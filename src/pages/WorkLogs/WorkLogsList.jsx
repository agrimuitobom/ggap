// src/pages/WorkLogs/WorkLogsList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { deleteHarvestForWorkLog } from '../../services/harvestSyncService';
import { firestoreLogger } from '../../utils/logger';

const WorkLogsList = () => {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const [workLogs, setWorkLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
      await deleteHarvestForWorkLog(currentOrganization.id, id);
      await deleteDoc(doc(db, 'workLogs', id));
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
      
      {workLogs.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">日付</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">圃場</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">作業内容</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">担当者</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">作業時間</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">収穫量</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">廃棄量</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {workLogs.map((log) => (
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
