// src/pages/Trainings/TrainingForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, getDoc, query, getDocs, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const TrainingForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [formData, setFormData] = useState({
    trainingDate: new Date().toISOString().split('T')[0],
    title: '',
    category: '',
    instructor: '',
    instructorType: 'internal',
    participants: [],
    duration: '',
    location: '',
    description: '',
    objectives: '',
    materials: '',
    evaluationMethod: '',
    status: '予定',
    certificateIssued: false,
    followUpRequired: false,
    followUpDate: '',
    cost: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState('');
  const isEditMode = !!id;

  const trainingCategories = [
    '食品安全・衛生管理',
    'GAP基準・認証',
    '農薬・化学物質管理',
    '労働安全衛生',
    '環境保全・持続可能性',
    '品質管理',
    '機械操作・メンテナンス',
    '緊急時対応',
    'トレーサビリティ',
    'コンプライアンス',
    'その他'
  ];

  const statusOptions = [
    '予定',
    '進行中',
    '完了',
    '延期'
  ];

  const evaluationMethods = [
    '筆記試験',
    '実技試験',
    '口頭試問',
    '実習評価',
    '参加確認のみ',
    'その他'
  ];

  useEffect(() => {
    if (currentUser) {
      fetchData();
      if (isEditMode) {
        fetchTrainingData();
      }
    }
  }, [id, isEditMode, currentUser]);

  const fetchData = async () => {
    if (!currentUser) return;

    try {
      // 従業員とグループを並行して取得
      const [usersSnapshot, groupsSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, 'users'),
          where('organizationId', '==', currentUser.uid)
        )),
        getDocs(query(
          collection(db, 'groups'),
          where('organizationId', '==', currentUser.uid)
        ))
      ]);

      const usersList = [];
      usersSnapshot.forEach((doc) => {
        usersList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      usersList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setUsers(usersList);

      const groupsList = [];
      groupsSnapshot.forEach((doc) => {
        groupsList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      groupsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setGroups(groupsList);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('データの取得中にエラーが発生しました');
    }
  };

  const fetchTrainingData = async () => {
    try {
      setFetchLoading(true);
      const docRef = doc(db, 'trainings', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          trainingDate: data.trainingDate?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          title: data.title || '',
          category: data.category || '',
          instructor: data.instructor || '',
          instructorType: data.instructorType || 'internal',
          participants: data.participants || [],
          duration: data.duration?.toString() || '',
          location: data.location || '',
          description: data.description || '',
          objectives: data.objectives || '',
          materials: data.materials || '',
          evaluationMethod: data.evaluationMethod || '',
          status: data.status || '予定',
          certificateIssued: data.certificateIssued || false,
          followUpRequired: data.followUpRequired || false,
          followUpDate: data.followUpDate?.toDate().toISOString().split('T')[0] || '',
          cost: data.cost?.toString() || '',
          notes: data.notes || ''
        });
        // 編集時のグループIDを復元
        if (data.groupId) {
          setSelectedGroupId(data.groupId);
        }
      } else {
        setError('指定された教育・訓練記録が見つかりません。');
        navigate('/trainings');
      }
    } catch (err) {
      console.error('Error fetching training data:', err);
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

  const handleGroupSelect = (e) => {
    const groupId = e.target.value;
    setSelectedGroupId(groupId);

    if (groupId) {
      // グループを選択した場合、そのグループのメンバーを参加者として設定
      const selectedGroup = groups.find(g => g.id === groupId);
      if (selectedGroup && selectedGroup.members) {
        setFormData(prev => ({
          ...prev,
          participants: selectedGroup.members
        }));
      }
    } else {
      // グループ選択を解除した場合は参加者をクリア
      setFormData(prev => ({
        ...prev,
        participants: []
      }));
    }
  };

  const handleParticipantToggle = (userId) => {
    setFormData(prev => {
      const newParticipants = prev.participants.includes(userId)
        ? prev.participants.filter(id => id !== userId)
        : [...prev.participants, userId];
      return { ...prev, participants: newParticipants };
    });
    // 個別選択したらグループ選択を解除
    setSelectedGroupId('');
  };

  const handleSelectAll = () => {
    setFormData(prev => ({
      ...prev,
      participants: users.map(u => u.id)
    }));
    setSelectedGroupId('');
  };

  const handleDeselectAll = () => {
    setFormData(prev => ({
      ...prev,
      participants: []
    }));
    setSelectedGroupId('');
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

    if (formData.participants.length === 0) {
      setError('参加者を1名以上選択してください。');
      setLoading(false);
      return;
    }

    try {
      const selectedParticipants = users.filter(user => formData.participants.includes(user.id));
      const selectedGroup = groups.find(g => g.id === selectedGroupId);

      const trainingData = {
        userId: currentUser.uid,
        trainingDate: new Date(formData.trainingDate),
        title: formData.title,
        category: formData.category,
        instructor: formData.instructor,
        instructorType: formData.instructorType,
        participants: formData.participants,
        participantNames: selectedParticipants.map(participant => participant.name),
        participantCount: formData.participants.length,
        groupId: selectedGroupId || null,
        groupName: selectedGroup?.name || null,
        duration: formData.duration ? Number(formData.duration) : null,
        location: formData.location,
        description: formData.description,
        objectives: formData.objectives,
        materials: formData.materials,
        evaluationMethod: formData.evaluationMethod,
        status: formData.status,
        certificateIssued: formData.certificateIssued,
        followUpRequired: formData.followUpRequired,
        followUpDate: formData.followUpDate ? new Date(formData.followUpDate) : null,
        cost: formData.cost ? Number(formData.cost) : null,
        notes: formData.notes,
        updatedAt: serverTimestamp()
      };

      if (isEditMode) {
        await updateDoc(doc(db, 'trainings', id), trainingData);
        toast.success('教育・訓練記録が更新されました');
      } else {
        trainingData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'trainings'), trainingData);
        toast.success('教育・訓練記録が登録されました');

        // フォームをリセット
        setFormData({
          trainingDate: new Date().toISOString().split('T')[0],
          title: '',
          category: '',
          instructor: '',
          instructorType: 'internal',
          participants: [],
          duration: '',
          location: '',
          description: '',
          objectives: '',
          materials: '',
          evaluationMethod: '',
          status: '予定',
          certificateIssued: false,
          followUpRequired: false,
          followUpDate: '',
          cost: '',
          notes: ''
        });
        setSelectedGroupId('');
      }

      // 成功後、一覧画面に戻る
      setTimeout(() => {
        navigate('/trainings');
      }, 1000);
    } catch (err) {
      console.error('Error saving training:', err);
      setError('教育・訓練記録の保存中にエラーが発生しました: ' + err.message);
      toast.error('教育・訓練記録の保存中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '教育・訓練記録編集' : '教育・訓練記録登録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl pb-20 md:pb-4">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '教育・訓練記録編集' : '教育・訓練記録登録'}</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="trainingDate">
              実施日 <span className="text-red-500">*</span>
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="trainingDate"
              type="date"
              name="trainingDate"
              value={formData.trainingDate}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="status">
              状態 <span className="text-red-500">*</span>
            </label>
            <select
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
            >
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="title">
            教育・訓練名 <span className="text-red-500">*</span>
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="title"
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="category">
              カテゴリ <span className="text-red-500">*</span>
            </label>
            <select
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="">カテゴリを選択してください</option>
              {trainingCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="location">
              実施場所
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="location"
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="instructor">
              講師名 <span className="text-red-500">*</span>
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="instructor"
              type="text"
              name="instructor"
              value={formData.instructor}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="instructorType">
              講師区分
            </label>
            <select
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="instructorType"
              name="instructorType"
              value={formData.instructorType}
              onChange={handleChange}
            >
              <option value="internal">内部講師</option>
              <option value="external">外部講師</option>
              <option value="consultant">コンサルタント</option>
              <option value="auditor">監査員</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="duration">
              実施時間（時間）
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="duration"
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              step="0.5"
              min="0"
            />
          </div>
        </div>

        {/* 参加者選択セクション */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
          <label className="block text-gray-700 text-sm font-bold mb-3">
            参加者 <span className="text-red-500">*</span>
          </label>

          {users.length === 0 && groups.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-sm text-yellow-800 mb-2">
                従業員・グループが登録されていません。
              </p>
              <div className="flex gap-4">
                <a
                  href="/workers/new"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  従業員を登録
                </a>
                <a
                  href="/groups/new"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  グループを登録
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* グループ選択 */}
              {groups.length > 0 && (
                <div className="mb-4">
                  <label className="block text-gray-600 text-sm mb-2">
                    グループから選択（グループを選ぶとメンバー全員が参加者になります）
                  </label>
                  <select
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={selectedGroupId}
                    onChange={handleGroupSelect}
                  >
                    <option value="">-- グループを選択 --</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.memberCount || 0}名)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 選択中のグループ表示 */}
              {selectedGroupId && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="font-medium text-blue-800">
                        {groups.find(g => g.id === selectedGroupId)?.name}
                      </span>
                    </div>
                    <span className="text-sm text-blue-600">
                      {formData.participants.length}名選択中
                    </span>
                  </div>
                </div>
              )}

              {/* 個別選択 */}
              {users.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-600 text-sm">
                      個別に選択（または追加・解除）
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        全選択
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        解除
                      </button>
                    </div>
                  </div>

                  <div className="border rounded-lg max-h-48 overflow-y-auto bg-white">
                    {users.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={formData.participants.includes(user.id)}
                          onChange={() => handleParticipantToggle(user.id)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm text-gray-900">{user.name}</span>
                        {user.role && (
                          <span className="ml-2 text-xs text-gray-500">({user.role})</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 選択人数表示 */}
              <div className="mt-3 text-sm text-gray-600">
                選択中: <span className="font-semibold text-green-600">{formData.participants.length}名</span>
              </div>
            </>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
            教育・訓練内容
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            placeholder="実施した教育・訓練の具体的な内容を記載してください"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="objectives">
            教育目標・期待効果
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="objectives"
            name="objectives"
            value={formData.objectives}
            onChange={handleChange}
            rows="2"
            placeholder="この教育・訓練で達成したい目標や期待する効果を記載してください"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="materials">
              使用教材・資料
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="materials"
              type="text"
              name="materials"
              value={formData.materials}
              onChange={handleChange}
              placeholder="テキスト、動画、実物サンプル等"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="evaluationMethod">
              評価方法
            </label>
            <select
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="evaluationMethod"
              name="evaluationMethod"
              value={formData.evaluationMethod}
              onChange={handleChange}
            >
              <option value="">評価方法を選択してください</option>
              {evaluationMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="certificateIssued"
                checked={formData.certificateIssued}
                onChange={handleChange}
                className="mr-2"
              />
              <span className="text-gray-700 text-sm font-bold">修了証明書発行</span>
            </label>
          </div>

          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="followUpRequired"
                checked={formData.followUpRequired}
                onChange={handleChange}
                className="mr-2"
              />
              <span className="text-gray-700 text-sm font-bold">フォローアップ必要</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="followUpDate">
              フォローアップ予定日
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="followUpDate"
              type="date"
              name="followUpDate"
              value={formData.followUpDate}
              onChange={handleChange}
              disabled={!formData.followUpRequired}
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="cost">
              実施費用（円）
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="cost"
              type="number"
              name="cost"
              value={formData.cost}
              onChange={handleChange}
              min="0"
            />
          </div>
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
            placeholder="その他の特記事項や改善点があれば記載してください"
          />
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline w-full md:w-auto"
            type="submit"
            disabled={loading}
          >
            {loading ? '送信中...' : isEditMode ? '更新する' : '登録する'}
          </button>
          <button
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline w-full md:w-auto"
            type="button"
            onClick={() => navigate('/trainings')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default TrainingForm;
