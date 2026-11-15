// src/services/viewerAccountService.js
// 閲覧用ID（メールアドレスを持たない閲覧専用アカウント）の発行。
// Firebase Authentication はメールアドレスが必須のため、閲覧用IDを
// 実在しないドメインのアドレスに変換して登録する。
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';
import { firestoreLogger } from '../utils/logger';

// .invalid は予約済みTLDで、実在のメールアドレスと衝突しない
export const VIEWER_EMAIL_DOMAIN = 'viewer.gaptracker.invalid';
export const VIEWER_PASSWORD_MIN_LENGTH = 8;

const VIEWER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export const normalizeViewerId = (value) => (value || '').trim().toLowerCase();

/** 閲覧用IDの入力エラーを返す（問題なければ null） */
export const validateViewerId = (value) => {
  const id = normalizeViewerId(value);
  if (!id) return '閲覧用IDを入力してください';
  if (!VIEWER_ID_PATTERN.test(id)) {
    return '閲覧用IDは半角英数字で始まる3〜30文字（英小文字・数字・「.」「_」「-」）で入力してください';
  }
  return null;
};

export const validateViewerPassword = (value) =>
  (value || '').length < VIEWER_PASSWORD_MIN_LENGTH
    ? `パスワードは${VIEWER_PASSWORD_MIN_LENGTH}文字以上で入力してください`
    : null;

export const viewerIdToEmail = (viewerId) => `${normalizeViewerId(viewerId)}@${VIEWER_EMAIL_DOMAIN}`;

export const isViewerEmail = (email) => (email || '').endsWith(`@${VIEWER_EMAIL_DOMAIN}`);

/**
 * ログイン画面の入力値を Firebase 用のメールアドレスに変換する。
 * 「@」を含まなければ閲覧用IDとして扱う。
 */
export const loginIdToEmail = (input) => {
  const value = (input || '').trim();
  return value.includes('@') ? value : viewerIdToEmail(value);
};

/** 読み間違えやすい文字（0/O、1/l/I など）を除いたパスワードを生成する */
export const generateViewerPassword = (length = 12) => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join('');
};

/**
 * 閲覧用IDを発行し、組織に「閲覧のみ」で追加する（管理者が実行）。
 * 通常の方法でアカウントを作ると管理者自身がログアウトされてしまうため、
 * 一時的な別インスタンスでアカウントを作成する。
 * @returns {Promise<string>} 作成したユーザーのUID
 */
export const createViewerAccount = async ({ organizationId, viewerId, password, displayName }) => {
  const id = normalizeViewerId(viewerId);
  const name = (displayName || '').trim() || `閲覧用（${id}）`;
  const tempApp = initializeApp(firebaseConfig, `viewer-account-${Date.now()}`);

  try {
    const tempAuth = getAuth(tempApp);
    const credential = await createUserWithEmailAndPassword(tempAuth, viewerIdToEmail(id), password);
    const { uid } = credential.user;

    await updateProfile(credential.user, { displayName: name });

    // プロフィールは本人しか書き込めないため、作成したアカウントとして保存する
    const tempDb = initializeFirestore(tempApp, {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true
    });
    await setDoc(doc(tempDb, 'users', uid), {
      name,
      email: viewerIdToEmail(id),
      loginId: id,
      isViewerAccount: true,
      role: 'user',
      organizations: [organizationId],
      createdAt: serverTimestamp()
    });

    // メンバーシップは管理者の権限で作成する
    await setDoc(doc(db, 'organizationMembers', `${uid}_${organizationId}`), {
      organizationId,
      userId: uid,
      role: 'viewer',
      joinedAt: serverTimestamp()
    });

    await signOut(tempAuth);
    return uid;
  } catch (error) {
    firestoreLogger.error('閲覧用IDの発行エラー', { organizationId, viewerId: id }, error);
    throw error;
  } finally {
    await deleteApp(tempApp).catch(() => {});
  }
};
