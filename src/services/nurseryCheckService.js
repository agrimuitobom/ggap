// src/services/nurseryCheckService.js
// 育苗中の病害虫モニタリング記録（FV-Smart 26.03）。
//
// 26.03 は、農場内で育苗した種苗について「病害虫の目に見える兆候を
// モニタリングする仕組み」と「恒常的に、一定の頻度で」取った記録を求めている。
// 播種・定植の時点の記録だけでは頻度の要件を満たせないため、
// 育苗期間中の観察をこの記録に残す。
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { moveToTrash } from './trashService';

// 観察の目安（日）。これを過ぎると、育苗中のロットがある場合だけ警告する
export const NURSERY_CHECK_INTERVAL_DAYS = 7;

const toTime = (u) => (u.date?.toDate ? u.date.toDate().getTime() : u.date ? new Date(u.date).getTime() : 0);

/**
 * いま育苗中のロットを返す。
 * 播種の記録があり、まだ同じロットの定植の記録が無いものを育苗中とみなす。
 * 長く放置された記録で警告し続けないよう、播種から一定日数を過ぎたものは除く。
 */
export const lotsInNursery = (seedUses = [], today = new Date(), maxDays = 60) => {
  const transplanted = new Set(
    seedUses.filter((u) => u.method === '定植' && u.lotNumber).map((u) => u.lotNumber)
  );
  const limit = today.getTime() - maxDays * 24 * 60 * 60 * 1000;
  const byLot = new Map();
  seedUses
    .filter((u) => u.lotNumber && u.method !== '定植' && !transplanted.has(u.lotNumber))
    .filter((u) => toTime(u) >= limit && toTime(u) <= today.getTime())
    .forEach((u) => {
      if (!byLot.has(u.lotNumber)) byLot.set(u.lotNumber, u);
    });
  return Array.from(byLot.values()).sort((a, b) => toTime(b) - toTime(a));
};

export const getNurseryChecks = async (organizationId) => {
  const snapshot = await getDocs(query(
    collection(db, 'nurseryChecks'),
    where('organizationId', '==', organizationId)
  ));
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return list;
};

/**
 * 観察記録を保存する。
 * results: [{ lotNumber, seedName, status: 'なし'|'あり', detail, action }]
 */
export const saveNurseryCheck = async (organizationId, checkId, data) => {
  const payload = {
    organizationId,
    date: data.date,
    checkedByName: data.checkedByName || '',
    // 育苗中のロットが無かった日も「確認した」ことを残す
    noNursery: !!data.noNursery,
    results: (data.results || []).map((r) => ({
      lotNumber: r.lotNumber,
      seedName: r.seedName || '',
      status: r.status === 'あり' ? 'あり' : 'なし',
      detail: r.status === 'あり' ? (r.detail || '').trim() : '',
      action: r.status === 'あり' ? (r.action || '').trim() : ''
    })),
    notes: (data.notes || '').trim(),
    updatedAt: serverTimestamp()
  };
  if (checkId) {
    await updateDoc(doc(db, 'nurseryChecks', checkId), payload);
    return { id: checkId, ...payload };
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(collection(db, 'nurseryChecks'), payload);
  return { id: ref.id, ...payload };
};

export const deleteNurseryCheck = (checkId, organizationId, deletedByName = '') =>
  moveToTrash('nurseryChecks', checkId, organizationId, deletedByName);

/** 最後の観察から何日たったか（記録が無ければ null） */
export const daysSinceLastNurseryCheck = (checks = [], today = new Date()) => {
  const dates = checks.map((c) => c.date).filter(Boolean).sort();
  if (dates.length === 0) return null;
  const last = new Date(`${dates[dates.length - 1]}T00:00:00`);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  return Math.floor((t - last) / (24 * 60 * 60 * 1000));
};

/** 観察が必要なのに間があいているか（育苗中のロットがあるときだけ判定） */
export const isNurseryCheckOverdue = (checks = [], nurseryLots = [], today = new Date()) => {
  if (nurseryLots.length === 0) return false;
  const days = daysSinceLastNurseryCheck(checks, today);
  return days === null || days > NURSERY_CHECK_INTERVAL_DAYS;
};
