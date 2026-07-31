// src/services/backupService.js
// 組織のデータをまるごと書き出し・復元する。
//
// 目的は「誤って消してしまったときに戻せること」。
// 書き出したJSONは手元（Google Drive等）に保管でき、
// Firebaseのアカウントに何かあってもデータが残る。
import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { firestoreLogger } from '../utils/logger';

// バックアップ対象のコレクション（すべて organizationId を持つもの）
// ユーザーアカウントや組織メンバーシップは、復元すると権限が壊れるため対象外。
export const BACKUP_COLLECTIONS = [
  'fields',
  'plantings',
  'workLogs',
  'workLogTemplates',
  'harvests',
  'shipments',
  'seeds',
  'seedUses',
  'fertilizers',
  'fertilizerUses',
  'pesticides',
  'pesticideUses',
  'fieldInspections',
  'nutrientLogs',
  'waterSources',
  'waterTests',
  'storageLocations',
  'materialDisposals',
  'workers',
  'groups',
  'trainings',
  'trainingItems',
  'visitors',
  'cleaningItems',
  'cleaningChecks',
  'incidents',
  'equipments',
  'equipmentChecks',
  'complaints',
  'recallTests',
  'selfAssessments',
  'biodiversitySurveys'
];

// 日時はJSONにそのまま入らないため、目印を付けて文字列にする
const TIMESTAMP_MARKER = '__timestamp__';

/** Firestoreの値をJSONで扱える形に変換する */
const serializeValue = (value) => {
  if (value === null || value === undefined) return null;
  // Firestore の Timestamp
  if (typeof value.toDate === 'function') {
    return { [TIMESTAMP_MARKER]: value.toDate().toISOString() };
  }
  if (value instanceof Date) {
    return { [TIMESTAMP_MARKER]: value.toISOString() };
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([k, v]) => { out[k] = serializeValue(v); });
    return out;
  }
  return value;
};

/** JSONの値をFirestoreに書き戻せる形に変換する */
const deserializeValue = (value) => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(deserializeValue);
  if (typeof value === 'object') {
    if (typeof value[TIMESTAMP_MARKER] === 'string') {
      return Timestamp.fromDate(new Date(value[TIMESTAMP_MARKER]));
    }
    const out = {};
    Object.entries(value).forEach(([k, v]) => { out[k] = deserializeValue(v); });
    return out;
  }
  return value;
};

/**
 * 組織のデータをすべて取得してバックアップ用のオブジェクトを作る。
 * @param {function} onProgress 進捗通知（コレクション名, 完了数, 全体数）
 */
export const createBackup = async (organization, onProgress) => {
  const collections = {};
  let totalDocs = 0;

  for (let i = 0; i < BACKUP_COLLECTIONS.length; i++) {
    const name = BACKUP_COLLECTIONS[i];
    onProgress?.(name, i, BACKUP_COLLECTIONS.length);
    try {
      const snap = await getDocs(query(
        collection(db, name),
        where('organizationId', '==', organization.id)
      ));
      collections[name] = snap.docs.map((d) => ({
        id: d.id,
        data: serializeValue(d.data())
      }));
      totalDocs += snap.size;
    } catch (err) {
      // 1つのコレクションで失敗しても、他は取得できるよう続行する
      firestoreLogger.error('バックアップ取得エラー', { collectionName: name }, err);
      collections[name] = [];
    }
  }
  onProgress?.('完了', BACKUP_COLLECTIONS.length, BACKUP_COLLECTIONS.length);

  return {
    formatVersion: 1,
    appName: 'GAP Tracker',
    organizationId: organization.id,
    organizationName: organization.name || '',
    exportedAt: new Date().toISOString(),
    totalDocs,
    collections
  };
};

/** バックアップをJSONファイルとしてダウンロードする */
export const downloadBackup = (backup) => {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const stamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const safeName = (backup.organizationName || 'organization').replace(/[\\/:*?"<>|]/g, '_');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `GAPTracker_バックアップ_${safeName}_${stamp}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};

/** 読み込んだファイルがバックアップとして妥当か確認する */
export const parseBackupFile = async (file) => {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('ファイルの形式が正しくありません（JSONとして読み取れません）。');
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.collections) {
    throw new Error('このファイルはGAP Trackerのバックアップではないようです。');
  }
  return parsed;
};

/** バックアップに含まれる件数を数える */
export const countBackupDocs = (backup) => {
  const counts = {};
  let total = 0;
  Object.entries(backup.collections || {}).forEach(([name, docsArr]) => {
    const n = Array.isArray(docsArr) ? docsArr.length : 0;
    if (n > 0) counts[name] = n;
    total += n;
  });
  return { counts, total };
};

/**
 * バックアップから復元する。
 * @param {string} organizationId 復元先の組織
 * @param {object} backup バックアップデータ
 * @param {object} options
 *   - mode: 'missing'（既にある記録は触らず、無いものだけ戻す）/ 'overwrite'（バックアップの内容で上書き）
 *   - onProgress: 進捗通知
 *
 * 記録は元のIDのまま書き戻すため、ロット番号や作付との紐づけが壊れない。
 */
export const restoreBackup = async (organizationId, backup, { mode = 'missing', onProgress } = {}) => {
  const result = { restored: 0, skipped: 0, failed: 0, byCollection: {} };
  const names = Object.keys(backup.collections || {});

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const docsArr = backup.collections[name] || [];
    onProgress?.(name, i, names.length);
    if (docsArr.length === 0) continue;
    if (!BACKUP_COLLECTIONS.includes(name)) continue; // 想定外のコレクションは無視

    // 既にある記録のIDを調べる（「無いものだけ戻す」の判定に使う）
    let existingIds = new Set();
    try {
      const snap = await getDocs(query(
        collection(db, name),
        where('organizationId', '==', organizationId)
      ));
      existingIds = new Set(snap.docs.map((d) => d.id));
    } catch (err) {
      firestoreLogger.error('復元前の既存データ確認に失敗しました', { collectionName: name }, err);
    }

    const targets = docsArr.filter((entry) => {
      if (mode === 'missing' && existingIds.has(entry.id)) {
        result.skipped += 1;
        return false;
      }
      return true;
    });

    // Firestoreの一括書き込みは500件までのため分割する
    const CHUNK = 400;
    for (let s = 0; s < targets.length; s += CHUNK) {
      const chunk = targets.slice(s, s + CHUNK);
      const batch = writeBatch(db);
      chunk.forEach((entry) => {
        const data = deserializeValue(entry.data) || {};
        // 復元先の組織に必ず合わせる（別組織のデータが混ざらないように）
        data.organizationId = organizationId;
        batch.set(doc(db, name, entry.id), data);
      });
      try {
        await batch.commit();
        result.restored += chunk.length;
        result.byCollection[name] = (result.byCollection[name] || 0) + chunk.length;
      } catch (err) {
        firestoreLogger.error('復元の書き込みに失敗しました', { collectionName: name, count: chunk.length }, err);
        result.failed += chunk.length;
      }
    }
  }

  onProgress?.('完了', names.length, names.length);
  firestoreLogger.info('バックアップから復元しました', { organizationId, ...result });
  return result;
};
