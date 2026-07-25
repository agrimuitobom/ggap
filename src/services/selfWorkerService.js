// src/services/selfWorkerService.js
// ログイン中のアカウントに対応する従業員（workers）レコードを用意する。
// これにより「自分（＝ログイン中のアカウント名）」を担当者として自動選択でき、
// 共有端末で「生徒アカウント」としてログインした場合も担当者＝生徒アカウントに
// 自動でなる。linkedUid でアカウントと従業員を結びつける。
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
 * ログインアカウントに対応する従業員レコードのIDを返す（なければ作成）。
 * @param {string} organizationId
 * @param {string} uid - ログインユーザーのUID
 * @param {string} name - 表示名（個人名 または「生徒アカウント」）
 * @returns {Promise<string|null>} 従業員ID（権限がない等で失敗時はnull）
 */
export const ensureSelfWorker = async (organizationId, uid, name) => {
  if (!organizationId || !uid) return null;
  try {
    const q = query(
      collection(db, 'workers'),
      where('organizationId', '==', organizationId),
      where('linkedUid', '==', uid)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    const ref = await addDoc(collection(db, 'workers'), {
      organizationId,
      name: name || '担当者',
      linkedUid: uid,
      role: '',
      status: '在籍',
      isAccountWorker: true, // ログインアカウントに紐づく従業員であることの目印
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    firestoreLogger.info('ログインアカウントの従業員レコードを作成しました', { organizationId, uid });
    return ref.id;
  } catch (err) {
    // 閲覧者など書き込み権限がない場合は静かに失敗（記録は手動選択で続行可）
    firestoreLogger.error('自分の従業員レコードの用意に失敗しました', { organizationId, uid }, err);
    return null;
  }
};
