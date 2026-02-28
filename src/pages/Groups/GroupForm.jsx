// src/pages/Groups/GroupForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const GroupForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    members: []
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState('');
  const isEditMode = !!id;

  useEffect(() => {
    if (currentUser) {
      fetchWorkers();
      if (isEditMode) {
        fetchGroupData();
      }
    }
  }, [id, isEditMode, currentUser]);

  const fetchWorkers = async () => {
    if (!currentUser) return;

    try {
      const workersQuery = query(
        collection(db, 'users'),
        where('organizationId', '==', currentUser.uid)
      );
      const workersSnapshot = await getDocs(workersQuery);
      const workersList = [];
      workersSnapshot.forEach((doc) => {
        workersList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      workersList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setWorkers(workersList);
    } catch (err) {
      console.error('Error fetching workers:', err);
      toast.error('従業員データの取得中にエラーが発生しました');
    }
  };

  const fetchGroupData = async () => {
    try {
      setFetchLoading(true);
      const docRef = doc(db, 'groups', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          name: data.name || '',
          description: data.description || '',
          members: data.members || []
        });
      } else {
        setError('指定されたグループが見つかりません。');
        navigate('/groups');
      }
    } catch (err) {
      console.error('Error fetching group data:', err);
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

  const handleMemberToggle = (workerId) => {
    setFormData(prev => {
      const newMembers = prev.members.includes(workerId)
        ? prev.members.filter(id => id !== workerId)
        : [...prev.members, workerId];
      return { ...prev, members: newMembers };
    });
  };

  const handleSelectAll = () => {
    setFormData(prev => ({
      ...prev,
      members: workers.map(w => w.id)
    }));
  };

  const handleDeselectAll = () => {
    setFormData(prev => ({
      ...prev,
      members: []
    }));
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
      setError('グループ名は必須です。');
      setLoading(false);
      return;
    }

    try {
      // 選択されたメンバーの名前を取得
      const selectedMembers = workers.filter(w => formData.members.includes(w.id));
      const memberNames = selectedMembers.map(m => m.name);

      const groupData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        members: formData.members,
        memberNames: memberNames,
        memberCount: formData.members.length,
        organizationId: currentUser.uid,
        updatedAt: serverTimestamp()
      };

      if (isEditMode) {
        await updateDoc(doc(db, 'groups', id), groupData);
        toast.success('グループを更新しました');
      } else {
        groupData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'groups'), groupData);
        toast.success('グループを登録しました');
      }

      setTimeout(() => {
        navigate('/groups');
      }, 1000);
    } catch (err) {
      console.error('Error saving group:', err);
      setError('グループの保存中にエラーが発生しました: ' + err.message);
      toast.error('グループの保存中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? 'グループ編集' : 'グループ登録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl pb-20 md:pb-4">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? 'グループ編集' : 'グループ登録'}</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
            グループ名 <span className="text-red-500">*</span>
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="例：令和7年度1年生"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
            説明
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="2"
            placeholder="グループの説明（任意）"
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            メンバー選択
          </label>

          {workers.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-sm text-yellow-800 mb-2">
                従業員が登録されていません。
              </p>
              <a
                href="/workers/new"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                従業員管理から従業員を登録してください
              </a>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  全て選択
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  選択解除
                </button>
                <span className="text-sm text-gray-500 ml-auto">
                  {formData.members.length}名選択中
                </span>
              </div>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {workers.map((worker) => (
                  <label
                    key={worker.id}
                    className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={formData.members.includes(worker.id)}
                      onChange={() => handleMemberToggle(worker.id)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">{worker.name}</p>
                      {worker.role && (
                        <p className="text-xs text-gray-500">{worker.role}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
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
            onClick={() => navigate('/groups')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default GroupForm;
