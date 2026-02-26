// src/pages/Visitors/VisitorsList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const VisitorsList = () => {
  const { currentUser } = useAuth();
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchVisitors();
    }
  }, [currentUser]);

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'visitors'),
        where('userId', '==', currentUser.uid),
        orderBy('visitDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const visitorsData = [];
      querySnapshot.forEach((doc) => {
        visitorsData.push({
          id: doc.id,
          ...doc.data(),
          visitDate: doc.data().visitDate?.toDate()
        });
      });
      setVisitors(visitorsData);
    } catch (err) {
      console.error('Error fetching visitors:', err);
      setError('訪問者記録の取得中にエラーが発生しました。');
      toast.error('訪問者記録の取得中にエラーが発生しました');
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
      await deleteDoc(doc(db, 'visitors', id));
      setVisitors(visitors.filter(visitor => visitor.id !== id));
      setDeleteConfirm(null);
      toast.success('訪問者記録を削除しました');
    } catch (err) {
      console.error('Error deleting visitor:', err);
      setError('訪問者記録の削除中にエラーが発生しました。');
      toast.error('訪問者記録の削除中にエラーが発生しました');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">訪問者管理</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">訪問者管理</h1>
        <Link 
          to="/visitors/new" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          新規訪問者登録
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {visitors.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left font-semibold">訪問日</th>
                <th className="py-3 px-4 text-left font-semibold">訪問者名</th>
                <th className="py-3 px-4 text-left font-semibold">所属</th>
                <th className="py-3 px-4 text-left font-semibold">訪問目的</th>
                <th className="py-3 px-4 text-left font-semibold">連絡先</th>
                <th className="py-3 px-4 text-left font-semibold">衛生管理</th>
                <th className="py-3 px-4 text-left font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => (
                <tr key={visitor.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    {visitor.visitDate ? format(visitor.visitDate, 'yyyy年MM月dd日') : '-'}
                  </td>
                  <td className="py-3 px-4">{visitor.visitorName || '-'}</td>
                  <td className="py-3 px-4">{visitor.organization || '-'}</td>
                  <td className="py-3 px-4">{visitor.purpose || '-'}</td>
                  <td className="py-3 px-4">{visitor.contactInfo || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      visitor.hygieneCompliance 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {visitor.hygieneCompliance ? '適合' : '不適合'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {deleteConfirm === visitor.id ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleDelete(visitor.id)} 
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
                          to={`/visitors/edit/${visitor.id}`} 
                          className="text-blue-600 hover:text-blue-800"
                        >
                          編集
                        </Link>
                        <button 
                          onClick={() => handleDelete(visitor.id)} 
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
          <p className="text-gray-500 mb-4">訪問者記録がありません。</p>
          <Link 
            to="/visitors/new" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            最初の訪問者記録を登録する
          </Link>
        </div>
      )}
    </div>
  );
};

export default VisitorsList;