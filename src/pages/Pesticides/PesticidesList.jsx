// src/pages/Pesticides/PesticidesList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const PesticidesList = () => {
  const { currentUser } = useAuth();
  const [pesticides, setPesticides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchPesticides();
    }
  }, [currentUser]);

  const fetchPesticides = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const q = query(
        collection(db, 'pesticides'), 
        where('userId', '==', currentUser.uid),
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const pesticidesList = [];
      querySnapshot.forEach((doc) => {
        pesticidesList.push({
          id: doc.id,
          ...doc.data(),
          purchaseDate: doc.data().purchaseDate?.toDate(),
          expiryDate: doc.data().expiryDate?.toDate()
        });
      });
      setPesticides(pesticidesList);
    } catch (err) {
      console.error('Error fetching pesticides:', err);
      if (err.message && err.message.includes('index')) {
        setError('データベースのインデックスを準備中です。しばらく待ってから再度お試しください。');
      } else {
        setError('農薬データの取得中にエラーが発生しました。');
      }
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
      await deleteDoc(doc(db, 'pesticides', id));
      setPesticides(pesticides.filter(pesticide => pesticide.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting pesticide:', err);
      setError('農薬データの削除中にエラーが発生しました。');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const today = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(today.getMonth() + 3);
    return expiryDate <= threeMonthsFromNow;
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    const today = new Date();
    return expiryDate < today;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">農薬一覧</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">農薬一覧</h1>
        <Link 
          to="/pesticides/new" 
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          新規農薬登録
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {pesticides.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">農薬名</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">分類</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">有効成分</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">剤型</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">登録番号</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">メーカー</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">有効期限</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {pesticides.map((pesticide) => (
                <tr 
                  key={pesticide.id} 
                  className={`border-t border-gray-200 hover:bg-gray-50 ${
                    isExpired(pesticide.expiryDate) ? 'bg-red-50' : 
                    isExpiringSoon(pesticide.expiryDate) ? 'bg-yellow-50' : ''
                  }`}
                >
                  <td className="py-3 px-4 whitespace-nowrap font-medium">{pesticide.name}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{pesticide.type}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {pesticide.activeIngredient}
                    {pesticide.concentration && (
                      <span className="text-gray-600 ml-1">({pesticide.concentration}%)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{pesticide.formulation}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{pesticide.registrationNumber}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{pesticide.manufacturer}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {pesticide.expiryDate ? (
                      <span className={
                        isExpired(pesticide.expiryDate) ? 'text-red-600 font-bold' :
                        isExpiringSoon(pesticide.expiryDate) ? 'text-yellow-600 font-bold' :
                        'text-gray-900'
                      }>
                        {pesticide.expiryDate.toLocaleDateString()}
                        {isExpired(pesticide.expiryDate) && ' (期限切れ)'}
                        {!isExpired(pesticide.expiryDate) && isExpiringSoon(pesticide.expiryDate) && ' (要注意)'}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {deleteConfirm === pesticide.id ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleDelete(pesticide.id)} 
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
                          to={`/pesticides/edit/${pesticide.id}`} 
                          className="text-blue-600 hover:text-blue-800"
                        >
                          編集
                        </Link>
                        <Link 
                          to={`/pesticide-uses/new?pesticideId=${pesticide.id}`} 
                          className="text-green-600 hover:text-green-800"
                        >
                          使用記録
                        </Link>
                        <button 
                          onClick={() => handleDelete(pesticide.id)} 
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
          
          {/* 期限アラート */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-200 rounded mr-2"></div>
                <span>期限切れ</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-200 rounded mr-2"></div>
                <span>3ヶ月以内に期限切れ</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-gray-500 mb-4">農薬のデータがありません。</p>
          <Link 
            to="/pesticides/new" 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            最初の農薬を登録する
          </Link>
        </div>
      )}
    </div>
  );
};

export default PesticidesList;