// src/pages/Organizations/OrganizationSwitcher.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { createOrganization } from '../../services/organizationService';
import toast from 'react-hot-toast';
import logger from '../../utils/logger';

const OrganizationSwitcher = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { organizations, currentOrganization, switchOrganization, refreshOrganizations } = useOrganization();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSwitchOrganization = async (orgId) => {
    try {
      await switchOrganization(orgId);
      toast.success('組織を切り替えました');
      navigate('/dashboard');
    } catch (error) {
      logger.error('Error switching organization', {}, error);
      toast.error('組織の切り替えに失敗しました');
    }
  };

  const handleCreateOrganization = async (e) => {
    e.preventDefault();

    if (!newOrgName.trim()) {
      toast.error('組織名を入力してください');
      return;
    }

    setCreating(true);

    try {
      await createOrganization(currentUser.uid, newOrgName, newOrgDescription);
      toast.success('新しい組織を作成しました');
      setNewOrgName('');
      setNewOrgDescription('');
      setShowCreateForm(false);
      await refreshOrganizations();
    } catch (error) {
      logger.error('Error creating organization', {}, error);
      toast.error('組織の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-20 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">組織の切り替え</h1>
        <p className="text-gray-600 mt-1">アクセスする組織を選択してください</p>
      </div>

      {/* 現在の組織 */}
      {currentOrganization && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">
                現在の組織: <span className="font-semibold">{currentOrganization.name}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 組織リスト */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">所属している組織</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {organizations.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              所属している組織がありません
            </div>
          ) : (
            organizations.map((org) => (
              <div
                key={org.id}
                className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition ${
                  currentOrganization?.id === org.id ? 'bg-green-50' : ''
                }`}
                onClick={() => {
                  if (currentOrganization?.id !== org.id) {
                    handleSwitchOrganization(org.id);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-base font-medium text-gray-900">{org.name}</h3>
                      {currentOrganization?.id === org.id && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                          使用中
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        org.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : org.role === 'member'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {org.role === 'admin' ? '管理者' : org.role === 'member' ? 'メンバー' : '閲覧のみ'}
                      </span>
                    </div>
                    {org.description && (
                      <p className="text-sm text-gray-500 mt-1">{org.description}</p>
                    )}
                  </div>
                  {currentOrganization?.id !== org.id && (
                    <svg
                      className="h-5 w-5 text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 新しい組織を作成 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">新しい組織を作成</h2>
        </div>
        {showCreateForm ? (
          <form onSubmit={handleCreateOrganization} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                組織名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="例: 〇〇農場"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                説明（任意）
              </label>
              <textarea
                value={newOrgDescription}
                onChange={(e) => setNewOrgDescription(e.target.value)}
                placeholder="この組織の説明"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={creating}
                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-300 disabled:opacity-50"
              >
                {creating ? '作成中...' : '組織を作成'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewOrgName('');
                  setNewOrgDescription('');
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded transition duration-300"
              >
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full bg-white border-2 border-dashed border-gray-300 rounded-lg px-6 py-4 text-center hover:border-green-500 hover:bg-green-50 transition"
            >
              <svg
                className="mx-auto h-8 w-8 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="mt-2 block text-sm font-medium text-gray-900">
                新しい組織を作成
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationSwitcher;
