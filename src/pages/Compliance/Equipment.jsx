// src/pages/Compliance/Equipment.jsx
// 機器の登録と校正・点検記録。
// GAP認証では、計量器・EC/pH計・散布器具などの校正／点検の実施と
// 記録の保管が求められる（測定値の信頼性を担保するため）。
import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const EQUIPMENT_TYPES = ['EC計', 'pH計', 'はかり・計量器', '噴霧器・散布機', '温湿度計', 'その他'];
const CHECK_TYPES = ['校正', '点検', '修理', '交換'];

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const chip = (active) =>
  `px-3 py-2 rounded-full border text-sm ${
    active ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
  }`;

const Equipment = () => {
  const { userProfile } = useAuth();
  const { currentOrganization, isMember } = useOrganization();

  const [equipments, setEquipments] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddEquipment, setShowAddEquipment] = useState(false);

  // 機器登録フォーム
  const [eName, setEName] = useState('');
  const [eType, setEType] = useState(EQUIPMENT_TYPES[0]);
  const [eIntervalDays, setEIntervalDays] = useState('180');

  // 校正・点検フォーム
  const [rEquipmentId, setREquipmentId] = useState('');
  const [rDate, setRDate] = useState(toDateString(new Date()));
  const [rType, setRType] = useState('校正');
  const [rResult, setRResult] = useState('正常');
  const [rDetail, setRDetail] = useState('');

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [eSnap, rSnap] = await Promise.all([
        getDocs(query(collection(db, 'equipments'), where('organizationId', '==', currentOrganization.id))),
        getDocs(query(collection(db, 'equipmentChecks'), where('organizationId', '==', currentOrganization.id)))
      ]);
      setEquipments(eSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const list = rSnap.docs.map((d) => ({
        id: d.id, ...d.data(), date: d.data().date?.toDate ? d.data().date.toDate() : null
      }));
      list.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      setRecords(list);
    } catch (err) {
      firestoreLogger.error('機器管理データの取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  const handleSaveEquipment = async () => {
    if (!eName.trim() || !currentOrganization) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'equipments'), {
        organizationId: currentOrganization.id,
        name: eName.trim(),
        type: eType,
        // 次回実施日の目安に使う（日数）
        intervalDays: eIntervalDays !== '' ? Number(eIntervalDays) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('機器を登録しました');
      setEName(''); setShowAddEquipment(false);
      await load();
    } catch (err) {
      firestoreLogger.error('機器の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRecord = async () => {
    if (!rEquipmentId || !currentOrganization) return;
    setSaving(true);
    try {
      const eq = equipments.find((e) => e.id === rEquipmentId);
      await addDoc(collection(db, 'equipmentChecks'), {
        organizationId: currentOrganization.id,
        equipmentId: rEquipmentId,
        equipmentName: eq?.name || '',
        date: new Date(`${rDate}T00:00:00`),
        checkType: rType,
        result: rResult,
        detail: rDetail,
        recordedByName: userProfile?.name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('校正・点検を記録しました');
      setRDetail(''); setRResult('正常');
      await load();
    } catch (err) {
      firestoreLogger.error('校正・点検記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (collectionName, id) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      await load();
      toast.success('削除しました');
    } catch (err) {
      firestoreLogger.error('機器記録の削除エラー', { collectionName, id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  // 機器ごとの最終実施日と次回予定を算出
  const today = new Date();
  const equipmentStatus = equipments.map((eq) => {
    const last = records.find((r) => r.equipmentId === eq.id)?.date || null;
    const interval = eq.intervalDays || 0;
    let nextDue = null;
    if (last && interval) {
      nextDue = new Date(last.getTime() + interval * 24 * 60 * 60 * 1000);
    }
    return {
      ...eq,
      last,
      nextDue,
      overdue: !last || (nextDue && nextDue < today)
    };
  });
  const overdueList = equipmentStatus.filter((e) => e.overdue);

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-24">
      <h1 className="text-2xl font-bold mb-1">🔧 機器の校正・点検記録</h1>
      <p className="text-sm text-gray-500 mb-4">
        EC計・pH計・はかり・噴霧器などの校正／点検を記録します。測定値の信頼性を示す記録になります。
      </p>

      {overdueList.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 text-amber-800 rounded-lg p-3 mb-4 text-sm">
          ⏰ 校正・点検が未実施または予定日を過ぎている機器があります（
          {overdueList.map((e) => e.name).join('、')}）。
        </div>
      )}

      {/* 機器一覧 */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold">登録機器</h2>
          {isMember && (
            <button
              onClick={() => setShowAddEquipment(!showAddEquipment)}
              className="text-sm px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              {showAddEquipment ? '閉じる' : '＋ 機器を追加'}
            </button>
          )}
        </div>

        {showAddEquipment && isMember && (
          <div className="border rounded p-3 mb-3 bg-gray-50">
            <div className="mb-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">機器名</label>
              <input type="text" value={eName} onChange={(e) => setEName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="例: ハンディEC計（HI98301）" />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">種類</label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setEType(t)} className={chip(eType === t)}>{t}</button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">校正・点検の間隔（日）</label>
              <input type="number" min="1" value={eIntervalDays} onChange={(e) => setEIntervalDays(e.target.value)} className="w-40 border rounded px-3 py-2" />
              <p className="text-xs text-gray-500 mt-1">この日数を過ぎると「要実施」として表示されます。</p>
            </div>
            <button onClick={handleSaveEquipment} disabled={!eName.trim() || saving} className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded hover:bg-green-700 disabled:opacity-50">
              登録する
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">読み込み中...</p>
        ) : equipments.length === 0 ? (
          <p className="text-sm text-gray-500">機器がまだ登録されていません。</p>
        ) : (
          <div className="divide-y">
            {equipmentStatus.map((eq) => (
              <div key={eq.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {eq.name}
                    <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{eq.type}</span>
                    {eq.overdue && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">要実施</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    最終実施: {eq.last ? eq.last.toLocaleDateString('ja-JP') : '未実施'}
                    {eq.nextDue && ` ・ 次回目安: ${eq.nextDue.toLocaleDateString('ja-JP')}`}
                  </p>
                </div>
                {isMember && (
                  <button onClick={() => handleDelete('equipments', eq.id)} className="text-red-600 hover:text-red-800 text-xs shrink-0 ml-3">削除</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 校正・点検の記録 */}
      {isMember && equipments.length > 0 && (
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <h2 className="font-bold mb-3">校正・点検を記録</h2>
          <div className="mb-3">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              対象機器 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {equipments.map((eq) => (
                <button key={eq.id} type="button" onClick={() => setREquipmentId(eq.id)} className={chip(rEquipmentId === eq.id)}>
                  {eq.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">実施日</label>
              <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">種別</label>
              <div className="flex flex-wrap gap-2">
                {CHECK_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setRType(t)} className={chip(rType === t)}>{t}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold text-gray-700 mb-1">結果</label>
            <div className="flex gap-2">
              {['正常', '調整実施', '異常あり'].map((r) => (
                <button key={r} type="button" onClick={() => setRResult(r)} className={chip(rResult === r)}>{r}</button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">内容・使用した標準液など</label>
            <input type="text" value={rDetail} onChange={(e) => setRDetail(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="例: pH4.01/6.86標準液で2点校正、ずれなし" />
          </div>
          <button onClick={handleSaveRecord} disabled={!rEquipmentId || saving} className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50">
            {saving ? '保存中...' : '記録する'}
          </button>
        </div>
      )}

      <h2 className="font-bold text-gray-700 mb-2">校正・点検の履歴</h2>
      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500">まだ記録がありません。</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left whitespace-nowrap">実施日</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">機器</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">種別</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">結果</th>
                <th className="py-2 px-3 text-left">内容</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">実施者</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className={`border-t ${r.result === '異常あり' ? 'bg-red-50' : ''}`}>
                  <td className="py-2 px-3 whitespace-nowrap">{r.date?.toLocaleDateString('ja-JP') || '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.equipmentName}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.checkType}</td>
                  <td className={`py-2 px-3 whitespace-nowrap ${r.result === '異常あり' ? 'text-red-600 font-bold' : ''}`}>{r.result}</td>
                  <td className="py-2 px-3 max-w-xs truncate" title={r.detail}>{r.detail || '-'}</td>
                  <td className="py-2 px-3 whitespace-nowrap text-gray-500">{r.recordedByName || '-'}</td>
                  <td className="py-2 px-3">
                    {isMember && (
                      <button onClick={() => handleDelete('equipmentChecks', r.id)} className="text-red-600 hover:text-red-800 text-xs">削除</button>
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

export default Equipment;
