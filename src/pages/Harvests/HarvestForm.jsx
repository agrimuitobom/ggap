import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, getDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
// 将来的に使用するためコメントアウト // import { format } from 'date-fns';
import toast from 'react-hot-toast';

const HarvestForm = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // フォームフィールド
  const [fields, setFields] = useState([]);
  const [cropName, setCropName] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [quality, setQuality] = useState('良');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);

  // 圃場データの読み込み
  useEffect(() => {
    const fetchFields = async () => {
      try {
        const fieldsQuery = query(
          collection(db, 'fields'),
          where('userId', '==', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(fieldsQuery);
        const fieldsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setFields(fieldsList);
      } catch (error) {
        console.error('Error fetching fields:', error);
        toast.error('圃場データの取得中にエラーが発生しました');
      }
    };

    fetchFields();
  }, [currentUser]);

  // 編集時のデータ読み込み
  useEffect(() => {
    if (isEditing) {
      const fetchHarvestData = async () => {
        try {
          const harvestDoc = await getDoc(doc(db, 'harvests', id));
          
          if (harvestDoc.exists()) {
            const data = harvestDoc.data();
            
            setCropName(data.cropName || '');
            
            // 日付の処理
            if (data.harvestDate) {
              const date = data.harvestDate.toDate ? data.harvestDate.toDate() : data.harvestDate;
              setHarvestDate(date.toISOString().split('T')[0]);
            }
            
            setFieldId(data.fieldId || '');
            setFieldName(data.fieldName || '');
            setQuantity(data.quantity || '');
            setUnit(data.unit || 'kg');
            setQuality(data.quality || '良');
            setNotes(data.notes || '');
            
            setInitialLoading(false);
          } else {
            toast.error('収穫記録が見つかりませんでした');
            navigate('/harvests');
          }
        } catch (error) {
          console.error('Error fetching harvest data:', error);
          toast.error('収穫記録の取得中にエラーが発生しました');
          setInitialLoading(false);
        }
      };
      
      fetchHarvestData();
    }
  }, [id, isEditing, navigate]);

  // 圃場選択時の処理
  const handleFieldChange = (e) => {
    const selectedFieldId = e.target.value;
    setFieldId(selectedFieldId);
    
    const selectedField = fields.find(field => field.id === selectedFieldId);
    if (selectedField) {
      setFieldName(selectedField.name);
    }
  };

  // フォーム送信処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!cropName || !harvestDate || !fieldId || !quantity) {
      toast.error('必須項目を入力してください');
      return;
    }
    
    setLoading(true);
    
    // 保存するデータの作成
    const harvestData = {
      cropName,
      harvestDate: new Date(harvestDate),
      fieldId,
      fieldName,
      quantity: Number(quantity),
      unit,
      quality,
      notes,
      userId: currentUser.uid,
      updatedAt: new Date()
    };
    
    try {
      if (isEditing) {
        // 既存の記録を更新
        await updateDoc(doc(db, 'harvests', id), harvestData);
        toast.success('収穫記録を更新しました');
      } else {
        // 新規記録を作成
        harvestData.createdAt = new Date();
        await addDoc(collection(db, 'harvests'), harvestData);
        toast.success('収穫記録を作成しました');
      }
      
      navigate('/harvests');
    } catch (error) {
      console.error('Error saving harvest data:', error);
      toast.error('収穫記録の保存中にエラーが発生しました');
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
        {isEditing ? '収穫記録の編集' : '新規収穫記録'}
      </h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 圃場選択 */}
            <div>
              <label htmlFor="fieldId" className="block text-sm font-medium text-gray-700 mb-1">
                圃場 <span className="text-red-500">*</span>
              </label>
              <select
                id="fieldId"
                value={fieldId}
                onChange={handleFieldChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">圃場を選択してください</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
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
            
            {/* 収穫日 */}
            <div>
              <label htmlFor="harvestDate" className="block text-sm font-medium text-gray-700 mb-1">
                収穫日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="harvestDate"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>
            
            {/* 収穫量と単位 */}
            <div className="flex space-x-2">
              <div className="flex-1">
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  収穫量 <span className="text-red-500">*</span>
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
            
            {/* 品質 */}
            <div>
              <label htmlFor="quality" className="block text-sm font-medium text-gray-700 mb-1">
                品質
              </label>
              <select
                id="quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="優">優</option>
                <option value="良">良</option>
                <option value="可">可</option>
              </select>
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
              onClick={() => navigate('/harvests')}
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

export default HarvestForm;