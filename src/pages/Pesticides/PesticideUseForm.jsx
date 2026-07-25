// src/pages/Pesticides/PesticideUseForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { getCurrentPosition, fetchWeatherForDate } from '../../services/weatherService';
import { getLastPesticideUse } from '../../services/lastUseService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const PesticideUseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrganization } = useOrganization();
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
    treatedArea: '',
    method: '',
    weather: '',
    temperature: '',
    windSpeed: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // 選択中の圃場の面積（処理面積の入力補助に使う）
  const selectedFieldArea = Number(
    fields.find((f) => f.id === formData.fieldId)?.area || 0
  );

  // 単位面積あたりの使用量（ラベル記載量との整合確認用）
  const areaRate = (() => {
    const amount = Number(formData.amount);
    const area = Number(formData.treatedArea);
    if (!amount || !area) return '';
    const per10a = (amount / area) * 1000; // 10a = 1000m²
    return `${(amount / area).toFixed(3)} ${formData.unit}/m²（約 ${per10a.toFixed(1)} ${formData.unit}/10a）`;
  })();

  // 現在地と散布日から天候・気温・風速を自動入力
  const handleAutoFillWeather = async () => {
    setWeatherLoading(true);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      const weather = await fetchWeatherForDate(latitude, longitude, formData.date);
      if (!weather) {
        toast.error('この日付の天気データが見つかりませんでした');
        return;
      }
      setFormData(prev => ({
        ...prev,
        weather: weather.weather,
        temperature: weather.temperature,
        windSpeed: weather.windSpeed
      }));
      toast.success(`天気を自動入力しました（${weather.weather} ${weather.temperature}℃）`);
    } catch (err) {
      if (err?.code === 1) {
        toast.error('位置情報の利用が許可されていません。ブラウザの設定を確認してください');
      } else {
        toast.error('天気の取得に失敗しました。通信環境を確認してください');
      }
    } finally {
      setWeatherLoading(false);
    }
  };
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
      if (!currentOrganization) return;

      try {
        // 農薬データを取得
        const pesticidesQuery = query(
          collection(db, 'pesticides'),
          where('organizationId', '==', currentOrganization.id)
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
          where('organizationId', '==', currentOrganization.id)
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
              treatedArea: data.treatedArea?.toString() || '',
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
        firestoreLogger.error('フォームデータの取得に失敗しました', { organizationId: currentOrganization.id, pesticideUseId: id || null }, err);
        setError('データの取得中にエラーが発生しました。');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchData();
  }, [id, isEditMode, navigate, currentOrganization]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // 農薬を選んだら前回使用時の値を空欄に自動補完（新規登録時のみ）
    if (name === 'pesticideId' && value && !isEditMode) {
      autoFillFromLastUse(value);
    }
  };

  const autoFillFromLastUse = async (pesticideId) => {
    const last = await getLastPesticideUse(currentOrganization.id, pesticideId);
    if (!last) return;
    setFormData((prev) => ({
      ...prev,
      targetPest: prev.targetPest || last.targetPest,
      dilutionRate: prev.dilutionRate || last.dilutionRate,
      amount: prev.amount || last.amount,
      unit: prev.unit && prev.unit !== 'L' ? prev.unit : last.unit || 'L',
      method: prev.method || last.method
    }));
    toast.success('前回の使用内容を自動入力しました');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentOrganization) {
      setError('組織情報が必要です。');
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
        organizationId: currentOrganization.id,
        dilutionRate: formData.dilutionRate ? Number(formData.dilutionRate) : null,
        amount: formData.amount ? Number(formData.amount) : null,
        unit: formData.unit,
        treatedArea: formData.treatedArea ? Number(formData.treatedArea) : null,
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
      firestoreLogger.error('農薬使用記録の保存に失敗しました', { organizationId: currentOrganization.id, pesticideUseId: id || null, isEditMode }, err);
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

        {/* 処理面積: GGAPでは単位面積あたりの使用量がラベル記載量と整合するか確認される */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="treatedArea">
            処理面積 (m²) *
          </label>
          <div className="flex items-center gap-2">
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="treatedArea"
              type="number"
              name="treatedArea"
              value={formData.treatedArea}
              onChange={handleChange}
              step="0.1"
              min="0"
              placeholder="散布した面積"
            />
            {selectedFieldArea > 0 && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, treatedArea: String(selectedFieldArea) }))}
                className="shrink-0 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                圃場全体（{selectedFieldArea}m²）
              </button>
            )}
          </div>
          {areaRate && (
            <p className="text-xs text-gray-600 mt-1">
              単位面積あたり: <span className="font-semibold">{areaRate}</span>
            </p>
          )}
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-gray-700 text-sm font-bold" htmlFor="weather">
              天候 *
            </label>
            <button
              type="button"
              onClick={handleAutoFillWeather}
              disabled={weatherLoading}
              className="text-xs px-3 py-1.5 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50"
            >
              {weatherLoading ? '取得中...' : '📍 現在地から天気を自動入力'}
            </button>
          </div>
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