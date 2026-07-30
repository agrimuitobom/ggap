// src/pages/Trainings/TrainingItemsManager.jsx
// 教育訓練計画（項目マスタ）の管理と、年度内の実施状況の確認。
// 「計画した項目を実施できているか」が一目で分かるようにする。
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  TRAINING_FREQUENCIES,
  getTrainingItems,
  saveTrainingItem,
  deleteTrainingItem,
  seedDefaultTrainingItems,
  summarizeItemProgress,
  fiscalYearOf
} from '../../services/trainingItemService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const emptyForm = { code: '', title: '', frequency: '実習の都度', description: '' };

const chip = (active) =>
  `px-3 py-2 rounded-full border text-sm ${
    active ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
  }`;

const TrainingItemsManager = () => {
  const { currentOrganization, isMember } = useOrganization();
  const [items, setItems] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const formRef = useRef(null);

  const fiscalYear = fiscalYearOf(new Date());

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [itemList, trainingSnap] = await Promise.all([
        getTrainingItems(currentOrganization.id),
        getDocs(query(collection(db, 'trainings'), where('organizationId', '==', currentOrganization.id)))
      ]);
      setItems(itemList);
      setTrainings(trainingSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        trainingDate: d.data().trainingDate?.toDate ? d.data().trainingDate.toDate() : null
      })));
    } catch (err) {
      firestoreLogger.error('教育訓練項目の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  const progress = summarizeItemProgress(items, trainings, fiscalYear);
  const notDone = progress.filter((p) => p.count === 0);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      code: item.code || '',
      title: item.title || '',
      frequency: item.frequency || '',
      description: item.description || ''
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('項目名を入力してください');
      return;
    }
    setSaving(true);
    try {
      const order = editingId ? items.find((i) => i.id === editingId)?.order ?? 0 : items.length;
      await saveTrainingItem(currentOrganization.id, editingId, { ...form, order });
      toast.success(editingId ? '項目を更新しました' : '項目を追加しました');
      resetForm();
      await load();
    } catch (err) {
      firestoreLogger.error('教育訓練項目の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`「${item.title}」を削除しますか？\n過去の実施記録は残ります。`)) return;
    try {
      await deleteTrainingItem(item.id);
      toast.success('削除しました');
      await load();
    } catch (err) {
      firestoreLogger.error('教育訓練項目の削除エラー', { itemId: item.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDefaultTrainingItems(currentOrganization.id);
      await load();
      toast.success('計画の項目①〜⑩を読み込みました');
    } catch (err) {
      firestoreLogger.error('標準項目の登録エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('登録中にエラーが発生しました');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-24">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">📚 教育訓練計画（項目）</h1>
        <Link to="/trainings" className="text-sm text-blue-600 hover:text-blue-800 underline">
          実施記録へ
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        年間で指導する項目を登録しておくと、実施記録がタップだけで済みます。
        下の表で「計画どおり実施できているか」も確認できます。
      </p>

      {/* 今年度の実施状況 */}
      {items.length > 0 && (
        <>
          {notDone.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 text-amber-800 rounded-lg p-3 mb-4 text-sm">
              ⚠️ {fiscalYear}年度にまだ実施記録がない項目が{notDone.length}件あります（
              {notDone.slice(0, 3).map((p) => p.item.title).join('、')}
              {notDone.length > 3 ? ' ほか' : ''}）。
            </div>
          )}
          <h2 className="font-bold text-gray-700 mb-2">{fiscalYear}年度の実施状況</h2>
          <div className="bg-white shadow rounded-lg overflow-x-auto mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-3 text-left whitespace-nowrap">項目</th>
                  <th className="py-2 px-3 text-left whitespace-nowrap">頻度</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">実施回数</th>
                  <th className="py-2 px-3 text-left whitespace-nowrap">最終実施日</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p) => (
                  <tr key={p.item.id} className={`border-t ${p.count === 0 ? 'bg-amber-50' : ''}`}>
                    <td className="py-2 px-3">
                      {p.item.code && <span className="text-gray-500 mr-1">{p.item.code}</span>}
                      {p.item.title}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-gray-600">{p.item.frequency || '-'}</td>
                    <td className={`py-2 px-3 text-right font-bold ${p.count === 0 ? 'text-amber-700' : 'text-green-700'}`}>
                      {p.count}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {p.lastDate ? p.lastDate.toLocaleDateString('ja-JP') : '未実施'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 項目の追加・編集 */}
      {isMember && (
        <form ref={formRef} onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-4 mb-6">
          <h2 className="font-bold mb-3">{editingId ? '項目を編集' : '項目を追加'}</h2>
          <div className="flex gap-2 mb-3">
            <div className="w-20">
              <label className="block text-sm font-bold text-gray-700 mb-1">記号</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="①"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                項目名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="例: 農場全体の衛生管理"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold text-gray-700 mb-1">実施頻度</label>
            <div className="flex flex-wrap gap-2">
              {TRAINING_FREQUENCIES.map((f) => (
                <button key={f} type="button" onClick={() => setForm({ ...form, frequency: f })} className={chip(form.frequency === f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">指導内容のメモ</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="どんな内容を教えるか"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50">
              {saving ? '保存中...' : editingId ? '更新する' : '追加する'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded hover:bg-gray-300">
                キャンセル
              </button>
            )}
          </div>
        </form>
      )}

      {/* 項目一覧 */}
      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-2">教育訓練の項目がまだありません。</p>
          {isMember && (
            <button onClick={handleSeed} disabled={seeding} className="px-6 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50">
              {seeding ? '読み込み中...' : '計画の項目①〜⑩を読み込む'}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg divide-y">
          {items.map((item) => (
            <div key={item.id} className="flex items-center p-4">
              <div className="flex-1">
                <p className="font-medium">
                  {item.code && <span className="text-gray-500 mr-1">{item.code}</span>}
                  {item.title}
                </p>
                <p className="text-xs text-gray-500">
                  {item.frequency || '頻度未設定'}
                  {item.description && ` ・ ${item.description}`}
                </p>
              </div>
              {isMember && (
                <>
                  <button onClick={() => startEdit(item)} className="text-blue-600 hover:text-blue-800 text-sm mr-4">編集</button>
                  <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800 text-sm">削除</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrainingItemsManager;
