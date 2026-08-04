// src/pages/Nutrient/NutrientLogs.jsx
// 養液管理記録（水耕栽培の中核記録）。
// EC・pH・水温・補給量を日々記録し、基準範囲外は警告する。
// GGAP審査では養液・用水の管理記録が求められるため、
// 「いつ・どの系統で・どんな値だったか・どう調整したか」を残す。
import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { moveToTrash } from '../../services/trashService';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import VoiceInput from '../../components/common/VoiceInput';
import { usesNutrientSolution } from '../../constants/cultivation';
import { getPlantings, plantingLabel } from '../../services/plantingService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

// 葉菜類（サラダ菜等）の一般的な管理目安。運用に合わせて調整可能。
const DEFAULT_RANGES = {
  ec: { min: 1.0, max: 2.5, unit: 'mS/cm', label: 'EC（電気伝導度）' },
  ph: { min: 5.5, max: 6.5, unit: '', label: 'pH' },
  waterTemp: { min: 15, max: 28, unit: '℃', label: '水温' }
};

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const judge = (key, value) => {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  const range = DEFAULT_RANGES[key];
  if (num < range.min) return 'low';
  if (num > range.max) return 'high';
  return 'ok';
};

// 一度に読み込む件数。これを超える分は「もっと見る」で追加読み込みする。
// 以前は50件で打ち切っており、それ以上の記録が画面に出ないため
// 「保存できていない」ように見えていた。
const PAGE_SIZE = 50;

