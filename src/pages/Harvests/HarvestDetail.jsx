import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

const HarvestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [harvest, setHarvest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHarvestData = async () => {
      try {
        const harvestDoc = await getDoc(doc(db, 'harvests', id));
        
        if (harvestDoc.exists()) {
        setHarvest({
        id: harvestDoc.id,
        ...harvestDoc.data()
        });
        } else {
        alert('収穫記録が見つかりませんでした');
        navigate('/harvests');
        }
      } catch (error) {
      console.error('Error fetching harvest:', error);
      alert('収穫記録の取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchHarvestData();
  }, [id, navigate]);

  const handleDelete = async () => {
    if (window.confirm('この収穫記録を削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'harvests', id));
        alert('収穫記録を削除しました');
        navigate('/harvests');
      } catch (error) {
        console.error('Error deleting harvest:', error);
        alert('収穫記録の削除中にエラーが発生しました');
      }
    }
  };

  const formatDate = (date) => {
    if (!date) return '日付なし';
    
    const dateObj = date instanceof Date ? date : date.toDate();
    return dateObj.toLocaleDateString('ja-JP');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      </div>
    );
  }

  if (!harvest) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                収穫記録が見つかりませんでした
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Link to="/harvests" className="text-green-600 hover:text-green-800">
            収穫記録一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/harvests" className="text-green-600 hover:text-green-800 mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">収穫記録詳細</h1>
        </div>
        <div className="flex space-x-2">
          <Link 
            to={`/harvests/edit/${id}`}
            className="bg-amber-500 hover:bg-amber-600 text-white py-2 px-4 rounded transition duration-300"
          >
            編集
          </Link>
          <button 
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded transition duration-300"
          >
            削除
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-medium text-gray-900">
            {harvest.cropName} の収穫記録
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {formatDate(harvest.harvestDate)}
          </p>
        </div>
        
        <div className="px-6 py-5">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
            <div>
              <dt className="text-sm font-medium text-gray-500">圃場</dt>
              <dd className="mt-1 text-lg text-gray-900">{harvest.fieldName}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">収穫量</dt>
              <dd className="mt-1 text-lg text-gray-900">{harvest.quantity} {harvest.unit}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">品質</dt>
              <dd className="mt-1">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  harvest.quality === '優' 
                    ? 'bg-green-100 text-green-800' 
                    : harvest.quality === '良'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {harvest.quality}
                </span>
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">更新日時</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {harvest.updatedAt ? formatDate(harvest.updatedAt) : '情報なし'}
              </dd>
            </div>
            
            {harvest.notes && (
              <div className="col-span-2">
                <dt className="text-sm font-medium text-gray-500">備考</dt>
                <dd className="mt-1 text-gray-900 whitespace-pre-line">
                  {harvest.notes}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
};

export default HarvestDetail;