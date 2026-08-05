// src/services/fertilizerPurchaseService.js
// 肥料の購入（入荷）記録。
//
// 同じ肥料を毎年買い足すたびに肥料マスタを新規登録すると、選択欄に
// 同じ名前が並んで区別できなくなる。肥料マスタは「製品」を表すものとして
// 1つに保ち、買った回数ぶんはこちらの購入記録として積み上げる。
//
//   肥料マスタ（M2号）… 製造元・成分・比重など、買っても変わらない情報
//     └ 購入記録 2024/04/10 20kg ロット A123
//     └ 購入記録 2025/04/08 20kg ロット B456
//     └ 購入記録 2026/04/12 20kg ロット C789
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { moveToTrash } from './trashService';
import { firestoreLogger } from '../utils/logger';

/** 購入記録の一覧を取得（新しい順） */
export const getFertilizerPurchases = async (organizationId) => {
  const snapshot = await getDocs(query(
    collection(db, 'fertilizerPurchases'),
    where('organizationId', '==', organizationId)
  ));
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
  return list;
};

/** 購入記録を保存（新規 or 更新） */
export const saveFertilizerPurchase = async (organizationId, purchaseId, data) => {
  const payload = {
    organizationId,
    fertilizerId: data.fertilizerId,
    fertilizerName: data.fertilizerName || '',
    purchaseDate: data.purchaseDate,
    amount: Number(data.amount) || 0,
    unit: data.unit || 'kg',
    lotNumber: (data.lotNumber || '').trim(),
    supplier: (data.supplier || '').trim(),
    expiryDate: data.expiryDate || '',
    notes: (data.notes || '').trim(),
    updatedAt: serverTimestamp()
  };
  if (purchaseId) {
    await updateDoc(doc(db, 'fertilizerPurchases', purchaseId), payload);
    return { id: purchaseId, ...payload };
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(collection(db, 'fertilizerPurchases'), payload);
  return { id: ref.id, ...payload };
};

/** 購入記録を削除（ゴミ箱へ） */
export const deleteFertilizerPurchase = async (purchaseId, organizationId, deletedByName = '') => {
  await moveToTrash('fertilizerPurchases', purchaseId, organizationId, deletedByName);
};

/**
 * 名前（と製造元）が同じ肥料マスタをまとめて、重複の一覧を返す。
 * 表記ゆれを拾うため、空白と大文字小文字は無視して比較する。
 */
export const findDuplicateFertilizers = (fertilizers = []) => {
  const groups = {};
  fertilizers.forEach((f) => {
    const key = `${(f.name || '').replace(/\s+/g, '').toLowerCase()}__${(f.manufacturer || '').replace(/\s+/g, '').toLowerCase()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  });
  return Object.values(groups)
    .filter((group) => group.length > 1)
    // 古いものを代表にする（購入日が分かればそれ、なければ登録順）
    .map((group) => [...group].sort((a, b) => {
      const da = a.purchaseDate?.toDate ? a.purchaseDate.toDate().getTime() : 0;
      const dbb = b.purchaseDate?.toDate ? b.purchaseDate.toDate().getTime() : 0;
      return da - dbb;
    }));
};

const toDateKey = (value) => {
  if (!value) return '';
  const d = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

/**
 * 重複した肥料マスタを1つにまとめる。
 *
 * 1. 重複それぞれの購入情報を、代表マスタの購入記録として残す（買った履歴は消さない）
 * 2. 施肥記録・母液の材料が指している肥料IDを、代表マスタに付け替える
 * 3. 重複マスタをゴミ箱へ移す（元に戻せる）
 *
 * @param {string} organizationId
 * @param {object} keep 残す肥料マスタ
 * @param {Array} duplicates まとめる対象（keep は含めない）
 * @param {string} deletedByName
 * @returns {{purchases:number, uses:number, solutions:number, removed:number}}
 */
export const mergeFertilizers = async (organizationId, keep, duplicates, deletedByName = '') => {
  const duplicateIds = duplicates.map((d) => d.id);
  const result = { purchases: 0, uses: 0, solutions: 0, removed: 0 };

  // 1. 買った履歴を購入記録として残す
  for (const dup of duplicates) {
    if (!Number(dup.purchaseAmount)) continue;
    await saveFertilizerPurchase(organizationId, null, {
      fertilizerId: keep.id,
      fertilizerName: keep.name,
      purchaseDate: toDateKey(dup.purchaseDate),
      amount: dup.purchaseAmount,
      unit: dup.purchaseUnit || 'kg',
      lotNumber: dup.lotNumber || '',
      supplier: dup.supplier || '',
      notes: '重複していた肥料登録をまとめた際に、購入記録として移しました'
    });
    result.purchases += 1;
  }

  // 2. 施肥記録の付け替え
  const usesSnapshot = await getDocs(query(
    collection(db, 'fertilizerUses'),
    where('organizationId', '==', organizationId)
  ));
  const useTargets = usesSnapshot.docs.filter((d) => duplicateIds.includes(d.data().fertilizerId));
  for (let i = 0; i < useTargets.length; i += 400) {
    const batch = writeBatch(db);
    useTargets.slice(i, i + 400).forEach((d) => {
      batch.update(doc(db, 'fertilizerUses', d.id), {
        fertilizerId: keep.id,
        fertilizerName: keep.name
      });
    });
    await batch.commit();
  }
  result.uses = useTargets.length;

  // 3. 母液の材料の付け替え（配列なので入れ替えて書き戻す）
  const solutionsSnapshot = await getDocs(query(
    collection(db, 'stockSolutions'),
    where('organizationId', '==', organizationId)
  ));
  const solutionTargets = solutionsSnapshot.docs.filter((d) =>
    (d.data().ingredients || []).some((ing) => duplicateIds.includes(ing.fertilizerId))
  );
  for (let i = 0; i < solutionTargets.length; i += 400) {
    const batch = writeBatch(db);
    solutionTargets.slice(i, i + 400).forEach((d) => {
      const ingredients = (d.data().ingredients || []).map((ing) =>
        duplicateIds.includes(ing.fertilizerId)
          ? { ...ing, fertilizerId: keep.id, fertilizerName: keep.name }
          : ing
      );
      batch.update(doc(db, 'stockSolutions', d.id), { ingredients });
    });
    await batch.commit();
  }
  result.solutions = solutionTargets.length;

  // 4. 重複マスタをゴミ箱へ
  for (const dup of duplicates) {
    await moveToTrash('fertilizers', dup.id, organizationId, deletedByName);
    result.removed += 1;
  }

  firestoreLogger.info('肥料マスタをまとめました', { organizationId, keepId: keep.id, ...result });
  return result;
};

/**
 * 肥料ごとの購入量の合計を求める。
 * マスタ側の購入量（旧方式）と購入記録の両方を足す。
 */
export const totalPurchased = (fertilizer, purchases = []) => {
  const entries = [];
  if (Number(fertilizer.purchaseAmount)) {
    entries.push({ amount: Number(fertilizer.purchaseAmount), unit: fertilizer.purchaseUnit || 'kg' });
  }
  purchases
    .filter((p) => p.fertilizerId === fertilizer.id)
    .forEach((p) => entries.push({ amount: Number(p.amount) || 0, unit: p.unit || 'kg' }));
  return entries;
};
