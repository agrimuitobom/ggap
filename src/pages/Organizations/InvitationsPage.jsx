// src/pages/Organizations/InvitationsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { acceptInvitation } from '../../services/organizationService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const InvitationsPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { invitations, fetchInvitations, refreshOrganizations } = useOrganization();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchInvitations();
    }
  }, [currentUser]);

  const handleAcceptInvitation = async (invitationId) => {
    setLoading(true);

    try {
      await acceptInvitation(invitationId, currentUser.uid);
      toast.success('招待を承認しました');
      await fetchInvitations();
      await refreshOrganizations();
      navigate('/organizations/switch');
    } catch (error) {
      console.error('Error accepting invitation:', error);
      if (error.message === 'Invitation expired') {
        toast.error('この招待は期限切れです');
      } else {
        toast.error('招待の承認に失敗しました');
      }
    } finally {
      setLoading(false);
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

  return (
    <div className="container mx-auto px-4 py-8 pb-20 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">組織への招待</h1>
        <p className="text-gray-600 mt-1">あなたへの組織招待を確認できます</p>
      </div>

      {invitations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">招待はありません</h3>
          <p className="mt-1 text-sm text-gray-500">
            現在、あなた宛ての組織招待はありません
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="bg-white rounded-lg shadow overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {invitation.organization.name}
                    </h3>
                    {invitation.organization.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {invitation.organization.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-500">権限:</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getRoleBadgeColor(invitation.role)}`}>
                          {getRoleLabel(invitation.role)}
                        </span>
                      </div>
                      {invitation.createdAt && (
                        <div className="text-gray-500">
                          招待日: {format(invitation.createdAt.toDate(), 'yyyy/MM/dd')}
                        </div>
                      )}
                      {invitation.expiresAt && (
                        <div className="text-gray-500">
                          有効期限: {format(invitation.expiresAt.toDate(), 'yyyy/MM/dd')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => handleAcceptInvitation(invitation.id)}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-300 disabled:opacity-50"
                  >
                    {loading ? '処理中...' : '承認する'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvitationsPage;
