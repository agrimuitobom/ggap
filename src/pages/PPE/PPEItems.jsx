// src/pages/PPE/PPEItems.jsx
// 保護具（PPE）の品目マスタと在庫管理。
//
// FV-Smart 20.03.03 の後段「使い捨てのPPEを使用する場合、働く人のニーズに
// 合致した手元の在庫を維持していなければならず、又は、新しいPPEが速やかに
// 調達され、補充されていることを示す記録が利用可能でなければならない」に
// 対応する画面。入庫と支給を記録すると現在庫が自動で計算され、適正在庫を
// 下回ると警告が出る。
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getPpeItems,
  savePpeItem,
  deletePpeItem,
  seedDefaultPpeItems,
  getPpeTransactions,
  addPpeTransaction,
  deletePpeTransaction,
  computeStock,
  PPE_CATEGORIES,
  TRANSACTION_TYPES,
  transactionSign
} from '../../services/ppeService';
import { getWorkers } from '../../services/workerService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const todayKey = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const emptyItemForm = {
  name: '',
  category: '使い捨て',
  targetWork: '',
  unit: '個',
  minStock: 0,
  storageLocation: ''
};

const emptyTxForm = {
  date: todayKey(),
  type: '入庫',
  itemId: '',
  quantity: '',
  counterpartName: '',
  note: ''
};

