// src/pages/Fertilizers/FertilizersList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, getDocs, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { calcFertilizerStock, formatStock } from '../../services/inventoryService';
import { firestoreLogger } from '../../utils/logger';

const STOCK_STYLES = {
  ok: 'text-gray-900',
  low: 'text-orange-600 font-bold',
  empty: 'text-red-600 font-bold'
};

const FertilizersList = () => {
  const navigate = useNavigate();
  const [fertilizers, setFertilizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const { currentOrganization } = useOrganization();

  const fetchFertilizers = useCallback(async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const [querySnapshot, usesSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, 'fertilizers'),
          where('organizationId', '==', currentOrganization.id)
        )),
        getDocs(query(
          collection(db, 'fertilizerUses'),
          where('organizationId', '==', currentOrganization.id)
        ))
      ]);

      // 肥料ごとの使用記録をまとめる
      const usesByFertilizer = {};
      usesSnapshot.forEach((useDoc) => {
        const use = useDoc.data();
        if (!use.fertilizerId) return;
        if (!usesByFertilizer[use.fertilizerId]) {
          usesByFertilizer[use.fertilizerId] = [];
        }
        usesByFertilizer[use.fertilizerId].push(use);
      });

      const fertilizersList = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fertilizersList.push({
          id: doc.id,
          ...data,
          purchaseDate: data.purchaseDate?.toDate(),
          stock: formatStock(
            calcFertilizerStock(data, usesByFertilizer[doc.id] || []),
            data.purchaseUnit
          )
        });
      });
      setFertilizers(fertilizersList);
    } catch (err) {
      firestoreLogger.error('肥料データの取得に失敗しました', {
        organizationId: currentOrganization.id
      }, err);
      setError('肥料データの取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    fetchFertilizers();
  }, [fetchFertilizers]);

  const handleDelete = async (id) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    try {
      await deleteDoc(doc(db, 'fertilizers', id));
      setFertilizers(fertilizers.filter(fertilizer => fertilizer.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      firestoreLogger.error('肥料データの削除に失敗しました', { fertilizerId: id }, err);
      setError('肥料データの削除中にエラーが発生しました。');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">肥料一覧</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">肥料一覧</h1>
        <Link 
          to="/fertilizers/new" 
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          新規肥料登録
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {fertilizers.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left font-semibold">名称</th>
                <th className="py-3 px-4 text-left font-semibold">メーカー</th>
                <th className="py-3 px-4 text-left font-semibold">肥料タイプ</th>
                <th className="py-3 px-4 text-left font-semibold">N-P-K</th>
                <th className="py-3 px-4 text-left font-semibold">在庫（推定）</th>
                <th className="py-3 px-4 text-left font-semibold">ロット番号</th>
                <th className="py-3 px-4 text-left font-semibold">購入日</th>
                <th className="py-3 px-4 text-left font-semibold">備考</th>
                <th className="py-3 px-4 text-left font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {fertilizers.map((fertilizer) => (
                <tr
                  key={fertilizer.id}
                  onClick={() => navigate(`/fertilizers/edit/${fertilizer.id}`)}
                  className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <td className="py-3 px-4">{fertilizer.name || '-'}</td>
                  <td className="py-3 px-4">{fertilizer.manufacturer || '-'}</td>
                  <td className="py-3 px-4">{fertilizer.type || '-'}</td>
                  <td className="py-3 px-4">
                    {fertilizer.nitrogenContent ? fertilizer.nitrogenContent : '-'}-
                    {fertilizer.phosphorusContent ? fertilizer.phosphorusContent : '-'}-
                    {fertilizer.potassiumContent ? fertilizer.potassiumContent : '-'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {fertilizer.stock ? (
                      <span className={STOCK_STYLES[fertilizer.stock.level]}>
                        {fertilizer.stock.level === 'empty' && '🚫 '}
                        {fertilizer.stock.level === 'low' && '⚠️ '}
                        {fertilizer.stock.display}
                        {fertilizer.stock.level === 'low' && '（残りわずか）'}
                        {fertilizer.stock.level === 'empty' && '（在庫切れ）'}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm" title="編集画面で購入量を登録すると在庫を自動計算します">
                        未設定
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">{fertilizer.lotNumber || '-'}</td>
                  <td className="py-3 px-4">{fertilizer.purchaseDate?.toLocaleDateString() || '-'}</td>
                  <td className="py-3 px-4">
                    {fertilizer.notes ? (
                      <span 
                        className="text-blue-600 cursor-help"
                        title={fertilizer.notes}
                      >
                        📝
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="py-3 px-4">
                    {deleteConfirm === fertilizer.id ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleDelete(fertilizer.id)} 
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
                          to={`/fertilizers/edit/${fertilizer.id}`} 
                          className="text-blue-600 hover:text-blue-800"
                        >
                          編集
                        </Link>
                        <button 
                          onClick={() => handleDelete(fertilizer.id)} 
                          className="text-red-600 hover:text-red-800"
                        >
                          削除
                        </button>
                        <Link 
                          to={`/fertilizer-uses/new?fertilizerId=${fertilizer.id}`} 
                          className="text-green-600 hover:text-green-800"
                        >
                          使用記録
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
          <p className="text-gray-500 mb-4">肥料のデータがありません。</p>
          <Link 
            to="/fertilizers/new" 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            最初の肥料を登録する
          </Link>
        </div>
      )}
    </div>
  );
};

export default FertilizersList;
