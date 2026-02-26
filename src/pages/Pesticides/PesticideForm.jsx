// src/pages/Pesticides/PesticideForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const PesticideForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    manufacturer: '',
    type: '',
    activeIngredient: '',
    concentration: '',
    formulation: '',
    registrationNumber: '',
    lotNumber: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
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
      const fetchPesticide = async () => {
        try {
          const docRef = doc(db, 'pesticides', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              name: data.name || '',
              manufacturer: data.manufacturer || '',
              type: data.type || '',
              activeIngredient: data.activeIngredient || '',
              concentration: data.concentration?.toString() || '',
              formulation: data.formulation || '',
              registrationNumber: data.registrationNumber || '',
              lotNumber: data.lotNumber || '',
              purchaseDate: data.purchaseDate?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              expiryDate: data.expiryDate?.toDate().toISOString().split('T')[0] || '',
              supplier: data.supplier || '',
              notes: data.notes || ''
            });
          } else {
            setError('指定された農薬データが見つかりません。');
            navigate('/pesticides');
          }
        } catch (err) {
          console.error('Error fetching pesticide data:', err);
          setError('データの取得中にエラーが発生しました。');
        } finally {
          setFetchLoading(false);
        }
      };

      fetchPesticide();
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
      const pesticideData = {
        ...formData,
        concentration: formData.concentration ? Number(formData.concentration) : null,
        purchaseDate: new Date(formData.purchaseDate),
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : null,
        userId: currentUser.uid,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        // 既存のドキュメントを更新
        await updateDoc(doc(db, 'pesticides', id), pesticideData);
        setMessage('農薬データが正常に更新されました');
      } else {
        // 新規ドキュメントを作成
        pesticideData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'pesticides'), pesticideData);
        setMessage('農薬データが正常に登録されました');
        
        // フォームをリセット
        setFormData({
          name: '',
          manufacturer: '',
          type: '',
          activeIngredient: '',
          concentration: '',
          formulation: '',
          registrationNumber: '',
          lotNumber: '',
          purchaseDate: new Date().toISOString().split('T')[0],
          expiryDate: '',
          supplier: '',
          notes: ''
        });
      }
      
      // 成功メッセージを表示後、一覧画面に戻る
      setTimeout(() => {
        navigate('/pesticides');
      }, 2000);
    } catch (err) {
      console.error('Error saving pesticide data:', err);
      setError('農薬データの保存中にエラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '農薬データ編集' : '農薬データ登録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '農薬データ編集' : '農薬データ登録'}</h1>
      
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
            農薬名 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="例: ラウンドアップ、スミチオン、オルトラン など"
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
            placeholder="例: バイエル、住友化学、日本農薬 など"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="type">
            農薬分類 *
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
            <option value="殺虫剤">殺虫剤</option>
            <option value="殺菌剤">殺菌剤</option>
            <option value="除草剤">除草剤</option>
            <option value="殺線虫剤">殺線虫剤</option>
            <option value="植物成長調整剤">植物成長調整剤</option>
            <option value="誘引剤">誘引剤</option>
            <option value="展着剤">展着剤</option>
            <option value="その他">その他</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="activeIngredient">
            有効成分 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="activeIngredient"
            type="text"
            name="activeIngredient"
            value={formData.activeIngredient}
            onChange={handleChange}
            required
            placeholder="例: グリホサート、MEP、アセフェート など"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="concentration">
            有効成分濃度 (%)
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="concentration"
            type="number"
            name="concentration"
            value={formData.concentration}
            onChange={handleChange}
            step="0.1"
            min="0"
            max="100"
            placeholder="例: 41.0"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="formulation">
            剤型 *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="formulation"
            name="formulation"
            value={formData.formulation}
            onChange={handleChange}
            required
          >
            <option value="">選択してください</option>
            <option value="液剤">液剤</option>
            <option value="乳剤">乳剤</option>
            <option value="水和剤">水和剤</option>
            <option value="粉剤">粉剤</option>
            <option value="粒剤">粒剤</option>
            <option value="水溶剤">水溶剤</option>
            <option value="フロアブル">フロアブル</option>
            <option value="その他">その他</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="registrationNumber">
            農薬登録番号 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="registrationNumber"
            type="text"
            name="registrationNumber"
            value={formData.registrationNumber}
            onChange={handleChange}
            required
            placeholder="例: 第21543号"
          />
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
            placeholder="例: P2023-001 など"
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
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="expiryDate">
            有効期限
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="expiryDate"
            type="date"
            name="expiryDate"
            value={formData.expiryDate}
            onChange={handleChange}
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
            備考・適用作物・使用方法
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="4"
            placeholder="適用作物、使用方法、希釈倍率、使用上の注意点など
例: 
適用作物: キャベツ、白菜、大根
希釈倍率: 1000倍
使用回数: 収穫14日前まで2回以内
PHI: 14日"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <button
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="submit"
            disabled={loading}
          >
            {loading ? '送信中...' : isEditMode ? '更新する' : '登録する'}
          </button>
          <button
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="button"
            onClick={() => navigate('/pesticides')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default PesticideForm;