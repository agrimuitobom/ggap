// src/pages/Fertilizers/FertilizerForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const FertilizerForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    manufacturer: '',
    type: '',
    nitrogenContent: '',
    phosphorusContent: '',
    potassiumContent: '',
    lotNumber: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    supplier: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(!!id);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isEditMode = !!id;

  useEffect(() => {
    // 編集モードの場合、既存データを取得
    if (isEditMode) {
      const fetchFertilizer = async () => {
        try {
          const docRef = doc(db, 'fertilizers', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              name: data.name || '',
              manufacturer: data.manufacturer || '',
              type: data.type || '',
              nitrogenContent: data.nitrogenContent?.toString() || '',
              phosphorusContent: data.phosphorusContent?.toString() || '',
              potassiumContent: data.potassiumContent?.toString() || '',
              lotNumber: data.lotNumber || '',
              purchaseDate: data.purchaseDate?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              supplier: data.supplier || '',
              notes: data.notes || ''
            });
          } else {
            setError('指定された肥料データが見つかりません。');
            navigate('/fertilizers');
          }
        } catch (err) {
          console.error('Error fetching fertilizer data:', err);
          setError('データの取得中にエラーが発生しました。');
        } finally {
          setFetchLoading(false);
        }
      };

      fetchFertilizer();
    }
  }, [id, isEditMode, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('ユーザー認証が必要です。');
      return;
    }
    
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const fertilizerData = {
        ...formData,
        nitrogenContent: formData.nitrogenContent ? Number(formData.nitrogenContent) : null,
        phosphorusContent: formData.phosphorusContent ? Number(formData.phosphorusContent) : null,
        potassiumContent: formData.potassiumContent ? Number(formData.potassiumContent) : null,
        purchaseDate: new Date(formData.purchaseDate),
        userId: currentUser.uid,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        // 既存のドキュメントを更新
        await updateDoc(doc(db, 'fertilizers', id), fertilizerData);
        setMessage('肥料データが正常に更新されました');
      } else {
        // 新規ドキュメントを作成
        fertilizerData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'fertilizers'), fertilizerData);
        setMessage('肥料データが正常に登録されました');
        
        // フォームをリセット
        setFormData({
          name: '',
          manufacturer: '',
          type: '',
          nitrogenContent: '',
          phosphorusContent: '',
          potassiumContent: '',
          lotNumber: '',
          purchaseDate: new Date().toISOString().split('T')[0],
          supplier: '',
          notes: ''
        });
      }
      
      // 成功メッセージを表示後、一覧画面に戻る
      setTimeout(() => {
        navigate('/fertilizers');
      }, 2000);
    } catch (err) {
      console.error('Error saving fertilizer data:', err);
      setError('肥料データの保存中にエラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '肥料データ編集' : '肥料データ登録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '肥料データ編集' : '肥料データ登録'}</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 mb-4 rounded">
          {message}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
            肥料名 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="例: 有機アミノ酸肥料、化成肥料8-8-8 など"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="manufacturer">
            メーカー *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="manufacturer"
            type="text"
            name="manufacturer"
            value={formData.manufacturer}
            onChange={handleChange}
            required
            placeholder="例: JAグループ、住友化学 など"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="type">
            肥料タイプ *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            required
          >
            <option value="">選択してください</option>
            <option value="有機肥料">有機肥料</option>
            <option value="化成肥料">化成肥料</option>
            <option value="窒素肥料">窒素肥料</option>
            <option value="リン酸肥料">リン酸肥料</option>
            <option value="カリ肥料">カリ肥料</option>
            <option value="複合肥料">複合肥料</option>
            <option value="微量要素肥料">微量要素肥料</option>
            <option value="その他">その他</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            成分含有量 (N-P-K)
          </label>
          <div className="flex space-x-2">
            <div className="flex-1">
              <label className="block text-gray-700 text-xs mb-1" htmlFor="nitrogenContent">
                窒素 (N) %
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="nitrogenContent"
                type="number"
                name="nitrogenContent"
                value={formData.nitrogenContent}
                onChange={handleChange}
                step="0.1"
                min="0"
                max="100"
                placeholder="例: 8.0"
              />
            </div>
            <div className="flex-1">
              <label className="block text-gray-700 text-xs mb-1" htmlFor="phosphorusContent">
                リン酸 (P) %
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="phosphorusContent"
                type="number"
                name="phosphorusContent"
                value={formData.phosphorusContent}
                onChange={handleChange}
                step="0.1"
                min="0"
                max="100"
                placeholder="例: 8.0"
              />
            </div>
            <div className="flex-1">
              <label className="block text-gray-700 text-xs mb-1" htmlFor="potassiumContent">
                カリ (K) %
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="potassiumContent"
                type="number"
                name="potassiumContent"
                value={formData.potassiumContent}
                onChange={handleChange}
                step="0.1"
                min="0"
                max="100"
                placeholder="例: 8.0"
              />
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="lotNumber">
            ロット番号
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="lotNumber"
            type="text"
            name="lotNumber"
            value={formData.lotNumber}
            onChange={handleChange}
            placeholder="例: F2023-001 など"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="purchaseDate">
            購入日 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="purchaseDate"
            type="date"
            name="purchaseDate"
            value={formData.purchaseDate}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="supplier">
            購入先 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="supplier"
            type="text"
            name="supplier"
            value={formData.supplier}
            onChange={handleChange}
            required
            placeholder="例: JA、農業資材店 など"
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="notes">
            備考・その他成分
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="4"
            placeholder="NPK以外の成分（Ca、Mg、S、Fe、Mn、B、Zn等の微量要素）や特記事項を記入
例: Ca 10%, Mg 2%, Fe 0.1%, Mn 0.05%"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="submit"
            disabled={loading}
          >
            {loading ? '送信中...' : isEditMode ? '更新する' : '登録する'}
          </button>
          <button
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="button"
            onClick={() => navigate('/fertilizers')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default FertilizerForm;
