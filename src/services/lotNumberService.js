// src/services/lotNumberService.js
// 播種ロットIDの採番。
//
// 「令和の年 ＋ その年の播種の通し番号」で表す運用に合わせる。
//   R8.01 … 令和8年に最初に播種したもの
//   R8.02 … 2回目に播種したもの
//
// ロットIDは、播種 → 定植 → 収穫 → 出荷 をつなぐ背番号になる。
// 定植の記録では新しく採番せず、どの播種ロットを定植したのかを指す。

/** 西暦の年から令和の年を求める（令和元年 = 2019年） */
export const toReiwaYear = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  // 令和より前の日付は扱わない
  return year >= 2019 ? year - 2018 : null;
};

/** ロットIDの接頭辞（例: 2026年 → 'R8.'） */
export const lotPrefix = (date) => {
  const reiwa = toReiwaYear(date);
  return reiwa ? `R${reiwa}.` : '';
};

/** ロットIDから通し番号を取り出す（R8.03 → 3。形式が違えば null） */
export const lotSequence = (lotNumber, prefix) => {
  if (!lotNumber || !prefix || !lotNumber.startsWith(prefix)) return null;
  const rest = lotNumber.slice(prefix.length);
  const num = parseInt(rest, 10);
  return Number.isFinite(num) ? num : null;
};

/**
 * 次のロットIDを求める。
 * 同じ年のロットIDの中で最も大きい通し番号の次を使う。
 * 途中の番号が欠けていても、番号を再利用しない（過去の記録と衝突させない）。
 * @param {Array<string>} existingLotNumbers 既存のロットID
 * @param {Date|string} date 播種日
 * @param {number} digits 通し番号の桁数（既定2桁 → R8.01）
 */
export const nextLotNumber = (existingLotNumbers = [], date = new Date(), digits = 2) => {
  const prefix = lotPrefix(date);
  if (!prefix) return '';

  const maxSeq = existingLotNumbers.reduce((max, lot) => {
    const seq = lotSequence(lot, prefix);
    return seq !== null && seq > max ? seq : max;
  }, 0);

  return `${prefix}${String(maxSeq + 1).padStart(digits, '0')}`;
};

/** 播種にあたる作業か（定植・その他は新しく採番しない） */
export const isSowingMethod = (method) =>
  ['直播', '条播', '点播', '散播'].includes(method);
