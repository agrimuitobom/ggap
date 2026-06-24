// src/services/cleaningService.js
// 清掃チェック機能のデータアクセス。
// - cleaningItems: 清掃項目マスタ（項目名・頻度・実施曜日）
// - cleaningChecks: 日付ごとのチェック記録（チェック済み項目IDの配列）
//
// 「その日付にチェックを入れたら全てにチェックが入る」を実現するため、
// 日付ドキュメントに checkedItems 配列を持たせ、一括設定・個別トグルの
// 両方を効率よく扱えるようにしている。
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { firestoreLogger } from '../utils/logger';

// 紙の「おそうじカレンダー」に基づく標準清掃項目
// weekdays: 実施する曜日（0=日, 1=月 ... 6=土）。空配列は「毎日（曜日問わず）」。
export const DEFAULT_CLEANING_ITEMS = [
  { name: '水耕ハウスの清掃・整理整頓', frequencyLabel: '毎日', weekdays: [] },
  { name: 'トイレの清掃', frequencyLabel: '毎日', weekdays: [] },
  { name: '収穫用ハサミ・収穫トレイの洗浄', frequencyLabel: '使用後', weekdays: [] },
  { name: '作業台の清掃', frequencyLabel: '使用前後', weekdays: [] },
  { name: '資材管理室の清掃', frequencyLabel: '週1回', weekdays: [1] },
  { name: '軽トラックの車内清掃', frequencyLabel: '使用前後', weekdays: [] },
  { name: 'ねずみトラップ 確認', frequencyLabel: '週1回', weekdays: [1] },
  { name: 'ホウリバー 確認', frequencyLabel: '毎日', weekdays: [] }
];

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// ローカル時刻で YYYY-MM-DD を返す
export const toDateKey = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

// 項目が指定日に実施対象か（weekdays が空なら毎日対象）
export const isItemApplicable = (item, date) => {
  if (!item.weekdays || item.weekdays.length === 0) return true;
  return item.weekdays.includes(new Date(date).getDay());
};

/** 清掃項目一覧を取得（order順） */
export const getCleaningItems = async (organizationId) => {
  const itemsQuery = query(
    collection(db, 'cleaningItems'),
    where('organizationId', '==', organizationId)
  );
  const snapshot = await getDocs(itemsQuery);
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return items;
};

/** 標準清掃項目をまとめて登録 */
export const seedDefaultCleaningItems = async (organizationId) => {
  const created = [];
  for (let i = 0; i < DEFAULT_CLEANING_ITEMS.length; i++) {
    const item = DEFAULT_CLEANING_ITEMS[i];
    const data = {
      organizationId,
      name: item.name,
      frequencyLabel: item.frequencyLabel,
      weekdays: item.weekdays,
      order: i,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, 'cleaningItems'), data);
    created.push({ id: ref.id, ...data });
  }
  firestoreLogger.info('標準清掃項目を登録しました', { organizationId, count: created.length });
  return created;
};

/** 清掃項目を保存（新規 or 更新） */
export const saveCleaningItem = async (organizationId, itemId, data) => {
  const payload = {
    organizationId,
    name: data.name.trim(),
    frequencyLabel: data.frequencyLabel || '',
    weekdays: data.weekdays || [],
    order: data.order ?? 0,
    updatedAt: serverTimestamp()
  };
  if (itemId) {
    await updateDoc(doc(db, 'cleaningItems', itemId), payload);
    return { id: itemId, ...payload };
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(collection(db, 'cleaningItems'), payload);
  return { id: ref.id, ...payload };
};

/** 清掃項目を削除 */
export const deleteCleaningItem = async (itemId) => {
  await deleteDoc(doc(db, 'cleaningItems', itemId));
};

/** 指定日のチェック記録を取得（なければ空配列） */
export const getDayCheck = async (organizationId, dateKey) => {
  const ref = doc(db, 'cleaningChecks', `${organizationId}_${dateKey}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().checkedItems || [] : [];
};

/** 指定日のチェック済み項目を保存（配列をそのまま設定） */
export const setDayCheck = async (organizationId, dateKey, checkedItems, checkedByName = '') => {
  const ref = doc(db, 'cleaningChecks', `${organizationId}_${dateKey}`);
  await setDoc(ref, {
    organizationId,
    date: dateKey,
    checkedItems,
    lastCheckedByName: checkedByName,
    updatedAt: serverTimestamp()
  });
};

/** 月間のチェック記録を取得 → { dateKey: [itemId, ...] }
 * 清掃チェックは1日1件と少量のため、組織IDのみで取得して
 * 日付範囲はクライアント側で絞り込む（複合インデックス不要）。 */
export const getMonthChecks = async (organizationId, startKey, endKey) => {
  const checksQuery = query(
    collection(db, 'cleaningChecks'),
    where('organizationId', '==', organizationId)
  );
  const snapshot = await getDocs(checksQuery);
  const map = {};
  snapshot.forEach((d) => {
    const data = d.data();
    if (data.date && data.date >= startKey && data.date <= endKey) {
      map[data.date] = data.checkedItems || [];
    }
  });
  return map;
};
