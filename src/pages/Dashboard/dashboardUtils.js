// src/pages/Dashboard/dashboardUtils.js
// ダッシュボードの集計・判定ロジック（Firestoreに依存しない純粋関数）。

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

export const EXPIRY_WARNING_DAYS = 30;
export const DRAFT_COUNT_LIMIT = 100;

/** Firestoreのタイムスタンプ・Date・文字列のいずれも Date に変換（不正値は null） */
export const toDate = (value) => {
  if (!value) return null;
  const date = value.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);

/** 数量を単位ごとに合計し、多い順に返す → [{ unit, total }] */
export const sumByUnit = (records) => {
  const totals = {};
  records.forEach((record) => {
    const quantity = Number(record.quantity);
    if (!Number.isFinite(quantity) || quantity === 0) return;
    const unit = record.unit || 'kg';
    totals[unit] = (totals[unit] || 0) + quantity;
  });
  return Object.entries(totals)
    .map(([unit, total]) => ({ unit, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
};

/** 農薬の有効期限を「期限切れ」「期限間近」に分類 */
export const classifyPesticideExpiry = (pesticides, now = new Date()) => {
  const today = startOfDay(now);
  const limit = new Date(today.getTime() + EXPIRY_WARNING_DAYS * MS_PER_DAY);
  const expired = [];
  const expiring = [];
  pesticides.forEach((pesticide) => {
    const expiryDate = toDate(pesticide.expiryDate);
    if (!expiryDate) return;
    const item = { id: pesticide.id, name: pesticide.name || '名称未設定', expiryDate };
    if (expiryDate < today) expired.push(item);
    else if (expiryDate <= limit) expiring.push(item);
  });
  expired.sort((a, b) => a.expiryDate - b.expiryDate);
  expiring.sort((a, b) => a.expiryDate - b.expiryDate);
  return { expired, expiring };
};

/** 校正・点検が未実施、または次回予定日を過ぎている機器 */
export const findOverdueEquipments = (equipments, checks, now = new Date()) => {
  const lastByEquipment = {};
  checks.forEach((check) => {
    const date = toDate(check.date);
    if (!date || !check.equipmentId) return;
    if (!lastByEquipment[check.equipmentId] || lastByEquipment[check.equipmentId] < date) {
      lastByEquipment[check.equipmentId] = date;
    }
  });
  return equipments.filter((equipment) => {
    const last = lastByEquipment[equipment.id];
    if (!last) return true;
    if (!equipment.intervalDays) return false;
    return new Date(last.getTime() + equipment.intervalDays * MS_PER_DAY) < now;
  });
};

/** 水源ごとの最新の検査で、次回検査予定日を過ぎているもの */
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

/** 最新の自己点検の状況（実施からの経過日数・是正処置が未記入の不適合数） */
export const summarizeSelfAssessments = (assessments, now = new Date()) => {
  const dated = assessments
    .map((assessment) => ({ ...assessment, startedAt: toDate(assessment.startedAt) }))
    .filter((assessment) => assessment.startedAt)
    .sort((a, b) => b.startedAt - a.startedAt);
  const latest = dated[0] || null;
  if (!latest) return { latest: null, daysSince: null, openNonConformities: 0 };
  const openNonConformities = (latest.items || []).filter(
    (item) => item.status === '不適合' && !(item.correctiveAction || '').trim()
  ).length;
  return { latest, daysSince: daysBetween(latest.startedAt, now), openNonConformities };
};

const namesPreview = (items, getName = (item) => item.name) => {
  const names = items.slice(0, 3).map(getName).join('、');
  return items.length > 3 ? `${names} ほか` : names;
};

const formatShortDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;

// 表示順: 重大 → 注意 → お知らせ
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

/**
 * 集計済みデータから「要対応」リストを組み立てる。
 * 取得に失敗した項目（null）は判定せずに読み飛ばす。
 * @returns {Array<{id, severity, title, detail, to, action}>}
 */
export const buildAlerts = (data, now = new Date()) => {
  const alerts = [];

  if (data.pesticides) {
    const { expired, expiring } = classifyPesticideExpiry(data.pesticides, now);
    if (expired.length > 0) {
      alerts.push({
        id: 'pesticide-expired',
        severity: 'critical',
        title: `有効期限切れの農薬が${expired.length}件`,
        detail: `${namesPreview(expired)}。期限切れ農薬の使用は審査で不適合になります。`,
        to: '/pesticides',
        action: '確認する'
      });
    }
    if (expiring.length > 0) {
      alerts.push({
        id: 'pesticide-expiring',
        severity: 'warning',
        title: `${EXPIRY_WARNING_DAYS}日以内に期限が切れる農薬が${expiring.length}件`,
        detail: namesPreview(expiring, (p) => `${p.name}（${formatShortDate(p.expiryDate)}まで）`),
        to: '/pesticides',
        action: '確認する'
      });
    }
  }

  if (data.openComplaints && data.openComplaints.length > 0) {
    alerts.push({
      id: 'complaints-open',
      severity: 'critical',
      title: `対応中の苦情が${data.openComplaints.length}件`,
      detail: '原因と対応内容を記録して完了させてください。',
      to: '/complaints',
      action: '対応する'
    });
  }

  if (data.overdueWaterTests && data.overdueWaterTests.length > 0) {
    alerts.push({
      id: 'water-overdue',
      severity: 'warning',
      title: `水質検査の予定日を過ぎた水源が${data.overdueWaterTests.length}件`,
      detail: namesPreview(data.overdueWaterTests, (t) => t.waterSourceName || '名称未設定'),
      to: '/water',
      action: '記録する'
    });
  }

  if (data.overdueEquipments && data.overdueEquipments.length > 0) {
    alerts.push({
      id: 'equipment-overdue',
      severity: 'warning',
      title: `校正・点検が必要な機器が${data.overdueEquipments.length}件`,
      detail: namesPreview(data.overdueEquipments),
      to: '/equipment',
      action: '記録する'
    });
  }

  if (data.draftCount > 0) {
    const countLabel = data.draftCount >= DRAFT_COUNT_LIMIT ? `${DRAFT_COUNT_LIMIT}件以上` : `${data.draftCount}件`;
    alerts.push({
      id: 'drafts',
      severity: 'warning',
      title: `要追記の作業記録が${countLabel}`,
      detail: 'GGAPの記録として完成させるため、詳細を追記してください。',
      to: '/work-logs',
      action: '一覧へ'
    });
  }

  if (data.cleaning && data.cleaning.total > 0 && data.cleaning.done < data.cleaning.total) {
    alerts.push({
      id: 'cleaning-today',
      severity: 'info',
      title: `今日の清掃チェックが残り${data.cleaning.total - data.cleaning.done}件`,
      detail: `${data.cleaning.done}/${data.cleaning.total}件 完了`,
      to: '/cleaning',
      action: '記録する'
    });
  }

  if (data.selfAssessment) {
    const { latest, daysSince, openNonConformities } = data.selfAssessment;
    if (openNonConformities > 0) {
      alerts.push({
        id: 'self-assessment-nonconform',
        severity: 'warning',
        title: `是正処置が未記入の不適合が${openNonConformities}件`,
        detail: `自己点検「${latest.title || '無題'}」`,
        to: `/self-assessments/${latest.id}`,
        action: '記入する'
      });
    }
    if (!latest || daysSince > DAYS_PER_YEAR) {
      alerts.push({
        id: 'self-assessment-due',
        severity: 'info',
        title: latest ? '自己点検から1年以上が経過' : '自己点検がまだ実施されていません',
        detail: '年1回以上の自己点検と記録の保存が求められます。',
        to: '/self-assessments',
        action: '実施する'
      });
    }
  }

  if (data.lastRecallTestDate !== undefined) {
    const last = data.lastRecallTestDate;
    if (!last || daysBetween(last, now) > DAYS_PER_YEAR) {
      alerts.push({
        id: 'recall-test-due',
        severity: 'info',
        title: last ? '模擬回収テストから1年以上が経過' : '模擬回収テストがまだ実施されていません',
        detail: '年1回以上のトレーサビリティテストが求められます。',
        to: '/complaints',
        action: '実施する'
      });
    }
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
};
