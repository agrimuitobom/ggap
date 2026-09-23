// src/services/photoBackupService.js
// 記録に添付した写真のバックアップ（ZIP）。
//
// 記録のバックアップ（JSON）には写真のURLしか入らない。Storage 側の写真が
// 失われると、URLだけ残っても写真は戻らないため、写真そのものを手元に保存する。
//
// 注意: ブラウザから Storage の写真を読み出すには、バケットに CORS の設定が
// 必要（初回に一度だけ）。設定が無いと読み出しに失敗するので、失敗の理由を
// 画面で説明できるよう、CORS による失敗を区別して返す。
import JSZip from 'jszip';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref, getBlob } from 'firebase/storage';
import { db, storage } from './firebase';

// 写真を持つ記録
export const PHOTO_SOURCES = [
  { collection: 'workLogs', label: '作業日誌', dateField: 'date', titleField: 'workType' },
  { collection: 'ppeChecks', label: '保護具の着用確認', dateField: 'date', titleField: 'workName' }
];

const toDateKey = (value) => {
  if (!value) return 'nodate';
  const d = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return 'nodate';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

// ファイル名に使えない文字を置き換える
const safe = (text) => String(text || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);

/** 組織の記録から、添付写真の一覧を集める（Storage にはまだ触れない） */
export const collectPhotos = async (organizationId) => {
  const photos = [];
  for (const source of PHOTO_SOURCES) {
    const snapshot = await getDocs(query(
      collection(db, source.collection),
      where('organizationId', '==', organizationId)
    ));
    snapshot.forEach((d) => {
      const data = d.data();
      (data.photoUrls || []).forEach((url, index) => {
        if (!url) return;
        const date = toDateKey(data[source.dateField]);
        photos.push({
          url,
          collection: source.collection,
          label: source.label,
          recordId: d.id,
          date,
          // 並べたときに日付順になり、何の記録の写真か分かる名前にする
          path: `${source.label}/${date}_${safe(data[source.titleField])}_${d.id.slice(0, 6)}_${index + 1}.jpg`
        });
      });
    });
  }
  photos.sort((a, b) => a.path.localeCompare(b.path));
  return photos;
};

/** CORS 未設定による失敗かどうか（ブラウザは詳しい理由を教えてくれないため推定） */
const looksLikeCorsError = (error) => {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  return text.includes('cors') || text.includes('network') || text.includes('failed to fetch') ||
    text.includes('retry-limit-exceeded') || text.includes('unknown');
};

/**
 * 写真をZIPにまとめる。
 * @param {Array} photos collectPhotos の結果
 * @param {Function} onProgress (done, total) を受け取る
 * @returns {{blob: Blob|null, saved: number, failed: Array, corsLikely: boolean}}
 */
export const buildPhotoZip = async (photos, onProgress = () => {}) => {
  const zip = new JSZip();
  const failed = [];
  let saved = 0;
  let corsFailures = 0;

  for (let i = 0; i < photos.length; i += 1) {
    const photo = photos[i];
    try {
      const blob = await getBlob(ref(storage, photo.url));
      zip.file(photo.path, blob);
      saved += 1;
    } catch (error) {
      if (looksLikeCorsError(error)) corsFailures += 1;
      failed.push({ ...photo, reason: error?.code || error?.message || '不明なエラー' });
    }
    onProgress(i + 1, photos.length);

    // 最初の数枚がすべて CORS で失敗するなら、残りも同じなので打ち切る
    if (i === 2 && saved === 0 && corsFailures === 3) {
      photos.slice(3).forEach((p) => failed.push({ ...p, reason: 'CORS 未設定のため中止' }));
      break;
    }
  }

  // どの写真がどの記録のものかを残す
  zip.file('写真の一覧.json', JSON.stringify(
    photos.map(({ url, collection: c, recordId, date, path }) => ({ path, collection: c, recordId, date, url })),
    null,
    2
  ));

  const blob = saved > 0 ? await zip.generateAsync({ type: 'blob' }) : null;
  return { blob, saved, failed, corsLikely: saved === 0 && corsFailures > 0 };
};
