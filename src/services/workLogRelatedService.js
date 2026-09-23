// src/services/workLogRelatedService.js
// 作業日誌から自動で作る施肥・播種/定植・農薬使用記録の同期。
//
// 以前は作業日誌を更新するたびに関連記録を「全削除 → 作り直し」していた。
// その方式だと、関連記録の側でだけ入力した値が更新のたびに消える。
//   - 施肥記録: 母液への紐づけ、希釈倍率、入力量が原液か希釈後か
//   - 播種・定植記録: 病害虫の記録
//   - 農薬使用記録: 保護具の着用確認など
//
// そこで、作業日誌が持っている項目（owned）と、作るときだけ入れる初期値
// （createOnly）を分けて扱う。既存の記録があれば owned だけを上書きし、
// それ以外の項目には触れない。
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { moveToTrash } from './trashService';

export const RELATED_COLLECTIONS = ['fertilizerUses', 'seedUses', 'pesticideUses'];

const toNumberOrNull = (value) =>
  value === '' || value === null || value === undefined ? null : Number(value);

/**
 * 作業日誌の入力から、作るべき関連記録を組み立てる（Firestoreには触れない）。
 * 作業の種類に合わない記録は null になり、同期のときに取り除かれる。
 *
 * @returns {{fertilizerUses: object|null, seedUses: object|null, pesticideUses: object|null}}
 *   それぞれ { owned, createOnly } の形
 */
export const buildRelatedRecords = ({
  formData,
  workLogId,
  selectedField,
  users = [],
  fertilizers = [],
  seeds = [],
  seedUses = [],
  pesticides = [],
  currentUid = '',
  fallbackName = ''
}) => {
  // 施用者は組織名ではなく、実際に作業した担当者。担当者が未入力なら記録した人
  const applierNames = users
    .filter((user) => (formData.workers || []).includes(user.id))
    .map((user) => user.name);
  const appliedByName = applierNames.length > 0 ? applierNames.join('、') : fallbackName;

  const common = {
    date: new Date(formData.date),
    fieldId: formData.fieldId,
    fieldName: selectedField?.name || ''
  };
  const autoNote = `作業日誌より自動作成 (作業ID: ${workLogId})`;

  // 施肥
  let fertilizerUses = null;
  if (formData.workType === '施肥' && formData.fertilizerId) {
    const fertilizer = fertilizers.find((f) => f.id === formData.fertilizerId);
    fertilizerUses = {
      owned: {
        ...common,
        fertilizerId: formData.fertilizerId,
        fertilizerName: fertilizer ? fertilizer.name : '',
        appliedBy: currentUid,
        appliedByName,
        amount: toNumberOrNull(formData.fertilizerAmount),
        unit: formData.fertilizerUnit,
        method: formData.fertilizerMethod
      },
      // 母液の紐づけ・希釈倍率・備考は施肥記録の側で編集するため、作るときだけ入れる
      createOnly: {
        notes: autoNote
      }
    };
  }

  // 播種 / 定植
  let seedRecord = null;
  if (formData.workType === '播種' && formData.seedId) {
    const seed = seeds.find((s) => s.id === formData.seedId);
    seedRecord = {
      owned: {
        ...common,
        seedId: formData.seedId,
        seedName: seed ? `${seed.name} (${seed.variety})` : '',
        plantedBy: currentUid,
        plantedByName: appliedByName,
        amount: toNumberOrNull(formData.seedAmount),
        unit: formData.seedUnit || '粒',
        method: formData.seedMethod,
        lotNumber: (formData.lotNumber || '').trim()
      },
      // 病害虫の記録は播種・定植記録の側で入力するため、作るときだけ初期値を入れる
      createOnly: {
        pestStatus: 'なし',
        pestDetail: '',
        pestAction: '',
        notes: autoNote
      }
    };
  } else if (formData.workType === '定植' && formData.lotNumber) {
    // どの播種ロットを定植したのかを残し、種子の情報はそのロットから引き継ぐ
    const sourceLot = seedUses.find(
      (u) => u.lotNumber === formData.lotNumber && u.method !== '定植'
    ) || seedUses.find((u) => u.lotNumber === formData.lotNumber);
    seedRecord = {
      owned: {
        ...common,
        seedId: sourceLot?.seedId || '',
        seedName: sourceLot?.seedName || '',
        plantedBy: currentUid,
        plantedByName: appliedByName,
        method: '定植',
        lotNumber: formData.lotNumber.trim()
      },
      createOnly: {
        amount: null,
        unit: '',
        pestStatus: 'なし',
        pestDetail: '',
        pestAction: '',
        notes: autoNote
      }
    };
  }

  // 防除
  let pesticideUses = null;
  if (formData.workType === '防除' && formData.pesticideId) {
    const pesticide = pesticides.find((p) => p.id === formData.pesticideId);
    pesticideUses = {
      owned: {
        ...common,
        pesticideId: formData.pesticideId,
        pesticideName: pesticide ? pesticide.name : '',
        targetPest: formData.targetPest,
        appliedBy: currentUid,
        appliedByName,
        dilutionRate: toNumberOrNull(formData.dilutionRate),
        amount: toNumberOrNull(formData.pesticideAmount),
        unit: formData.pesticideUnit,
        treatedArea: toNumberOrNull(formData.treatedArea),
        method: formData.pesticideMethod,
        weather: formData.weather,
        temperature: toNumberOrNull(formData.temperature),
        windSpeed: toNumberOrNull(formData.windSpeed)
      },
      // 保護具の着用確認・備考などは農薬使用記録の側で編集するため、作るときだけ入れる
      createOnly: {
        notes: autoNote
      }
    };
  }

  return { fertilizerUses, seedUses: seedRecord, pesticideUses };
};

