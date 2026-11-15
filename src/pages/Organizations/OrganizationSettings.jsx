// src/pages/Organizations/OrganizationSettings.jsx
import React, { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  updateOrganization,
  inviteMemberToOrganization,
  removeMemberFromOrganization,
  updateMemberRole
} from '../../services/organizationService';
import {
  createViewerAccount,
  generateViewerPassword,
  validateViewerId,
  validateViewerPassword,
  normalizeViewerId,
  VIEWER_PASSWORD_MIN_LENGTH
} from '../../services/viewerAccountService';
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
  const [showViewerForm, setShowViewerForm] = useState(false);
  const [viewerId, setViewerId] = useState('');
  const [viewerPassword, setViewerPassword] = useState('');
  const [viewerName, setViewerName] = useState('');
  const [viewerError, setViewerError] = useState('');
  const [viewerSaving, setViewerSaving] = useState(false);
  // 発行直後に一度だけ表示する IDとパスワード
  const [issuedViewer, setIssuedViewer] = useState(null);

  useEffect(() => {
    if (currentOrganization) {
      setOrganizationName(currentOrganization.name);
      setOrganizationDescription(currentOrganization.description || '');
      loadMembers();
    }
    // 依存配列のキーが変わったときだけ再取得する（取得関数は毎回作り直されるため含めない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization]);

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
        currentUser.uid
      );
      toast.success(`${inviteEmail} に招待メールを送信しました`);
      setInviteEmail('');
      setInviteRole('member');
      setShowInviteForm(false);
    } catch (error) {
      firestoreLogger.error('メンバーの招待に失敗しました', { organizationId: currentOrganization.id, inviteEmail, inviteRole }, error);
      toast.error('メンバーの招待に失敗しました');
    }
  };

  const closeViewerForm = () => {
    setShowViewerForm(false);
    setViewerId('');
    setViewerPassword('');
    setViewerName('');
    setViewerError('');
  };

  const handleCreateViewer = async (e) => {
    e.preventDefault();

    const validationError = validateViewerId(viewerId) || validateViewerPassword(viewerPassword);
    if (validationError) {
      setViewerError(validationError);
      return;
    }

    try {
      setViewerError('');
      setViewerSaving(true);
      const id = normalizeViewerId(viewerId);
      await createViewerAccount({
        organizationId: currentOrganization.id,
        viewerId: id,
        password: viewerPassword,
        displayName: viewerName
      });
      setIssuedViewer({ id, password: viewerPassword });
      closeViewerForm();
      toast.success('閲覧用IDを発行しました');
      await loadMembers();
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setViewerError('この閲覧用IDは既に使われています。別のIDを指定してください');
      } else if (error.code === 'auth/weak-password') {
        setViewerError('パスワードが弱すぎます。より複雑なパスワードにしてください');
      } else if (error.code === 'auth/network-request-failed') {
        setViewerError('通信できませんでした。電波状況を確認してください');
      } else {
        setViewerError('閲覧用IDの発行に失敗しました: ' + error.message);
      }
    } finally {
      setViewerSaving(false);
    }
  };

  const handleCopyIssued = async () => {
    try {
      await navigator.clipboard.writeText(
        `閲覧用ID: ${issuedViewer.id}\nパスワード: ${issuedViewer.password}\nURL: ${window.location.origin}/login`
      );
      toast.success('コピーしました');
    } catch (error) {
      toast.error('コピーできませんでした。表示内容を控えてください');
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

  const isAdmin = userRole === 'admin';

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
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  setShowViewerForm(!showViewerForm);
                  setShowInviteForm(false);
                }}
                className="bg-white hover:bg-gray-50 text-green-700 border border-green-600 py-2 px-4 rounded transition duration-300"
              >
                閲覧用IDを発行
              </button>
              <button
                onClick={() => {
                  setShowInviteForm(!showInviteForm);
                  setShowViewerForm(false);
                }}
                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-300"
              >
                メンバーを招待
              </button>
            </div>
          )}
        </div>

        {/* 発行した閲覧用IDの控え */}
        {issuedViewer && isAdmin && (
          <div className="px-6 py-4 bg-green-50 border-b border-green-200" role="status">
            <p className="text-sm font-semibold text-green-900">閲覧用IDを発行しました</p>
            <p className="text-sm text-green-800 mt-1">
              パスワードはこの画面を閉じると再表示できません。今のうちに控えて、閲覧する方へ伝えてください。
            </p>
            <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-gray-600">閲覧用ID</dt>
              <dd className="font-mono font-semibold text-gray-900 break-all">{issuedViewer.id}</dd>
              <dt className="text-gray-600">パスワード</dt>
              <dd className="font-mono font-semibold text-gray-900 break-all">{issuedViewer.password}</dd>
            </dl>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleCopyIssued}
                className="bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-4 rounded transition duration-300"
              >
                IDとパスワードをコピー
              </button>
              <button
                type="button"
                onClick={() => setIssuedViewer(null)}
                className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-sm py-2 px-4 rounded transition duration-300"
              >
                控えたので閉じる
              </button>
            </div>
          </div>
        )}

        {/* 閲覧用ID発行フォーム */}
        {showViewerForm && isAdmin && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <form onSubmit={handleCreateViewer} className="space-y-4">
              <p className="text-sm text-gray-600">
                メールアドレスを持たない方（審査員・取引先など）に、記録を見るだけのIDとパスワードを発行します。
                発行したIDでは記録の追加・変更・削除はできません。
              </p>
              {viewerError && (
                <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {viewerError}
                </div>
              )}
              <div>
                <label htmlFor="viewer-id" className="block text-sm font-medium text-gray-700 mb-1">
                  閲覧用ID
                </label>
                <input
                  id="viewer-id"
                  type="text"
                  value={viewerId}
                  onChange={(e) => setViewerId(e.target.value)}
                  placeholder="例: shinsa-2026"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  半角の英小文字・数字・「.」「_」「-」で3〜30文字。他の農場と重複するIDは使えません。
                </p>
              </div>
              <div>
                <label htmlFor="viewer-password" className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード
                </label>
                <div className="flex gap-2">
                  <input
                    id="viewer-password"
                    type="text"
                    value={viewerPassword}
                    onChange={(e) => setViewerPassword(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    minLength={VIEWER_PASSWORD_MIN_LENGTH}
                    className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-green-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setViewerPassword(generateViewerPassword())}
                    className="shrink-0 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 py-2 px-3 rounded-lg text-sm"
                  >
                    自動生成
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">{VIEWER_PASSWORD_MIN_LENGTH}文字以上</p>
              </div>
              <div>
                <label htmlFor="viewer-name" className="block text-sm font-medium text-gray-700 mb-1">
                  表示名（任意）
                </label>
                <input
                  id="viewer-name"
                  type="text"
                  value={viewerName}
                  onChange={(e) => setViewerName(e.target.value)}
                  placeholder="例: JGAP審査員"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={viewerSaving}
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-300 disabled:opacity-60"
                >
                  {viewerSaving ? '発行中…' : '発行する'}
                </button>
                <button
                  type="button"
                  onClick={closeViewerForm}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded transition duration-300"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 招待フォーム */}
        {showInviteForm && isAdmin && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
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
                  招待を送信
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
                      <p className="text-sm text-gray-500">
                        {member.user.isViewerAccount ? `閲覧用ID: ${member.user.loginId}` : member.user.email}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getRoleBadgeColor(member.role)}`}>
                      {getRoleLabel(member.role)}
                    </span>
                  </div>
                </div>
                {isAdmin && member.userId !== currentUser.uid && (
                  <div className="flex items-center space-x-2">
                    {!member.user.isViewerAccount && (
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                      className="text-sm px-2 py-1 border border-gray-300 rounded"
                    >
                      <option value="admin">管理者</option>
                      <option value="member">メンバー</option>
                      <option value="viewer">閲覧のみ</option>
                    </select>
                    )}
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
