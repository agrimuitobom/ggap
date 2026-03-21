// src/pages/Fertilizers/FertilizerUsesList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import logger from '../../utils/logger';

const FertilizerUsesList = () => {
  const { currentOrganization } = useOrganization();
  const [fertilizerUses, setFertilizerUses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (currentOrganization) {
      fetchFertilizerUses();
    }
  }, [currentOrganization]);

  const fetchFertilizerUses = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);

      logger.debug('FertilizerUsesList - Fetching data for organization', { organizationId: currentOrganization.id });

      const q = query(
        collection(db, 'fertilizerUses'),
        where('organizationId', '==', currentOrganization.id),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      logger.debug('FertilizerUsesList - Query result count', { count: querySnapshot.size });
      
      const uses = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        logger.debug('FertilizerUsesList - Document', {
          id: doc.id,
          date: data.date?.toDate?.() || data.date,
          dateType: typeof data.date,
          hasToDate: typeof data.date?.toDate === 'function',
          fertilizerName: data.fertilizerName,
          fieldName: data.fieldName
        });
        
        uses.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate()
        });
      });
      
      logger.debug('FertilizerUsesList - Final processed count', { count: uses.length });
      logger.debug('FertilizerUsesList - Date range', { first: uses[0]?.useDate, last: uses[uses.length-1]?.useDate });
      
      setFertilizerUses(uses);
    } catch (err) {
      logger.error('Error fetching fertilizer uses', {}, err);
      setError('施肥記録の取得中にエラーが発生しました。');
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
      await deleteDoc(doc(db, 'fertilizerUses', id));
      setFertilizerUses(fertilizerUses.filter(use => use.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      logger.error('Error deleting fertilizer use', {}, err);
      setError('施肥記録の削除中にエラーが発生しました。');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">施肥記録一覧</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto mobile-container pb-20 md:pb-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 space-y-4 md:space-y-0">
        <h1 className="mobile-form-header md:text-left">施肥記録一覧</h1>
        <Link 
          to="/fertilizer-uses/new" 
          className="mobile-btn mobile-btn-success w-full md:w-auto text-center"
        >
          新規施肥記録登録
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {fertilizerUses.length > 0 ? (
        <>
          {/* デスクトップ用テーブル */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">作業日</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">肥料名</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">圃場</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">使用量</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">施肥方法</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">作業者</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">備考</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">操作</th>
                </tr>
              </thead>
              <tbody>
                {fertilizerUses.map((use) => (
                  <tr key={use.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">{use.date?.toLocaleDateString() || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">{use.fertilizerName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">{use.fieldName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">{use.amount ? `${use.amount} ${use.unit}` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">{use.method || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">{use.appliedByName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b max-w-xs truncate" title={use.notes}>{use.notes || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {deleteConfirm === use.id ? (
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => handleDelete(use.id)} 
                            className="text-red-700 hover:text-red-900 px-2 py-1 text-sm"
                          >
                            確認
                          </button>
                          <button 
                            onClick={handleCancelDelete} 
                            className="text-gray-600 hover:text-gray-800 px-2 py-1 text-sm"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <Link 
                            to={`/fertilizer-uses/edit/${use.id}`} 
                            className="text-blue-600 hover:text-blue-800 px-2 py-1 text-sm"
                          >
                            編集
                          </Link>
                          <button 
                            onClick={() => handleDelete(use.id)} 
                            className="text-red-600 hover:text-red-800 px-2 py-1 text-sm"
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

          {/* モバイル用カード */}
          <div className="md:hidden space-y-4">
            {fertilizerUses.map((use) => (
              <div key={use.id} className="mobile-card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">{use.fertilizerName || '-'}</h3>
                    <p className="text-sm text-gray-600">{use.date?.toLocaleDateString() || '-'}</p>
                  </div>
                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                    {use.amount ? `${use.amount} ${use.unit}` : '-'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">圃場：</span>
                    <span className="font-medium">{use.fieldName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">施肥方法：</span>
                    <span className="font-medium">{use.method || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">作業者：</span>
                    <span className="font-medium">{use.appliedByName || '-'}</span>
                  </div>
                </div>
                
                {use.notes && (
                  <div className="mb-4">
                    <span className="text-gray-500 text-sm">備考：</span>
                    <p className="text-sm text-gray-700 mt-1">{use.notes}</p>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  {deleteConfirm === use.id ? (
                    <>
                      <button 
                        onClick={() => handleDelete(use.id)} 
                        className="mobile-btn mobile-btn-danger flex-1"
                      >
                        削除確認
                      </button>
                      <button 
                        onClick={handleCancelDelete} 
                        className="mobile-btn mobile-btn-secondary flex-1"
                      >
                        キャンセル
                      </button>
                    </>
                  ) : (
                    <>
                      <Link 
                        to={`/fertilizer-uses/edit/${use.id}`} 
                        className="mobile-btn mobile-btn-primary flex-1 text-center"
                      >
                        編集
                      </Link>
                      <button 
                        onClick={() => handleDelete(use.id)} 
                        className="mobile-btn mobile-btn-danger flex-1"
                      >
                        削除
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-gray-500 mb-4">施肥記録のデータがありません。</p>
          <Link 
            to="/fertilizer-uses/new" 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            最初の施肥記録を登録する
          </Link>
        </div>
      )}
    </div>
  );
};

export default FertilizerUsesList;