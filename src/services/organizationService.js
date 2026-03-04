// src/services/organizationService.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * 新しい組織を作成
 * @param {string} userId - 作成者のユーザーID
 * @param {string} name - 組織名
 * @param {string} description - 組織の説明（オプション）
 * @returns {Promise<string>} 作成された組織のID
 */
export const createOrganization = async (userId, name, description = '') => {
  try {
    const orgRef = doc(collection(db, 'organizations'));
    const orgData = {
      name,
      description,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(orgRef, orgData);

    // 作成者をメンバーとして追加（管理者権限）
    await addMemberToOrganization(orgRef.id, userId, 'admin');

    return orgRef.id;
  } catch (error) {
    console.error('Error creating organization:', error);
    throw error;
  }
};

/**
 * ユーザーが所属する組織一覧を取得
 * @param {string} userId - ユーザーID
 * @returns {Promise<Array>} 組織一覧
 */
export const getUserOrganizations = async (userId) => {
  try {
    // ユーザー情報から組織IDリストを取得
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return [];
    }

    const userData = userDoc.data();
    const orgIds = userData.organizations || [];

    if (orgIds.length === 0) {
      return [];
    }

    const organizations = [];

    for (const orgId of orgIds) {
      try {
        // メンバーシップ情報を取得
        const membershipDoc = await getDoc(doc(db, 'organizationMembers', `${userId}_${orgId}`));

        if (!membershipDoc.exists()) {
          continue;
        }

        const memberData = membershipDoc.data();

        // 組織情報を取得
        const orgDoc = await getDoc(doc(db, 'organizations', orgId));

        if (orgDoc.exists()) {
          organizations.push({
            id: orgDoc.id,
            ...orgDoc.data(),
            role: memberData.role,
            joinedAt: memberData.joinedAt
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch organization ${orgId}:`, err);
      }
    }

    return organizations;
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    throw error;
  }
};

/**
 * 組織の詳細情報を取得
 * @param {string} organizationId - 組織ID
 * @returns {Promise<Object>} 組織情報
 */
export const getOrganization = async (organizationId) => {
  try {
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId));

    if (!orgDoc.exists()) {
      throw new Error('Organization not found');
    }

    return {
      id: orgDoc.id,
      ...orgDoc.data()
    };
  } catch (error) {
    console.error('Error fetching organization:', error);
    throw error;
  }
};

/**
 * 組織情報を更新
 * @param {string} organizationId - 組織ID
 * @param {Object} updates - 更新内容
 */
export const updateOrganization = async (organizationId, updates) => {
  try {
    await updateDoc(doc(db, 'organizations', organizationId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    throw error;
  }
};

/**
 * 組織を削除
 * @param {string} organizationId - 組織ID
 */
export const deleteOrganization = async (organizationId) => {
  try {
    // メンバー情報を削除
    const membersQuery = query(
      collection(db, 'organizationMembers'),
      where('organizationId', '==', organizationId)
    );
    const membersSnapshot = await getDocs(membersQuery);

    for (const memberDoc of membersSnapshot.docs) {
      await deleteDoc(memberDoc.ref);
    }

    // 招待情報を削除
    const invitationsQuery = query(
      collection(db, 'organizationInvitations'),
      where('organizationId', '==', organizationId)
    );
    const invitationsSnapshot = await getDocs(invitationsQuery);

    for (const inviteDoc of invitationsSnapshot.docs) {
      await deleteDoc(inviteDoc.ref);
    }

    // 組織を削除
    await deleteDoc(doc(db, 'organizations', organizationId));
  } catch (error) {
    console.error('Error deleting organization:', error);
    throw error;
  }
};

/**
 * 組織にメンバーを追加
 * @param {string} organizationId - 組織ID
 * @param {string} userId - ユーザーID
 * @param {string} role - 役割（admin, member, viewer）
 */
export const addMemberToOrganization = async (organizationId, userId, role = 'member') => {
  try {
    // ドキュメントIDを userId_organizationId の形式にする
    const memberRef = doc(db, 'organizationMembers', `${userId}_${organizationId}`);
    await setDoc(memberRef, {
      organizationId,
      userId,
      role,
      joinedAt: serverTimestamp()
    });

    // ユーザーの所属組織リストを更新
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      organizations: arrayUnion(organizationId),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding member to organization:', error);
    throw error;
  }
};

/**
 * 組織からメンバーを削除
 * @param {string} organizationId - 組織ID
 * @param {string} userId - ユーザーID
 */
export const removeMemberFromOrganization = async (organizationId, userId) => {
  try {
    // メンバー情報を削除
    const membersQuery = query(
      collection(db, 'organizationMembers'),
      where('organizationId', '==', organizationId),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(membersQuery);

    for (const memberDoc of snapshot.docs) {
      await deleteDoc(memberDoc.ref);
    }

    // ユーザーの所属組織リストを更新
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      organizations: arrayRemove(organizationId),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error removing member from organization:', error);
    throw error;
  }
};

/**
 * 組織のメンバー一覧を取得
 * @param {string} organizationId - 組織ID
 * @returns {Promise<Array>} メンバー一覧
 */
export const getOrganizationMembers = async (organizationId) => {
  try {
    const membersQuery = query(
      collection(db, 'organizationMembers'),
      where('organizationId', '==', organizationId)
    );

    const snapshot = await getDocs(membersQuery);
    const members = [];

    for (const memberDoc of snapshot.docs) {
      const memberData = memberDoc.data();
      const userDoc = await getDoc(doc(db, 'users', memberData.userId));

      if (userDoc.exists()) {
        members.push({
          id: memberDoc.id,
          userId: memberData.userId,
          role: memberData.role,
          joinedAt: memberData.joinedAt,
          user: userDoc.data()
        });
      }
    }

    return members;
  } catch (error) {
    console.error('Error fetching organization members:', error);
    throw error;
  }
};

/**
 * メンバーの役割を更新
 * @param {string} organizationId - 組織ID
 * @param {string} userId - ユーザーID
 * @param {string} newRole - 新しい役割
 */
export const updateMemberRole = async (organizationId, userId, newRole) => {
  try {
    const membersQuery = query(
      collection(db, 'organizationMembers'),
      where('organizationId', '==', organizationId),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(membersQuery);

    for (const memberDoc of snapshot.docs) {
      await updateDoc(memberDoc.ref, {
        role: newRole,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error updating member role:', error);
    throw error;
  }
};

/**
 * ユーザーの組織における役割を取得
 * @param {string} organizationId - 組織ID
 * @param {string} userId - ユーザーID
 * @returns {Promise<string|null>} 役割（admin, member, viewer）またはnull
 */
export const getUserRoleInOrganization = async (organizationId, userId) => {
  try {
    const membersQuery = query(
      collection(db, 'organizationMembers'),
      where('organizationId', '==', organizationId),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(membersQuery);

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data().role;
  } catch (error) {
    console.error('Error fetching user role:', error);
    throw error;
  }
};

/**
 * メンバーを招待（招待リンクまたはメールアドレス）
 * @param {string} organizationId - 組織ID
 * @param {string} email - 招待するメールアドレス
 * @param {string} role - 付与する役割
 * @param {string} invitedBy - 招待者のユーザーID
 * @returns {Promise<string>} 招待ID
 */
export const inviteMemberToOrganization = async (organizationId, email, role, invitedBy) => {
  try {
    const inviteRef = doc(collection(db, 'organizationInvitations'));
    await setDoc(inviteRef, {
      organizationId,
      email,
      role,
      invitedBy,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7日間有効
    });

    return inviteRef.id;
  } catch (error) {
    console.error('Error inviting member:', error);
    throw error;
  }
};

/**
 * 招待を承認してメンバーに加入
 * @param {string} invitationId - 招待ID
 * @param {string} userId - ユーザーID
 */
export const acceptInvitation = async (invitationId, userId) => {
  try {
    const inviteDoc = await getDoc(doc(db, 'organizationInvitations', invitationId));

    if (!inviteDoc.exists()) {
      throw new Error('Invitation not found');
    }

    const inviteData = inviteDoc.data();

    // 有効期限チェック
    if (inviteData.expiresAt.toDate() < new Date()) {
      throw new Error('Invitation expired');
    }

    // メンバーとして追加
    await addMemberToOrganization(inviteData.organizationId, userId, inviteData.role);

    // 招待を承認済みにマーク
    await updateDoc(doc(db, 'organizationInvitations', invitationId), {
      status: 'accepted',
      acceptedBy: userId,
      acceptedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    throw error;
  }
};

/**
 * ユーザーへの招待一覧を取得
 * @param {string} email - メールアドレス
 * @returns {Promise<Array>} 招待一覧
 */
export const getUserInvitations = async (email) => {
  try {
    const invitationsQuery = query(
      collection(db, 'organizationInvitations'),
      where('email', '==', email),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(invitationsQuery);
    const invitations = [];

    for (const inviteDoc of snapshot.docs) {
      const inviteData = inviteDoc.data();

      // 有効期限チェック
      if (inviteData.expiresAt.toDate() < new Date()) {
        continue;
      }

      const orgDoc = await getDoc(doc(db, 'organizations', inviteData.organizationId));

      if (orgDoc.exists()) {
        invitations.push({
          id: inviteDoc.id,
          ...inviteData,
          organization: {
            id: orgDoc.id,
            ...orgDoc.data()
          }
        });
      }
    }

    return invitations;
  } catch (error) {
    console.error('Error fetching user invitations:', error);
    throw error;
  }
};

/**
 * 既存データを組織に移行
 * @param {string} userId - ユーザーID
 * @param {string} organizationId - 組織ID
 * @param {Array<string>} collections - 移行するコレクション名のリスト
 */
export const migrateUserDataToOrganization = async (userId, organizationId, collections) => {
  try {
    for (const collectionName of collections) {
      const dataQuery = query(
        collection(db, collectionName),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(dataQuery);

      for (const dataDoc of snapshot.docs) {
        await updateDoc(dataDoc.ref, {
          organizationId,
          migratedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error('Error migrating user data to organization:', error);
    throw error;
  }
};