/**
 * 組み立てた関連記録を Firestore に反映する。
 *   - 記録が必要で、まだ無い → 作る（owned + createOnly）
 *   - 記録が必要で、既にある → owned だけ上書き（それ以外の項目は残す）
 *   - 記録が不要になった（作業の種類を変えた等）→ ゴミ箱へ移す
 *   - 過去の作り直しで重複している → 1件だけ残し、残りはゴミ箱へ
 *
 * セキュリティルールがドキュメントの組織所属を要求するため、
 * クエリには organizationId 条件を必ず含める。
 */
export const syncRelatedRecords = async (organizationId, workLogId, records, deletedByName = '') => {
  for (const collectionName of RELATED_COLLECTIONS) {
    const record = records[collectionName];
    const snapshot = await getDocs(query(
      collection(db, collectionName),
      where('organizationId', '==', organizationId),
      where('workLogId', '==', workLogId)
    ));
    const existing = snapshot.docs;

    if (!record) {
      for (const d of existing) {
        await moveToTrash(collectionName, d.id, organizationId, deletedByName);
      }
      continue;
    }

    if (existing.length === 0) {
      await addDoc(collection(db, collectionName), {
        ...record.createOnly,
        ...record.owned,
        organizationId,
        workLogId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      continue;
    }

    const [keep, ...duplicates] = existing;
    await updateDoc(keep.ref, { ...record.owned, updatedAt: serverTimestamp() });
    for (const d of duplicates) {
      await moveToTrash(collectionName, d.id, organizationId, deletedByName);
    }
  }
};

/**
 * 作業日誌を削除したとき、そこから作られた関連記録もゴミ箱へ移す。
 * 残しておくと、削除した作業が農薬使用記録簿や成分量の集計に残り続ける。
 * 作業日誌をゴミ箱から戻した場合は、関連記録もゴミ箱から戻せる。
 */
export const trashRelatedRecords = (organizationId, workLogId, deletedByName = '') =>
  syncRelatedRecords(
    organizationId,
    workLogId,
    { fertilizerUses: null, seedUses: null, pesticideUses: null },
    deletedByName
  );
