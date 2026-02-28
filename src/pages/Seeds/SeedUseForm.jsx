// src/pages/Seeds/SeedUseForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { uiLogger } from '../../utils/logger';

const SeedUseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [seeds, setSeeds] = useState([]);
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    seedId: '',
    fieldId: '',
    amount: '',
    method: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isEditMode = !!id;

  // URLクエリパラメータから種子IDを取得
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const seedIdParam = queryParams.get('seedId');
    
    if (seedIdParam) {
      setFormData(prev => ({
        ...prev,
        seedId: seedIdParam
      }));
    }
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      try {
        // 種子データを取得（ユーザーIDでフィルタリング）
        const seedsQuery = query(
          collection(db, 'seeds'),
          where('userId', '==', currentUser.uid)
        );
        const seedsSnapshot = await getDocs(seedsQuery);
        const seedsList = [];
        seedsSnapshot.forEach((doc) => {
          seedsList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setSeeds(seedsList);

        // 圃場データを取得（ユーザーIDでフィルタリング）
        const fieldsQuery = query(
          collection(db, 'fields'),
          where('userId', '==', currentUser.uid)
        );
        const fieldsSnapshot = await getDocs(fieldsQuery);
        const fieldsList = [];
        fieldsSnapshot.forEach((doc) => {
          fieldsList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setFields(fieldsList);

        // 編集モードの場合、既存データを取得
        if (isEditMode) {
          const docRef = doc(db, 'seedUses', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              date: data.date?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              seedId: data.seedId || '',
              fieldId: data.fieldId || '',
              amount: data.amount?.toString() || '',
              method: data.method || '',
              notes: data.notes || ''
            });
          } else {
            setError('指定された播種・定植記録が見つかりません。');
            navigate('/seeds');
          }
        }
      } catch (err) {
        uiLogger.error('Error fetching form data', { component: 'SeedUseForm', isEditMode }, err);
        setError('データの取得中にエラーが発生しました。');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchData();
  }, [id, isEditMode, navigate, currentUser]);

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
      // 選択された種子と圃場の名前を取得
      const selectedSeed = seeds.find(seed => seed.id === formData.seedId);
      const selectedField = fields.find(field => field.id === formData.fieldId);
      
      const seedUseData = {
        date: new Date(formData.date),
        seedId: formData.seedId,
        seedName: selectedSeed ? `${selectedSeed.name} (${selectedSeed.variety})` : '',
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        plantedBy: currentUser.uid,
        plantedByName: currentUser.displayName || currentUser.email,
        userId: currentUser.uid,
        amount: formData.amount ? Number(formData.amount) : null,
        method: formData.method,
        notes: formData.notes,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        // 既存のドキュメントを更新
        await updateDoc(doc(db, 'seedUses', id), seedUseData);
        setMessage('播種・定植記録が正常に更新されました');
      } else {
        // 新規ドキュメントを作成
        seedUseData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'seedUses'), seedUseData);
        setMessage('播種・定植記録が正常に登録されました');
      }

      // 成功メッセージを表示後、播種・定植記録一覧に遷移
      setTimeout(() => {
        navigate('/seed-uses');
      }, 2000);
    } catch (err) {
      uiLogger.error('Error saving seed use record', { component: 'SeedUseForm', isEditMode, seedId: formData.seedId }, err);
      setError('播種・定植記録の保存中にエラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '播種・定植記録編集' : '播種・定植記録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '播種・定植記録編集' : '播種・定植記録'}</h1>
      
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
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="date">
            作業日 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="date"
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="seedId">
            種子・苗 *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="seedId"
            name="seedId"
            value={formData.seedId}
            onChange={handleChange}
            required
          >
            <option value="">種子・苗を選択してください</option>
            {seeds.map(seed => (
              <option key={seed.id} value={seed.id}>{seed.name} ({seed.variety})</option>
            ))}
          </select>
          {seeds.length === 0 && (
            <p className="text-red-500 text-xs mt-1">
              種子・苗が登録されていません。先に種子・苗を登録してください。
            </p>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="fieldId">
            圃場 *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="fieldId"
            name="fieldId"
            value={formData.fieldId}
            onChange={handleChange}
            required
          >
            <option value="">圃場を選択してください</option>
            {fields.map(field => (
              <option key={field.id} value={field.id}>{field.name}</option>
            ))}
          </select>
          {fields.length === 0 && (
            <p className="text-red-500 text-xs mt-1">
              圃場が登録されていません。先に圃場を登録してください。
            </p>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amount">
            使用量
          </label>
          <div className="flex items-center">
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="amount"
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.1"
              min="0"
              placeholder="数量を入力"
            />
            <span className="ml-2 text-gray-600">g/本</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">※種子の場合はg、苗の場合は本数</p>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="method">
            播種・定植方法 *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="method"
            name="method"
            value={formData.method}
            onChange={handleChange}
            required
          >
            <option value="">選択してください</option>
            <option value="直播">直播</option>
            <option value="条播">条播</option>
            <option value="点播">点播</option>
            <option value="散播">散播</option>
            <option value="定植">定植</option>
            <option value="その他">その他</option>
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
            placeholder="栽培条件や特記事項など"
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

export default SeedUseForm;
