// src/pages/FieldManagement/FieldForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const FieldForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    area: '',
    soilType: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(!!id);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isEditMode = !!id;

  useEffect(() => {
    // 編集モードの場合、既存データを取得
    if (isEditMode) {
      const fetchField = async () => {
        try {
          const docRef = doc(db, 'fields', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setFormData(docSnap.data());
          } else {
            setError('指定された圃場データが見つかりません。');
            navigate('/fields');
          }
        } catch (err) {
          console.error('Error fetching field data:', err);
          setError('データの取得中にエラーが発生しました。');
        } finally {
          setFetchLoading(false);
        }
      };

      fetchField();
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
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      if (!currentUser) {
        setError('ユーザー認証が確認できません。');
        return;
      }
      
      const fieldData = {
        ...formData,
        userId: currentUser.uid,
        area: Number(formData.area),
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        // 既存のドキュメントを更新
        await updateDoc(doc(db, 'fields', id), fieldData);
        setMessage('圃場データが正常に更新されました');
      } else {
        // 新規ドキュメントを作成
        fieldData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'fields'), fieldData);
        setMessage('圃場データが正常に登録されました');
        
        // フォームをリセット
        setFormData({
          name: '',
          location: '',
          area: '',
          soilType: '',
          description: ''
        });
      }
      
      // 成功メッセージを表示後、一覧画面に戻る
      setTimeout(() => {
        navigate('/fields');
      }, 2000);
    } catch (err) {
      console.error('Error saving field data:', err);
      setError('圃場データの保存中にエラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '圃場データ編集' : '圃場データ登録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '圃場データ編集' : '圃場データ登録'}</h1>
      
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
            圃場名 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="例: A区画、ハウス1号 など"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="location">
            場所 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="location"
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            placeholder="例: 校舎北側、西農場 など"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="area">
            面積 (m²) *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="area"
            type="number"
            name="area"
            value={formData.area}
            onChange={handleChange}
            required
            step="0.1"
            min="0"
            placeholder="例: 100.5"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="soilType">
            土壌タイプ *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="soilType"
            name="soilType"
            value={formData.soilType}
            onChange={handleChange}
            required
          >
            <option value="">土壌タイプを選択してください</option>
            <option value="砂質土">砂質土</option>
            <option value="粘土質">粘土質</option>
            <option value="シルト質">シルト質</option>
            <option value="壌土">壌土</option>
            <option value="黒ボク土">黒ボク土</option>
            <option value="赤土">赤土</option>
            <option value="その他">その他</option>
          </select>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
            説明・特記事項
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            placeholder="圃場の特徴や注意点など"
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
            onClick={() => navigate('/fields')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default FieldForm;
