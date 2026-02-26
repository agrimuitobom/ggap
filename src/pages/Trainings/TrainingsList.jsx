// src/pages/Trainings/TrainingsList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const TrainingsList = () => {
  const { currentUser } = useAuth();
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchTrainings();
    }
  }, [currentUser]);

  const fetchTrainings = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'trainings'),
        where('userId', '==', currentUser.uid),
        orderBy('trainingDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const trainingsData = [];
      querySnapshot.forEach((doc) => {
        trainingsData.push({
          id: doc.id,
          ...doc.data(),
          trainingDate: doc.data().trainingDate?.toDate()
        });
      });
      setTrainings(trainingsData);
    } catch (err) {
      console.error('Error fetching trainings:', err);
      setError('教育・訓練記録の取得中にエラーが発生しました。');
      toast.error('教育・訓練記録の取得中にエラーが発生しました');
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
      await deleteDoc(doc(db, 'trainings', id));
      setTrainings(trainings.filter(training => training.id !== id));
      setDeleteConfirm(null);
      toast.success('教育・訓練記録を削除しました');
    } catch (err) {
      console.error('Error deleting training:', err);
      setError('教育・訓練記録の削除中にエラーが発生しました。');
      toast.error('教育・訓練記録の削除中にエラーが発生しました');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      '完了': 'bg-green-100 text-green-800',
      '進行中': 'bg-blue-100 text-blue-800',
      '予定': 'bg-yellow-100 text-yellow-800',
      '延期': 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status || '-'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">教育・訓練記録管理</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">教育・訓練記録管理</h1>
        <Link 
          to="/trainings/new" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          新規教育・訓練記録登録
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {trainings.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left font-semibold">実施日</th>
                <th className="py-3 px-4 text-left font-semibold">教育・訓練名</th>
                <th className="py-3 px-4 text-left font-semibold">カテゴリ</th>
                <th className="py-3 px-4 text-left font-semibold">講師</th>
                <th className="py-3 px-4 text-left font-semibold">参加者数</th>
                <th className="py-3 px-4 text-left font-semibold">時間</th>
                <th className="py-3 px-4 text-left font-semibold">状態</th>
                <th className="py-3 px-4 text-left font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {trainings.map((training) => (
                <tr key={training.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    {training.trainingDate ? format(training.trainingDate, 'yyyy年MM月dd日') : '-'}
                  </td>
                  <td className="py-3 px-4">{training.title || '-'}</td>
                  <td className="py-3 px-4">{training.category || '-'}</td>
                  <td className="py-3 px-4">{training.instructor || '-'}</td>
                  <td className="py-3 px-4">
                    {training.participants?.length || 0}人
                  </td>
                  <td className="py-3 px-4">
                    {training.duration ? `${training.duration}時間` : '-'}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(training.status)}
                  </td>
                  <td className="py-3 px-4">
                    {deleteConfirm === training.id ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleDelete(training.id)} 
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
                          to={`/trainings/edit/${training.id}`} 
                          className="text-blue-600 hover:text-blue-800"
                        >
                          編集
                        </Link>
                        <button 
                          onClick={() => handleDelete(training.id)} 
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
          <p className="text-gray-500 mb-4">教育・訓練記録がありません。</p>
          <Link 
            to="/trainings/new" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            最初の教育・訓練記録を登録する
          </Link>
        </div>
      )}
    </div>
  );
};

export default TrainingsList;