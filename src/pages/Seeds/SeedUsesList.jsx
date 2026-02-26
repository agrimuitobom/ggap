// src/pages/Seeds/SeedUsesList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const SeedUsesList = () => {
  const { currentUser } = useAuth();
  const [seedUses, setSeedUses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchSeedUses();
    }
  }, [currentUser]);

  const fetchSeedUses = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const q = query(
        collection(db, 'seedUses'), 
        where('userId', '==', currentUser.uid),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const uses = [];
      querySnapshot.forEach((doc) => {
        uses.push({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate()
        });
      });
      setSeedUses(uses);
    } catch (err) {
      console.error('Error fetching seed uses:', err);
      setError('播種・定植記録の取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    try {
      await deleteDoc(doc(db, 'seedUses', id));
      setSeedUses(seedUses.filter(use => use.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting seed use:', err);
      setError('播種・定植記録の削除中にエラーが発生しました。');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">播種・定植記録一覧</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">播種・定植記録一覧</h1>
        <Link 
          to="/seed-uses/new" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          新規播種・定植記録登録
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {seedUses.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">作業日</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">種子・苗</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">圃場</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">使用量</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">方法</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">作業者</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">備考</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {seedUses.map((use) => (
                <tr key={use.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 whitespace-nowrap">{use.date?.toLocaleDateString() || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{use.seedName || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{use.fieldName || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{use.amount ? `${use.amount} g/本` : '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{use.method || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{use.plantedByName || '-'}</td>
                  <td className="py-3 px-4 max-w-xs truncate" title={use.notes}>{use.notes || '-'}</td>
                  <td className="py-3 px-4">
                    {deleteConfirm === use.id ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleDelete(use.id)} 
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
                          to={`/seed-uses/edit/${use.id}`} 
                          className="text-blue-600 hover:text-blue-800"
                        >
                          編集
                        </Link>
                        <button 
                          onClick={() => handleDelete(use.id)} 
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
          <p className="text-gray-500 mb-4">播種・定植記録のデータがありません。</p>
          <Link 
            to="/seed-uses/new" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            最初の播種・定植記録を登録する
          </Link>
        </div>
      )}
    </div>
  );
};

export default SeedUsesList;