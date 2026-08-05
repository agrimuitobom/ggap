// src/pages/WorkLogs/WorkLogsList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { moveToTrash } from '../../services/trashService';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { deleteHarvestForWorkLog } from '../../services/harvestSyncService';
import { firestoreLogger } from '../../utils/logger';

const WorkLogsList = () => {
  const { currentOrganization } = useOrganization();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [workLogs, setWorkLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // 並べ替えと絞り込み。既定は今までどおり日付の新しい順
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [filterWorkType, setFilterWorkType] = useState('');
  const [filterField, setFilterField] = useState('');

  const fetchWorkLogs = useCallback(async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'workLogs'),
        where('organizationId', '==', currentOrganization.id),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const logs = [];
      querySnapshot.forEach((doc) => {
        logs.push({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate() // Firestoreのタイムスタンプをプレーンな日付に変換
        });
      });
      setWorkLogs(logs);
    } catch (err) {
      firestoreLogger.error('作業日誌の取得に失敗しました', {
        organizationId: currentOrganization.id
      }, err);
      setError('作業日誌の取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    if (currentOrganization) {
      fetchWorkLogs();
    }
  }, [currentOrganization, fetchWorkLogs]);

  const handleDelete = async (id) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    try {
      // この作業日誌から作られた収穫記録も一緒に取り消す（集計に残らないように）
      await deleteHarvestForWorkLog(currentOrganization.id, id, userProfile?.name);
      await moveToTrash('workLogs', id, currentOrganization.id, userProfile?.name);
      setWorkLogs(workLogs.filter(log => log.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      firestoreLogger.error('作業日誌の削除に失敗しました', { workLogId: id }, err);
      setError('作業日誌の削除中にエラーが発生しました。');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  // 絞り込みの選択肢は、実際に記録されている値から作る
  const workTypeOptions = [...new Set(workLogs.map((l) => l.workType).filter(Boolean))].sort();
  const fieldOptions = [...new Set(workLogs.map((l) => l.fieldName).filter(Boolean))].sort();

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // 日付・数量は大きい順、文字は五十音順から始めるのが自然
      setSortDir(key === 'date' || key === 'workHours' || key === 'harvestAmount' || key === 'wasteAmount' ? 'desc' : 'asc');
    }
  };

  const sortValue = (log, key) => {
    switch (key) {
      case 'date':
        return log.date ? log.date.getTime() : 0;
      case 'workHours':
      case 'harvestAmount':
      case 'wasteAmount':
        return Number(log[key]) || 0;
      case 'workerNames':
        return (log.workerNames || []).join(',');
      default:
        return log[key] || '';
    }
  };

  const visibleLogs = workLogs
    .filter((l) => !filterWorkType || l.workType === filterWorkType)
    .filter((l) => !filterField || l.fieldName === filterField)
    .slice()
    .sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      let result;
      if (typeof va === 'number' && typeof vb === 'number') {
        result = va - vb;
      } else {
        // 日本語は localeCompare でないと並び順が崩れる
        result = String(va).localeCompare(String(vb), 'ja');
      }
      return sortDir === 'asc' ? result : -result;
    });

  // 見出しに並べ替えの向きを出す
  const SortableHeader = ({ label, sortKey: key }) => (
    <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="flex items-center gap-1 hover:text-blue-700"
      >
        {label}
        <span className={sortKey === key ? 'text-blue-700' : 'text-gray-300'}>
          {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">作業日誌一覧</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-3">
        <h1 className="text-2xl font-bold">作業日誌一覧</h1>
        <div className="flex gap-2">
          <Link
            to="/work-logs/calendar"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            📅 カレンダー
          </Link>
          <Link
            to="/work-logs/quick"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            ⚡ クイック記録
          </Link>
          <Link
            to="/work-logs/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            新規作業日誌登録
          </Link>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {workLogs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-3 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">作業内容で絞り込む</label>
              <select
                value={filterWorkType}
                onChange={(e) => setFilterWorkType(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">すべて</option>
                {workTypeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">圃場で絞り込む</label>
              <select
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">すべて</option>
                {fieldOptions.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            {(filterWorkType || filterField) && (
              <button
                type="button"
                onClick={() => { setFilterWorkType(''); setFilterField(''); }}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
              >
                絞り込みを解除
              </button>
            )}
            <span className="text-sm text-gray-500 ml-auto">
              {visibleLogs.length}件 / 全{workLogs.length}件
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            見出しをタップすると、その列で並べ替えできます。
          </p>
        </div>
      )}

      {workLogs.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100">
                <SortableHeader label="日付" sortKey="date" />
                <SortableHeader label="圃場" sortKey="fieldName" />
                <SortableHeader label="作業内容" sortKey="workType" />
                <SortableHeader label="担当者" sortKey="workerNames" />
                <SortableHeader label="作業時間" sortKey="workHours" />
                <SortableHeader label="収穫量" sortKey="harvestAmount" />
                <SortableHeader label="廃棄量" sortKey="wasteAmount" />
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 px-4 text-center text-gray-500">
                    絞り込みに一致する作業日誌がありません。
                  </td>
                </tr>
              )}
              {visibleLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => navigate(`/work-logs/edit/${log.id}`)}
                  className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="py-3 px-4 whitespace-nowrap">{log.date?.toLocaleDateString() || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{log.fieldName || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {log.workType || '-'}
                    {log.isDraft && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-full">
                        要追記
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {log.workerNames?.join(', ') || '-'}
                    {log.createdByName && (
                      <span className="block text-xs text-gray-400">記録: {log.createdByName}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{log.workHours ? `${log.workHours}時間` : '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{log.harvestAmount ? `${log.harvestAmount} kg` : '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{log.wasteAmount ? `${log.wasteAmount} kg` : '-'}</td>
                  {/* 操作列のタップは行クリック（編集画面へ）と分離する */}
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    {deleteConfirm === log.id ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleDelete(log.id)} 
                          className="text-red-700 hover:text-red-900"
                        >
                          確認
                        </button>
                        <button 
                          onClick={handleCancelDelete} 
                          className="text-gray-600 hover:text-gray-800"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <Link
                          to={`/work-logs/new?copyFrom=${log.id}`}
                          className="text-green-600 hover:text-green-800"
                          title="この記録を複製して今日の日付で新規作成"
                        >
                          複製
                        </Link>
                        <Link
                          to={`/work-logs/edit/${log.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {log.isDraft ? '追記' : '編集'}
                        </Link>
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-gray-500 mb-4">作業日誌のデータがありません。</p>
          <Link 
            to="/work-logs/new" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            最初の作業日誌を登録する
          </Link>
        </div>
      )}
    </div>
  );
};

export default WorkLogsList;
