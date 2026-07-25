// src/pages/Cleaning/CleaningItemsManager.jsx
// 清掃項目（項目名・頻度・実施曜日）の管理画面。
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getCleaningItems,
  saveCleaningItem,
  deleteCleaningItem,
  WEEKDAY_LABELS
} from '../../services/cleaningService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const emptyForm = { name: '', frequencyLabel: '毎日', weekdays: [] };

const CleaningItemsManager = () => {
  const { currentOrganization, isMember } = useOrganization();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  const loadItems = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      setItems(await getCleaningItems(currentOrganization.id));
    } catch (err) {
      firestoreLogger.error('清掃項目の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('清掃項目の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      frequencyLabel: item.frequencyLabel || '',
      weekdays: item.weekdays || []
    });
    // メイン領域がスクロールコンテナのため scrollIntoView でフォームへ移動
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleWeekday = (wd) => {
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(wd)
        ? prev.weekdays.filter((d) => d !== wd)
        : [...prev.weekdays, wd].sort((a, b) => a - b)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('項目名を入力してください');
      return;
    }
    setSaving(true);
    try {
      const order = editingId
        ? items.find((i) => i.id === editingId)?.order ?? 0
        : items.length;
      await saveCleaningItem(currentOrganization.id, editingId, { ...form, order });
      toast.success(editingId ? '項目を更新しました' : '項目を追加しました');
      resetForm();
      await loadItems();
    } catch (err) {
      firestoreLogger.error('清掃項目の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`「${item.name}」を削除しますか？\n過去のチェック記録は残ります。`)) return;
    try {
      await deleteCleaningItem(item.id);
      toast.success('項目を削除しました');
      await loadItems();
    } catch (err) {
      firestoreLogger.error('清掃項目の削除エラー', { itemId: item.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  if (!isMember) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">清掃項目の管理</h1>
        <p className="text-gray-500">項目の編集は管理者またはメンバーのみ可能です。</p>
        <Link to="/cleaning" className="text-blue-600 hover:text-blue-800 underline">清掃チェックに戻る</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl pb-24">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">清掃項目の管理</h1>
        <Link to="/cleaning" className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
          清掃チェックへ
        </Link>
      </div>

      {/* 入力フォーム */}
      <form ref={formRef} onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-4 mb-6">
        <h2 className="font-bold mb-3">{editingId ? '項目を編集' : '項目を追加'}</h2>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">項目名 <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="例: 水耕ハウスの清掃・整理整頓"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">頻度の表示ラベル</label>
          <input
            type="text"
            value={form.frequencyLabel}
            onChange={(e) => setForm({ ...form, frequencyLabel: e.target.value })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="例: 毎日 / 週1回 / 使用後"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-1">実施する曜日</label>
          <p className="text-xs text-gray-500 mb-2">
            選択した曜日だけチェック対象になります。何も選ばないと「毎日（曜日問わず）」対象です。
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, wd) => (
              <button
                key={wd}
                type="button"
                onClick={() => toggleWeekday(wd)}
                className={`w-11 h-11 rounded-full border text-sm font-medium ${
                  form.weekdays.includes(wd)
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {form.weekdays.length === 0 && (
            <p className="text-xs text-green-700 mt-2">→ 毎日対象</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : editingId ? '更新する' : '追加する'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded hover:bg-gray-300"
            >
              キャンセル
            </button>
          )}
        </div>
      </form>

      {/* 項目一覧 */}
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <span className="text-gray-500">読み込み中...</span>
        </div>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-center">清掃項目がまだありません。上のフォームから追加してください。</p>
      ) : (
        <div className="bg-white shadow rounded-lg divide-y">
          {items.map((item) => (
            <div key={item.id} className="flex items-center p-4">
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.frequencyLabel || '頻度未設定'}
                  {' ・ '}
                  {item.weekdays && item.weekdays.length > 0
                    ? item.weekdays.map((wd) => WEEKDAY_LABELS[wd]).join('・') + '曜'
                    : '毎日'}
                </p>
              </div>
              <button
                onClick={() => startEdit(item)}
                className="text-blue-600 hover:text-blue-800 text-sm mr-4"
              >
                編集
              </button>
              <button
                onClick={() => handleDelete(item)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CleaningItemsManager;
