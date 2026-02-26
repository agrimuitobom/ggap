// src/pages/Seeds/SeedsList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, getDocs, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const SeedsList = () => {
  const { currentUser } = useAuth();
  const [seeds, setSeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchSeeds();
    }
  }, [currentUser]);

  const fetchSeeds = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const q = query(
        collection(db, 'seeds'),
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const seedsList = [];
      querySnapshot.forEach((doc) => {
        seedsList.push({
          id: doc.id,
          ...doc.data(),
          purchaseDate: doc.data().purchaseDate?.toDate()
        });
      });
      setSeeds(seedsList);
    } catch (err) {
      console.error('Error fetching seeds:', err);
      setError('種子・苗データの取得中にエラーが発生しました。');
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
      await deleteDoc(doc(db, 'seeds', id));
      setSeeds(seeds.filter(seed => seed.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting seed:', err);
      setError('種子・苗データの削除中にエラーが発生しました。');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (!currentUser) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">種子・苗一覧</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">ユーザー認証が必要です。</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">種子・苗一覧</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">種子・苗一覧</h1>
        <Link 
          to="/seeds/new" 
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          新規種子・苗登録
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {seeds.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left font-semibold">名称</th>
                <th className="py-3 px-4 text-left font-semibold">品種</th>
                <th className="py-3 px-4 text-left font-semibold">購入先</th>
                <th className="py-3 px-4 text-left font-semibold">ロット番号</th>
                <th className="py-3 px-4 text-left font-semibold">購入日</th>
                <th className="py-3 px-4 text-left font-semibold">消毒方法</th>
                <th className="py-3 px-4 text-left font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {seeds.map((seed) => (
                <tr key={seed.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4">{seed.name || '-'}</td>
                  <td className="py-3 px-4">{seed.variety || '-'}</td>
                  <td className="py-3 px-4">{seed.supplier || '-'}</td>
                  <td className="py-3 px-4">{seed.lotNumber || '-'}</td>
                  <td className="py-3 px-4">{seed.purchaseDate?.toLocaleDateString() || '-'}</td>
                  <td className="py-3 px-4">{seed.disinfectionMethod || '-'}</td>
                  <td className="py-3 px-4">
                    {deleteConfirm === seed.id ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleDelete(seed.id)} 
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
                          to={`/seeds/edit/${seed.id}`} 
                          className="text-blue-600 hover:text-blue-800"
                        >
                          編集
                        </Link>
                        <button 
                          onClick={() => handleDelete(seed.id)} 
                          className="text-red-600 hover:text-red-800"
                        >
                          削除
                        </button>
                        <Link 
                          to={`/seed-uses/new?seedId=${seed.id}`} 
                          className="text-green-600 hover:text-green-800"
                        >
                          播種記録
                        </Link>
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
          <p className="text-gray-500 mb-4">種子・苗のデータがありません。</p>
          <Link 
            to="/seeds/new" 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            最初の種子・苗を登録する
          </Link>
        </div>
      )}
    </div>
  );
};

export default SeedsList;
