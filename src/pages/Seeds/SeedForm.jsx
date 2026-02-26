// src/pages/Seeds/SeedForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const SeedForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    variety: '',
    supplier: '',
    lotNumber: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    disinfectionMethod: '',
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
      const fetchSeed = async () => {
        try {
          const docRef = doc(db, 'seeds', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              name: data.name || '',
              variety: data.variety || '',
              supplier: data.supplier || '',
              lotNumber: data.lotNumber || '',
              purchaseDate: data.purchaseDate?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              disinfectionMethod: data.disinfectionMethod || '',
              notes: data.notes || ''
            });
          } else {
            setError('指定された種子・苗データが見つかりません。');
            navigate('/seeds');
          }
        } catch (err) {
          console.error('Error fetching seed data:', err);
          setError('データの取得中にエラーが発生しました。');
        } finally {
          setFetchLoading(false);
        }
      };

      fetchSeed();
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
      const seedData = {
        ...formData,
        purchaseDate: new Date(formData.purchaseDate),
        userId: currentUser.uid,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        // 既存のドキュメントを更新
        await updateDoc(doc(db, 'seeds', id), seedData);
        setMessage('種子・苗データが正常に更新されました');
      } else {
        // 新規ドキュメントを作成
        seedData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'seeds'), seedData);
        setMessage('種子・苗データが正常に登録されました');
        
        // フォームをリセット
        setFormData({
          name: '',
          variety: '',
          supplier: '',
          lotNumber: '',
          purchaseDate: new Date().toISOString().split('T')[0],
          disinfectionMethod: '',
          notes: ''
        });
      }
      
      // 成功メッセージを表示後、一覧画面に戻る
      setTimeout(() => {
        navigate('/seeds');
      }, 2000);
    } catch (err) {
      console.error('Error saving seed data:', err);
      setError('種子・苗データの保存中にエラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '種子・苗データ編集' : '種子・苗データ登録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">ユーザー認証が必要です。</span>
        </div>
      </div>
    );
  }

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '種子・苗データ編集' : '種子・苗データ登録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '種子・苗データ編集' : '種子・苗データ登録'}</h1>
      
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
            作物名 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="例: トマト、レタス など"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="variety">
            品種名 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="variety"
            type="text"
            name="variety"
            value={formData.variety}
            onChange={handleChange}
            required
            placeholder="例: 桃太郎、サニーレタス など"
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
            placeholder="例: サカタのタネ、タキイ種苗 など"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="lotNumber">
            ロット番号 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="lotNumber"
            type="text"
            name="lotNumber"
            value={formData.lotNumber}
            onChange={handleChange}
            required
            placeholder="例: L2023-001 など"
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
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="disinfectionMethod">
            種子消毒方法
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="disinfectionMethod"
            name="disinfectionMethod"
            value={formData.disinfectionMethod}
            onChange={handleChange}
          >
            <option value="">選択してください</option>
            <option value="なし">なし</option>
            <option value="温湯消毒">温湯消毒</option>
            <option value="次亜塩素酸">次亜塩素酸</option>
            <option value="エタノール">エタノール</option>
            <option value="その他">その他</option>
            <option value="購入時消毒済み">購入時消毒済み</option>
          </select>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="notes">
            備考
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            placeholder="その他特記事項があれば記入"
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
            onClick={() => navigate('/seeds')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default SeedForm;
