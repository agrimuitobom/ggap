import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ShipmentsList = () => {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchShipments = async () => {
      try {
        const shipmentsQuery = query(
          collection(db, 'shipments'),
          where('userId', '==', currentUser.uid),
          orderBy('shipmentDate', 'desc')
        );
        
        const querySnapshot = await getDocs(shipmentsQuery);
        const shipmentsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setShipments(shipmentsList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching shipments:', error);
        toast.error('出荷記録の取得中にエラーが発生しました');
        setLoading(false);
      }
    };

    fetchShipments();
  }, [currentUser]);

  const handleDelete = async (id) => {
    if (window.confirm('この出荷記録を削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'shipments', id));
        setShipments(shipments.filter(shipment => shipment.id !== id));
        toast.success('出荷記録を削除しました');
      } catch (error) {
        console.error('Error deleting shipment:', error);
        toast.error('出荷記録の削除中にエラーが発生しました');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">出荷記録</h1>
        <Link 
          to="/shipments/new" 
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
      ) : shipments.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  出荷日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  出荷先
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  作物
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  出荷状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shipment.shipmentDate instanceof Date 
                      ? format(shipment.shipmentDate, 'yyyy年MM月dd日')
                      : shipment.shipmentDate && shipment.shipmentDate.toDate 
                        ? format(shipment.shipmentDate.toDate(), 'yyyy年MM月dd日')
                        : '日付なし'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shipment.destination}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shipment.cropName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shipment.quantity} {shipment.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      shipment.status === '完了' 
                        ? 'bg-green-100 text-green-800' 
                        : shipment.status === '準備中'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}>
                      {shipment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link 
                        to={`/shipments/${shipment.id}`} 
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        詳細
                      </Link>
                      <Link 
                        to={`/shipments/edit/${shipment.id}`} 
                        className="text-amber-600 hover:text-amber-900"
                      >
                        編集
                      </Link>
                      <button
                        onClick={() => handleDelete(shipment.id)}
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
          <p className="text-gray-500 mb-4">出荷記録がまだありません</p>
          <Link 
            to="/shipments/new" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            最初の出荷記録を作成する
          </Link>
        </div>
      )}
    </div>
  );
};

export default ShipmentsList;