const PPEItems = () => {
  const { currentOrganization, isMember } = useOrganization();
  const { userProfile, currentUser } = useAuth();

  const [tab, setTab] = useState('items'); // items | transactions
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState(null);
  const [savingItem, setSavingItem] = useState(false);
  const itemFormRef = useRef(null);

  const [txForm, setTxForm] = useState(emptyTxForm);
  const [savingTx, setSavingTx] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [itemList, txList, workerList] = await Promise.all([
        getPpeItems(currentOrganization.id),
        getPpeTransactions(currentOrganization.id),
        getWorkers(currentOrganization.id, currentUser?.uid)
      ]);
      setItems(itemList);
      setTransactions(txList);
      setWorkers(workerList);
    } catch (err) {
      firestoreLogger.error('保護具データの取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保護具データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, currentUser]);

  useEffect(() => {
    load();
  }, [load]);

  const stock = computeStock(transactions);

  /* ------------------------------ 品目マスタ ------------------------------ */

  const resetItemForm = () => {
    setItemForm(emptyItemForm);
    setEditingItemId(null);
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name || '',
      category: item.category || '使い捨て',
      targetWork: item.targetWork || '',
      unit: item.unit || '個',
      minStock: item.minStock ?? 0,
      storageLocation: item.storageLocation || ''
    });
    // メイン領域がスクロールコンテナのため scrollIntoView でフォームへ移動
    itemFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name.trim() || !currentOrganization) return;
    try {
      setSavingItem(true);
      await savePpeItem(currentOrganization.id, editingItemId, {
        ...itemForm,
        order: editingItemId
          ? items.find((i) => i.id === editingItemId)?.order ?? 0
          : items.length
      });
      toast.success(editingItemId ? '品目を更新しました' : '品目を登録しました');
      resetItemForm();
      await load();
    } catch (err) {
      firestoreLogger.error('保護具品目の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`「${item.name}」をゴミ箱へ移動しますか？`)) return;
    try {
      await deletePpeItem(item.id, currentOrganization.id, userProfile?.name || '');
      toast.success('ゴミ箱へ移動しました');
      await load();
    } catch (err) {
      firestoreLogger.error('保護具品目の削除エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('標準の保護具10品目を登録します。よろしいですか？')) return;
    try {
      setSeeding(true);
      await seedDefaultPpeItems(currentOrganization.id);
      toast.success('標準の保護具を登録しました');
      await load();
    } catch (err) {
      firestoreLogger.error('標準保護具の登録エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('登録中にエラーが発生しました');
    } finally {
      setSeeding(false);
    }
  };

  /* ------------------------------ 入出庫 ------------------------------ */

  const handleSaveTx = async (e) => {
    e.preventDefault();
    if (!txForm.itemId || !txForm.quantity || !currentOrganization) return;
    const item = items.find((i) => i.id === txForm.itemId);
    try {
      setSavingTx(true);
      await addPpeTransaction(currentOrganization.id, {
        ...txForm,
        itemName: item?.name || '',
        unit: item?.unit || '',
        recordedByName: userProfile?.name || ''
      });
      toast.success('記録しました');
      setTxForm({ ...emptyTxForm, date: txForm.date, type: txForm.type });
      await load();
    } catch (err) {
      firestoreLogger.error('保護具入出庫の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSavingTx(false);
    }
  };

  const handleDeleteTx = async (tx) => {
    if (!window.confirm('この記録をゴミ箱へ移動しますか？')) return;
    try {
      await deletePpeTransaction(tx.id, currentOrganization.id, userProfile?.name || '');
      toast.success('ゴミ箱へ移動しました');
      await load();
    } catch (err) {
      firestoreLogger.error('保護具入出庫の削除エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const trackedIds = new Set(transactions.map((tx) => tx.itemId));
  const lowStock = items
    .filter((i) => trackedIds.has(i.id) && (i.minStock ?? 0) > 0)
    .map((i) => ({ ...i, stock: stock[i.id] || 0 }))
    .filter((i) => i.stock < i.minStock);

  if (loading) {
    return <div className="container mx-auto p-4">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-bold">保護具（PPE）管理</h1>
        <Link
          to="/ppe/checks"
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
        >
          着用確認記録へ
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-900">
        入庫と支給を記録すると、現在庫が自動で計算されます。適正在庫を下回ると警告が出るので、
        「必要な保護具の在庫を維持している」ことの証拠になります。
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded p-3 mb-4">
          <p className="font-bold text-red-800 mb-1">
            ⚠️ 適正在庫を下回っている保護具が{lowStock.length}件あります
          </p>
          <ul className="text-sm text-red-800 list-disc list-outside ml-5">
            {lowStock.map((i) => (
              <li key={i.id}>
                {i.name}：残り {i.stock}{i.unit}（適正在庫 {i.minStock}{i.unit}）
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* タブ */}
      <div className="flex border-b mb-4">
        <button
          type="button"
          onClick={() => setTab('items')}
          className={`px-4 py-2 text-sm ${tab === 'items' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
        >
          品目・在庫
        </button>
        <button
          type="button"
          onClick={() => setTab('transactions')}
          className={`px-4 py-2 text-sm ${tab === 'transactions' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
        >
          入出庫記録
        </button>
      </div>

      {tab === 'items' && (
        <>
          {items.length === 0 && (
            <div className="bg-white rounded shadow p-6 text-center mb-4">
              <p className="text-gray-600 mb-3">保護具がまだ登録されていません。</p>
              {isMember && (
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-300"
                >
                  {seeding ? '登録中...' : '標準の保護具を一括登録する'}
                </button>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div className="bg-white rounded shadow overflow-x-auto mb-6">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">品目</th>
                    <th className="px-3 py-2 text-left">区分</th>
                    <th className="px-3 py-2 text-left">対象作業</th>
                    <th className="px-3 py-2 text-right">現在庫</th>
                    <th className="px-3 py-2 text-right">適正在庫</th>
                    <th className="px-3 py-2 text-left">保管場所</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const current = stock[item.id] || 0;
                    const isTracked = trackedIds.has(item.id);
                    const isLow = isTracked && (item.minStock ?? 0) > 0 && current < item.minStock;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => isMember && startEditItem(item)}
                        className={`border-t ${isMember ? 'cursor-pointer hover:bg-gray-50' : ''} ${isLow ? 'bg-red-50' : ''}`}
                      >
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              item.category === '使い捨て'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{item.targetWork}</td>
                        <td className={`px-3 py-2 text-right font-bold ${isLow ? 'text-red-700' : ''}`}>
                          {isTracked ? `${current}${item.unit}` : <span className="text-gray-400 font-normal">未記録</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {item.minStock ? `${item.minStock}${item.unit}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{item.storageLocation}</td>
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          {isMember && (
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
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

          {isMember && (
            <form ref={itemFormRef} onSubmit={handleSaveItem} className="bg-white rounded shadow p-4">
              <h2 className="font-bold mb-3">
                {editingItemId ? '品目を編集' : '品目を追加'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">品目名 *</label>
                  <input
                    type="text"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="例: 使い捨て手袋（ニトリル手袋）"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">区分</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    {PPE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">対象作業</label>
                  <input
                    type="text"
                    value={itemForm.targetWork}
                    onChange={(e) => setItemForm({ ...itemForm, targetWork: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="例: 防除（農薬散布）"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">単位</label>
                  <input
                    type="text"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="枚 / 個 / 双 / 着"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    適正在庫（これを下回ると警告）
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemForm.minStock}
                    onChange={(e) => setItemForm({ ...itemForm, minStock: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">保管場所</label>
                  <input
                    type="text"
                    value={itemForm.storageLocation}
                    onChange={(e) => setItemForm({ ...itemForm, storageLocation: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="例: 農薬保管庫の外（専用棚）"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-300"
                >
                  {savingItem ? '保存中...' : editingItemId ? '更新' : '追加'}
                </button>
                {editingItemId && (
                  <button
                    type="button"
                    onClick={resetItemForm}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </form>
          )}
        </>
      )}

      {tab === 'transactions' && (
        <>
          {isMember && (
            <form onSubmit={handleSaveTx} className="bg-white rounded shadow p-4 mb-6">
              <h2 className="font-bold mb-3">入出庫を記録</h2>

              {/* 種別はボタンで選ぶ（タップ数を減らす） */}
              <div className="flex gap-2 mb-3">
                {TRANSACTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTxForm({ ...txForm, type: t.value })}
                    className={`flex-1 py-3 rounded border-2 text-sm font-medium ${
                      txForm.type === t.value
                        ? 'border-green-600 bg-green-50 text-green-800'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {t.icon} {t.value}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">日付 *</label>
                  <input
                    type="date"
                    value={txForm.date}
                    onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">品目 *</label>
                  <select
                    value={txForm.itemId}
                    onChange={(e) => setTxForm({ ...txForm, itemId: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option value="">選択してください</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    数量 *
                    {txForm.itemId && (
                      <span className="text-gray-500 font-normal">
                        （{items.find((i) => i.id === txForm.itemId)?.unit}）
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={txForm.quantity}
                    onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    {txForm.type === '入庫' ? '購入先' : txForm.type === '支給' ? '渡した相手' : '処分した人'}
                  </label>
                  {txForm.type === '支給' ? (
                    <select
                      value={txForm.counterpartName}
                      onChange={(e) => setTxForm({ ...txForm, counterpartName: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">選択してください</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.name}>{w.name}</option>
                      ))}
                      <option value="実習班（生徒）">実習班（生徒）</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={txForm.counterpartName}
                      onChange={(e) => setTxForm({ ...txForm, counterpartName: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder={txForm.type === '入庫' ? '例: ◯◯農業資材店' : ''}
                    />
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">備考</label>
                  <input
                    type="text"
                    value={txForm.note}
                    onChange={(e) => setTxForm({ ...txForm, note: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="例: 在庫が少なくなったため追加購入"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingTx}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-300"
              >
                {savingTx ? '保存中...' : '記録する'}
              </button>
            </form>
          )}

          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">入出庫の記録がありません。</p>
          ) : (
            <div className="bg-white rounded shadow overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">日付</th>
                    <th className="px-3 py-2 text-left">種別</th>
                    <th className="px-3 py-2 text-left">品目</th>
                    <th className="px-3 py-2 text-right">数量</th>
                    <th className="px-3 py-2 text-left">相手先</th>
                    <th className="px-3 py-2 text-left">備考</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{tx.date}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{tx.type}</td>
                      <td className="px-3 py-2">{tx.itemName}</td>
                      <td className={`px-3 py-2 text-right font-medium ${transactionSign(tx.type) > 0 ? 'text-green-700' : 'text-gray-700'}`}>
                        {transactionSign(tx.type) > 0 ? '+' : '−'}{tx.quantity}{tx.unit}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{tx.counterpartName}</td>
                      <td className="px-3 py-2 text-gray-600">{tx.note}</td>
                      <td className="px-3 py-2 text-right">
                        {isMember && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTx(tx)}
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
        </>
      )}
    </div>
  );
};

export default PPEItems;
