// src/services/trashService.js
// ゴミ箱方式の削除。
//
// 記録を削除するとき、いきなり消さずにゴミ箱（trash）へ移す。
// 一定期間は元に戻せるので、誤って消しても記録を失わない。
// 完全に消せるのは管理者だけにしている。
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { firestoreLogger } from '../utils/logger';

// ゴミ箱に残す日数。これを過ぎたものは自動的に消える
export const TRASH_RETENTION_DAYS = 30;

// 画面表示用のコレクション名
export const COLLECTION_LABELS = {
  fields: '圃場',
  plantings: '作付・処理区',
  workLogs: '作業日誌',
  workLogTemplates: '作業日誌テンプレート',
  harvests: '収穫記録',
  shipments: '出荷記録',
  seeds: '種子・苗',
  seedUses: '播種・定植記録',
  fertilizers: '肥料',
  fertilizerUses: '施肥記録',
  pesticides: '農薬',
  pesticideUses: '農薬使用記録',
  fieldInspections: '圃場点検',
  nutrientLogs: '養液管理記録',
  waterSources: '水源',
  waterTests: '水質検査',
  storageLocations: '保管場所',
  materialDisposals: '資材の廃棄記録',
  workers: '従業員',
  groups: 'グループ',
  trainings: '教育訓練記録',
  trainingItems: '教育訓練の項目',
  visitors: '訪問者記録',
  cleaningItems: '清掃項目',
  cleaningChecks: '清掃チェック',
  ppeItems: '保護具の品目',
  ppeTransactions: '保護具の入出庫',
  ppeChecks: '保護具の着用確認',
  incidents: '事故・ヒヤリハット',
  equipments: '機器',
  equipmentChecks: '機器の校正・点検',
  complaints: '苦情記録',
  recallTests: '模擬回収テスト',
  selfAssessments: '自己点検',
  biodiversitySurveys: '生物多様性の観察'
};

const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

/** ゴミ箱の一覧で「何の記録か」が分かるように要約を作る */
export const summarizeRecord = (collectionName, data = {}) => {
  const dateValue = toDate(
    data.date || data.harvestDate || data.shipmentDate || data.trainingDate ||
    data.visitDate || data.surveyDate || data.testDate || data.plantingDate || data.sowingDate
  );
  const datePart = dateValue ? dateValue.toLocaleDateString('ja-JP') : '';

  const namePart =
    data.name || data.title || data.cropName || data.materialName ||
    data.speciesName || data.content || data.workType || data.lotNumber ||
    data.itemName || data.workName || '';

  const wherePart = data.fieldName ? `@${data.fieldName}` : '';

  return [datePart, namePart, wherePart].filter(Boolean).join(' ') || '（内容なし）';
};

/**
 * 記録をゴミ箱へ移す（元のコレクションからは消える）。
 * 元のIDを保持するため、戻したときに紐づけが壊れない。
 */
export const moveToTrash = async (collectionName, docId, organizationId, deletedByName = '') => {
  const ref = doc(db, collectionName, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // すでに無い場合は何もしない
    return null;
  }
  const data = snap.data();

  const trashRef = await addDoc(collection(db, 'trash'), {
    organizationId,
    collectionName,
    originalId: docId,
    // Firestore同士のコピーなので、日時などの型はそのまま保てる
    data,
    summary: summarizeRecord(collectionName, data),
    deletedAt: serverTimestamp(),
    deletedByName,
    // 自動削除の判定に使う（サーバー時刻が入る前でも比較できるよう保険で入れる）
    expiresAt: new Date(Date.now() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  });

  await deleteDoc(ref);
  firestoreLogger.info('記録をゴミ箱へ移しました', { collectionName, docId, organizationId });
  return trashRef.id;
};

/** ゴミ箱の一覧を取得（新しい順） */
export const listTrash = async (organizationId) => {
  const snap = await getDocs(query(
    collection(db, 'trash'),
    where('organizationId', '==', organizationId)
  ));
  const list = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    deletedAt: toDate(d.data().deletedAt),
    expiresAt: toDate(d.data().expiresAt)
  }));
  list.sort((a, b) => (b.deletedAt?.getTime() || 0) - (a.deletedAt?.getTime() || 0));
  return list;
};

/** ゴミ箱から元の場所へ戻す */
export const restoreFromTrash = async (entry) => {
  if (!entry?.collectionName || !entry?.originalId) {
    throw new Error('この項目は復元できません');
  }
  await setDoc(doc(db, entry.collectionName, entry.originalId), entry.data || {});
  await deleteDoc(doc(db, 'trash', entry.id));
  firestoreLogger.info('ゴミ箱から復元しました', {
    collectionName: entry.collectionName,
    originalId: entry.originalId
  });
};

/** ゴミ箱から完全に削除する（管理者のみ） */
export const purgeFromTrash = async (trashId) => {
  await deleteDoc(doc(db, 'trash', trashId));
};

/**
 * 保存期間を過ぎた項目を消す。
 * 定期実行の仕組みは使わず、ゴミ箱を開いたときにまとめて処理する。
 */
export const purgeExpired = async (entries) => {
  const now = Date.now();
  const expired = entries.filter((e) => e.expiresAt && e.expiresAt.getTime() < now);
  for (const e of expired) {
    try {
      await deleteDoc(doc(db, 'trash', e.id));
    } catch (err) {
      firestoreLogger.error('期限切れのゴミ箱項目の削除に失敗しました', { trashId: e.id }, err);
    }
  }
  return expired.length;
};

/** 残り日数（表示用） */
export const daysLeft = (entry) => {
  if (!entry?.expiresAt) return null;
  const diff = entry.expiresAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
};
