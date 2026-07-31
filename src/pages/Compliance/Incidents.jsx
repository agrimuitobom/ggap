// src/pages/Compliance/Incidents.jsx
// 事故・ヒヤリハット記録。
// GAP認証では労働安全衛生の取り組みとして、事故発生時の記録と
// 再発防止策、ヒヤリハットの収集が確認される。
import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { moveToTrash } from '../../services/trashService';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import VoiceInput from '../../components/common/VoiceInput';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const KINDS = ['ヒヤリハット', '軽微な事故', '負傷を伴う事故'];
const CATEGORIES = ['転倒・転落', '刃物・工具', '機械・車両', '農薬・薬品', '熱中症・体調', '電気', 'その他'];

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const chip = (active) =>
  `px-3 py-2 rounded-full border text-sm ${
    active ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
  }`;

const Incidents = () => {
  const { userProfile } = useAuth();
  const { currentOrganization, isMember } = useOrganization();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(toDateString(new Date()));
  const [kind, setKind] = useState('ヒヤリハット');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [place, setPlace] = useState('');
  const [content, setContent] = useState('');
  const [cause, setCause] = useState('');
  const [prevention, setPrevention] = useState('');
  const [treatment, setTreatment] = useState('');

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const snap = await getDocs(query(
        collection(db, 'incidents'),
        where('organizationId', '==', currentOrganization.id)
      ));
      const list = snap.docs.map((d) => ({
        id: d.id, ...d.data(), date: d.data().date?.toDate ? d.data().date.toDate() : null
      }));
      list.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      setIncidents(list);
    } catch (err) {
      firestoreLogger.error('事故・ヒヤリハット記録の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!content.trim() || !currentOrganization) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'incidents'), {
        organizationId: currentOrganization.id,
        date: new Date(`${date}T00:00:00`),
        kind,
        category,
        place,
        content: content.trim(),
        cause,
        prevention,
        treatment,
        recordedByName: userProfile?.name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('記録しました');
      setPlace(''); setContent(''); setCause(''); setPrevention(''); setTreatment('');
      await load();
    } catch (err) {
      firestoreLogger.error('事故・ヒヤリハット記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    try {
      await moveToTrash('incidents', id, currentOrganization.id, userProfile?.name);
      setIncidents((prev) => prev.filter((i) => i.id !== id));
      toast.success('削除しました');
    } catch (err) {
      firestoreLogger.error('事故記録の削除エラー', { id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-24">
      <h1 className="text-2xl font-bold mb-1">⚠️ 事故・ヒヤリハット記録</h1>
      <p className="text-sm text-gray-500 mb-4">
        作業中の事故や「危なかった」出来事を記録し、再発防止につなげます。
        労働安全衛生の取り組みを示す記録になります。
      </p>

      {isMember && (
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <h2 className="font-bold mb-3">記録する</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">発生日</label>
              <input type="date" value={date} max={toDateString(new Date())} onChange={(e) => setDate(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">発生場所</label>
              <input type="text" value={place} onChange={(e) => setPlace(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="例: 水耕ハウス内 通路" />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold text-gray-700 mb-1">区分</label>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={chip(kind === k)}>{k}</button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold text-gray-700 mb-1">分類</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} className={chip(category === c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              内容 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input type="text" value={content} onChange={(e) => setContent(e.target.value)} className="flex-1 border rounded px-3 py-2" placeholder="何が起きたか" />
              <VoiceInput value={content} onChange={setContent} />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold text-gray-700 mb-1">原因</label>
            <input type="text" value={cause} onChange={(e) => setCause(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="なぜ起きたか" />
          </div>
          {kind !== 'ヒヤリハット' && (
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">応急処置・受診の有無</label>
              <input type="text" value={treatment} onChange={(e) => setTreatment(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="例: 消毒し絆創膏。受診なし" />
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">再発防止策</label>
            <div className="flex gap-2">
              <input type="text" value={prevention} onChange={(e) => setPrevention(e.target.value)} className="flex-1 border rounded px-3 py-2" placeholder="今後どうするか" />
              <VoiceInput value={prevention} onChange={setPrevention} />
            </div>
          </div>
          <button onClick={handleSave} disabled={!content.trim() || saving} className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50">
            {saving ? '保存中...' : '記録する'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : incidents.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          まだ記録がありません。ヒヤリハットも記録しておくと安全管理の証拠になります。
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg divide-y">
          {incidents.map((i) => (
            <div key={i.id} className="p-4 flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm">
                  <span className="text-gray-500">{i.date?.toLocaleDateString('ja-JP')}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    i.kind === '負傷を伴う事故' ? 'bg-red-100 text-red-800'
                      : i.kind === '軽微な事故' ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>{i.kind}</span>
                  <span className="ml-1 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{i.category}</span>
                </p>
                <p className="font-medium mt-1">{i.content}</p>
                {i.place && <p className="text-xs text-gray-500">場所: {i.place}</p>}
                {i.cause && <p className="text-xs text-gray-600">原因: {i.cause}</p>}
                {i.treatment && <p className="text-xs text-gray-600">処置: {i.treatment}</p>}
                {i.prevention && <p className="text-xs text-green-700">再発防止: {i.prevention}</p>}
              </div>
              {isMember && (
                <button onClick={() => handleDelete(i.id)} className="text-red-600 hover:text-red-800 text-xs shrink-0 ml-3">削除</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Incidents;
