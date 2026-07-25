// src/constants/discardReasons.js
// 廃棄理由の分類（固定）。
// 途中で増減すると前半・後半のデータが比較できなくなるため、6種類で固定する。
// 迷う場合は備考に書き、分類自体は増やさない。

export const DISCARD_REASONS = [
  { key: 'disease', label: '病害', icon: '🦠', hint: '病斑・腐敗など' },
  { key: 'pest', label: '虫害', icon: '🐛', hint: '食害・虫の付着' },
  { key: 'physiological', label: '生理障害', icon: '🍂', hint: 'チップバーン（縁腐れ）など' },
  { key: 'offGrade', label: '規格外', icon: '📏', hint: '大きさ不足・過大' },
  { key: 'damage', label: '損傷', icon: '💥', hint: '調製時の物理的な傷' },
  { key: 'bolting', label: 'とう立ち', icon: '🌾', hint: '抽苔' }
];

/** 空のカウント（全理由0） */
export const emptyDiscardCounts = () =>
  DISCARD_REASONS.reduce((acc, r) => ({ ...acc, [r.key]: 0 }), {});

/** 保存済みデータからカウントを復元（欠けている理由は0で補う） */
export const normalizeDiscardCounts = (data = {}) =>
  DISCARD_REASONS.reduce((acc, r) => ({ ...acc, [r.key]: Number(data[r.key]) || 0 }), {});

/** 廃棄株数の合計 */
export const sumDiscardCounts = (counts = {}) =>
  DISCARD_REASONS.reduce((sum, r) => sum + (Number(counts[r.key]) || 0), 0);
