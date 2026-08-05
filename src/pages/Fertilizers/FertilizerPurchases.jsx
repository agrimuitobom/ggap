// src/pages/Fertilizers/FertilizerPurchases.jsx
// 肥料の購入（入荷）記録と、重複した肥料登録の整理。
//
// 同じ肥料を買い足すたびに肥料マスタを新規登録すると、選択欄に同じ名前が
// 並んで区別できなくなる。肥料マスタは製品ごとに1つに保ち、買った回数は
// この購入記録として積み上げる。すでに重複してしまったものは、
// 下の「重複した肥料をまとめる」で1つに統合できる。
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getFertilizerPurchases,
  saveFertilizerPurchase,
  deleteFertilizerPurchase,
  findDuplicateFertilizers,
  mergeFertilizers
} from '../../services/fertilizerPurchaseService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const todayKey = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const emptyForm = () => ({
  fertilizerId: '',
  purchaseDate: todayKey(),
  amount: '',
  unit: 'kg',
  lotNumber: '',
  supplier: '',
  expiryDate: '',
  notes: ''
});

const formatDate = (value) => {
  if (!value) return '—';
  const d = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ja-JP');
};

const FertilizerPurchases = () => {
  const { currentOrganization, isMember, isAdmin } = useOrganization();
  const { userProfile } = useAuth();

  const [fertilizers, setFertilizers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [merging, setMerging] = useState('');
  const [keepChoice, setKeepChoice] = useState({});
  const formRef = useRef(null);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [fertilizerSnap, purchaseList] = await Promise.all([
        getDocs(query(
          collection(db, 'fertilizers'),
          where('organizationId', '==', currentOrganization.id)
        )),
        getFertilizerPurchases(currentOrganization.id)
      ]);
      setFertilizers(fertilizerSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPurchases(purchaseList);
    } catch (err) {
      firestoreLogger.error('肥料購入記録の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('購入記録の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    load();
  }, [load]);

  const duplicateGroups = findDuplicateFertilizers(fertilizers);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const startEdit = (purchase) => {
    setEditingId(purchase.id);
    setForm({
      fertilizerId: purchase.fertilizerId || '',
      purchaseDate: purchase.purchaseDate || todayKey(),
      amount: purchase.amount?.toString() || '',
      unit: purchase.unit || 'kg',
      lotNumber: purchase.lotNumber || '',
      supplier: purchase.supplier || '',
      expiryDate: purchase.expiryDate || '',
      notes: purchase.notes || ''
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fertilizerId || !Number(form.amount) || !currentOrganization) {
      toast.error('肥料と購入量を入力してください');
      return;
    }
    try {
      setSaving(true);
      const fertilizer = fertilizers.find((f) => f.id === form.fertilizerId);
      await saveFertilizerPurchase(currentOrganization.id, editingId, {
        ...form,
        fertilizerName: fertilizer?.name || ''
      });
      toast.success(editingId ? '購入記録を更新しました' : '購入記録を登録しました');
      resetForm();
      await load();
    } catch (err) {
      firestoreLogger.error('肥料購入記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (purchase) => {
    if (!window.confirm(`${purchase.fertilizerName} の購入記録をゴミ箱へ移動しますか？`)) return;
    try {
      await deleteFertilizerPurchase(purchase.id, currentOrganization.id, userProfile?.name || '');
      toast.success('ゴミ箱へ移動しました');
      await load();
    } catch (err) {
      firestoreLogger.error('肥料購入記録の削除エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const handleMerge = async (group, groupKey) => {
    const keepId = keepChoice[groupKey] || group[0].id;
    const keep = group.find((f) => f.id === keepId);
    const duplicates = group.filter((f) => f.id !== keepId);
    if (!keep || duplicates.length === 0) return;

    if (!window.confirm(
      `「${keep.name}」の重複した登録${duplicates.length}件を1つにまとめます。\n\n` +
      '・重複していた登録の購入情報は、購入記録として残します\n' +
      '・施肥記録と母液の材料は、残す方の肥料に付け替えます\n' +
      '・重複していた登録はゴミ箱へ移します（元に戻せます）\n\n' +
      '実行前にバックアップを取ることをおすすめします。よろしいですか？'
    )) {
      return;
    }

    try {
      setMerging(groupKey);
      const result = await mergeFertilizers(
        currentOrganization.id,
        keep,
        duplicates,
        userProfile?.name || ''
      );
      toast.success(
        `まとめました（購入記録 ${result.purchases}件 / 施肥記録 ${result.uses}件 / 母液 ${result.solutions}件を付け替え）`
      );
      await load();
    } catch (err) {
      firestoreLogger.error('肥料マスタの統合エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('統合中にエラーが発生しました');
    } finally {
      setMerging('');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-bold">肥料の購入（入荷）記録</h1>
        <Link to="/fertilizers" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm">
          肥料一覧へ
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-900">
        <p className="font-bold mb-1">同じ肥料を買い足すときは、肥料を新しく登録しないでください</p>
        <p>
          肥料一覧には<strong>製品ごとに1つ</strong>だけ登録し、買った回数はこの画面に購入記録として
          積み上げます。こうすると選択欄に同じ名前が並ばず、在庫も正しく積算されます。
          ロット番号や購入先は購入記録ごとに残せます。
        </p>
      </div>

      {/* 重複している肥料の統合 */}
      {duplicateGroups.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded p-4 mb-6">
          <h2 className="font-bold text-red-800 mb-2">
            ⚠️ 同じ名前で重複している肥料が{duplicateGroups.length}種類あります
          </h2>
          <p className="text-sm text-red-800 mb-3">
            残す1つを選んで「まとめる」を押すと、購入情報は購入記録として残したまま、
            施肥記録と母液の材料が残す方に付け替わります。
            重複していた登録はゴミ箱へ移るので、元に戻すこともできます。
          </p>
          {!isAdmin && (
            <p className="text-sm text-red-800 mb-3 font-medium">
              この操作は管理者のみ実行できます。
            </p>
          )}

          <div className="space-y-4">
            {duplicateGroups.map((group, gi) => {
              const groupKey = `${group[0].name}_${gi}`;
              const keepId = keepChoice[groupKey] || group[0].id;
              return (
                <div key={groupKey} className="bg-white rounded p-3">
                  <p className="font-bold mb-2">
                    {group[0].name}
                    {group[0].manufacturer && (
                      <span className="ml-2 font-normal text-sm text-gray-600">{group[0].manufacturer}</span>
                    )}
                    <span className="ml-2 font-normal text-sm text-gray-600">（{group.length}件）</span>
                  </p>
                  <div className="space-y-1 mb-3">
                    {group.map((f) => (
                      <label key={f.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name={groupKey}
                          checked={keepId === f.id}
                          onChange={() => setKeepChoice((prev) => ({ ...prev, [groupKey]: f.id }))}
                          className="h-4 w-4 mt-1"
                        />
                        <span>
                          購入日 {formatDate(f.purchaseDate)}
                          {f.purchaseAmount ? ` / ${f.purchaseAmount}${f.purchaseUnit || ''}` : ''}
                          {f.lotNumber ? ` / ロット ${f.lotNumber}` : ''}
                          {f.supplier ? ` / ${f.supplier}` : ''}
                          <span className="block text-xs text-gray-500">
                            成分 N{f.nitrogenContent ?? 0}-P{f.phosphorusContent ?? 0}-K{f.potassiumContent ?? 0}
                            {f.formType ? ` / ${f.formType}` : ''}
                            {f.density ? ` / 比重${f.density}` : ''}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    成分や比重が入力されている登録を残すのがおすすめです。
                  </p>
                  <button
                    type="button"
                    disabled={!isAdmin || merging === groupKey}
                    onClick={() => handleMerge(group, groupKey)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm disabled:bg-gray-300"
                  >
                    {merging === groupKey ? 'まとめています...' : 'この肥料をまとめる'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 購入記録の登録 */}
      {isMember && (
        <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded shadow p-4 mb-6">
          <h2 className="font-bold mb-3">{editingId ? '購入記録を編集' : '購入を記録'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">肥料 *</label>
              <select
                value={form.fertilizerId}
                onChange={(e) => setForm({ ...form, fertilizerId: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              >
                <option value="">肥料を選択してください</option>
                {fertilizers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.manufacturer ? `（${f.manufacturer}）` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">購入日 *</label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">購入量 *</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="border rounded px-3 py-2 flex-1"
                  required
                />
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="border rounded px-3 py-2 w-24"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                  <option value="ml">ml</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">ロット番号</label>
              <input
                type="text"
                value={form.lotNumber}
                onChange={(e) => setForm({ ...form, lotNumber: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="袋や容器に記載されている番号"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">購入先</label>
              <input
                type="text"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="例: ◯◯農業資材店"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">有効期限</label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">備考</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-300"
            >
              {saving ? '保存中...' : editingId ? '更新' : '登録'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">
                キャンセル
              </button>
            )}
          </div>
        </form>
      )}

      {/* 購入記録の一覧 */}
      {purchases.length === 0 ? (
        <p className="text-gray-500 text-center py-8">購入記録がありません。</p>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">購入日</th>
                <th className="px-3 py-2 text-left">肥料</th>
                <th className="px-3 py-2 text-right">購入量</th>
                <th className="px-3 py-2 text-left">ロット</th>
                <th className="px-3 py-2 text-left">購入先</th>
                <th className="px-3 py-2 text-left">有効期限</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => isMember && startEdit(p)}
                  className={`border-t ${isMember ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                >
                  <td className="px-3 py-2 whitespace-nowrap">{p.purchaseDate || '—'}</td>
                  <td className="px-3 py-2">{p.fertilizerName}</td>
                  <td className="px-3 py-2 text-right">{p.amount}{p.unit}</td>
                  <td className="px-3 py-2 text-gray-600">{p.lotNumber || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{p.supplier || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{p.expiryDate || '—'}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    {isMember && (
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
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

export default FertilizerPurchases;
