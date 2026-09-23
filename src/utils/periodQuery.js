// src/utils/periodQuery.js
// 表示期間を Firestore のクエリ条件にする。
// 「組織ID ＋ 日付の降順」の複合インデックスがあるコレクションなら、
// 同じ日付項目への範囲条件は新しいインデックスなしで使える。
import { where, Timestamp } from 'firebase/firestore';
import { periodStartDate } from './period';

export const periodWhere = (dateField, periodKey) => {
  const start = periodStartDate(periodKey);
  return start ? [where(dateField, '>=', Timestamp.fromDate(start))] : [];
};
