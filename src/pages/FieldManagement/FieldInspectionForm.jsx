// src/pages/FieldManagement/FieldInspectionForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const FieldInspectionForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    fieldId: '',
    soilPH: '',
    waterQuality: '',
    facilityCondition: '',
    pest: '',
    disease: '',
    weed: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isEditMode = !!id;

  // URLクエリパラメータから圃場IDを取得
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const fieldIdParam = queryParams.get('fieldId');
    
    if (fieldIdParam) {
      setFormData(prev => ({
        ...prev,
        fieldId: fieldIdParam
      }));
    }
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      try {
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
          const docRef = doc(db, 'fieldInspections', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              date: data.date?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              fieldId: data.fieldId || '',
              soilPH: data.soilPH?.toString() || '',
              waterQuality: data.waterQuality || '',
              facilityCondition: data.facilityCondition || '',
              pest: data.pest || '',
              disease: data.disease || '',
              weed: data.weed || '',
              notes: data.notes || ''
            });
          } else {
            setError('指定された点検記録データが見つかりません。');
            navigate('/fields');
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
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      // 選択された圃場名を取得
      const selectedField = fields.find(field => field.id === formData.fieldId);
      
      const inspectionData = {
        date: new Date(formData.date),
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        inspector: currentUser.uid,
        inspectorName: currentUser.displayName || currentUser.email,
        soilPH: formData.soilPH ? Number(formData.soilPH) : null,
        waterQuality: formData.waterQuality,
        facilityCondition: formData.facilityCondition,
        pest: formData.pest,
        disease: formData.disease,
        weed: formData.weed,
        notes: formData.notes,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        // 既存のドキュメントを更新
        await updateDoc(doc(db, 'fieldInspections', id), inspectionData);
        setMessage('圃場点検記録が正常に更新されました');
      } else {
        // 新規ドキュメントを作成
        inspectionData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'fieldInspections'), inspectionData);
        setMessage('圃場点検記録が正常に登録されました');
        
        // フォームをリセット（圃場IDは保持）
        setFormData({
          date: new Date().toISOString().split('T')[0],
          fieldId: formData.fieldId,
          soilPH: '',
          waterQuality: '',
          facilityCondition: '',
          pest: '',
          disease: '',
          weed: '',
          notes: ''
        });
      }
      
      if (isEditMode) {
        // 成功メッセージを表示後、一覧画面に戻る
        setTimeout(() => {
          navigate('/fields');
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving field inspection:', err);
      setError('圃場点検記録の保存中にエラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '圃場点検記録編集' : '圃場点検記録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '圃場点検記録編集' : '圃場点検記録'}</h1>
      
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
            点検日 *
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
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="soilPH">
            土壌pH
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="soilPH"
            type="number"
            name="soilPH"
            value={formData.soilPH}
            onChange={handleChange}
            step="0.1"
            min="0"
            max="14"
            placeholder="例: 6.5"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="waterQuality">
            水質状態
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="waterQuality"
            name="waterQuality"
            value={formData.waterQuality}
            onChange={handleChange}
          >
            <option value="">選択してください</option>
            <option value="良好">良好</option>
            <option value="やや問題あり">やや問題あり</option>
            <option value="問題あり">問題あり</option>
            <option value="未確認">未確認</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="facilityCondition">
            施設状態
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="facilityCondition"
            name="facilityCondition"
            value={formData.facilityCondition}
            onChange={handleChange}
          >
            <option value="">選択してください</option>
            <option value="良好">良好</option>
            <option value="軽微な修繕必要">軽微な修繕必要</option>
            <option value="修繕必要">修繕必要</option>
            <option value="使用不可">使用不可</option>
            <option value="該当なし">該当なし（露地等）</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="pest">
            害虫状況
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="pest"
            name="pest"
            value={formData.pest}
            onChange={handleChange}
          >
            <option value="">選択してください</option>
            <option value="発生なし">発生なし</option>
            <option value="軽微な発生">軽微な発生</option>
            <option value="中程度発生">中程度発生</option>
            <option value="多発生">多発生</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="disease">
            病害状況
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="disease"
            name="disease"
            value={formData.disease}
            onChange={handleChange}
          >
            <option value="">選択してください</option>
            <option value="発生なし">発生なし</option>
            <option value="軽微な発生">軽微な発生</option>
            <option value="中程度発生">中程度発生</option>
            <option value="多発生">多発生</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="weed">
            雑草状況
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="weed"
            name="weed"
            value={formData.weed}
            onChange={handleChange}
          >
            <option value="">選択してください</option>
            <option value="発生なし">発生なし</option>
            <option value="少量発生">少量発生</option>
            <option value="中程度発生">中程度発生</option>
            <option value="多発生">多発生</option>
          </select>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="notes">
            備考・対策
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            placeholder="発見した問題点や実施した対策などを記入"
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

export default FieldInspectionForm;
