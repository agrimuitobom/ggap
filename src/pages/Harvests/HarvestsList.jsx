import React, { useState, useEffect } from 'react';
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">収穫記録</h1>
        <Link 
          to="/harvests/new" 
          className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-300 flex items-center"
        >
          <span className="mr-2">新規記録</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
        </div>
      ) : harvests.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  収穫日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  圃場
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  作物
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  収穫量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  品質
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {harvests.map((harvest) => (
                <tr key={harvest.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {harvest.harvestDate instanceof Date 
                      ? format(harvest.harvestDate, 'yyyy年MM月dd日')
                      : harvest.harvestDate && harvest.harvestDate.toDate 
                        ? format(harvest.harvestDate.toDate(), 'yyyy年MM月dd日')
                        : '日付なし'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {harvest.fieldName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {harvest.cropName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {harvest.quantity} {harvest.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
              ))}
            </tbody>
          </table>
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