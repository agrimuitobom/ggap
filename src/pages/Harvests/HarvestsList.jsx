import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const HarvestsList = () => {
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchHarvests = async () => {
      try {
        const harvestsQuery = query(
          collection(db, 'harvests'),
          where('userId', '==', currentUser.uid),
          orderBy('harvestDate', 'desc')
        );

        const querySnapshot = await getDocs(harvestsQuery);
        const harvestsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setHarvests(harvestsList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching harvests:', error);
        toast.error('収穫記録の取得中にエラーが発生しました');
        setLoading(false);
      }
    };

    fetchHarvests();
  }, [currentUser]);

  // 全体の廃棄率を計算
  const totalStats = useMemo(() => {
    let totalHarvest = 0;
    let totalDisposal = 0;

    harvests.forEach(harvest => {
      totalHarvest += parseFloat(harvest.quantity) || 0;
      totalDisposal += parseFloat(harvest.disposalAmount) || 0;
    });

    const totalAmount = totalHarvest + totalDisposal;
    const disposalRate = totalAmount > 0 ? ((totalDisposal / totalAmount) * 100).toFixed(1) : 0;

    return {
      totalHarvest: totalHarvest.toFixed(1),
      totalDisposal: totalDisposal.toFixed(1),
      totalAmount: totalAmount.toFixed(1),
      disposalRate
    };
  }, [harvests]);

  const handleDelete = async (id) => {
    if (window.confirm('この収穫記録を削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'harvests', id));
        setHarvests(harvests.filter(harvest => harvest.id !== id));
        toast.success('収穫記録を削除しました');
      } catch (error) {
        console.error('Error deleting harvest:', error);
        toast.error('収穫記録の削除中にエラーが発生しました');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-20 md:pb-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">収穫記録</h1>
        <Link
          to="/harvests/new"
          className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-300 flex items-center justify-center"
        >
          <span className="mr-2">新規記録</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      {/* 統計サマリー */}
      {harvests.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">総収穫量（出荷可能）</p>
            <p className="text-xl font-bold text-green-600">{totalStats.totalHarvest} kg</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">総廃棄量</p>
            <p className="text-xl font-bold text-red-600">{totalStats.totalDisposal} kg</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">総生産量</p>
            <p className="text-xl font-bold text-gray-700">{totalStats.totalAmount} kg</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">平均廃棄率</p>
            <div className="flex items-center">
              <p className={`text-xl font-bold ${
                parseFloat(totalStats.disposalRate) > 20
                  ? 'text-red-600'
                  : parseFloat(totalStats.disposalRate) > 10
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}>
                {totalStats.disposalRate}%
              </p>
              {parseFloat(totalStats.disposalRate) <= 10 && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">良好</span>
              )}
              {parseFloat(totalStats.disposalRate) > 10 && parseFloat(totalStats.disposalRate) <= 20 && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">注意</span>
              )}
              {parseFloat(totalStats.disposalRate) > 20 && (
                <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">要改善</span>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
        </div>
      ) : harvests.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  収穫日
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  圃場
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  作物
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  収穫量
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  廃棄量
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  廃棄率
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  品質
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {harvests.map((harvest) => {
                const disposalRate = harvest.disposalRate || 0;
                return (
                  <tr key={harvest.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {harvest.harvestDate instanceof Date
                        ? format(harvest.harvestDate, 'yyyy/MM/dd')
                        : harvest.harvestDate && harvest.harvestDate.toDate
                          ? format(harvest.harvestDate.toDate(), 'yyyy/MM/dd')
                          : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {harvest.fieldName || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {harvest.cropName || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {harvest.quantity} {harvest.unit}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 hidden md:table-cell">
                      {harvest.disposalAmount ? (
                        <span className="text-red-600">
                          {harvest.disposalAmount} {harvest.unit}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        disposalRate > 20
                          ? 'bg-red-100 text-red-700'
                          : disposalRate > 10
                          ? 'bg-yellow-100 text-yellow-700'
                          : disposalRate > 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {disposalRate > 0 ? `${disposalRate}%` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 hidden lg:table-cell">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        harvest.quality === '優'
                          ? 'bg-green-100 text-green-800'
                          : harvest.quality === '良'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {harvest.quality}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link
                          to={`/harvests/${harvest.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          詳細
                        </Link>
                        <Link
                          to={`/harvests/edit/${harvest.id}`}
                          className="text-amber-600 hover:text-amber-900"
                        >
                          編集
                        </Link>
                        <button
                          onClick={() => handleDelete(harvest.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="bg-gray-50 px-4 py-2 border-t">
            <p className="text-sm text-gray-500">{harvests.length}件の収穫記録</p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <p className="text-gray-500 mb-4">収穫記録がまだありません</p>
          <Link
            to="/harvests/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            最初の収穫記録を作成する
          </Link>
        </div>
      )}
    </div>
  );
};

export default HarvestsList;
