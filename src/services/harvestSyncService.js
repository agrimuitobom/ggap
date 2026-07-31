// src/services/harvestSyncService.js
// 作業日誌の「収穫」を収穫記録（harvests）に反映する。
//
// これまで作業日誌の収穫量・廃棄量は workLogs にしか保存されず、
// 収穫記録・トレーサビリティ・マスバランスから見えなかった。
// 収穫の正データは harvests に一本化し、作業日誌は入力補助として扱う。
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { moveToTrash } from './trashService';
import { firestoreLogger } from '../utils/logger';

/** ロット番号の生成（収穫記録と同じ形式） */
const generateLotNumber = (fieldName, cropName, date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
  const fieldCode = fieldName ? fieldName.substring(0, 2).toUpperCase() : 'XX';
  const cropCode = cropName ? cropName.substring(0, 2).toUpperCase() : 'XX';
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${dateStr}-${fieldCode}-${cropCode}-${random}`;
};

/** この作業日誌から作られた収穫記録を取得する */
const findLinkedHarvest = async (organizationId, workLogId) => {
  const snap = await getDocs(query(
    collection(db, 'harvests'),
    where('organizationId', '==', organizationId),
    where('workLogId', '==', workLogId)
  ));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

/**
 * 作業日誌の内容に合わせて収穫記録を作成・更新・削除する。
 * - 作業種別が「収穫」で収穫量がある → 作成または更新
 * - それ以外 → 紐づく収穫記録があれば削除
 *
 * 既存の記録は更新（作り直しではなく）するため、ロット番号と記録IDが保たれ、
 * 出荷記録からの参照が壊れない。
 */
export const syncHarvestFromWorkLog = async (organizationId, workLogId, workLog, context = {}) => {
  try {
    const existing = await findLinkedHarvest(organizationId, workLogId);
    const isHarvest = workLog.workType === '収穫' && Number(workLog.harvestAmount) > 0;

    if (!isHarvest) {
      // 収穫でなくなった場合は、この作業日誌から作られた記録を取り消す
      if (existing) await deleteDoc(doc(db, 'harvests', existing.id));
      return null;
    }

    const quantity = Number(workLog.harvestAmount) || 0;
    const disposalAmount = Number(workLog.wasteAmount) || 0;
    const totalAmount = quantity + disposalAmount;
    const disposalRate = totalAmount > 0 ? (disposalAmount / totalAmount) * 100 : 0;

    const cropName = context.cropName || existing?.cropName || '';
    const harvestDate = workLog.date instanceof Date ? workLog.date : new Date(workLog.date);

    const harvestData = {
      organizationId,
      workLogId,
      cropName,
      harvestDate,
      fieldId: workLog.fieldId,
      fieldName: workLog.fieldName || '',
      plantingId: workLog.plantingId || null,
      plantingLabel: workLog.plantingLabel || '',
      quantity,
      unit: 'kg',
      quality: existing?.quality || '良',
      disposalAmount,
      disposalReason: existing?.disposalReason || '',
      disposalRate: Number(disposalRate.toFixed(1)),
      totalAmount,
      notes: `作業日誌より自動作成 (作業ID: ${workLogId})`,
      createdByName: workLog.createdByName || '',
      updatedAt: serverTimestamp()
    };

    if (existing) {
      // ロット番号は維持する（出荷記録から参照されるため）
      await updateDoc(doc(db, 'harvests', existing.id), harvestData);
      return existing.id;
    }

    const ref = await addDoc(collection(db, 'harvests'), {
      ...harvestData,
      lotNumber: generateLotNumber(workLog.fieldName, cropName, harvestDate),
      createdAt: serverTimestamp()
    });
    return ref.id;
  } catch (err) {
    firestoreLogger.error('作業日誌からの収穫記録の反映に失敗しました', { workLogId }, err);
    throw err;
  }
};

/** 作業日誌を削除したときに、そこから作られた収穫記録も取り消す */
export const deleteHarvestForWorkLog = async (organizationId, workLogId, deletedByName) => {
  try {
    const existing = await findLinkedHarvest(organizationId, workLogId);
    // 作業日誌と同じくゴミ箱へ移す（作業日誌を戻すときに収穫記録も戻せるように）
    if (existing) await moveToTrash('harvests', existing.id, organizationId, deletedByName);
  } catch (err) {
    firestoreLogger.error('作業日誌に紐づく収穫記録の削除に失敗しました', { workLogId }, err);
  }
};

/**
 * 収穫記録に未反映の作業日誌（収穫）を探す。
 * 過去に作業日誌だけで記録していた分を取り込むために使う。
 */
export const findUnsyncedHarvestWorkLogs = async (organizationId) => {
  const [workLogSnap, harvestSnap] = await Promise.all([
    getDocs(query(collection(db, 'workLogs'), where('organizationId', '==', organizationId))),
    getDocs(query(collection(db, 'harvests'), where('organizationId', '==', organizationId)))
  ]);

  const syncedWorkLogIds = new Set();
  harvestSnap.forEach((d) => {
    const wid = d.data().workLogId;
    if (wid) syncedWorkLogIds.add(wid);
  });

  return workLogSnap.docs
    .map((d) => ({ id: d.id, ...d.data(), date: d.data().date?.toDate ? d.data().date.toDate() : null }))
    .filter((w) =>
      w.workType === '収穫' &&
      Number(w.harvestAmount) > 0 &&
      !syncedWorkLogIds.has(w.id)
    );
};

/** 未反映の作業日誌をまとめて収穫記録に取り込む */
export const backfillHarvests = async (organizationId, workLogs, fields = []) => {
  let created = 0;
  for (const w of workLogs) {
    const field = fields.find((f) => f.id === w.fieldId);
    await syncHarvestFromWorkLog(organizationId, w.id, w, {
      cropName: field?.currentCrop || ''
    });
    created += 1;
  }
  firestoreLogger.info('作業日誌の収穫を収穫記録に取り込みました', { organizationId, count: created });
  return created;
};
