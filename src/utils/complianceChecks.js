// src/utils/complianceChecks.js
// 期限・実施状況の判定（Firestoreに依存しない純粋関数）。
// 各管理画面とダッシュボードで同じ基準を使うため、ここに集約する。

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Firestoreのタイムスタンプ・Date・文字列のいずれも Date に変換（不正値は null） */
export const toDate = (value) => {
  if (!value) return null;
  const date = value.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * 機器ごとの最終実施日・次回予定日・要実施かどうかを返す。
 * 一度も実施していない機器、次回予定日を過ぎた機器を「要実施」とする。
 * @returns {Array} 機器 + { last: Date|null, nextDue: Date|null, overdue: boolean }
 */
export const getEquipmentStatus = (equipments, checks, now = new Date()) => {
  const lastByEquipment = {};
  checks.forEach((check) => {
    const date = toDate(check.date);
    if (!date || !check.equipmentId) return;
    if (!lastByEquipment[check.equipmentId] || lastByEquipment[check.equipmentId] < date) {
      lastByEquipment[check.equipmentId] = date;
    }
  });
  return equipments.map((equipment) => {
    const last = lastByEquipment[equipment.id] || null;
    const nextDue =
      last && equipment.intervalDays ? new Date(last.getTime() + equipment.intervalDays * MS_PER_DAY) : null;
    return { ...equipment, last, nextDue, overdue: !last || Boolean(nextDue && nextDue < now) };
  });
};

/** 校正・点検が未実施、または次回予定日を過ぎている機器 */
export const findOverdueEquipments = (equipments, checks, now = new Date()) =>
  getEquipmentStatus(equipments, checks, now).filter((equipment) => equipment.overdue);

/**
 * 水源ごとの最新の検査で、次回検査予定日を過ぎているもの。
 * 古い検査の予定日が過ぎていても、その後に検査していれば対象外。
 */
export const findOverdueWaterTests = (tests, now = new Date()) => {
  const latestBySource = {};
  tests.forEach((test) => {
    const testDate = toDate(test.testDate);
    const key = test.waterSourceId || test.waterSourceName;
    if (!testDate || !key) return;
    if (!latestBySource[key] || latestBySource[key].testDate < testDate) {
      latestBySource[key] = { ...test, testDate };
    }
  });
  return Object.values(latestBySource).filter((test) => {
    const next = toDate(test.nextTestDate);
    return next && next < startOfDay(now);
  });
};
