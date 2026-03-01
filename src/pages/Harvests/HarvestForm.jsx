import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, getDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
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
  const [lotNumber, setLotNumber] = useState('');
  const [disposalAmount, setDisposalAmount] = useState('');
  const [disposalReason, setDisposalReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);

  // 廃棄率を自動計算
  const disposalRate = useMemo(() => {
    const harvestQty = parseFloat(quantity) || 0;
    const disposalQty = parseFloat(disposalAmount) || 0;

    if (harvestQty <= 0) return 0;

    // 収穫量 + 廃棄量 = 総量として計算
    const totalAmount = harvestQty + disposalQty;
    return ((disposalQty / totalAmount) * 100).toFixed(1);
  }, [quantity, disposalAmount]);

  // ロット番号自動生成
  const generateLotNumber = (fieldName, cropName, date) => {
    const dateStr = date.replace(/-/g, '');
    const fieldCode = fieldName ? fieldName.substring(0, 2).toUpperCase() : 'XX';
    const cropCode = cropName ? cropName.substring(0, 2).toUpperCase() : 'XX';
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${dateStr}-${fieldCode}-${cropCode}-${random}`;
  };

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
            setQuantity(data.quantity?.toString() || '');
            setUnit(data.unit || 'kg');
            setQuality(data.quality || '良');
            setNotes(data.notes || '');
            setLotNumber(data.lotNumber || '');
            setDisposalAmount(data.disposalAmount?.toString() || '');
            setDisposalReason(data.disposalReason || '');

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
      // ロット番号を自動生成（まだ生成されていない場合）
      if (!lotNumber && harvestDate && cropName) {
        setLotNumber(generateLotNumber(selectedField.name, cropName, harvestDate));
      }
    }
  };

  // ロット番号自動生成ボタン
  const handleGenerateLotNumber = () => {
    if (fieldName && cropName && harvestDate) {
      setLotNumber(generateLotNumber(fieldName, cropName, harvestDate));
    } else {
      toast.error('圃場、作物名、収穫日を入力してください');
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

    // ロット番号がない場合は自動生成
    const finalLotNumber = lotNumber || generateLotNumber(fieldName, cropName, harvestDate);

    // 廃棄率を計算
    const harvestQty = parseFloat(quantity) || 0;
    const disposalQty = parseFloat(disposalAmount) || 0;
    const totalAmount = harvestQty + disposalQty;
    const calculatedDisposalRate = totalAmount > 0 ? ((disposalQty / totalAmount) * 100) : 0;

    // 保存するデータの作成
    const harvestData = {
      cropName,
      harvestDate: new Date(harvestDate),
      fieldId,
      fieldName,
      quantity: Number(quantity),
      unit,
      quality,
      lotNumber: finalLotNumber,
      disposalAmount: disposalQty,
      disposalReason,
      disposalRate: parseFloat(calculatedDisposalRate.toFixed(1)),
      totalAmount: totalAmount,
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
    <div className="container mx-auto px-4 py-8 pb-20 md:pb-8">
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
                  収穫量（出荷可能量） <span className="text-red-500">*</span>
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

            {/* 廃棄量 */}
            <div>
              <label htmlFor="disposalAmount" className="block text-sm font-medium text-gray-700 mb-1">
                廃棄量
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  id="disposalAmount"
                  value={disposalAmount}
                  onChange={(e) => setDisposalAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className="mt-1 flex-1 py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
                <span className="text-gray-600">{unit}</span>
              </div>
            </div>

            {/* 廃棄率表示 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                廃棄率
              </label>
              <div className="mt-1 py-2 px-3 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex items-center justify-between">
                  <span className={`text-lg font-bold ${
                    parseFloat(disposalRate) > 20
                      ? 'text-red-600'
                      : parseFloat(disposalRate) > 10
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    {disposalRate}%
                  </span>
                  <span className="text-xs text-gray-500">
                    ({disposalAmount || 0} / {(parseFloat(quantity) || 0) + (parseFloat(disposalAmount) || 0)} {unit})
                  </span>
                </div>
                {/* 廃棄率バー */}
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      parseFloat(disposalRate) > 20
                        ? 'bg-red-500'
                        : parseFloat(disposalRate) > 10
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(parseFloat(disposalRate), 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 廃棄理由 */}
            <div>
              <label htmlFor="disposalReason" className="block text-sm font-medium text-gray-700 mb-1">
                廃棄理由
              </label>
              <select
                id="disposalReason"
                value={disposalReason}
                onChange={(e) => setDisposalReason(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">選択してください</option>
                <option value="規格外">規格外（サイズ・形状）</option>
                <option value="病害">病害</option>
                <option value="虫害">虫害</option>
                <option value="傷・損傷">傷・損傷</option>
                <option value="腐敗">腐敗</option>
                <option value="過熟">過熟</option>
                <option value="未熟">未熟</option>
                <option value="その他">その他</option>
              </select>
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

            {/* ロット番号 */}
            <div>
              <label htmlFor="lotNumber" className="block text-sm font-medium text-gray-700 mb-1">
                ロット番号
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  id="lotNumber"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="自動生成または入力"
                  className="mt-1 flex-1 py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
                <button
                  type="button"
                  onClick={handleGenerateLotNumber}
                  className="mt-1 py-2 px-3 border border-green-500 text-green-600 rounded-md hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  生成
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                トレーサビリティ用の識別番号（空欄時は自動生成）
              </p>
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
          <div className="mt-8 flex flex-col md:flex-row md:justify-end space-y-3 md:space-y-0 md:space-x-3">
            <button
              type="button"
              onClick={() => navigate('/harvests')}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 w-full md:w-auto"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 w-full md:w-auto ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
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
