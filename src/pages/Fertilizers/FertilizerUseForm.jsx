// src/pages/Fertilizers/FertilizerUseForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, query, getDocs, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const FertilizerUseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [fertilizers, setFertilizers] = useState([]);
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    fertilizerId: '',
    fieldId: '',
    amount: '',
    unit: 'kg',
    method: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isEditMode = !!id;

  // URLクエリパラメータから肥料IDを取得
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const fertilizerIdParam = queryParams.get('fertilizerId');
    
    if (fertilizerIdParam) {
      setFormData(prev => ({
        ...prev,
        fertilizerId: fertilizerIdParam
      }));
    }
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      try {
        // 肥料データを取得
        const fertilizersQuery = query(
          collection(db, 'fertilizers'),
          where('userId', '==', currentUser.uid)
        );
        const fertilizersSnapshot = await getDocs(fertilizersQuery);
        const fertilizersList = [];
        fertilizersSnapshot.forEach((doc) => {
          fertilizersList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setFertilizers(fertilizersList);

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
          const docRef = doc(db, 'fertilizerUses', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              date: data.date?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              fertilizerId: data.fertilizerId || '',
              fieldId: data.fieldId || '',
              amount: data.amount?.toString() || '',
              unit: data.unit || 'kg',
              method: data.method || '',
              notes: data.notes || ''
            });
          } else {
            setError('指定された肥料使用記録が見つかりません。');
            navigate('/fertilizers');
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
      // 選択された肥料と圃場の名前を取得
      const selectedFertilizer = fertilizers.find(fertilizer => fertilizer.id === formData.fertilizerId);
      const selectedField = fields.find(field => field.id === formData.fieldId);
      
      const fertilizerUseData = {
        date: new Date(formData.date),
        fertilizerId: formData.fertilizerId,
        fertilizerName: selectedFertilizer ? selectedFertilizer.name : '',
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        appliedBy: currentUser.uid,
        appliedByName: currentUser.displayName || currentUser.email,
        userId: currentUser.uid,
        amount: formData.amount ? Number(formData.amount) : null,
        unit: formData.unit,
        method: formData.method,
        notes: formData.notes,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        // 既存のドキュメントを更新
        await updateDoc(doc(db, 'fertilizerUses', id), fertilizerUseData);
        setMessage('肥料使用記録が正常に更新されました');
      } else {
        // 新規ドキュメントを作成
        fertilizerUseData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'fertilizerUses'), fertilizerUseData);
        setMessage('肥料使用記録が正常に登録されました');
        
        // フォームをリセット（肥料IDは保持）
        setFormData({
          date: new Date().toISOString().split('T')[0],
          fertilizerId: formData.fertilizerId,
          fieldId: '',
          amount: '',
          unit: 'kg',
          method: '',
          notes: ''
        });
      }
      
      if (isEditMode) {
        // 成功メッセージを表示後、一覧画面に戻る
        setTimeout(() => {
          navigate('/fertilizers');
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving fertilizer use record:', err);
      setError('肥料使用記録の保存中にエラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '肥料使用記録編集' : '肥料使用記録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto mobile-container max-w-2xl pb-20 md:pb-4">
      <h1 className="mobile-form-header">{isEditMode ? '肥料使用記録編集' : '肥料使用記録'}</h1>
      
      {error && (
        <div className="mobile-alert mobile-alert-error">
          {error}
        </div>
      )}
      
      {message && (
        <div className="mobile-alert mobile-alert-success">
          {message}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="mobile-form-section">
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="date">
            作業日 *
          </label>
          <input
            className="mobile-input w-full"
            id="date"
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="fertilizerId">
            肥料 *
          </label>
          <select
            className="mobile-select w-full"
            id="fertilizerId"
            name="fertilizerId"
            value={formData.fertilizerId}
            onChange={handleChange}
            required
          >
            <option value="">肥料を選択してください</option>
            {fertilizers.map(fertilizer => (
              <option key={fertilizer.id} value={fertilizer.id}>{fertilizer.name}</option>
            ))}
          </select>
          {fertilizers.length === 0 && (
            <p className="text-red-500 text-xs mt-1">
              肥料が登録されていません。先に肥料を登録してください。
            </p>
          )}
        </div>
        
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="fieldId">
            圃場 *
          </label>
          <select
            className="mobile-select w-full"
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
        
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="amount">
            使用量 *
          </label>
          <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-2">
            <input
              className="mobile-input flex-1"
              id="amount"
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.1"
              min="0"
              required
              placeholder="数量を入力"
            />
            <select
              className="mobile-select w-full md:w-24"
              id="unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="袋">袋</option>
              <option value="その他">その他</option>
            </select>
          </div>
        </div>
        
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="method">
            施肥方法 *
          </label>
          <select
            className="mobile-select w-full"
            id="method"
            name="method"
            value={formData.method}
            onChange={handleChange}
            required
          >
            <option value="">選択してください</option>
            <option value="全面散布">全面散布</option>
            <option value="条施肥">条施肥</option>
            <option value="点滴施肥">点滴施肥</option>
            <option value="葉面散布">葉面散布</option>
            <option value="土壌混和">土壌混和</option>
            <option value="灌水施肥">灌水施肥</option>
            <option value="その他">その他</option>
          </select>
        </div>
        
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="notes">
            備考
          </label>
          <textarea
            className="mobile-textarea w-full"
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            placeholder="特記事項があれば記入"
          />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
          <button
            className="mobile-btn mobile-btn-success w-full md:w-auto order-2 md:order-1"
            type="submit"
            disabled={loading}
          >
            {loading ? '送信中...' : isEditMode ? '更新する' : '登録する'}
          </button>
          <button
            className="mobile-btn mobile-btn-secondary w-full md:w-auto order-1 md:order-2"
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

export default FertilizerUseForm;
