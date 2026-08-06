// src/services/applierRepairService.js
// 施肥・農薬使用記録の「作業者」を、組織名から実際の担当者に直す。
//
// 作業日誌から自動作成する処理が、施用者として組織名を入れていた。
// 審査では「誰が施用したか」を必ず問われるため、作業日誌に記録されている
// 担当者へ置き換える。作業日誌との紐づけ（workLogId）が残っているので、
// そこから正しい氏名を引ける。
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc
} from 'firebase/firestore';
import { db } from './firebase';
import { firestoreLogger } from '../utils/logger';

const TARGET_COLLECTIONS = ['fertilizerUses', 'pesticideUses'];

/**
 * 作業者が組織名のままになっている記録を集める。
 * @param {string} organizationId
 * @param {string} organizationName 組織名（これと一致するものが対象）
 * @returns {Promise<{items: Array, workLogNames: Object}>}
 */
export const findRecordsWithWrongApplier = async (organizationId, organizationName) => {
  if (!organizationName) return { items: [], workLogNames: {} };

  // 作業日誌の担当者を引けるようにしておく
  const workLogsSnapshot = await getDocs(query(
    collection(db, 'workLogs'),
    where('organizationId', '==', organizationId)
  ));
  const workLogNames = {};
  workLogsSnapshot.forEach((d) => {
    const data = d.data();
    const names = data.workerNames || [];
    if (names.length > 0) {
      workLogNames[d.id] = names.join('、');
    } else if (data.createdByName) {
      // 担当者が未入力なら、記録した人で代替する
      workLogNames[d.id] = data.createdByName;
    }
  });

  const items = [];
  for (const collectionName of TARGET_COLLECTIONS) {
    const snapshot = await getDocs(query(
      collection(db, collectionName),
      where('organizationId', '==', organizationId)
    ));
    snapshot.forEach((d) => {
      const data = d.data();
      if (data.appliedByName !== organizationName) return;
      const correctName = data.workLogId ? workLogNames[data.workLogId] : null;
      if (!correctName) return;
      items.push({ id: d.id, collectionName, correctName, date: data.date });
    });
  }

  return { items, workLogNames };
};

/**
 * 作業者を実際の担当者へ置き換える。
 * @returns {Promise<number>} 更新した件数
 */
export const repairAppliers = async (organizationId, organizationName) => {
  const { items } = await findRecordsWithWrongApplier(organizationId, organizationName);
  for (let i = 0; i < items.length; i += 400) {
    const batch = writeBatch(db);
    items.slice(i, i + 400).forEach((item) => {
      batch.update(doc(db, item.collectionName, item.id), {
        appliedByName: item.correctName
      });
    });
    await batch.commit();
  }
  firestoreLogger.info('施用者を担当者名に修正しました', { organizationId, count: items.length });
  return items.length;
};
