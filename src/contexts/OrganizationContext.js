// src/contexts/OrganizationContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
  getUserOrganizations,
  getOrganization,
  createOrganization,
  getUserRoleInOrganization,
  getOrganizationMembers,
  getUserInvitations,
  migrateUserDataToOrganization
} from '../services/organizationService';
import { ensureSelfWorker } from '../services/selfWorkerService';
import { firestoreLogger } from '../utils/logger';
import toast from 'react-hot-toast';

const OrganizationContext = createContext();

export function useOrganization() {
  return useContext(OrganizationContext);
}

export function OrganizationProvider({ children }) {
  const { currentUser, userProfile } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [currentOrganization, setCurrentOrganization] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [selfWorkerId, setSelfWorkerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState([]);
  const [invitationError, setInvitationError] = useState('');

  // ユーザーの組織一覧を取得
  const fetchUserOrganizations = async () => {
    if (!currentUser) return;

    try {
      const orgs = await getUserOrganizations(currentUser.uid);
      setOrganizations(orgs);

      // 組織が存在しない場合、個人組織を自動作成
      if (orgs.length === 0) {
        await createPersonalOrganization();
      } else {
        // ローカルストレージから前回選択した組織を復元
        const savedOrgId = localStorage.getItem('currentOrganizationId');
        const savedOrg = orgs.find(org => org.id === savedOrgId);

        if (savedOrg) {
          await switchOrganization(savedOrg.id);
        } else {
          // デフォルトで最初の組織を選択
          await switchOrganization(orgs[0].id);
        }
      }
    } catch (error) {
      firestoreLogger.error('組織一覧の取得エラー', { userId: currentUser?.uid }, error);
      toast.error('組織情報の取得に失敗しました。再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  };

  // 個人組織を自動作成
  const createPersonalOrganization = async () => {
    try {
      const displayName = currentUser.displayName || currentUser.email.split('@')[0];
      const orgId = await createOrganization(
        currentUser.uid,
        `${displayName}の農場`,
        '個人用の組織'
      );

      // 既存データを新しい組織に移行
      const collections = [
        'harvests',
        'workLogs',
        'fields',
        'workers',
        'pesticides',
        'pesticideUses',
        'fertilizers',
        'fertilizerUses',
        'seeds',
        'seedUses',
        'shipments',
        'trainings',
        'visitors',
        'groups'
      ];

      await migrateUserDataToOrganization(currentUser.uid, orgId, collections);

      // 組織一覧を再取得
      await fetchUserOrganizations();
    } catch (error) {
      firestoreLogger.error('個人組織の自動作成エラー', { userId: currentUser?.uid }, error);
      toast.error('組織の初期設定に失敗しました。再読み込みしてください。');
    }
  };

  // 組織を切り替え
  const switchOrganization = async (organizationId) => {
    try {
      const org = await getOrganization(organizationId);
      const role = await getUserRoleInOrganization(organizationId, currentUser.uid);

      setCurrentOrganization(org);
      setUserRole(role);

      // ログインアカウントに対応する従業員を用意し「自分」を担当者に使えるようにする
      // （書き込み権限のあるadmin/memberのみ。閲覧者はnull）
      let swId = null;
      if (role === 'admin' || role === 'member') {
        swId = await ensureSelfWorker(
          organizationId,
          currentUser.uid,
          userProfile?.name || currentUser.displayName || currentUser.email
        );
      }
      setSelfWorkerId(swId);

      // 選択した組織をローカルストレージに保存
      localStorage.setItem('currentOrganizationId', organizationId);
    } catch (error) {
      firestoreLogger.error('組織の切り替えエラー', { organizationId }, error);
      toast.error('組織の切り替えに失敗しました');
    }
  };

  // 招待一覧を取得
  const fetchInvitations = async () => {
    if (!currentUser) return;

    try {
      const invites = await getUserInvitations(currentUser.email);
      setInvitations(invites);
      setInvitationError('');
    } catch (error) {
      // 失敗を黙って握りつぶすと「招待がない」のか「取得に失敗した」のか
      // 区別できなくなるため、画面に出せるよう控えておく
      firestoreLogger.error('招待一覧の取得エラー', {}, error);
      setInvitationError(error?.message || '招待一覧の取得に失敗しました');
    }
  };

  // 組織メンバーを取得
  const fetchMembers = async (organizationId) => {
    try {
      return await getOrganizationMembers(organizationId);
    } catch (error) {
      firestoreLogger.error('組織メンバーの取得エラー', { organizationId }, error);
      toast.error('メンバー一覧の取得に失敗しました');
      return [];
    }
  };

  // 組織一覧を再読み込み
  const refreshOrganizations = async () => {
    await fetchUserOrganizations();
  };

  useEffect(() => {
    if (currentUser) {
      fetchUserOrganizations();
      fetchInvitations();
    } else {
      setOrganizations([]);
      setCurrentOrganization(null);
      setUserRole(null);
      setSelfWorkerId(null);
      setInvitations([]);
      setLoading(false);
    }
  }, [currentUser]);

  const value = {
    organizations,
    currentOrganization,
    userRole,
    selfWorkerId,
    invitations,
    loading,
    switchOrganization,
    refreshOrganizations,
    fetchMembers,
    fetchInvitations,
    invitationError,
    isAdmin: userRole === 'admin',
    isMember: userRole === 'member' || userRole === 'admin',
    isViewer: userRole === 'viewer'
  };

  return (
    <OrganizationContext.Provider value={value}>
      {!loading && children}
    </OrganizationContext.Provider>
  );
}
