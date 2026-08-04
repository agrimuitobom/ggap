// src/services/stockSolutionService.js
// 母液（原液）の調製記録。
//
// 水耕栽培では、粉末や液体の肥料製品を水に溶かして「母液（原液タンク）」を作り、
// それを希釈して灌水施肥するのが一般的。この場合、肥料製品が実際に消費されるのは
// 「母液を作ったとき」であって、日々の施肥のときではない。
//
//   肥料製品（Mk1号 25kg）→ 母液200L を調製 → 100倍に希釈 → 10L ずつ施用
//
// 母液の調製を記録しておかないと、日々の「10L」から肥料製品の使用量・成分量へ
// たどれない。ここはその調製記録を扱う。
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { moveToTrash } from './trashService';
import { firestoreLogger } from '../utils/logger';

/** 母液の調製記録一覧を取得（新しい順） */
export const getStockSolutions = async (organizationId) => {
  const q = query(
    collection(db, 'stockSolutions'),
    where('organizationId', '==', organizationId)
  );
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (b.preparedDate || '').localeCompare(a.preparedDate || ''));
  return list;
};

/** 母液の調製記録を1件取得 */
export const getStockSolution = async (id) => {
  const snap = await getDoc(doc(db, 'stockSolutions', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * 母液の調製記録を保存
 * ingredients: [{ fertilizerId, fertilizerName, amount, unit }]
 * totalVolume: できあがった母液の量(L)
 */
export const saveStockSolution = async (organizationId, solutionId, data) => {
  const payload = {
    organizationId,
    name: (data.name || '').trim(),
    preparedDate: data.preparedDate,
    ingredients: (data.ingredients || [])
      .filter((ing) => ing.fertilizerId && Number(ing.amount) > 0)
      .map((ing) => ({
        fertilizerId: ing.fertilizerId,
        fertilizerName: ing.fertilizerName || '',
        amount: Number(ing.amount),
        unit: ing.unit || 'kg'
      })),
    totalVolume: Number(data.totalVolume) || 0,
    defaultDilutionRatio: Number(data.defaultDilutionRatio) || null,
    preparedByName: data.preparedByName || '',
    notes: (data.notes || '').trim(),
    updatedAt: serverTimestamp()
  };
  if (solutionId) {
    await updateDoc(doc(db, 'stockSolutions', solutionId), payload);
    return { id: solutionId, ...payload };
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(collection(db, 'stockSolutions'), payload);
  firestoreLogger.info('母液の調製記録を登録しました', { organizationId });
  return { id: ref.id, ...payload };
};

/** 母液の調製記録を削除（ゴミ箱へ） */
export const deleteStockSolution = async (solutionId, organizationId, deletedByName = '') => {
  await moveToTrash('stockSolutions', solutionId, organizationId, deletedByName);
};

/** 表示用のラベル（例: 2026-04-01 A液（Mk1号）200L） */
export const stockSolutionLabel = (s) => {
  if (!s) return '';
  const volume = s.totalVolume ? `${s.totalVolume}L` : '';
  return [s.preparedDate, s.name, volume].filter(Boolean).join(' ');
};
