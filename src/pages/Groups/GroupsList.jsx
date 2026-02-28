// src/pages/Groups/GroupsList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, getDocs, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const GroupsList = () => {
  const { currentUser } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchGroups();
  }, [currentUser]);

  const fetchGroups = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const groupsQuery = query(
        collection(db, 'groups'),
        where('organizationId', '==', currentUser.uid)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsList = [];
      groupsSnapshot.forEach((doc) => {
        groupsList.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // 名前でソート
      groupsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setGroups(groupsList);
    } catch (err) {
      console.error('Error fetching groups:', err);
      toast.error('グループデータの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (groupId, groupName) => {
    if (!window.confirm(`「${groupName}」を削除してもよろしいですか？\n\n※グループに所属するメンバーは削除されません。`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'groups', groupId));
      setGroups(groups.filter(group => group.id !== groupId));
      toast.success('グループを削除しました');
    } catch (err) {
      console.error('Error deleting group:', err);
      toast.error('グループの削除中にエラーが発生しました');
    }
  };

  const filteredGroups = groups.filter(group =>
    (group.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">グループ管理</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">グループ管理</h1>
        <Link
          to="/groups/new"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          グループを追加
        </Link>
      </div>

      {/* 検索 */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">検索</label>
          <input
            type="text"
            placeholder="グループ名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* グループリスト */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">グループが登録されていません</h3>
          <p className="mt-1 text-sm text-gray-500">
            グループを作成して、教育訓練の参加者をまとめて管理しましょう。
          </p>
          <div className="mt-6">
            <Link
              to="/groups/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              グループを追加
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <div key={group.id} className="bg-white shadow rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">{group.name}</h3>
                    <p className="text-sm text-gray-500">
                      {group.memberCount || 0}名
                    </p>
                  </div>
                </div>
              </div>

              {group.description && (
                <p className="mt-3 text-sm text-gray-600 line-clamp-2">{group.description}</p>
              )}

              {group.memberNames && group.memberNames.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">メンバー:</p>
                  <p className="text-sm text-gray-700 truncate">
                    {group.memberNames.slice(0, 3).join('、')}
                    {group.memberNames.length > 3 && ` 他${group.memberNames.length - 3}名`}
                  </p>
                </div>
              )}

              <div className="mt-4 flex justify-end space-x-3">
                <Link
                  to={`/groups/edit/${group.id}`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  編集
                </Link>
                <button
                  onClick={() => handleDelete(group.id, group.name)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredGroups.length > 0 && (
        <div className="mt-4 text-sm text-gray-500">
          {filteredGroups.length}件のグループ
        </div>
      )}
    </div>
  );
};

export default GroupsList;
