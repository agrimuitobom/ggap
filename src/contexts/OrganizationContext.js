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
import logger from '../utils/logger';

const OrganizationContext = createContext();

export function useOrganization() {
  return useContext(OrganizationContext);
}

export function OrganizationProvider({ children }) {
  const { currentUser } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [currentOrganization, setCurrentOrganization] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState([]);

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
      logger.error('Error fetching organizations', {}, error);
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
      logger.error('Error creating personal organization', {}, error);
    }
  };

  // 組織を切り替え
  const switchOrganization = async (organizationId) => {
    try {
      const org = await getOrganization(organizationId);
      const role = await getUserRoleInOrganization(organizationId, currentUser.uid);

      setCurrentOrganization(org);
      setUserRole(role);

      // 選択した組織をローカルストレージに保存
      localStorage.setItem('currentOrganizationId', organizationId);
    } catch (error) {
      logger.error('Error switching organization', {}, error);
    }
  };

  // 招待一覧を取得
  const fetchInvitations = async () => {
    if (!currentUser) return;

    try {
      const invites = await getUserInvitations(currentUser.email);
      setInvitations(invites);
    } catch (error) {
      logger.error('Error fetching invitations', {}, error);
    }
  };

  // 組織メンバーを取得
  const fetchMembers = async (organizationId) => {
    try {
      return await getOrganizationMembers(organizationId);
    } catch (error) {
      logger.error('Error fetching members', {}, error);
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
      setInvitations([]);
      setLoading(false);
    }
  }, [currentUser]);

  const value = {
    organizations,
    currentOrganization,
    userRole,
    invitations,
    loading,
    switchOrganization,
    refreshOrganizations,
    fetchMembers,
    fetchInvitations,
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
