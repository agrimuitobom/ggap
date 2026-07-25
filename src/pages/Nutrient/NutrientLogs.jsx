// src/pages/Nutrient/NutrientLogs.jsx
// 養液管理記録（水耕栽培の中核記録）。
// EC・pH・水温・補給量を日々記録し、基準範囲外は警告する。
// GGAP審査では養液・用水の管理記録が求められるため、
// 「いつ・どの系統で・どんな値だったか・どう調整したか」を残す。
import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, where, orderBy, limit, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import VoiceInput from '../../components/common/VoiceInput';
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

const NutrientLogs = () => {
  const { currentUser, userProfile } = useAuth();
  const { currentOrganization, isMember } = useOrganization();

  const [fields, setFields] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dateStr, setDateStr] = useState(toDateString(new Date()));
  const [fieldId, setFieldId] = useState('');
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
      const [fieldsSnap, logsSnap] = await Promise.all([
        getDocs(query(collection(db, 'fields'), where('organizationId', '==', currentOrganization.id))),
        getDocs(query(
          collection(db, 'nutrientLogs'),
          where('organizationId', '==', currentOrganization.id),
          orderBy('date', 'desc'),
          limit(50)
        ))
      ]);
      setFields(fieldsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLogs(logsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate ? d.data().date.toDate() : null
      })));
    } catch (err) {
      firestoreLogger.error('養液管理記録の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { loadData(); }, [loadData]);

  const ecStatus = judge('ec', ec);
  const phStatus = judge('ph', ph);
  const tempStatus = judge('waterTemp', waterTemp);
  const hasWarning = [ecStatus, phStatus, tempStatus].some((s) => s === 'low' || s === 'high');

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
      await deleteDoc(doc(db, 'nutrientLogs', id));
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
              <p className="text-sm text-gray-500">圃場が登録されていません。</p>
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

          {/* 測定値 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {renderMeasureInput('ec', ec, setEc, '0.1')}
            {renderMeasureInput('ph', ph, setPh, '0.1')}
            {renderMeasureInput('waterTemp', waterTemp, setWaterTemp, '0.1')}
          </div>

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
      <h2 className="font-bold text-gray-700 mb-2">最近の記録</h2>
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
                  <td className="py-2 px-3 whitespace-nowrap">{log.fieldName || '-'}</td>
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
        </div>
      )}
    </div>
  );
};

export default NutrientLogs;
