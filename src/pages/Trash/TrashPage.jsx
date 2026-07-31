// src/pages/Trash/TrashPage.jsx
// ゴミ箱。削除した記録を一定期間保管し、元に戻せるようにする。
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  TRASH_RETENTION_DAYS,
  COLLECTION_LABELS,
  listTrash,
  restoreFromTrash,
  purgeFromTrash,
  purgeExpired,
  daysLeft
} from '../../services/trashService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const TrashPage = () => {
  const { currentOrganization, isAdmin, isMember } = useOrganization();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [filterCollection, setFilterCollection] = useState('');

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const list = await listTrash(currentOrganization.id);
      // 保存期間を過ぎたものは、この画面を開いたタイミングで片づける
      const purged = await purgeExpired(list);
      setEntries(purged > 0 ? await listTrash(currentOrganization.id) : list);
    } catch (err) {
      firestoreLogger.error('ゴミ箱の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  const handleRestore = async (entry) => {
    if (!window.confirm(`「${entry.summary}」を元に戻しますか？`)) return;
    setWorking(true);
    try {
      await restoreFromTrash(entry);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success('元に戻しました');
    } catch (err) {
      firestoreLogger.error('ゴミ箱からの復元に失敗しました', { trashId: entry.id }, err);
      toast.error('復元中にエラーが発生しました');
    } finally {
      setWorking(false);
    }
  };

  const handlePurge = async (entry) => {
    if (!window.confirm(`「${entry.summary}」を完全に削除します。\nこの操作は取り消せません。よろしいですか？`)) return;
    setWorking(true);
    try {
      await purgeFromTrash(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success('完全に削除しました');
    } catch (err) {
      firestoreLogger.error('ゴミ箱の完全削除に失敗しました', { trashId: entry.id }, err);
      toast.error('削除中にエラーが発生しました');
    } finally {
      setWorking(false);
    }
  };

  const handleEmpty = async () => {
    if (entries.length === 0) return;
    if (!window.confirm(`ゴミ箱の${entries.length}件をすべて完全に削除します。\nこの操作は取り消せません。よろしいですか？`)) return;
    setWorking(true);
    try {
      for (const e of entries) {
        await purgeFromTrash(e.id);
      }
      setEntries([]);
      toast.success('ゴミ箱を空にしました');
    } catch (err) {
      firestoreLogger.error('ゴミ箱を空にできませんでした', { organizationId: currentOrganization?.id }, err);
      toast.error('削除中にエラーが発生しました');
      await load();
    } finally {
      setWorking(false);
    }
  };

  // 種類ごとの件数（絞り込み用）
  const collectionCounts = useMemo(() => {
    const counts = {};
    entries.forEach((e) => {
      counts[e.collectionName] = (counts[e.collectionName] || 0) + 1;
    });
    return counts;
  }, [entries]);

  const visible = filterCollection
    ? entries.filter((e) => e.collectionName === filterCollection)
    : entries;

  if (!isMember) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">🗑 ゴミ箱</h1>
        <p className="text-gray-500">この機能は管理者・メンバーのみ利用できます。</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-24">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2 gap-3">
        <h1 className="text-2xl font-bold">🗑 ゴミ箱</h1>
        {isAdmin && entries.length > 0 && (
          <button
            onClick={handleEmpty}
            disabled={working}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
          >
            ゴミ箱を空にする
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        削除した記録は{TRASH_RETENTION_DAYS}日間ここに残り、いつでも元に戻せます。
        期間を過ぎたものは自動的に消えます。
      </p>

      {/* 種類で絞り込み */}
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilterCollection('')}
            className={`px-3 py-2 rounded-full border text-sm ${
              !filterCollection ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            すべて（{entries.length}）
          </button>
          {Object.entries(collectionCounts).map(([name, count]) => (
            <button
              key={name}
              onClick={() => setFilterCollection(name)}
              className={`px-3 py-2 rounded-full border text-sm ${
                filterCollection === name ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
              }`}
            >
              {COLLECTION_LABELS[name] || name}（{count}）
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-5xl mb-3">🗑</div>
          <p className="text-gray-600">ゴミ箱は空です。</p>
          <p className="text-sm text-gray-500 mt-1">
            削除した記録はここに{TRASH_RETENTION_DAYS}日間保管されます。
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg divide-y">
          {visible.map((entry) => {
            const left = daysLeft(entry);
            return (
              <div key={entry.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                      {COLLECTION_LABELS[entry.collectionName] || entry.collectionName}
                    </span>
                    {left != null && (
                      <span className={`ml-2 text-xs ${left <= 7 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        あと{left}日で自動削除
                      </span>
                    )}
                  </p>
                  <p className="font-medium mt-1 break-words">{entry.summary}</p>
                  <p className="text-xs text-gray-500">
                    {entry.deletedAt ? entry.deletedAt.toLocaleString('ja-JP') : ''}
                    {entry.deletedByName && ` ・ ${entry.deletedByName} が削除`}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col gap-1 items-end">
                  <button
                    onClick={() => handleRestore(entry)}
                    disabled={working}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    元に戻す
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handlePurge(entry)}
                      disabled={working}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      完全に削除
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900">
        <p className="font-bold mb-1">補足</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>元に戻すと、記録は元の場所・元の内容で復活します（ロット番号や紐づけも保たれます）</li>
          <li>完全な削除は管理者のみ実行できます</li>
          <li>自動削除はこの画面を開いたときに実行されます</li>
        </ul>
      </div>
    </div>
  );
};

export default TrashPage;
