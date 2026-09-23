// src/pages/Materials/MaterialPurchases.jsx
// 資材（肥料・農薬・種子）の購入（入荷）記録と、重複した登録の整理。
//
// 同じ資材を買い足すたびにマスタを新規登録すると、選択欄に同じ名前が
// 並んで区別できなくなる。マスタは製品ごとに1つに保ち、買った回数は
// この購入記録として積み上げる。すでに重複してしまったものは、
// 上の「重複をまとめる」で1つに統合できる。
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  MATERIALS,
  getPurchases,
  savePurchase,
  deletePurchase,
  findDuplicates,
  mergeMasters,
  purchaseMaterialId
} from '../../services/materialPurchaseService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const todayKey = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ja-JP');
};

/** 有効期限の状態（期限切れ・30日以内・問題なし） */
const expiryState = (expiryDate) => {
  if (!expiryDate) return null;
  const d = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return 'expired';
  if (d <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)) return 'soon';
  return 'ok';
};

const MaterialPurchases = ({ type }) => {
  const cfg = MATERIALS[type];
  const { currentOrganization, isMember, isAdmin } = useOrganization();
  const { userProfile } = useAuth();

  const emptyForm = useCallback(() => {
    const base = {
      materialId: '',
      purchaseDate: todayKey(),
      amount: '',
      unit: cfg.defaultUnit,
      lotNumber: '',
      supplier: '',
      expiryDate: '',
      notes: ''
    };
    cfg.extraFields.forEach((f) => { base[f.key] = ''; });
    return base;
  }, [cfg]);

  const [masters, setMasters] = useState([]);
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
      const [masterSnap, purchaseList] = await Promise.all([
        getDocs(query(
          collection(db, cfg.masterCollection),
          where('organizationId', '==', currentOrganization.id)
        )),
        getPurchases(type, currentOrganization.id)
      ]);
      setMasters(masterSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPurchases(purchaseList);
    } catch (err) {
      firestoreLogger.error('購入記録の取得エラー', { type, organizationId: currentOrganization?.id }, err);
      toast.error('購入記録の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, cfg, type]);

  useEffect(() => {
    load();
  }, [load]);

  // 種類を切り替えて同じ画面を再利用したときに、入力欄を初期化する
  useEffect(() => {
    setForm(emptyForm());
    setEditingId(null);
    setKeepChoice({});
  }, [type, emptyForm]);

  const duplicateGroups = findDuplicates(type, masters);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const startEdit = (purchase) => {
    setEditingId(purchase.id);
    const next = {
      materialId: purchaseMaterialId(type, purchase) || '',
      purchaseDate: purchase.purchaseDate || todayKey(),
      amount: purchase.amount?.toString() || '',
      unit: purchase.unit || cfg.defaultUnit,
      lotNumber: purchase.lotNumber || '',
      supplier: purchase.supplier || '',
      expiryDate: purchase.expiryDate || '',
      notes: purchase.notes || ''
    };
    cfg.extraFields.forEach((f) => { next[f.key] = purchase[f.key] || ''; });
    setForm(next);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.materialId || !Number(form.amount) || !currentOrganization) {
      toast.error(`${cfg.label}と購入量を入力してください`);
      return;
    }
    if (cfg.expiryImportant && !form.expiryDate) {
      toast.error('農薬は有効期限を入力してください（ラベルに記載があります）');
      return;
    }
    try {
      setSaving(true);
      const master = masters.find((m) => m.id === form.materialId);
      await savePurchase(type, currentOrganization.id, editingId, {
        ...form,
        materialName: master ? cfg.displayName(master) : ''
      });
      toast.success(editingId ? '購入記録を更新しました' : '購入記録を登録しました');
      resetForm();
      await load();
    } catch (err) {
      firestoreLogger.error('購入記録の保存エラー', { type, organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (purchase) => {
    const name = purchase[cfg.nameField];
    if (!window.confirm(`${name} の購入記録をゴミ箱へ移動しますか？`)) return;
    try {
      await deletePurchase(type, purchase.id, currentOrganization.id, userProfile?.name || '');
      toast.success('ゴミ箱へ移動しました');
      await load();
    } catch (err) {
      firestoreLogger.error('購入記録の削除エラー', { type, organizationId: currentOrganization?.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const handleMerge = async (group, groupKey) => {
    const keepId = keepChoice[groupKey] || group[0].id;
    const keep = group.find((m) => m.id === keepId);
    const duplicates = group.filter((m) => m.id !== keepId);
    if (!keep || duplicates.length === 0) return;

    if (!window.confirm(
      `「${cfg.displayName(keep)}」の重複した登録${duplicates.length}件を1つにまとめます。\n\n` +
      '・重複していた登録の購入情報（ロット・購入日・期限）は、購入記録として残します\n' +
      '・使用記録は、残す方の登録に付け替えます\n' +
      '・重複していた登録はゴミ箱へ移します（元に戻せます）\n\n' +
      '実行前にバックアップを取ることをおすすめします。よろしいですか？'
    )) {
      return;
    }

    try {
      setMerging(groupKey);
      const result = await mergeMasters(type, currentOrganization.id, keep, duplicates, userProfile?.name || '');
      toast.success(`まとめました（購入記録 ${result.purchases}件を作成 / 使用記録 ${result.uses}件を付け替え）`);
      await load();
    } catch (err) {
      firestoreLogger.error('資材マスタの統合エラー', { type, organizationId: currentOrganization?.id }, err);
      toast.error('統合中にエラーが発生しました');
    } finally {
      setMerging('');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">読み込み中...</div>;
  }

  const expiredCount = purchases.filter((p) => expiryState(p.expiryDate) === 'expired').length;

  return (
    <div className="container mx-auto p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-bold">{cfg.label}の購入（入荷）記録</h1>
        <Link to={cfg.listPath} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm">
          {cfg.label}一覧へ
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-900">
        <p className="font-bold mb-1">同じ{cfg.label}を買い足すときは、{cfg.label}を新しく登録しないでください</p>
        <p>
          {cfg.label}一覧には<strong>製品ごとに1つ</strong>だけ登録し、買った回数はこの画面に購入記録として
          積み上げます。ロット番号・有効期限・購入先は購入ごとに違うので、ここに残します。
        </p>
      </div>

      {expiredCount > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded p-3 mb-4 text-sm text-red-800">
          <p className="font-bold mb-1">有効期限を過ぎたロットが{expiredCount}件あります</p>
          <p>
            下の一覧で赤く表示しています。使い切っていない場合は廃棄し、
            <Link to="/material-disposals" className="underline font-medium mx-1">保管・廃棄記録</Link>
            に残してください。廃棄済みなら、この購入記録の備考に「廃棄済み」と書いておくと区別できます。
          </p>
        </div>
      )}

      {/* 重複している登録の統合 */}
      {duplicateGroups.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded p-4 mb-6">
          <h2 className="font-bold text-red-800 mb-2">
            ⚠️ 同じ{cfg.label}として重複している登録が{duplicateGroups.length}種類あります
          </h2>
          <p className="text-sm text-red-800 mb-3">
            残す1つを選んで「まとめる」を押すと、購入情報は購入記録として残したまま、
            使用記録が残す方に付け替わります。重複していた登録はゴミ箱へ移るので、元に戻すこともできます。
          </p>
          {!isAdmin && (
            <p className="text-sm text-red-800 mb-3 font-medium">この操作は管理者のみ実行できます。</p>
          )}

          <div className="space-y-4">
            {duplicateGroups.map((group, gi) => {
              const groupKey = `${cfg.duplicateKey(group[0])}_${gi}`;
              const keepId = keepChoice[groupKey] || group[0].id;
              return (
                <div key={groupKey} className="bg-white rounded p-3">
                  <p className="font-bold mb-2">
                    {cfg.displayName(group[0])}
                    {cfg.subLabel(group[0]) && (
                      <span className="ml-2 font-normal text-sm text-gray-600">{cfg.subLabel(group[0])}</span>
                    )}
                    <span className="ml-2 font-normal text-sm text-gray-600">（{group.length}件）</span>
                  </p>
                  <div className="space-y-1 mb-3">
                    {group.map((m) => (
                      <label key={m.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name={groupKey}
                          checked={keepId === m.id}
                          onChange={() => setKeepChoice((prev) => ({ ...prev, [groupKey]: m.id }))}
                          className="h-4 w-4 mt-1"
                        />
                        <span>
                          購入日 {formatDate(m.purchaseDate)}
                          {m.purchaseAmount ? ` / ${m.purchaseAmount}${m.purchaseUnit || ''}` : ''}
                          {m.lotNumber ? ` / ロット ${m.lotNumber}` : ''}
                          {m.expiryDate ? ` / 期限 ${formatDate(m.expiryDate)}` : ''}
                          {cfg.detailLabel(m) && (
                            <span className="block text-xs text-gray-500">{cfg.detailLabel(m)}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{cfg.keepHint}</p>
                  <button
                    type="button"
                    disabled={!isAdmin || merging === groupKey}
                    onClick={() => handleMerge(group, groupKey)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm disabled:bg-gray-300"
                  >
                    {merging === groupKey ? 'まとめています...' : `この${cfg.label}をまとめる`}
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

          {masters.length === 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
              {cfg.label}が登録されていません。先に
              <Link to={cfg.newPath} className="underline mx-1">{cfg.label}を登録</Link>
              してください。
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">{cfg.label} *</label>
              <select
                value={form.materialId}
                onChange={(e) => setForm({ ...form, materialId: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              >
                <option value="">{cfg.label}を選択してください</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {cfg.displayName(m)}{cfg.subLabel(m) ? `（${cfg.subLabel(m)}）` : ''}
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
                  {cfg.units.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
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
              <label className="block text-sm text-gray-700 mb-1">
                有効期限{cfg.expiryImportant && ' *'}
              </label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                className="w-full border rounded px-3 py-2"
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
            {cfg.extraFields.map((f) => (
              <div key={f.key}>
                <label className="block text-sm text-gray-700 mb-1">{f.label}</label>
                <input
                  type="text"
                  value={form[f.key] || ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <div className="md:col-span-2">
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
                <th className="px-3 py-2 text-left">{cfg.label}</th>
                <th className="px-3 py-2 text-right">購入量</th>
                <th className="px-3 py-2 text-left">ロット</th>
                <th className="px-3 py-2 text-left">有効期限</th>
                <th className="px-3 py-2 text-left">購入先</th>
                {cfg.extraFields.map((f) => (
                  <th key={f.key} className="px-3 py-2 text-left">{f.label}</th>
                ))}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => {
                const state = expiryState(p.expiryDate);
                return (
                  <tr
                    key={p.id}
                    onClick={() => isMember && startEdit(p)}
                    className={`border-t ${isMember ? 'cursor-pointer hover:bg-gray-50' : ''} ${
                      state === 'expired' ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{p.purchaseDate || '—'}</td>
                    <td className="px-3 py-2">{p[cfg.nameField]}</td>
                    <td className="px-3 py-2 text-right">{p.amount}{p.unit}</td>
                    <td className="px-3 py-2 text-gray-600">{p.lotNumber || '—'}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${
                      state === 'expired' ? 'text-red-700 font-bold' : state === 'soon' ? 'text-amber-700 font-bold' : 'text-gray-600'
                    }`}>
                      {p.expiryDate || '—'}
                      {state === 'expired' && '（期限切れ）'}
                      {state === 'soon' && '（間近）'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{p.supplier || '—'}</td>
                    {cfg.extraFields.map((f) => (
                      <td key={f.key} className="px-3 py-2 text-gray-600">{p[f.key] || '—'}</td>
                    ))}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MaterialPurchases;
