// src/services/ppeService.js
// 保護具（PPE）管理のデータアクセス。
//
// GLOBALG.A.P. FV-Smart 20.03.03（Major Must）は、次の2点の証拠を求めている。
//   (1) 提供されたPPEが「使用されている」ことを示す証拠
//   (2) 使い捨てPPEを使う場合、働く人のニーズに合った在庫を手元に維持している、
//       または速やかに調達・補充していることを示す記録
//
// (1) は着用確認記録（ppeChecks）＝管理者が現場で見て記録した証拠、
// (2) は品目マスタ（ppeItems）の適正在庫と入出庫記録（ppeTransactions）から
// 現在庫を算出することで示す。
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { moveToTrash } from './trashService';
import { firestoreLogger } from '../utils/logger';

// 使い捨てかどうかで、審査で問われることが変わる（使い捨ては在庫の維持が要件）
export const PPE_CATEGORIES = ['使い捨て', '繰り返し使用'];

// 入出庫の種別。符号は現在庫の計算に使う
export const TRANSACTION_TYPES = [
  { value: '入庫', sign: 1, label: '入庫（購入・補充）', icon: '📥' },
  { value: '支給', sign: -1, label: '支給（働く人へ渡した）', icon: '📤' },
  { value: '廃棄', sign: -1, label: '廃棄（破損・汚損）', icon: '🗑' }
];

export const transactionSign = (type) =>
  TRANSACTION_TYPES.find((t) => t.value === type)?.sign ?? 0;

// 着用確認は「月1回」を目安とする。これを超えると未実施の警告を出す
export const CHECK_INTERVAL_DAYS = 30;

// 着用状況の判定
export const CHECK_RESULTS = [
  { value: 'ok', label: '着用', icon: '⭕', color: 'text-green-700' },
  { value: 'ng', label: '未着用', icon: '❌', color: 'text-red-700' },
  { value: 'na', label: '対象外', icon: '—', color: 'text-gray-400' }
];

// 水耕サラダ菜の栽培・調製を想定した標準的な保護具
export const DEFAULT_PPE_ITEMS = [
  {
    name: '使い捨て手袋（ニトリル手袋）',
    category: '使い捨て',
    targetWork: '収穫・調製・包装',
    unit: '枚',
    minStock: 200,
    storageLocation: '調製室'
  },
  {
    name: '衛生マスク（不織布）',
    category: '使い捨て',
    targetWork: '収穫・調製・包装',
    unit: '枚',
    minStock: 100,
    storageLocation: '調製室'
  },
  {
    name: 'ヘアキャップ（三角巾・帽子）',
    category: '使い捨て',
    targetWork: '収穫・調製・包装',
    unit: '枚',
    minStock: 100,
    storageLocation: '調製室'
  },
  {
    name: '防除用マスク（防じん・防毒マスク）',
    category: '繰り返し使用',
    targetWork: '防除（農薬散布）',
    unit: '個',
    minStock: 2,
    storageLocation: '農薬保管庫の外（専用棚）'
  },
  {
    name: '防除マスク用 吸収缶',
    category: '使い捨て',
    targetWork: '防除（農薬散布）',
    unit: '個',
    minStock: 2,
    storageLocation: '農薬保管庫の外（専用棚）'
  },
  {
    name: '農薬用ゴム手袋',
    category: '繰り返し使用',
    targetWork: '防除（農薬散布）',
    unit: '双',
    minStock: 2,
    storageLocation: '農薬保管庫の外（専用棚）'
  },
  {
    name: '保護メガネ（ゴーグル）',
    category: '繰り返し使用',
    targetWork: '防除・薬品の希釈',
    unit: '個',
    minStock: 2,
    storageLocation: '農薬保管庫の外（専用棚）'
  },
  {
    name: '防除衣（カッパ・不浸透性の作業衣）',
    category: '繰り返し使用',
    targetWork: '防除（農薬散布）',
    unit: '着',
    minStock: 2,
    storageLocation: '農薬保管庫の外（専用棚）'
  },
  {
    name: '長靴',
    category: '繰り返し使用',
    targetWork: 'ハウス内作業全般',
    unit: '足',
    minStock: 5,
    storageLocation: 'ハウス入口'
  },
  {
    name: '防音保護具（耳栓・イヤーマフ）',
    category: '繰り返し使用',
    targetWork: '草刈機・動力機械の使用',
    unit: '個',
    minStock: 2,
    storageLocation: '資材管理室'
  }
];

/* ------------------------------------------------------------------ */
/* 品目マスタ                                                          */
/* ------------------------------------------------------------------ */

/** 保護具の品目一覧を取得（order順） */
export const getPpeItems = async (organizationId) => {
  const itemsQuery = query(
    collection(db, 'ppeItems'),
    where('organizationId', '==', organizationId)
  );
  const snapshot = await getDocs(itemsQuery);
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return items;
};

/** 標準の保護具をまとめて登録 */
export const seedDefaultPpeItems = async (organizationId) => {
  const created = [];
  for (let i = 0; i < DEFAULT_PPE_ITEMS.length; i++) {
    const item = DEFAULT_PPE_ITEMS[i];
    const data = {
      organizationId,
      ...item,
      order: i,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, 'ppeItems'), data);
    created.push({ id: ref.id, ...data });
  }
  firestoreLogger.info('標準の保護具を登録しました', { organizationId, count: created.length });
  return created;
};

