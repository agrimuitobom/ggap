// src/pages/FieldManagement/FieldsList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const FieldsList = () => {
  const { currentUser } = useAuth();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchFields();
    }
  }, [currentUser]);

  const fetchFields = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const q = query(
        collection(db, 'fields'),
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const fieldsList = [];
      querySnapshot.forEach((doc) => {
        fieldsList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setFields(fieldsList);
    } catch (err) {
      console.error('Error fetching fields:', err);
      setError('圃場データの取得中にエラーが発生しました。');
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
      await deleteDoc(doc(db, 'fields', id));
      setFields(fields.filter(field => field.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting field:', err);
      setError('圃場データの削除中にエラーが発生しました。');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">圃場一覧</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">圃場一覧</h1>
        <Link 
          to="/fields/new" 
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          新規圃場登録
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {fields.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fields.map(field => (
            <div key={field.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-2">{field.name}</h2>
                <div className="text-gray-600 mb-4">
                  <p><span className="font-medium">面積:</span> {field.area} m²</p>
                  <p><span className="font-medium">場所:</span> {field.location}</p>
                  <p><span className="font-medium">土壌タイプ:</span> {field.soilType}</p>
                  <p><span className="font-medium">説明:</span> {field.description || '-'}</p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  {deleteConfirm === field.id ? (
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleDelete(field.id)} 
                        className="text-red-700 hover:text-red-900"
                      >
                        削除確認
                      </button>
                      <button 
                        onClick={handleCancelDelete} 
                        className="text-gray-600 hover:text-gray-800"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-3">
                      <Link 
                        to={`/fields/edit/${field.id}`} 
                        className="text-blue-600 hover:text-blue-800"
                      >
                        編集
                      </Link>
                      <button 
                        onClick={() => handleDelete(field.id)} 
                        className="text-red-600 hover:text-red-800"
                      >
                        削除
                      </button>
                      <Link 
                        to={`/field-inspections/new?fieldId=${field.id}`} 
                        className="text-green-600 hover:text-green-800"
                      >
                        点検記録
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-gray-500 mb-4">圃場のデータがありません。</p>
          <Link 
            to="/fields/new" 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            最初の圃場を登録する
          </Link>
        </div>
      )}
    </div>
  );
};

export default FieldsList;
