import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, getDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
// 将来的に使用するためコメントアウト // import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ShipmentForm = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // フォームフィールド
  const [harvests, setHarvests] = useState([]);
  const [destination, setDestination] = useState('');
  const [shipmentDate, setShipmentDate] = useState('');
  const [harvestId, setHarvestId] = useState('');
  const [cropName, setCropName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [shippingMethod, setShippingMethod] = useState('');
  const [status, setStatus] = useState('準備中');
  const [lotNumber, setLotNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);

  // 収穫データの読み込み
  useEffect(() => {
    const fetchHarvests = async () => {
      try {
        const harvestsQuery = query(
          collection(db, 'harvests'),
          where('userId', '==', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(harvestsQuery);
        const harvestsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setHarvests(harvestsList);
      } catch (error) {
        console.error('Error fetching harvests:', error);
        toast.error('収穫データの取得中にエラーが発生しました');
      }
    };

    fetchHarvests();
  }, [currentUser]);

  // 編集時のデータ読み込み
  useEffect(() => {
    if (isEditing) {
      const fetchShipmentData = async () => {
        try {
          const shipmentDoc = await getDoc(doc(db, 'shipments', id));
          
          if (shipmentDoc.exists()) {
            const data = shipmentDoc.data();
            
            setDestination(data.destination || '');
            
            // 日付の処理
            if (data.shipmentDate) {
              const date = data.shipmentDate.toDate ? data.shipmentDate.toDate() : data.shipmentDate;
              setShipmentDate(date.toISOString().split('T')[0]);
            }
            
            setHarvestId(data.harvestId || '');
            setCropName(data.cropName || '');
            setQuantity(data.quantity || '');
            setUnit(data.unit || 'kg');
            setShippingMethod(data.shippingMethod || '');
            setStatus(data.status || '準備中');
            setLotNumber(data.lotNumber || '');
            setNotes(data.notes || '');
            
            setInitialLoading(false);
          } else {
            toast.error('出荷記録が見つかりませんでした');
            navigate('/shipments');
          }
        } catch (error) {
          console.error('Error fetching shipment data:', error);
          toast.error('出荷記録の取得中にエラーが発生しました');
          setInitialLoading(false);
        }
      };
      
      fetchShipmentData();
    }
  }, [id, isEditing, navigate]);

  // 収穫選択時の処理
  const handleHarvestChange = (e) => {
    const selectedHarvestId = e.target.value;
    setHarvestId(selectedHarvestId);
    
    const selectedHarvest = harvests.find(harvest => harvest.id === selectedHarvestId);
    if (selectedHarvest) {
      setCropName(selectedHarvest.cropName || '');
      setUnit(selectedHarvest.unit || 'kg');
    }
  };

  // フォーム送信処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!destination || !shipmentDate || !cropName || !quantity) {
      toast.error('必須項目を入力してください');
      return;
    }
    
    setLoading(true);
    
    // 保存するデータの作成
    const shipmentData = {
      destination,
      shipmentDate: new Date(shipmentDate),
      harvestId,
      cropName,
      quantity: Number(quantity),
      unit,
      shippingMethod,
      status,
      lotNumber,
      notes,
      userId: currentUser.uid,
      updatedAt: new Date()
    };
    
    try {
      if (isEditing) {
        // 既存の記録を更新
        await updateDoc(doc(db, 'shipments', id), shipmentData);
        toast.success('出荷記録を更新しました');
      } else {
        // 新規記録を作成
        shipmentData.createdAt = new Date();
        await addDoc(collection(db, 'shipments'), shipmentData);
        toast.success('出荷記録を作成しました');
      }
      
      navigate('/shipments');
    } catch (error) {
      console.error('Error saving shipment data:', error);
      toast.error('出荷記録の保存中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {isEditing ? '出荷記録の編集' : '新規出荷記録'}
      </h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 出荷先 */}
            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-1">
                出荷先 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>
            
            {/* 出荷日 */}
            <div>
              <label htmlFor="shipmentDate" className="block text-sm font-medium text-gray-700 mb-1">
                出荷日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="shipmentDate"
                value={shipmentDate}
                onChange={(e) => setShipmentDate(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>
            
            {/* 関連する収穫記録 */}
            <div>
              <label htmlFor="harvestId" className="block text-sm font-medium text-gray-700 mb-1">
                関連する収穫記録
              </label>
              <select
                id="harvestId"
                value={harvestId}
                onChange={handleHarvestChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">選択してください（任意）</option>
                {harvests.map((harvest) => (
                  <option key={harvest.id} value={harvest.id}>
                    {harvest.cropName} ({harvest.quantity} {harvest.unit})
                  </option>
                ))}
              </select>
            </div>
            
            {/* 作物名 */}
            <div>
              <label htmlFor="cropName" className="block text-sm font-medium text-gray-700 mb-1">
                作物名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="cropName"
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>
            
            {/* 数量と単位 */}
            <div className="flex space-x-2">
              <div className="flex-1">
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  数量 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  step="0.01"
                  min="0"
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>
              <div className="w-24">
                <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">
                  単位
                </label>
                <select
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="t">t</option>
                  <option value="個">個</option>
                  <option value="箱">箱</option>
                  <option value="袋">袋</option>
                </select>
              </div>
            </div>
            
            {/* 出荷方法 */}
            <div>
              <label htmlFor="shippingMethod" className="block text-sm font-medium text-gray-700 mb-1">
                出荷方法
              </label>
              <input
                type="text"
                id="shippingMethod"
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            {/* 出荷状態 */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                出荷状態
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="準備中">準備中</option>
                <option value="発送中">発送中</option>
                <option value="完了">完了</option>
                <option value="キャンセル">キャンセル</option>
              </select>
            </div>
            
            {/* ロット番号 */}
            <div>
              <label htmlFor="lotNumber" className="block text-sm font-medium text-gray-700 mb-1">
                ロット番号
              </label>
              <input
                type="text"
                id="lotNumber"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
          
          {/* 備考 */}
          <div className="mt-6">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              備考
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="4"
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
            ></textarea>
          </div>
          
          {/* ボタン */}
          <div className="mt-8 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/shipments')}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </span>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShipmentForm;