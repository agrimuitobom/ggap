// src/utils/period.js
// 一覧画面の表示期間。
//
// 一覧画面は、これまで組織の全件を毎回読み込んでいた。記録が数年分たまると
// 表示が遅くなり、Firestore の無料枠（1日5万回の読み取り）にも近づく。
// 既定は直近3か月とし、必要なときに今年度・全期間へ広げる。
// 審査で過去の記録を見せるときは「全期間」を選べばよい。

export const PERIOD_OPTIONS = [
  { key: '3m', label: '直近3か月' },
  { key: 'fy', label: '今年度' },
  { key: '1y', label: '直近1年' },
  { key: 'all', label: '全期間' }
];

export const DEFAULT_PERIOD = '3m';

/**
 * 表示期間の開始日を返す（全期間なら null）。
 * 今年度は学校の年度に合わせて4月1日から。
 */
export const periodStartDate = (key, today = new Date()) => {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  switch (key) {
    case '3m':
      d.setMonth(d.getMonth() - 3);
      return d;
    case '1y':
      d.setFullYear(d.getFullYear() - 1);
      return d;
    case 'fy': {
      const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      return new Date(year, 3, 1);
    }
    case 'all':
    default:
      return null;
  }
};

export const periodLabel = (key) =>
  PERIOD_OPTIONS.find((o) => o.key === key)?.label || '全期間';
