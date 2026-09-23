// src/services/materialPurchaseService.js
// 資材（肥料・農薬・種子）の購入（入荷）記録と、重複登録の統合。
//
// 資材を買い足すたびにマスタを新規登録すると、選択欄に同じ名前が並んで
// 区別できなくなり、在庫もロットもマスタごとに分かれてしまう。
// マスタは「製品」を表すものとして1つに保ち、買った回数ぶんは購入記録として
// 積み上げる。ロット番号・有効期限・購入先は購入ごとに違うので購入記録に持たせる。
//
//   マスタ（農薬A）… 登録番号・有効成分・収穫前日数など、買っても変わらない情報
//     └ 購入 2025/04/10 500ml ロットA123 期限2027/03
//     └ 購入 2026/04/12 500ml ロットB456 期限2028/03
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

const norm = (v) => (v || '').toString().replace(/\s+/g, '').toLowerCase();

/** 母液の材料に入っている肥料IDを、統合先に付け替える（肥料のみ） */
const repointStockSolutions = async (organizationId, keep, duplicateIds) => {
  const snapshot = await getDocs(query(
    collection(db, 'stockSolutions'),
    where('organizationId', '==', organizationId)
  ));
  const targets = snapshot.docs.filter((d) =>
    (d.data().ingredients || []).some((ing) => duplicateIds.includes(ing.fertilizerId))
  );
  for (let i = 0; i < targets.length; i += 400) {
    const batch = writeBatch(db);
    targets.slice(i, i + 400).forEach((d) => {
      const ingredients = (d.data().ingredients || []).map((ing) =>
        duplicateIds.includes(ing.fertilizerId)
          ? { ...ing, fertilizerId: keep.id, fertilizerName: keep.name }
          : ing
      );
      batch.update(doc(db, 'stockSolutions', d.id), { ingredients });
    });
    await batch.commit();
  }
  return targets.length;
};

/**
 * 資材の種類ごとの設定。
 * idField / nameField は購入記録と使用記録で資材を指す項目名。
 */
export const MATERIALS = {
  fertilizer: {
    label: '肥料',
    masterCollection: 'fertilizers',
    purchaseCollection: 'fertilizerPurchases',
    idField: 'fertilizerId',
    nameField: 'fertilizerName',
    listPath: '/fertilizers',
    newPath: '/fertilizers/new',
    units: ['kg', 'g', 'L', 'ml'],
    defaultUnit: 'kg',
    displayName: (m) => m.name || '',
    subLabel: (m) => m.manufacturer || '',
    detailLabel: (m) =>
      `成分 N${m.nitrogenContent ?? 0}-P${m.phosphorusContent ?? 0}-K${m.potassiumContent ?? 0}` +
      `${m.formType ? ` / ${m.formType}` : ''}${m.density ? ` / 比重${m.density}` : ''}`,
    duplicateKey: (m) => `${norm(m.name)}__${norm(m.manufacturer)}`,
    usageRefs: [{ collection: 'fertilizerUses', idField: 'fertilizerId', nameField: 'fertilizerName' }],
    extraRepoint: repointStockSolutions,
    extraFields: [],
    keepHint: '成分や比重が入力されている登録を残すのがおすすめです。'
  },
  pesticide: {
    label: '農薬',
    masterCollection: 'pesticides',
    purchaseCollection: 'pesticidePurchases',
    idField: 'pesticideId',
    nameField: 'pesticideName',
    listPath: '/pesticides',
    newPath: '/pesticides/new',
    units: ['ml', 'L', 'g', 'kg'],
    defaultUnit: 'ml',
    displayName: (m) => m.name || '',
    subLabel: (m) => (m.registrationNumber ? `登録第${m.registrationNumber}号` : m.manufacturer || ''),
    detailLabel: (m) =>
      `${m.activeIngredient ? `有効成分 ${m.activeIngredient}` : ''}` +
      `${m.preHarvestInterval ? ` / 収穫前日数 ${m.preHarvestInterval}日` : ''}`,
    // 同じ農薬は登録番号で見分ける。登録番号が無ければ名称と製造元で判定
    duplicateKey: (m) =>
      m.registrationNumber ? `reg__${norm(m.registrationNumber)}` : `${norm(m.name)}__${norm(m.manufacturer)}`,
    usageRefs: [{ collection: 'pesticideUses', idField: 'pesticideId', nameField: 'pesticideName' }],
    extraRepoint: null,
    extraFields: [],
    keepHint: '登録番号・有効成分・収穫前日数が入力されている登録を残すのがおすすめです。',
    // 農薬は有効期限の管理が審査で問われるため、購入ごとの期限を必須に近い扱いにする
    expiryImportant: true
  },
  seed: {
    label: '種子',
    masterCollection: 'seeds',
    purchaseCollection: 'seedPurchases',
    idField: 'seedId',
    nameField: 'seedName',
    listPath: '/seeds',
    newPath: '/seeds/new',
    units: ['袋', 'dl', 'ml', 'g', '粒'],
    defaultUnit: '袋',
    // 播種記録は「名称 (品種)」の形で種子名を持っている
    displayName: (m) => (m.variety ? `${m.name} (${m.variety})` : m.name || ''),
    subLabel: (m) => m.supplier || '',
    detailLabel: (m) => (m.disinfectionMethod ? `種子消毒 ${m.disinfectionMethod}` : ''),
    duplicateKey: (m) => `${norm(m.name)}__${norm(m.variety)}`,
    usageRefs: [{ collection: 'seedUses', idField: 'seedId', nameField: 'seedName' }],
    extraRepoint: null,
    // 種子の消毒・処理はロットごとに違うことがあるため、購入ごとに残せるようにする
    extraFields: [
      { key: 'treatment', label: '種子消毒・処理', placeholder: '例: チウラム処理済み / 無処理' }
    ],
    keepHint: '品種や種子消毒の情報が入力されている登録を残すのがおすすめです。'
  }
};

