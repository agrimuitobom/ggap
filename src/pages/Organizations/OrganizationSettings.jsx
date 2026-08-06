// src/pages/Organizations/OrganizationSettings.jsx
import React, { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  updateOrganization,
  inviteMemberToOrganization,
  getOrganizationInvitations,
  cancelInvitation,
  removeMemberFromOrganization,
  updateMemberRole
} from '../../services/organizationService';
import toast from 'react-hot-toast';
import { firestoreLogger } from '../../utils/logger';

const OrganizationSettings = () => {
  const { currentOrganization, userRole, fetchMembers, refreshOrganizations } = useOrganization();
  const { currentUser } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationDescription, setOrganizationDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState([]);

  // useEffect の依存配列は描画時に評価されるため、ここで先に決めておく
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (currentOrganization) {
      setOrganizationName(currentOrganization.name);
      setOrganizationDescription(currentOrganization.description || '');
      loadMembers();
      loadInvitations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization, isAdmin]);

  const loadMembers = async () => {
    try {
      const membersList = await fetchMembers(currentOrganization.id);
      setMembers(membersList);
    } catch (error) {
      firestoreLogger.error('メンバー一覧の取得に失敗しました', { organizationId: currentOrganization.id }, error);
      toast.error('メンバー一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrganization = async () => {
    try {
      await updateOrganization(currentOrganization.id, {
        name: organizationName,
        description: organizationDescription
      });
      toast.success('組織情報を更新しました');
      setEditingName(false);
      await refreshOrganizations();
    } catch (error) {
      firestoreLogger.error('組織情報の更新に失敗しました', { organizationId: currentOrganization.id }, error);
      toast.error('組織情報の更新に失敗しました');
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();

    if (!inviteEmail) {
      toast.error('メールアドレスを入力してください');
      return;
    }

    try {
      await inviteMemberToOrganization(
        currentOrganization.id,
        inviteEmail,
        inviteRole,
        currentUser.uid,
        currentOrganization.name
      );
      // メールは送信されない。招待された本人が同じメールアドレスで
      // ログインし、自分で「招待一覧」から承認する必要がある
      toast.success('招待を作成しました。相手にログインしてもらってください');
      await loadInvitations();
      setInviteEmail('');
      setInviteRole('member');
      setShowInviteForm(false);
    } catch (error) {
      firestoreLogger.error('メンバーの招待に失敗しました', { organizationId: currentOrganization.id, inviteEmail, inviteRole }, error);
      toast.error('メンバーの招待に失敗しました');
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    if (!window.confirm(`${userName} をこの組織から削除してもよろしいですか？`)) {
      return;
    }

    try {
      await removeMemberFromOrganization(currentOrganization.id, userId);
      toast.success('メンバーを削除しました');
      await loadMembers();
    } catch (error) {
      firestoreLogger.error('メンバーの削除に失敗しました', { organizationId: currentOrganization.id, userId }, error);
      toast.error('メンバーの削除に失敗しました');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await updateMemberRole(currentOrganization.id, userId, newRole);
      toast.success('権限を変更しました');
      await loadMembers();
    } catch (error) {
      firestoreLogger.error('権限の変更に失敗しました', { organizationId: currentOrganization.id, userId, newRole }, error);
      toast.error('権限の変更に失敗しました');
    }
  };

  const loadInvitations = async () => {
    if (!currentOrganization || !isAdmin) return;
    try {
      setPendingInvitations(
        await getOrganizationInvitations(currentOrganization.id, currentOrganization.name)
      );
    } catch (err) {
      firestoreLogger.error('招待一覧の取得に失敗しました', { organizationId: currentOrganization?.id }, err);
    }
  };

  const handleCancelInvitation = async (invitation) => {
    if (!window.confirm(`${invitation.email} への招待を取り消しますか？`)) return;
    try {
      await cancelInvitation(invitation.id);
      toast.success('招待を取り消しました');
      await loadInvitations();
    } catch (err) {
      firestoreLogger.error('招待の取り消しに失敗しました', { invitationId: invitation.id }, err);
      toast.error('取り消し中にエラーが発生しました');
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'member':
        return 'bg-blue-100 text-blue-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return '管理者';
      case 'member':
        return 'メンバー';
      case 'viewer':
        return '閲覧のみ';
      default:
        return role;
    }
  };


  if (!currentOrganization) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
          <p className="text-yellow-700">組織が選択されていません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-20 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">組織設定</h1>
        <p className="text-gray-600 mt-1">組織情報とメンバー管理</p>
      </div>

      {/* 組織情報 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">組織情報</h2>
        </div>
        <div className="p-6">
          {editingName && isAdmin ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  組織名
                </label>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={organizationDescription}
                  onChange={(e) => setOrganizationDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleUpdateOrganization}
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-300"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setOrganizationName(currentOrganization.name);
                    setOrganizationDescription(currentOrganization.description || '');
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded transition duration-300"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">{currentOrganization.name}</h3>
                {currentOrganization.description && (
                  <p className="text-gray-600 mt-1">{currentOrganization.description}</p>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-green-600 hover:text-green-800 text-sm"
                >
                  編集
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* メンバー管理 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">
            メンバー ({members.length})
          </h2>
          {isAdmin && (
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-300"
            >
              メンバーを招待
            </button>
          )}
        </div>

        {/* 招待フォーム */}
        {showInviteForm && isAdmin && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="bg-amber-50 border border-amber-300 rounded p-3 mb-4 text-sm text-amber-900">
              <p className="font-bold mb-1">この招待でメールは送信されません</p>
              <p>
                招待は、このアプリの中に「このメールアドレスの人を受け入れる」という
                印を置くだけです。相手には次の手順を伝えてください。
              </p>
              <ol className="list-decimal list-outside ml-5 mt-2 space-y-1">
                <li>アプリで<strong>同じメールアドレス</strong>のアカウントを作る（すでにあればログイン）</li>
                <li>サイドバーの「組織管理 → 招待一覧」を開く</li>
                <li>表示された招待を承認する</li>
              </ol>
              <p className="mt-2">
                メールアドレスが1文字でも違うと招待は表示されません。招待の有効期限は7日間です。
              </p>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="example@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  権限
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="member">メンバー（読み書き可能）</option>
                  <option value="viewer">閲覧のみ</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-300"
                >
                  招待を作成
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteEmail('');
                    setInviteRole('member');
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded transition duration-300"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 承認待ちの招待。メールが飛ばない以上、誰宛に出したかを見えるようにする */}
        {isAdmin && pendingInvitations.length > 0 && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <p className="font-bold text-blue-900 mb-2">
              承認待ちの招待（{pendingInvitations.length}件）
            </p>
            <p className="text-sm text-blue-900 mb-3">
              下のメールアドレスで<strong>相手がログインし、招待一覧から承認する</strong>と
              メンバーになります。まだ承認されていません。
            </p>
            <ul className="space-y-2">
              {pendingInvitations.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded px-3 py-2">
                  <span className="text-sm">
                    <span className="font-mono">{inv.email}</span>
                    <span className="ml-2 text-gray-600">{getRoleLabel(inv.role)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCancelInvitation(inv)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    取り消す
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* メンバーリスト */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700 mx-auto"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              メンバーがいません
            </div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {member.user.name || member.user.email}
                      </h3>
                      <p className="text-sm text-gray-500">{member.user.email}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getRoleBadgeColor(member.role)}`}>
                      {getRoleLabel(member.role)}
                    </span>
                  </div>
                </div>
                {isAdmin && member.userId !== currentUser.uid && (
                  <div className="flex items-center space-x-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                      className="text-sm px-2 py-1 border border-gray-300 rounded"
                    >
                      <option value="admin">管理者</option>
                      <option value="member">メンバー</option>
                      <option value="viewer">閲覧のみ</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.userId, member.user.name || member.user.email)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationSettings;
