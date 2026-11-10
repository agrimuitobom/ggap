// src/pages/Dashboard/dashboardUtils.js
// ダッシュボードの集計・判定ロジック（Firestoreに依存しない純粋関数）。

import { toDate } from '../../utils/complianceChecks';

export { toDate };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

export const EXPIRY_WARNING_DAYS = 30;
export const DRAFT_COUNT_LIMIT = 100;

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

export const TREND_MONTHS = 6;

/**
 * 直近の月ごとの収穫量・出荷量を集計する（グラフ用）。
 * 単位の違う数量は足せないため、収穫記録で最も多く使われている単位だけを集計し、
 * それ以外の単位の記録があれば hasOtherUnits で知らせる。
 * @returns {{unit: string|null, rows: Array<{key, label, harvest, shipment}>, hasOtherUnits: boolean}}
 */
export const buildMonthlyTrend = (harvests, shipments, now = new Date(), months = TREND_MONTHS) => {
  const rows = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    rows.push({
      key: `${month.getFullYear()}-${month.getMonth() + 1}`,
      label: `${month.getMonth() + 1}月`,
      harvest: 0,
      shipment: 0
    });
  }
  const rowByKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  const inRange = (record) => record.date && rowByKey[`${record.date.getFullYear()}-${record.date.getMonth() + 1}`];
  const unitOf = (record) => record.unit || 'kg';
  const hasQuantity = (record) => Number.isFinite(Number(record.quantity)) && Number(record.quantity) !== 0;

  const usable = (records) => records.filter((record) => inRange(record) && hasQuantity(record));
  const harvestRecords = usable(harvests);
  const shipmentRecords = usable(shipments);

  // 最も多く記録に使われている単位（収穫を優先し、収穫がなければ出荷から決める）
  const unitCounts = {};
  (harvestRecords.length > 0 ? harvestRecords : shipmentRecords).forEach((record) => {
    unitCounts[unitOf(record)] = (unitCounts[unitOf(record)] || 0) + 1;
  });
  const unit = Object.keys(unitCounts).sort((a, b) => unitCounts[b] - unitCounts[a])[0] || null;

  let hasOtherUnits = false;
  const add = (records, field) => {
    records.forEach((record) => {
      if (unitOf(record) !== unit) {
        hasOtherUnits = true;
        return;
      }
      inRange(record)[field] += Number(record.quantity);
    });
  };
  add(harvestRecords, 'harvest');
  add(shipmentRecords, 'shipment');
  rows.forEach((row) => {
    row.harvest = Math.round(row.harvest * 100) / 100;
    row.shipment = Math.round(row.shipment * 100) / 100;
  });

  return { unit, rows, hasOtherUnits };
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

// 散布記録をさかのぼる日数（phiService と同じ）
const PHI_LOOKBACK_DAYS = 90;

/**
 * 収穫前日数（PHI）の期間中で、まだ収穫できない圃場を返す。
 * 判定は phiService.checkPreHarvestInterval と同じ（散布日 + PHI日数 より前は収穫不可）。
 * @returns {Array<{fieldId, fieldName, pesticideName, okFrom: Date}>} 収穫可能日が近い順
 */
export const findFieldsInPhi = (pesticideUses, pesticides, now = new Date()) => {
  const today = startOfDay(now);
  const lookbackStart = new Date(today.getTime() - PHI_LOOKBACK_DAYS * MS_PER_DAY);
  const pesticideById = {};
  pesticides.forEach((pesticide) => {
    pesticideById[pesticide.id] = pesticide;
  });

  const byField = {};
  pesticideUses.forEach((use) => {
    const useDate = toDate(use.date);
    if (!useDate || !use.fieldId) return;
    const useDay = startOfDay(useDate);
    if (useDay < lookbackStart || useDay > today) return;
    const pesticide = pesticideById[use.pesticideId];
    const phi = pesticide?.preHarvestInterval;
    if (phi === undefined || phi === null || phi === '') return;
    const okFrom = new Date(useDay.getTime() + Number(phi) * MS_PER_DAY);
    if (!(today < okFrom)) return;
    if (!byField[use.fieldId] || byField[use.fieldId].okFrom < okFrom) {
      byField[use.fieldId] = {
        fieldId: use.fieldId,
        fieldName: use.fieldName || '名称未設定の圃場',
        pesticideName: use.pesticideName || pesticide.name || '不明な農薬',
        okFrom
      };
    }
  });
  return Object.values(byField).sort((a, b) => a.okFrom - b.okFrom);
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

  if (data.fieldsInPhi && data.fieldsInPhi.length > 0) {
    alerts.push({
      id: 'phi-active',
      severity: 'warning',
      title: `農薬散布後でまだ収穫できない圃場が${data.fieldsInPhi.length}件`,
      detail: namesPreview(data.fieldsInPhi, (f) => `${f.fieldName}（${formatShortDate(f.okFrom)}から収穫可）`),
      to: '/pesticide-uses',
      action: '確認する'
    });
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

  if (data.lowStock) {
    // 在庫は購入量と使用記録からの推定値
    const describe = (item) => `${item.name}（残り${item.display}）`;
    const linkFor = (items) => (items.some((item) => item.kind === 'pesticide') ? '/pesticides' : '/fertilizers');
    const empty = data.lowStock.filter((item) => item.level === 'empty');
    const low = data.lowStock.filter((item) => item.level === 'low');
    if (empty.length > 0) {
      alerts.push({
        id: 'stock-empty',
        severity: 'warning',
        title: `在庫切れ（推定）の資材が${empty.length}件`,
        detail: `${namesPreview(empty)}。購入した場合は資材マスタの購入量を更新してください。`,
        to: linkFor(empty),
        action: '確認する'
      });
    }
    if (low.length > 0) {
      alerts.push({
        id: 'stock-low',
        severity: 'info',
        title: `在庫が残り2割以下（推定）の資材が${low.length}件`,
        detail: namesPreview(low, describe),
        to: linkFor(low),
        action: '確認する'
      });
    }
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
