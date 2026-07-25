// src/pages/Materials/MaterialDisposals.jsx
// 資材の保管場所と廃棄・処分の記録。
// GAP認証では農薬の施錠保管、期限切れ農薬・空容器の適切な処理、
// 廃棄物の分別・処理記録が確認される。
import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import VoiceInput from '../../components/common/VoiceInput';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const MATERIAL_TYPES = ['農薬', '肥料', '種子・苗', '培地', '包装資材', 'その他'];
const DISPOSAL_REASONS = ['有効期限切れ', '空容器', '残液', '破損・汚損', '使用中止', 'その他'];
const DISPOSAL_METHODS = [
  '産業廃棄物として処理業者に委託',
  '販売店・メーカーに返却',
  '自治体の回収に出す',
  '三度洗い後に分別廃棄',
  'その他'
];

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const MaterialDisposals = () => {
  const { userProfile } = useAuth();
  const { currentOrganization, isMember } = useOrganization();

  const [disposals, setDisposals] = useState([]);
  const [storages, setStorages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('disposals'); // disposals | storages

  // 廃棄フォーム
  const [dDate, setDDate] = useState(toDateString(new Date()));
  const [dType, setDType] = useState('農薬');
  const [dName, setDName] = useState('');
  const [dAmount, setDAmount] = useState('');
  const [dUnit, setDUnit] = useState('L');
  const [dReason, setDReason] = useState('有効期限切れ');
  const [dMethod, setDMethod] = useState(DISPOSAL_METHODS[0]);
  const [dNotes, setDNotes] = useState('');

  // 保管場所フォーム
  const [sName, setSName] = useState('');
  const [sTypes, setSTypes] = useState([]);
  const [sLockable, setSLockable] = useState(true);
  const [sNotes, setSNotes] = useState('');

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [dSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, 'materialDisposals'), where('organizationId', '==', currentOrganization.id))),
        getDocs(query(collection(db, 'storageLocations'), where('organizationId', '==', currentOrganization.id)))
      ]);
      const dList = dSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate ? d.data().date.toDate() : null
      }));
      dList.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      setDisposals(dList);
      setStorages(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      firestoreLogger.error('資材管理データの取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  const handleSaveDisposal = async () => {
    if (!dName.trim() || !currentOrganization) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'materialDisposals'), {
        organizationId: currentOrganization.id,
        date: new Date(`${dDate}T00:00:00`),
        materialType: dType,
        materialName: dName.trim(),
        amount: dAmount !== '' ? Number(dAmount) : null,
        unit: dUnit,
        reason: dReason,
        method: dMethod,
        notes: dNotes,
        recordedByName: userProfile?.name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('廃棄記録を保存しました');
      setDName(''); setDAmount(''); setDNotes('');
      await load();
    } catch (err) {
      firestoreLogger.error('廃棄記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStorage = async () => {
    if (!sName.trim() || !currentOrganization) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'storageLocations'), {
        organizationId: currentOrganization.id,
        name: sName.trim(),
        materialTypes: sTypes,
        lockable: sLockable,
        notes: sNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('保管場所を登録しました');
      setSName(''); setSTypes([]); setSNotes(''); setSLockable(true);
      await load();
    } catch (err) {
      firestoreLogger.error('保管場所の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (collectionName, id) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast.success('削除しました');
      await load();
    } catch (err) {
      firestoreLogger.error('資材記録の削除エラー', { collectionName, id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const chip = (active) =>
    `px-3 py-2 rounded-full border text-sm ${
      active ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
    }`;

  // 農薬の保管場所に施錠できない場所があれば注意喚起
  const unlockablePesticideStorage = storages.filter(
    (s) => s.materialTypes?.includes('農薬') && !s.lockable
  );

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-24">
      <h1 className="text-2xl font-bold mb-1">📦 資材の保管・廃棄記録</h1>
      <p className="text-sm text-gray-500 mb-4">
        資材の保管場所と、期限切れ農薬・空容器などの処分を記録します。
      </p>

      {unlockablePesticideStorage.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 text-amber-800 rounded-lg p-3 mb-4 text-sm">
          ⚠️ 農薬を保管する場所のうち、施錠できない場所が登録されています（
          {unlockablePesticideStorage.map((s) => s.name).join('、')}）。
          農薬は施錠できる場所での保管が求められます。
        </div>
      )}

      <div className="flex rounded-lg overflow-hidden border border-gray-300 mb-4 w-fit">
        <button
          onClick={() => setTab('disposals')}
          className={`px-4 py-2 text-sm ${tab === 'disposals' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
        >
          廃棄・処分記録
        </button>
        <button
          onClick={() => setTab('storages')}
          className={`px-4 py-2 text-sm ${tab === 'storages' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
        >
          保管場所
        </button>
      </div>

      {tab === 'disposals' ? (
        <>
          {isMember && (
            <div className="bg-white shadow rounded-lg p-4 mb-6">
              <h2 className="font-bold mb-3">廃棄・処分を記録</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">処分日</label>
                  <input type="date" value={dDate} max={toDateString(new Date())} onChange={(e) => setDDate(e.target.value)} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">資材の種類</label>
                  <select value={dType} onChange={(e) => setDType(e.target.value)} className="w-full border rounded px-3 py-2">
                    {MATERIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  資材名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={dName}
                  onChange={(e) => setDName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="例: スミチオン乳剤（空容器）"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">数量</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={dAmount}
                    onChange={(e) => setDAmount(e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="数量"
                  />
                  <select value={dUnit} onChange={(e) => setDUnit(e.target.value)} className="border rounded px-3 py-2">
                    {['L', 'ml', 'kg', 'g', '本', '袋', '個'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">処分の理由</label>
                <div className="flex flex-wrap gap-2">
                  {DISPOSAL_REASONS.map((r) => (
                    <button key={r} type="button" onClick={() => setDReason(r)} className={chip(dReason === r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">処分方法</label>
                <select value={dMethod} onChange={(e) => setDMethod(e.target.value)} className="w-full border rounded px-3 py-2">
                  {DISPOSAL_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">備考（委託先・伝票番号など）</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dNotes}
                    onChange={(e) => setDNotes(e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="例: ○○産業に委託、マニフェスト番号 12345"
                  />
                  <VoiceInput value={dNotes} onChange={setDNotes} />
                </div>
              </div>
              <button
                onClick={handleSaveDisposal}
                disabled={!dName.trim() || saving}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '記録する'}
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : disposals.length === 0 ? (
            <p className="text-sm text-gray-500">まだ廃棄記録がありません。</p>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-3 text-left whitespace-nowrap">処分日</th>
                    <th className="py-2 px-3 text-left whitespace-nowrap">種類</th>
                    <th className="py-2 px-3 text-left whitespace-nowrap">資材名</th>
                    <th className="py-2 px-3 text-left whitespace-nowrap">数量</th>
                    <th className="py-2 px-3 text-left whitespace-nowrap">理由</th>
                    <th className="py-2 px-3 text-left">処分方法</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {disposals.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="py-2 px-3 whitespace-nowrap">{d.date?.toLocaleDateString('ja-JP') || '-'}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{d.materialType}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{d.materialName}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{d.amount != null ? `${d.amount}${d.unit}` : '-'}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{d.reason}</td>
                      <td className="py-2 px-3 max-w-xs truncate" title={`${d.method} ${d.notes || ''}`}>{d.method}</td>
                      <td className="py-2 px-3">
                        {isMember && (
                          <button onClick={() => handleDelete('materialDisposals', d.id)} className="text-red-600 hover:text-red-800 text-xs">
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
        </>
      ) : (
        <>
          {isMember && (
            <div className="bg-white shadow rounded-lg p-4 mb-6">
              <h2 className="font-bold mb-3">保管場所を登録</h2>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  場所の名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="例: 農薬保管庫（資材管理室）"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">保管する資材（複数選択可）</label>
                <div className="flex flex-wrap gap-2">
                  {MATERIAL_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSTypes(sTypes.includes(t) ? sTypes.filter((v) => v !== t) : [...sTypes, t])}
                      className={chip(sTypes.includes(t))}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sLockable} onChange={(e) => setSLockable(e.target.checked)} className="h-4 w-4" />
                  施錠できる（農薬保管では必須）
                </label>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">備考</label>
                <input
                  type="text"
                  value={sNotes}
                  onChange={(e) => setSNotes(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="例: 換気あり、鍵は事務室で管理、農薬と肥料は棚を分けている"
                />
              </div>
              <button
                onClick={handleSaveStorage}
                disabled={!sName.trim() || saving}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '登録する'}
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : storages.length === 0 ? (
            <p className="text-sm text-gray-500">保管場所がまだ登録されていません。</p>
          ) : (
            <div className="bg-white shadow rounded-lg divide-y">
              {storages.map((s) => (
                <div key={s.id} className="p-4 flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      {s.name}
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        s.lockable ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {s.lockable ? '🔒 施錠可' : '施錠なし'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      保管資材: {s.materialTypes?.length ? s.materialTypes.join('、') : '未設定'}
                    </p>
                    {s.notes && <p className="text-xs text-gray-500">{s.notes}</p>}
                  </div>
                  {isMember && (
                    <button onClick={() => handleDelete('storageLocations', s.id)} className="text-red-600 hover:text-red-800 text-sm shrink-0 ml-3">
                      削除
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MaterialDisposals;
