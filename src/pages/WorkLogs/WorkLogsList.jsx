// src/pages/WorkLogs/WorkLogsList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const WorkLogsList = () => {
  const { currentUser } = useAuth();
  const [workLogs, setWorkLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchWorkLogs = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const q = query(
        collection(db, 'workLogs'), 
        where('userId', '==', currentUser.uid),
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
      console.error('Error fetching work logs:', err);
      setError('作業日誌の取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchWorkLogs();
    }
  }, [currentUser, fetchWorkLogs]);

  const handleDelete = async (id) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    try {
      await deleteDoc(doc(db, 'workLogs', id));
      setWorkLogs(workLogs.filter(log => log.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting work log:', err);
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">作業日誌一覧</h1>
        <Link 
          to="/work-logs/new" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          新規作業日誌登録
        </Link>
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
                <tr key={log.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 whitespace-nowrap">{log.date?.toLocaleDateString() || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{log.fieldName || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{log.workType || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{log.workerNames?.join(', ') || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{log.workHours ? `${log.workHours}時間` : '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{log.harvestAmount ? `${log.harvestAmount} kg` : '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{log.wasteAmount ? `${log.wasteAmount} kg` : '-'}</td>
                  <td className="py-3 px-4">
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
                          to={`/work-logs/edit/${log.id}`} 
                          className="text-blue-600 hover:text-blue-800"
                        >
                          編集
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