const toDateKey = (value) => {
  if (!value) return '';
  const d = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

/** 購入記録の一覧を取得（新しい順） */
export const getPurchases = async (type, organizationId) => {
  const cfg = MATERIALS[type];
  const snapshot = await getDocs(query(
    collection(db, cfg.purchaseCollection),
    where('organizationId', '==', organizationId)
  ));
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
  return list;
};

/** 購入記録を保存（新規 or 更新） */
export const savePurchase = async (type, organizationId, purchaseId, data) => {
  const cfg = MATERIALS[type];
  const payload = {
    organizationId,
    [cfg.idField]: data.materialId,
    [cfg.nameField]: data.materialName || '',
    purchaseDate: data.purchaseDate || '',
    amount: Number(data.amount) || 0,
    unit: data.unit || cfg.defaultUnit,
    lotNumber: (data.lotNumber || '').trim(),
    supplier: (data.supplier || '').trim(),
    expiryDate: data.expiryDate || '',
    notes: (data.notes || '').trim(),
    updatedAt: serverTimestamp()
  };
  cfg.extraFields.forEach((f) => {
    payload[f.key] = (data[f.key] || '').trim();
  });
  if (purchaseId) {
    await updateDoc(doc(db, cfg.purchaseCollection, purchaseId), payload);
    return { id: purchaseId, ...payload };
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(collection(db, cfg.purchaseCollection), payload);
  return { id: ref.id, ...payload };
};

/** 購入記録を削除（ゴミ箱へ） */
export const deletePurchase = async (type, purchaseId, organizationId, deletedByName = '') => {
  await moveToTrash(MATERIALS[type].purchaseCollection, purchaseId, organizationId, deletedByName);
};

/** 購入記録が指している資材IDを取り出す */
export const purchaseMaterialId = (type, purchase) => purchase?.[MATERIALS[type].idField];

/**
 * 重複しているマスタをまとめて返す（同じ製品と判断できるもの同士）。
 * 各グループは古い順に並べる（先頭を統合先の候補にする）。
 */
export const findDuplicates = (type, masters = []) => {
  const cfg = MATERIALS[type];
  const groups = {};
  masters.forEach((m) => {
    const key = cfg.duplicateKey(m);
    if (!key.replace(/_/g, '')) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  const time = (m) => {
    const v = m.purchaseDate || m.createdAt;
    return v?.toDate ? v.toDate().getTime() : 0;
  };
  return Object.values(groups)
    .filter((g) => g.length > 1)
    .map((g) => [...g].sort((a, b) => time(a) - time(b)));
};

/**
 * 重複したマスタを1つにまとめる。
 * 1. 重複それぞれの購入情報を、統合先の購入記録として残す（買った履歴は消さない）
 * 2. 使用記録などが指している資材IDを統合先に付け替える
 * 3. 重複していたマスタをゴミ箱へ移す（元に戻せる）
 */
export const mergeMasters = async (type, organizationId, keep, duplicates, deletedByName = '') => {
  const cfg = MATERIALS[type];
  const duplicateIds = duplicates.map((d) => d.id);
  const keepName = cfg.displayName(keep);
  const result = { purchases: 0, uses: 0, extra: 0, removed: 0 };

  for (const dup of duplicates) {
    const hasPurchaseInfo = Number(dup.purchaseAmount) || dup.lotNumber || dup.purchaseDate;
    if (!hasPurchaseInfo) continue;
    const extra = {};
    if (type === 'seed' && dup.disinfectionMethod) extra.treatment = dup.disinfectionMethod;
    await savePurchase(type, organizationId, null, {
      materialId: keep.id,
      materialName: keepName,
      purchaseDate: toDateKey(dup.purchaseDate),
      amount: dup.purchaseAmount,
      unit: dup.purchaseUnit || cfg.defaultUnit,
      lotNumber: dup.lotNumber || '',
      supplier: dup.supplier || '',
      expiryDate: toDateKey(dup.expiryDate),
      notes: '重複していた登録をまとめた際に、購入記録として移しました',
      ...extra
    });
    result.purchases += 1;
  }

  for (const ref of cfg.usageRefs) {
    const snapshot = await getDocs(query(
      collection(db, ref.collection),
      where('organizationId', '==', organizationId)
    ));
    const targets = snapshot.docs.filter((d) => duplicateIds.includes(d.data()[ref.idField]));
    for (let i = 0; i < targets.length; i += 400) {
      const batch = writeBatch(db);
      targets.slice(i, i + 400).forEach((d) => {
        batch.update(doc(db, ref.collection, d.id), {
          [ref.idField]: keep.id,
          [ref.nameField]: keepName
        });
      });
      await batch.commit();
    }
    result.uses += targets.length;
  }

  // 購入記録（新しい仕組みで入力済みのもの）も統合先に付け替える
  const purchaseSnapshot = await getDocs(query(
    collection(db, cfg.purchaseCollection),
    where('organizationId', '==', organizationId)
  ));
  const purchaseTargets = purchaseSnapshot.docs.filter((d) => duplicateIds.includes(d.data()[cfg.idField]));
  for (const d of purchaseTargets) {
    await updateDoc(doc(db, cfg.purchaseCollection, d.id), {
      [cfg.idField]: keep.id,
      [cfg.nameField]: keepName
    });
  }

  if (cfg.extraRepoint) {
    result.extra = await cfg.extraRepoint(organizationId, keep, duplicateIds);
  }

  for (const dup of duplicates) {
    await moveToTrash(cfg.masterCollection, dup.id, organizationId, deletedByName);
    result.removed += 1;
  }

  firestoreLogger.info('資材マスタをまとめました', { type, organizationId, keepId: keep.id, ...result });
  return result;
};

/**
 * ある資材の購入記録を、マスタ側の購入情報（旧方式）と合わせて返す。
 * 在庫の合算や有効期限の判定に使う。
 */
export const purchasesOf = (type, master, purchases = []) => {
  const cfg = MATERIALS[type];
  const entries = [];
  if (Number(master.purchaseAmount) || master.lotNumber || master.expiryDate) {
    entries.push({
      source: 'master',
      purchaseDate: toDateKey(master.purchaseDate),
      amount: Number(master.purchaseAmount) || 0,
      unit: master.purchaseUnit || cfg.defaultUnit,
      lotNumber: master.lotNumber || '',
      expiryDate: toDateKey(master.expiryDate)
    });
  }
  purchases
    .filter((p) => p[cfg.idField] === master.id)
    .forEach((p) => entries.push({ source: 'purchase', ...p }));
  return entries;
};

/**
 * 有効期限の判定に使う日付。購入記録のうち最も遅い期限を採用する。
 * （新しく買い直したロットがあれば、古いロットの期限切れで警告し続けない）
 * 期限切れのロットそのものは、購入記録の一覧で赤く表示して廃棄を促す。
 */
export const latestExpiry = (type, master, purchases = []) => {
  const dates = purchasesOf(type, master, purchases)
    .map((e) => e.expiryDate)
    .filter(Boolean)
    .map((d) => new Date(`${d}T00:00:00`))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
};