/** 品目を保存（新規 or 更新） */
export const savePpeItem = async (organizationId, itemId, data) => {
  const payload = {
    organizationId,
    name: (data.name || '').trim(),
    category: data.category || '使い捨て',
    targetWork: (data.targetWork || '').trim(),
    unit: (data.unit || '個').trim(),
    minStock: Number(data.minStock) || 0,
    storageLocation: (data.storageLocation || '').trim(),
    order: data.order ?? 0,
    updatedAt: serverTimestamp()
  };
  if (itemId) {
    await updateDoc(doc(db, 'ppeItems', itemId), payload);
    return { id: itemId, ...payload };
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(collection(db, 'ppeItems'), payload);
  return { id: ref.id, ...payload };
};

/** 品目を削除（ゴミ箱へ） */
export const deletePpeItem = async (itemId, organizationId, deletedByName = '') => {
  await moveToTrash('ppeItems', itemId, organizationId, deletedByName);
};

/* ------------------------------------------------------------------ */
/* 入出庫                                                              */
/* ------------------------------------------------------------------ */

/** 入出庫記録を取得（新しい順）
 * 件数が多くないため組織IDのみで取得し、並べ替えはクライアント側で行う
 * （複合インデックスを不要にする） */
export const getPpeTransactions = async (organizationId) => {
  const txQuery = query(
    collection(db, 'ppeTransactions'),
    where('organizationId', '==', organizationId)
  );
  const snapshot = await getDocs(txQuery);
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return list;
};

/** 入出庫を記録 */
export const addPpeTransaction = async (organizationId, data) => {
  const payload = {
    organizationId,
    date: data.date,
    type: data.type,
    itemId: data.itemId,
    itemName: data.itemName || '',
    unit: data.unit || '',
    quantity: Number(data.quantity) || 0,
    // 支給のときは受け取った人、入庫のときは購入先を入れる
    counterpartName: (data.counterpartName || '').trim(),
    note: (data.note || '').trim(),
    recordedByName: data.recordedByName || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, 'ppeTransactions'), payload);
  return { id: ref.id, ...payload };
};

/** 入出庫記録を削除（ゴミ箱へ） */
export const deletePpeTransaction = async (txId, organizationId, deletedByName = '') => {
  await moveToTrash('ppeTransactions', txId, organizationId, deletedByName);
};

/** 品目ごとの現在庫を算出 → { itemId: 数量 } */
export const computeStock = (transactions = []) => {
  const stock = {};
  transactions.forEach((tx) => {
    if (!tx.itemId) return;
    const sign = transactionSign(tx.type);
    stock[tx.itemId] = (stock[tx.itemId] || 0) + sign * (Number(tx.quantity) || 0);
  });
  return stock;
};

/** 適正在庫を下回っている品目を抽出
 * 入出庫を1件も記録していない品目は「在庫管理をしていない」だけなので対象外とする */
export const findLowStockItems = (items = [], transactions = []) => {
  const stock = computeStock(transactions);
  const tracked = new Set(transactions.map((tx) => tx.itemId));
  return items
    .filter((item) => tracked.has(item.id))
    .filter((item) => (item.minStock ?? 0) > 0)
    .map((item) => ({ ...item, stock: stock[item.id] || 0 }))
    .filter((item) => item.stock < item.minStock);
};

/* ------------------------------------------------------------------ */
/* 着用確認                                                            */
/* ------------------------------------------------------------------ */

/** 着用確認記録を取得（新しい順） */
export const getPpeChecks = async (organizationId) => {
  const checksQuery = query(
    collection(db, 'ppeChecks'),
    where('organizationId', '==', organizationId)
  );
  const snapshot = await getDocs(checksQuery);
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return list;
};

/** 着用確認記録を1件取得 */
export const getPpeCheck = async (checkId) => {
  const snap = await getDoc(doc(db, 'ppeChecks', checkId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/** 着用確認記録を保存（新規 or 更新） */
export const savePpeCheck = async (organizationId, checkId, data) => {
  const payload = {
    organizationId,
    date: data.date,
    workName: (data.workName || '').trim(),
    checkedByName: data.checkedByName || '',
    targetIds: data.targetIds || [],
    targetNames: data.targetNames || [],
    otherTargets: (data.otherTargets || '').trim(),
    // 保護具を要する作業が無かった期間の記録（記録の空白を埋める）
    noApplicableWork: !!data.noApplicableWork,
    // [{ itemId, itemName, result }]
    results: data.results || [],
    findings: (data.findings || '').trim(),
    correctiveAction: (data.correctiveAction || '').trim(),
    photoUrls: data.photoUrls || [],
    updatedAt: serverTimestamp()
  };
  if (checkId) {
    await updateDoc(doc(db, 'ppeChecks', checkId), payload);
    return { id: checkId, ...payload };
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(collection(db, 'ppeChecks'), payload);
  return { id: ref.id, ...payload };
};

/** 着用確認記録を削除（ゴミ箱へ） */
export const deletePpeCheck = async (checkId, organizationId, deletedByName = '') => {
  await moveToTrash('ppeChecks', checkId, organizationId, deletedByName);
};

/** 未着用（ng）が1件でもあるか */
export const hasNonCompliance = (check) =>
  !check?.noApplicableWork && (check?.results || []).some((r) => r.result === 'ng');

/** 最後に着用確認を行ってからの経過日数（記録がなければ null） */
export const daysSinceLastCheck = (checks = []) => {
  const dates = checks.map((c) => c.date).filter(Boolean).sort();
  if (dates.length === 0) return null;
  const last = new Date(dates[dates.length - 1]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  return Math.floor((today - last) / (24 * 60 * 60 * 1000));
};

/** 着用確認が期限を過ぎているか（未実施も期限切れ扱い） */
export const isCheckOverdue = (checks = []) => {
  const days = daysSinceLastCheck(checks);
  return days === null || days > CHECK_INTERVAL_DAYS;
};
