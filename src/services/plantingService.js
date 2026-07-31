// src/services/plantingService.js
// 作付（栽培サイクル）と処理区の管理。
//
// 「いつ・どの圃場に・何を・どの条件で植えたか」を1レコードとして定義し、
// 収穫・作業・養液などの記録をこれに紐づけることで、
// 第1作/第2作の区別や、処理区どうしの比較ができるようにする。
//
// 比較実験は「同じ圃場内に処理区ごとの planting を複数作る」ことで表現する。
// 例: サラダ菜 第1作 → 慣行区×3反復・減肥区×3反復 = 6件
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { moveToTrash } from './trashService';

// 処理区の種別（途中で増やすと前半・後半のデータが比較できなくなるため固定）
export const TREATMENTS = ['慣行区', '減肥区', 'その他'];

export const PLANTING_STATUS = ['栽培中', '収穫完了', '中止'];

/** 作付の一覧を取得（新しい順） */
export const getPlantings = async (organizationId) => {
  const snapshot = await getDocs(query(
    collection(db, 'plantings'),
    where('organizationId', '==', organizationId)
  ));
  const list = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    sowingDate: d.data().sowingDate?.toDate ? d.data().sowingDate.toDate() : null,
    plantingDate: d.data().plantingDate?.toDate ? d.data().plantingDate.toDate() : null
  }));
  // 作次 → 処理区 → 反復 の順に並べると実験の構造が見やすい
  list.sort((a, b) => {
    const at = a.plantingDate?.getTime() || a.sowingDate?.getTime() || 0;
    const bt = b.plantingDate?.getTime() || b.sowingDate?.getTime() || 0;
    if (bt !== at) return bt - at;
    if ((a.treatment || '') !== (b.treatment || '')) {
      return (a.treatment || '').localeCompare(b.treatment || '');
    }
    return (a.replicate || 0) - (b.replicate || 0);
  });
  return list;
};

/** 作付を1件取得 */
export const getPlanting = async (id) => {
  const snap = await getDoc(doc(db, 'plantings', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    sowingDate: data.sowingDate?.toDate ? data.sowingDate.toDate() : null,
    plantingDate: data.plantingDate?.toDate ? data.plantingDate.toDate() : null
  };
};

/** フォームの入力値を保存用データに変換 */
const buildPlantingData = (organizationId, form, field) => ({
  organizationId,
  fieldId: form.fieldId,
  fieldName: field?.name || '',
  // 圃場の栽培方式を作付時点の記録として保持する（後で圃場を変えても実験条件が残る）
  cultivationType: field?.cultivationType || '',
  cropName: form.cropName.trim(),
  variety: form.variety.trim(),
  cropCycle: form.cropCycle !== '' ? Number(form.cropCycle) : null,
  treatment: form.treatment,
  treatmentDetail: form.treatmentDetail || '',
  replicate: form.replicate !== '' ? Number(form.replicate) : null,
  block: form.block !== '' ? Number(form.block) : null,
  plotArea: form.plotArea !== '' ? Number(form.plotArea) : null,
  plantCount: form.plantCount !== '' ? Number(form.plantCount) : null,
  // 水耕系: 目標EC / 土耕系: 目標窒素施用量(g/m²)
  targetEc: form.targetEc !== '' ? Number(form.targetEc) : null,
  targetNitrogen: form.targetNitrogen !== '' ? Number(form.targetNitrogen) : null,
  // 処理区どうしを同じ条件で比べるための収穫基準（例: 定植後35日で一斉収穫）
  harvestCriteria: form.harvestCriteria || '',
  sowingDate: form.sowingDate ? new Date(`${form.sowingDate}T00:00:00`) : null,
  plantingDate: form.plantingDate ? new Date(`${form.plantingDate}T00:00:00`) : null,
  status: form.status || '栽培中',
  notes: form.notes || '',
  updatedAt: serverTimestamp()
});

/** 作付を保存（新規 or 更新） */
export const savePlanting = async (organizationId, plantingId, form, field) => {
  const data = buildPlantingData(organizationId, form, field);
  if (plantingId) {
    await updateDoc(doc(db, 'plantings', plantingId), data);
    return plantingId;
  }
  const ref = await addDoc(collection(db, 'plantings'), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
};

/**
 * 実験区を一括作成する。
 * 処理区 × 反復数の組み合わせを作り、反復番号をそのままブロック番号に割り当てる。
 * （乱塊法: 同じブロックに各処理区を1つずつ置き、温室内の位置の影響を打ち消す）
 */
export const createExperimentPlantings = async (organizationId, form, field, treatments, replicates) => {
  const created = [];
  for (const treatment of treatments) {
    for (let r = 1; r <= replicates; r++) {
      const data = buildPlantingData(
        organizationId,
        {
          ...form,
          treatment: treatment.name,
          treatmentDetail: treatment.detail || '',
          targetEc: treatment.targetEc ?? form.targetEc,
          targetNitrogen: treatment.targetNitrogen ?? form.targetNitrogen,
          replicate: r,
          block: r
        },
        field
      );
      const ref = await addDoc(collection(db, 'plantings'), {
        ...data,
        createdAt: serverTimestamp()
      });
      created.push(ref.id);
    }
  }
  return created;
};

/** 作付を削除 */
export const deletePlanting = async (id, organizationId, deletedByName) => {
  // すぐには消さず、ゴミ箱へ移して一定期間戻せるようにする
  await moveToTrash('plantings', id, organizationId, deletedByName);
};

/** 表示用のラベル（例: サラダ菜 第1作 慣行区-1） */
export const plantingLabel = (p) => {
  if (!p) return '';
  const parts = [p.cropName];
  if (p.cropCycle) parts.push(`第${p.cropCycle}作`);
  if (p.treatment) {
    parts.push(p.replicate ? `${p.treatment}-${p.replicate}` : p.treatment);
  }
  return parts.filter(Boolean).join(' ');
};
