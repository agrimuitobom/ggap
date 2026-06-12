// src/services/workerService.js
// 従業員データの取得・移行を一元管理するサービス
//
// 従業員は workers コレクションに organizationId 付きで保存する。
// 旧バージョンでは users コレクションに organizationId = ユーザーUID で
// 保存していたため、workers が空の場合は旧データを自動移行する。
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { firestoreLogger } from '../utils/logger';

/**
 * 組織の従業員一覧を取得（名前順）
 * @param {string} organizationId - 組織ID
 * @param {string|null} legacyOwnerId - 旧形式データの所有者UID（自動移行に使用）
 * @returns {Promise<Array>} 従業員一覧
 */
export const getWorkers = async (organizationId, legacyOwnerId = null) => {
  const workersQuery = query(
    collection(db, 'workers'),
    where('organizationId', '==', organizationId)
  );
  const snapshot = await getDocs(workersQuery);
  let workers = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  // 旧形式（usersコレクション）からの自動移行
  if (workers.length === 0 && legacyOwnerId) {
    workers = await migrateLegacyWorkers(organizationId, legacyOwnerId);
  }

  workers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return workers;
};

/**
 * 旧形式（usersコレクションに organizationId = UID で保存）の従業員データを
 * workers コレクションへコピーする。失敗しても致命的ではないため、
 * エラー時はログのみ残して空配列を返す。
 */
const migrateLegacyWorkers = async (organizationId, legacyOwnerId) => {
  try {
    const legacyQuery = query(
      collection(db, 'users'),
      where('organizationId', '==', legacyOwnerId)
    );
    const legacySnapshot = await getDocs(legacyQuery);

    if (legacySnapshot.empty) {
      return [];
    }

    const migrated = [];
    for (const legacyDoc of legacySnapshot.docs) {
      const data = legacyDoc.data();
      const workerData = {
        ...data,
        organizationId,
        migratedFrom: `users/${legacyDoc.id}`,
        migratedAt: serverTimestamp()
      };
      const ref = await addDoc(collection(db, 'workers'), workerData);
      migrated.push({ id: ref.id, ...workerData });
    }

    firestoreLogger.info('旧形式の従業員データをworkersコレクションへ移行しました', {
      organizationId,
      count: migrated.length
    });

    return migrated;
  } catch (error) {
    firestoreLogger.error('旧形式の従業員データの移行に失敗しました', { organizationId }, error);
    return [];
  }
};
