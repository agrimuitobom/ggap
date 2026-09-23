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

/** 播種にあたる作業か（採番の判定に使う） */
export const isSowingMethod = (method) =>
  ['直播', '条播', '点播', '散播'].includes(method);

/**
 * 定植のときに選べるロットの一覧を作る。
 *
 * 方法が「播種」と入力されているとは限らない（作業日誌から自動作成された
 * 記録は「その他」になる）ため、方法では絞り込まず、ロットIDが付いている
 * 記録をすべて候補にする。定植の記録は同じロットIDを持つので、
 * ロットIDごとに1件へまとめ、播種側（定植以外）を優先して残す。
 *
 * @param {Array} seedUses 播種・定植記録
 * @returns {Array} 新しい順のロット候補
 */
export const collectSelectableLots = (seedUses = []) => {
  const toTime = (u) => (u.date?.toDate ? u.date.toDate().getTime() : 0);

  const byLot = new Map();
  seedUses
    .filter((u) => u.lotNumber)
    .forEach((u) => {
      const current = byLot.get(u.lotNumber);
      if (!current) {
        byLot.set(u.lotNumber, u);
        return;
      }
      // 定植より播種側を優先し、同種なら古い方（＝播種した日）を残す
      const currentIsTransplant = current.method === '定植';
      const nextIsTransplant = u.method === '定植';
      if (currentIsTransplant && !nextIsTransplant) {
        byLot.set(u.lotNumber, u);
      } else if (currentIsTransplant === nextIsTransplant && toTime(u) < toTime(current)) {
        byLot.set(u.lotNumber, u);
      }
    });

  return Array.from(byLot.values()).sort((a, b) => toTime(b) - toTime(a));
};

/**
 * 収穫などで、どの播種ロットのものかを推測する。
 * 同じ圃場で、その日以前に定植（なければ播種）された直近のロットを返す。
 * 水耕では圃場（ベッド）ごとに順番に植え替えるため、直近の定植が収穫対象になる。
 *
 * @param {Array} seedUses 播種・定植記録
 * @param {string} fieldId 圃場ID
 * @param {string} dateKey 'YYYY-MM-DD'
 * @returns {string} ロットID（推測できなければ ''）
 */
export const suggestLotForField = (seedUses = [], fieldId, dateKey) => {
  if (!fieldId) return '';
  const limit = dateKey ? new Date(`${dateKey}T23:59:59`).getTime() : Infinity;
  const toTime = (u) => (u.date?.toDate ? u.date.toDate().getTime() : u.date ? new Date(u.date).getTime() : 0);

  const candidates = seedUses
    .filter((u) => u.lotNumber && u.fieldId === fieldId && toTime(u) <= limit)
    .sort((a, b) => {
      // 定植を優先し、同じ種類なら新しい方
      const at = a.method === '定植' ? 1 : 0;
      const bt = b.method === '定植' ? 1 : 0;
      if (at !== bt) return bt - at;
      return toTime(b) - toTime(a);
    });
  return candidates[0]?.lotNumber || '';
};
