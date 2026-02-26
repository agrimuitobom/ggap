// src/pages/Pesticides/PesticideUseForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const PesticideUseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [pesticides, setPesticides] = useState([]);
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    pesticideId: '',
    fieldId: '',
    targetPest: '',
    dilutionRate: '',
    amount: '',
    unit: 'L',
    method: '',
    weather: '',
    temperature: '',
    windSpeed: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isEditMode = !!id;

  // URLクエリパラメータから農薬IDを取得
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const pesticideIdParam = queryParams.get('pesticideId');
    
    if (pesticideIdParam) {
      setFormData(prev => ({
        ...prev,
        pesticideId: pesticideIdParam
      }));
    }
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      try {
        // 農薬データを取得
        const pesticidesQuery = query(
          collection(db, 'pesticides'),
          where('userId', '==', currentUser.uid)
        );
        const pesticidesSnapshot = await getDocs(pesticidesQuery);
        const pesticidesList = [];
        pesticidesSnapshot.forEach((doc) => {
          pesticidesList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setPesticides(pesticidesList);

        // 圃場データを取得
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
          const docRef = doc(db, 'pesticideUses', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              date: data.date?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              pesticideId: data.pesticideId || '',
              fieldId: data.fieldId || '',
              targetPest: data.targetPest || '',
              dilutionRate: data.dilutionRate?.toString() || '',
              amount: data.amount?.toString() || '',
              unit: data.unit || 'L',
              method: data.method || '',
              weather: data.weather || '',
              temperature: data.temperature?.toString() || '',
              windSpeed: data.windSpeed?.toString() || '',
              notes: data.notes || ''
            });
          } else {
            setError('指定された農薬使用記録が見つかりません。');
            navigate('/pesticides');
          }
        }
      } catch (err) {
        console.error('Error fetching form data:', err);
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
      // 選択された農薬と圃場の名前を取得
      const selectedPesticide = pesticides.find(pesticide => pesticide.id === formData.pesticideId);
      const selectedField = fields.find(field => field.id === formData.fieldId);
      
      const pesticideUseData = {
        date: new Date(formData.date),
        pesticideId: formData.pesticideId,
        pesticideName: selectedPesticide ? selectedPesticide.name : '',
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        targetPest: formData.targetPest,
        appliedBy: currentUser.uid,
        appliedByName: currentUser.displayName || currentUser.email,
        userId: currentUser.uid,
        dilutionRate: formData.dilutionRate ? Number(formData.dilutionRate) : null,
        amount: formData.amount ? Number(formData.amount) : null,
        unit: formData.unit,
        method: formData.method,
        weather: formData.weather,
        temperature: formData.temperature ? Number(formData.temperature) : null,
        windSpeed: formData.windSpeed ? Number(formData.windSpeed) : null,
        notes: formData.notes,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        // 既存のドキュメントを更新
        await updateDoc(doc(db, 'pesticideUses', id), pesticideUseData);
        setMessage('農薬使用記録が正常に更新されました');
      } else {
        // 新規ドキュメントを作成
        pesticideUseData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'pesticideUses'), pesticideUseData);
        setMessage('農薬使用記録が正常に登録されました');
        
        // フォームをリセット（農薬IDは保持）
        setFormData({
          date: new Date().toISOString().split('T')[0],
          pesticideId: formData.pesticideId,
          fieldId: '',
          targetPest: '',
          dilutionRate: '',
          amount: '',
          unit: 'L',
          method: '',
          weather: '',
          temperature: '',
          windSpeed: '',
          notes: ''
        });
      }
      
      if (isEditMode) {
        // 成功メッセージを表示後、一覧画面に戻る
        setTimeout(() => {
          navigate('/pesticides');
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving pesticide use record:', err);
      setError('農薬使用記録の保存中にエラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '農薬使用記録編集' : '農薬使用記録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '農薬使用記録編集' : '農薬使用記録'}</h1>
      
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
            散布日 *
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
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="pesticideId">
            農薬 *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="pesticideId"
            name="pesticideId"
            value={formData.pesticideId}
            onChange={handleChange}
            required
          >
            <option value="">農薬を選択してください</option>
            {pesticides.map(pesticide => (
              <option key={pesticide.id} value={pesticide.id}>
                {pesticide.name} ({pesticide.type})
              </option>
            ))}
          </select>
          {pesticides.length === 0 && (
            <p className="text-red-500 text-xs mt-1">
              農薬が登録されていません。先に農薬を登録してください。
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
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="targetPest">
            対象病害虫 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="targetPest"
            type="text"
            name="targetPest"
            value={formData.targetPest}
            onChange={handleChange}
            required
            placeholder="例: アブラムシ、うどんこ病、雑草 など"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="dilutionRate">
            希釈倍率 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="dilutionRate"
            type="number"
            name="dilutionRate"
            value={formData.dilutionRate}
            onChange={handleChange}
            step="1"
            min="1"
            required
            placeholder="例: 1000"
          />
          <p className="text-xs text-gray-500 mt-1">倍数で入力（例: 1000倍なら「1000」）</p>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amount">
            散布量 *
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
              required
              placeholder="散布量を入力"
            />
            <select
              className="ml-2 shadow border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
            >
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
            </select>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="method">
            散布方法 *
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
            <option value="噴霧器散布">噴霧器散布</option>
            <option value="動力噴霧器">動力噴霧器</option>
            <option value="ブームスプレーヤー">ブームスプレーヤー</option>
            <option value="スピードスプレーヤー">スピードスプレーヤー</option>
            <option value="粉剤散布機">粉剤散布機</option>
            <option value="土壌処理">土壌処理</option>
            <option value="その他">その他</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="weather">
            天候 *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="weather"
            name="weather"
            value={formData.weather}
            onChange={handleChange}
            required
          >
            <option value="">選択してください</option>
            <option value="晴れ">晴れ</option>
            <option value="曇り">曇り</option>
            <option value="薄曇り">薄曇り</option>
            <option value="雨">雨</option>
            <option value="霧">霧</option>
          </select>
        </div>
        
        <div className="mb-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="temperature">
                気温 (℃)
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="temperature"
                type="number"
                name="temperature"
                value={formData.temperature}
                onChange={handleChange}
                step="0.1"
                placeholder="例: 25.5"
              />
            </div>
            <div className="flex-1">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="windSpeed">
                風速 (m/s)
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="windSpeed"
                type="number"
                name="windSpeed"
                value={formData.windSpeed}
                onChange={handleChange}
                step="0.1"
                min="0"
                placeholder="例: 2.0"
              />
            </div>
          </div>
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
            placeholder="散布条件、効果、注意事項など"
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

export default PesticideUseForm;