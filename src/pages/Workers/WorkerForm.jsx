// src/pages/Workers/WorkerForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const WorkerForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    hireDate: '',
    status: '在籍',
    emergencyContact: '',
    emergencyPhone: '',
    certifications: '',
    skills: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState('');
  const isEditMode = !!id;

  const roles = [
    '農場主',
    '農場管理者',
    '正社員',
    'パート・アルバイト',
    '研修生',
    '季節労働者',
    'その他'
  ];

  const statusOptions = [
    '在籍',
    '休職中',
    '退職'
  ];

  useEffect(() => {
    if (isEditMode && currentUser) {
      fetchWorkerData();
    }
  }, [id, isEditMode, currentUser]);

  const fetchWorkerData = async () => {
    try {
      setFetchLoading(true);
      const docRef = doc(db, 'users', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          role: data.role || '',
          department: data.department || '',
          hireDate: data.hireDate ? data.hireDate.toDate().toISOString().split('T')[0] : '',
          status: data.status || '在籍',
          emergencyContact: data.emergencyContact || '',
          emergencyPhone: data.emergencyPhone || '',
          certifications: data.certifications || '',
          skills: data.skills || '',
          notes: data.notes || ''
        });
      } else {
        setError('指定された従業員が見つかりません。');
        navigate('/workers');
      }
    } catch (err) {
      console.error('Error fetching worker data:', err);
      setError('データの取得中にエラーが発生しました。');
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setFetchLoading(false);
    }
  };

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

    if (!currentUser) {
      setError('ユーザー認証が確認できません。');
      setLoading(false);
      return;
    }

    if (!formData.name.trim()) {
      setError('名前は必須です。');
      setLoading(false);
      return;
    }

    try {
      const workerData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        department: formData.department.trim(),
        hireDate: formData.hireDate ? new Date(formData.hireDate) : null,
        status: formData.status,
        emergencyContact: formData.emergencyContact.trim(),
        emergencyPhone: formData.emergencyPhone.trim(),
        certifications: formData.certifications.trim(),
        skills: formData.skills.trim(),
        notes: formData.notes.trim(),
        organizationId: currentUser.uid,
        updatedAt: serverTimestamp()
      };

      if (isEditMode) {
        await updateDoc(doc(db, 'users', id), workerData);
        toast.success('従業員情報を更新しました');
      } else {
        workerData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'users'), workerData);
        toast.success('従業員を登録しました');
      }

      setTimeout(() => {
        navigate('/workers');
      }, 1000);
    } catch (err) {
      console.error('Error saving worker:', err);
      setError('従業員情報の保存中にエラーが発生しました: ' + err.message);
      toast.error('従業員情報の保存中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '従業員編集' : '従業員登録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl pb-20 md:pb-4">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '従業員編集' : '従業員登録'}</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        {/* 基本情報 */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">基本情報</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                名前 <span className="text-red-500">*</span>
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="山田 太郎"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="role">
                役職 <span className="text-red-500">*</span>
              </label>
              <select
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="">役職を選択してください</option>
                {roles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                メールアドレス
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@email.com"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">
                電話番号
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="090-1234-5678"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="department">
                部署・担当
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="department"
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="生産部門"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="hireDate">
                入社日
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="hireDate"
                type="date"
                name="hireDate"
                value={formData.hireDate}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="status">
              在籍状態
            </label>
            <select
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 緊急連絡先 */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">緊急連絡先</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="emergencyContact">
                緊急連絡先（氏名）
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="emergencyContact"
                type="text"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleChange}
                placeholder="山田 花子（配偶者）"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="emergencyPhone">
                緊急連絡先（電話番号）
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="emergencyPhone"
                type="tel"
                name="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={handleChange}
                placeholder="090-9876-5432"
              />
            </div>
          </div>
        </div>

        {/* スキル・資格 */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b">スキル・資格</h2>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="certifications">
              保有資格
            </label>
            <textarea
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="certifications"
              name="certifications"
              value={formData.certifications}
              onChange={handleChange}
              rows="2"
              placeholder="農薬管理指導士、フォークリフト免許、etc."
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="skills">
              スキル・特技
            </label>
            <textarea
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="skills"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              rows="2"
              placeholder="トラクター操作、剪定、土壌分析、etc."
            />
          </div>
        </div>

        {/* 備考 */}
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
            placeholder="その他特記事項"
          />
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline w-full md:w-auto"
            type="submit"
            disabled={loading}
          >
            {loading ? '送信中...' : isEditMode ? '更新する' : '登録する'}
          </button>
          <button
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline w-full md:w-auto"
            type="button"
            onClick={() => navigate('/workers')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default WorkerForm;
