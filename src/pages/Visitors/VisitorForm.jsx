// src/pages/Visitors/VisitorForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const VisitorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    visitDate: new Date().toISOString().split('T')[0],
    visitorName: '',
    organization: '',
    position: '',
    contactInfo: '',
    purpose: '',
    visitAreas: [],
    accompaniedBy: '',
    entryTime: '',
    exitTime: '',
    hygieneCompliance: true,
    safetyBriefing: true,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState('');
  const isEditMode = !!id;

  const visitPurposes = [
    '検査・監査',
    '技術指導',
    '見学・視察',
    '営業・商談',
    '配送・集荷',
    '設備点検・修理',
    '研修・教育',
    'その他'
  ];

  const farmAreas = [
    '校舎内',
    'サラダナ温室',
    '圃場'
  ];

  useEffect(() => {
    if (isEditMode && currentUser) {
      fetchVisitorData();
    }
  }, [id, isEditMode, currentUser]);

  const fetchVisitorData = async () => {
    try {
      setFetchLoading(true);
      const docRef = doc(db, 'visitors', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          visitDate: data.visitDate?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          visitorName: data.visitorName || '',
          organization: data.organization || '',
          position: data.position || '',
          contactInfo: data.contactInfo || '',
          purpose: data.purpose || '',
          visitAreas: data.visitAreas || [],
          accompaniedBy: data.accompaniedBy || '',
          entryTime: data.entryTime || '',
          exitTime: data.exitTime || '',
          hygieneCompliance: data.hygieneCompliance ?? true,
          safetyBriefing: data.safetyBriefing ?? true,
          notes: data.notes || ''
        });
      } else {
        setError('指定された訪問者記録が見つかりません。');
        navigate('/visitors');
      }
    } catch (err) {
      console.error('Error fetching visitor data:', err);
      setError('データの取得中にエラーが発生しました。');
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleAreaChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData({
      ...formData,
      visitAreas: selectedOptions
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (!currentUser) {
      setError('ユーザー認証が確認できません。');
      setLoading(false);
      return;
    }
    
    try {
      const visitorData = {
        userId: currentUser.uid,
        visitDate: new Date(formData.visitDate),
        visitorName: formData.visitorName,
        organization: formData.organization,
        position: formData.position,
        contactInfo: formData.contactInfo,
        purpose: formData.purpose,
        visitAreas: formData.visitAreas,
        accompaniedBy: formData.accompaniedBy,
        entryTime: formData.entryTime,
        exitTime: formData.exitTime,
        hygieneCompliance: formData.hygieneCompliance,
        safetyBriefing: formData.safetyBriefing,
        notes: formData.notes,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        await updateDoc(doc(db, 'visitors', id), visitorData);
        toast.success('訪問者記録が更新されました');
      } else {
        visitorData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'visitors'), visitorData);
        toast.success('訪問者記録が登録されました');
        
        // フォームをリセット
        setFormData({
          visitDate: new Date().toISOString().split('T')[0],
          visitorName: '',
          organization: '',
          position: '',
          contactInfo: '',
          purpose: '',
          visitAreas: [],
          accompaniedBy: '',
          entryTime: '',
          exitTime: '',
          hygieneCompliance: true,
          safetyBriefing: true,
          notes: ''
        });
      }
      
      // 成功後、一覧画面に戻る
      setTimeout(() => {
        navigate('/visitors');
      }, 1000);
    } catch (err) {
      console.error('Error saving visitor:', err);
      setError('訪問者記録の保存中にエラーが発生しました: ' + err.message);
      toast.error('訪問者記録の保存中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '訪問者記録編集' : '訪問者記録登録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '訪問者記録編集' : '訪問者記録登録'}</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="visitDate">
            訪問日 <span className="text-red-500">*</span>
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="visitDate"
            type="date"
            name="visitDate"
            value={formData.visitDate}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="visitorName">
            訪問者名 <span className="text-red-500">*</span>
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="visitorName"
            type="text"
            name="visitorName"
            value={formData.visitorName}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="organization">
            所属組織・会社名
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="organization"
            type="text"
            name="organization"
            value={formData.organization}
            onChange={handleChange}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="position">
            役職・部署
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="position"
            type="text"
            name="position"
            value={formData.position}
            onChange={handleChange}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="contactInfo">
            連絡先（電話番号・メールアドレス）
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="contactInfo"
            type="text"
            name="contactInfo"
            value={formData.contactInfo}
            onChange={handleChange}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="purpose">
            訪問目的 <span className="text-red-500">*</span>
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="purpose"
            name="purpose"
            value={formData.purpose}
            onChange={handleChange}
            required
          >
            <option value="">訪問目的を選択してください</option>
            {visitPurposes.map(purpose => (
              <option key={purpose} value={purpose}>{purpose}</option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="visitAreas">
            立ち入りエリア
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="visitAreas"
            name="visitAreas"
            multiple
            value={formData.visitAreas}
            onChange={handleAreaChange}
            size="4"
          >
            {farmAreas.map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">※Ctrlキーを押しながら複数選択できます</p>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="accompaniedBy">
            同行者（農場スタッフ）
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="accompaniedBy"
            type="text"
            name="accompaniedBy"
            value={formData.accompaniedBy}
            onChange={handleChange}
          />
        </div>
        
        <div className="flex mb-4 space-x-4">
          <div className="flex-1">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="entryTime">
              入場時間
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="entryTime"
              type="time"
              name="entryTime"
              value={formData.entryTime}
              onChange={handleChange}
            />
          </div>
          <div className="flex-1">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="exitTime">
              退場時間
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="exitTime"
              type="time"
              name="exitTime"
              value={formData.exitTime}
              onChange={handleChange}
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="hygieneCompliance"
              checked={formData.hygieneCompliance}
              onChange={handleChange}
              className="mr-2"
            />
            <span className="text-gray-700 text-sm font-bold">衛生管理基準への適合確認</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">※手洗い、靴の履き替え、作業服の着用等</p>
        </div>
        
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="safetyBriefing"
              checked={formData.safetyBriefing}
              onChange={handleChange}
              className="mr-2"
            />
            <span className="text-gray-700 text-sm font-bold">安全説明の実施</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">※危険箇所の説明、緊急時の対応等</p>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="notes">
            備考・特記事項
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            placeholder="訪問に関する特記事項や注意点があれば記載してください"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="submit"
            disabled={loading}
          >
            {loading ? '送信中...' : isEditMode ? '更新する' : '登録する'}
          </button>
          <button
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="button"
            onClick={() => navigate('/visitors')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default VisitorForm;