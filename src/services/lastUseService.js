// src/services/lastUseService.js
// 資材（農薬・肥料）の「前回使用時の値」を取得し、使用記録フォームの
// 自動入力に使う。同じ資材は同じ希釈倍率・対象・方法で使うことが多いため、
// 資材を選んだ瞬間に前回値を補完して入力の手間を減らす。
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { firestoreLogger } from '../utils/logger';

// 使用記録から日付の新しい順に最新1件を返す（複合インデックス不要のため
// クライアント側で日付ソート）
const findLatest = (docs) => {
  let latest = null;
  let latestTime = -Infinity;
  docs.forEach((d) => {
    const data = d.data();
    const dt = data.date?.toDate ? data.date.toDate().getTime() : 0;
    if (dt > latestTime) {
      latestTime = dt;
      latest = data;
    }
  });
  return latest;
};

/** 指定農薬の前回使用値（対象病害虫・希釈倍率・散布量・単位・方法） */
export const getLastPesticideUse = async (organizationId, pesticideId) => {
  if (!organizationId || !pesticideId) return null;
  try {
    const q = query(
      collection(db, 'pesticideUses'),
      where('organizationId', '==', organizationId),
      where('pesticideId', '==', pesticideId)
    );
    const snapshot = await getDocs(q);
    const latest = findLatest(snapshot.docs);
    if (!latest) return null;
    return {
      targetPest: latest.targetPest || '',
      dilutionRate: latest.dilutionRate != null ? String(latest.dilutionRate) : '',
      amount: latest.amount != null ? String(latest.amount) : '',
      unit: latest.unit || 'L',
      method: latest.method || ''
    };
  } catch (err) {
    firestoreLogger.error('農薬の前回使用値の取得エラー', { organizationId, pesticideId }, err);
    return null;
  }
};

/** 指定肥料の前回使用値（施用量・単位・施用方法） */
export const getLastFertilizerUse = async (organizationId, fertilizerId) => {
  if (!organizationId || !fertilizerId) return null;
  try {
    const q = query(
      collection(db, 'fertilizerUses'),
      where('organizationId', '==', organizationId),
      where('fertilizerId', '==', fertilizerId)
    );
    const snapshot = await getDocs(q);
    const latest = findLatest(snapshot.docs);
    if (!latest) return null;
    return {
      amount: latest.amount != null ? String(latest.amount) : '',
      unit: latest.unit || 'kg',
      method: latest.method || ''
    };
  } catch (err) {
    firestoreLogger.error('肥料の前回使用値の取得エラー', { organizationId, fertilizerId }, err);
    return null;
  }
};
