// src/pages/FieldManagement/FieldsList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { isSoillessType } from '../../constants/cultivation';
import { firestoreLogger } from '../../utils/logger';

const FieldsList = () => {
  const { currentOrganization } = useOrganization();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (currentOrganization) {
      fetchFields();
    }
  }, [currentOrganization]);

  const fetchFields = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'fields'),
        where('organizationId', '==', currentOrganization.id)
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
      firestoreLogger.error('圃場データの取得に失敗しました', { organizationId: currentOrganization.id }, err);
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
      firestoreLogger.error('圃場データの削除に失敗しました', { fieldId: id }, err);
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

      {/* 栽培方式が未設定の圃場を促す（養液管理などの対象判定に使うため） */}
      {fields.some((f) => !f.cultivationType) && (
        <div className="bg-amber-50 border-2 border-amber-300 text-amber-800 px-4 py-3 mb-4 rounded-lg text-sm">
          ⚠️ 栽培方式が未設定の圃場があります。各圃場の「編集」から水耕・土耕などを設定してください。
          設定すると、養液管理や施肥の記録が正しく切り替わります。
        </div>
      )}

      {fields.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fields.map(field => (
            <div key={field.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold">{field.name}</h2>
                  {field.currentCrop && (
                    <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                      🌱 {field.currentCrop}
                    </span>
                  )}
                </div>
                <div className="mb-2">
                  {field.cultivationType ? (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      isSoillessType(field.cultivationType)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isSoillessType(field.cultivationType) ? '💧' : '🌾'} {field.cultivationType}
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold bg-gray-200 text-gray-600 rounded-full">
                      栽培方式が未設定
                    </span>
                  )}
                </div>
                <div className="text-gray-600 mb-4">
                  <p><span className="font-medium">面積:</span> {field.area} m²</p>
                  <p><span className="font-medium">場所:</span> {field.location}</p>
                  {isSoillessType(field.cultivationType) ? (
                    <p><span className="font-medium">培地:</span> {field.substrate || '-'}</p>
                  ) : (
                    <p><span className="font-medium">土壌タイプ:</span> {field.soilType || '-'}</p>
                  )}
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