const NutrientLogs = () => {
  const { currentUser, userProfile } = useAuth();
  const { currentOrganization, isMember } = useOrganization();

  const [fields, setFields] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dateStr, setDateStr] = useState(toDateString(new Date()));
  const [fieldId, setFieldId] = useState('');
  const [plantingId, setPlantingId] = useState('');
  const [ec, setEc] = useState('');
  const [ph, setPh] = useState('');
  const [waterTemp, setWaterTemp] = useState('');
  const [replenishAmount, setReplenishAmount] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [fieldsSnap, logsSnap, plantingList] = await Promise.all([
        getDocs(query(collection(db, 'fields'), where('organizationId', '==', currentOrganization.id))),
        getDocs(query(
          collection(db, 'nutrientLogs'),
          where('organizationId', '==', currentOrganization.id),
          orderBy('date', 'desc'),
          limit(PAGE_SIZE)
        )),
        getPlantings(currentOrganization.id)
      ]);

      // 全体で何件あるかを表示する（画面に出ている件数＝保存件数ではないため）
      try {
        const countSnap = await getCountFromServer(query(
          collection(db, 'nutrientLogs'),
          where('organizationId', '==', currentOrganization.id)
        ));
        setTotalCount(countSnap.data().count);
      } catch (countErr) {
        // 件数が取れなくても記録の表示自体は続ける
        setTotalCount(null);
      }

      // 処理区ごとに養液の目標ECが異なるため、栽培中の作付を選べるようにする
      setPlantings(plantingList.filter((p) => p.status === '栽培中'));
      // 養液管理の対象は水耕・養液土耕のみ。
      // 栽培方式が未設定の圃場は、設定前でも記録できるよう含める。
      setFields(
        fieldsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((f) => !f.cultivationType || usesNutrientSolution(f.cultivationType))
      );
      setLogs(logsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate ? d.data().date.toDate() : null
      })));
      setLastDoc(logsSnap.docs[logsSnap.docs.length - 1] || null);
      setHasMore(logsSnap.docs.length === PAGE_SIZE);
    } catch (err) {
      firestoreLogger.error('養液管理記録の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { loadData(); }, [loadData]);

  /** 続きを読み込む（古い記録へさかのぼる） */
  const loadMore = async () => {
    if (!currentOrganization || !lastDoc || loadingMore) return;
    try {
      setLoadingMore(true);
      const snap = await getDocs(query(
        collection(db, 'nutrientLogs'),
        where('organizationId', '==', currentOrganization.id),
        orderBy('date', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      ));
      setLogs((prev) => [...prev, ...snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate ? d.data().date.toDate() : null
      }))]);
      setLastDoc(snap.docs[snap.docs.length - 1] || lastDoc);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      firestoreLogger.error('養液管理記録の追加取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('続きの読み込み中にエラーが発生しました');
    } finally {
      setLoadingMore(false);
    }
  };

  /** 全期間をCSVに書き出す（審査で全記録を提出できるように） */
  const exportCsv = async () => {
    if (!currentOrganization) return;
    try {
      setExporting(true);
      const snap = await getDocs(query(
        collection(db, 'nutrientLogs'),
        where('organizationId', '==', currentOrganization.id),
        orderBy('date', 'desc')
      ));
      const headers = ['測定日', '圃場・ベッド', '作付', '処理区', 'EC(mS/cm)', 'pH', '水温(℃)', '補給量(L)', '目標EC', '範囲外', '調整・処置', '備考', '記録者'];
      const rows = snap.docs.map((d) => {
        const v = d.data();
        const date = v.date?.toDate ? v.date.toDate() : null;
        return [
          date ? date.toLocaleDateString('ja-JP') : '',
          v.fieldName || '',
          v.plantingLabel || '',
          v.treatment || '',
          v.ec ?? '',
          v.ph ?? '',
          v.waterTemp ?? '',
          v.replenishAmount ?? '',
          v.targetEc ?? '',
          v.outOfRange ? '範囲外' : '',
          v.adjustment || '',
          v.notes || '',
          v.createdByName || ''
        ];
      });
      const csv = [headers, ...rows]
        .map((row) => row.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      // Excelで文字化けしないよう BOM を付ける
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `養液管理記録_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${rows.length}件を書き出しました`);
    } catch (err) {
      firestoreLogger.error('養液管理記録のCSV書き出しエラー', { organizationId: currentOrganization?.id }, err);
      toast.error('書き出し中にエラーが発生しました');
    } finally {
      setExporting(false);
    }
  };

  const selectedPlanting = plantings.find((p) => p.id === plantingId);
  // 目標ECが設定されていれば、その値からの乖離で判定する（許容幅 ±0.3 mS/cm）
  const targetEc = selectedPlanting?.targetEc ?? null;
  const ecDeviation = (targetEc != null && ec !== '') ? Number(ec) - targetEc : null;
  const offTarget = ecDeviation != null && Math.abs(ecDeviation) > 0.3;

  const ecStatus = judge('ec', ec);
  const phStatus = judge('ph', ph);
  const tempStatus = judge('waterTemp', waterTemp);
  const hasWarning =
    [ecStatus, phStatus, tempStatus].some((s) => s === 'low' || s === 'high') || offTarget;

  const canSave = fieldId && (ec !== '' || ph !== '' || waterTemp !== '') && !saving;

  const handleSave = async () => {
    if (!canSave || !currentOrganization) return;
    setSaving(true);
    try {
      const selectedField = fields.find((f) => f.id === fieldId);
      await addDoc(collection(db, 'nutrientLogs'), {
        organizationId: currentOrganization.id,
        date: new Date(`${dateStr}T00:00:00`),
        fieldId,
        fieldName: selectedField?.name || '',
        // 作付（処理区）に紐づけると、処理区ごとのEC推移が比較できる
        plantingId: plantingId || null,
        plantingLabel: selectedPlanting ? plantingLabel(selectedPlanting) : '',
        treatment: selectedPlanting?.treatment || '',
        targetEc: targetEc,
        ec: ec !== '' ? Number(ec) : null,
        ph: ph !== '' ? Number(ph) : null,
        waterTemp: waterTemp !== '' ? Number(waterTemp) : null,
        replenishAmount: replenishAmount !== '' ? Number(replenishAmount) : null,
        adjustment,
        notes,
        // 基準範囲外だったかを記録に残す（審査時に是正の説明ができるように）
        outOfRange: hasWarning,
        createdByUid: currentUser?.uid || null,
        createdByName: userProfile?.name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('養液管理記録を保存しました');
      setEc(''); setPh(''); setWaterTemp(''); setReplenishAmount(''); setAdjustment(''); setNotes('');
      // 圃場・作付の選択は残し、連続して記録できるようにする
      await loadData();
    } catch (err) {
      firestoreLogger.error('養液管理記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    try {
      await moveToTrash('nutrientLogs', id, currentOrganization.id, userProfile?.name);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast.success('削除しました');
    } catch (err) {
      firestoreLogger.error('養液管理記録の削除エラー', { logId: id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const renderMeasureInput = (key, value, setValue, step) => {
    const status = judge(key, value);
    const range = DEFAULT_RANGES[key];
    return (
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          {range.label} {range.unit && `(${range.unit})`}
        </label>
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`w-full border-2 rounded px-3 py-2 focus:outline-none ${
            status === 'ok' ? 'border-green-400'
              : status ? 'border-red-400 bg-red-50'
              : 'border-gray-300'
          }`}
          placeholder={`目安 ${range.min}〜${range.max}`}
        />
        {status && status !== 'ok' && (
          <p className="text-xs text-red-600 mt-1">
            ⚠️ 目安（{range.min}〜{range.max}）より{status === 'low' ? '低い' : '高い'}です
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-24">
      <h1 className="text-2xl font-bold mb-1">💧 養液管理記録</h1>
      <p className="text-sm text-gray-500 mb-4">
        EC・pH・水温を記録します。目安の範囲外になった場合は警告し、記録にも残します。
      </p>

      {isMember && (
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          {/* 日付 */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">測定日</label>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => setDateStr(toDateString(new Date()))}
                className={`px-4 py-2 rounded-full border text-sm ${
                  dateStr === toDateString(new Date())
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                今日
              </button>
              <input
                type="date"
                value={dateStr}
                max={toDateString(new Date())}
                onChange={(e) => setDateStr(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 圃場（栽培系統） */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              対象の圃場・ベッド <span className="text-red-500">*</span>
            </label>
            {fields.length === 0 ? (
              <p className="text-sm text-gray-500">
                養液管理の対象となる圃場がありません。圃場管理で栽培方式を「水耕」または「養液土耕」に設定してください。
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {fields.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFieldId(f.id)}
                    className={`touch-target p-3 rounded-lg border-2 text-sm ${
                      fieldId === f.id
                        ? 'border-green-600 bg-green-50 text-green-800 font-bold'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 作付（処理区）: 同じ圃場に処理区が複数ある場合、どの区の養液かを記録する */}
          {fieldId && plantings.filter((p) => p.fieldId === fieldId).length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-1">作付（処理区）</label>
              <div className="flex flex-wrap gap-2">
                {plantings.filter((p) => p.fieldId === fieldId).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlantingId(plantingId === p.id ? '' : p.id)}
                    className={`px-3 py-2 rounded-full border text-sm ${
                      plantingId === p.id
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {plantingLabel(p)}
                    {p.targetEc != null && (
                      <span className={plantingId === p.id ? 'text-green-100' : 'text-gray-500'}>
                        {' '}(目標EC {p.targetEc})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 測定値 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {renderMeasureInput('ec', ec, setEc, '0.1')}
            {renderMeasureInput('ph', ph, setPh, '0.1')}
            {renderMeasureInput('waterTemp', waterTemp, setWaterTemp, '0.1')}
          </div>

          {/* 目標ECとの差 */}
          {targetEc != null && ec !== '' && (
            <div className={`rounded p-3 mb-4 text-sm border ${
              offTarget ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-green-50 border-green-300 text-green-800'
            }`}>
              目標EC {targetEc} に対して実測 {ec}（差 {ecDeviation > 0 ? '+' : ''}{ecDeviation.toFixed(1)}）
              {offTarget && ' — 目標から離れています。調整内容を記入しておきましょう。'}
            </div>
          )}

          {/* 補給量・調整内容 */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">補給・給液量（L）</label>
            <input
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              value={replenishAmount}
              onChange={(e) => setReplenishAmount(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="例: 50"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">調整・処置の内容</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="例: 原液A液を200mL追加、pH下げ剤を10mL添加"
              />
              <VoiceInput value={adjustment} onChange={setAdjustment} />
            </div>
            {hasWarning && !adjustment && (
              <p className="text-xs text-amber-700 mt-1">
                目安の範囲外です。どのような処置をしたか記入しておくと、審査時の説明に使えます。
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">備考</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="メモ"
              />
              <VoiceInput value={notes} onChange={setNotes} />
            </div>
          </div>

          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className={`w-full py-4 rounded-lg font-bold text-white text-lg ${
              canSave ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {saving ? '保存中...' : '記録する'}
          </button>
        </div>
      )}

      {/* 記録一覧 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="font-bold text-gray-700">
          記録一覧
          {totalCount !== null && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              全{totalCount}件中 {logs.length}件を表示
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm disabled:opacity-50"
        >
          {exporting ? '書き出し中...' : '📄 CSVで全期間を書き出す'}
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500">まだ記録がありません。</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left whitespace-nowrap">日付</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">圃場</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">EC</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">pH</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">水温</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">補給</th>
                <th className="py-2 px-3 text-left">調整内容</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">記録者</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className={`border-t ${log.outOfRange ? 'bg-red-50' : ''}`}>
                  <td className="py-2 px-3 whitespace-nowrap">{log.date?.toLocaleDateString('ja-JP') || '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {log.fieldName || '-'}
                    {log.plantingLabel && (
                      <span className="block text-xs text-gray-500">{log.plantingLabel}</span>
                    )}
                  </td>
                  <td className={`py-2 px-3 whitespace-nowrap ${judge('ec', log.ec) === 'ok' ? '' : 'text-red-600 font-bold'}`}>
                    {log.ec ?? '-'}
                  </td>
                  <td className={`py-2 px-3 whitespace-nowrap ${judge('ph', log.ph) === 'ok' ? '' : 'text-red-600 font-bold'}`}>
                    {log.ph ?? '-'}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">{log.waterTemp != null ? `${log.waterTemp}℃` : '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{log.replenishAmount != null ? `${log.replenishAmount}L` : '-'}</td>
                  <td className="py-2 px-3 max-w-xs truncate" title={log.adjustment}>{log.adjustment || '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap text-gray-500">{log.createdByName || '-'}</td>
                  <td className="py-2 px-3">
                    {isMember && (
                      <button onClick={() => handleDelete(log.id)} className="text-red-600 hover:text-red-800 text-xs">
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore && (
            <div className="p-3 border-t text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm disabled:opacity-50"
              >
                {loadingMore ? '読み込み中...' : `もっと見る（あと${totalCount !== null ? totalCount - logs.length : '?'}件）`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NutrientLogs;
