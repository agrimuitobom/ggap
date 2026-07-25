// src/services/researchService.js
// 研究用の集計とCSV書き出し。
//
// 作付（処理区）を単位に、収量・廃棄率・労働時間・EC実績を集計する。
// 反復（同じ処理区の複数区画）をまたいで平均と標準偏差を出すことで、
// グラフにエラーバーを付けられる形にする。
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { DISCARD_REASONS, normalizeDiscardCounts } from '../constants/discardReasons';
import { getPlantings } from './plantingService';

const toDateStr = (date) => {
  if (!date) return '';
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const toDate = (value) => (value?.toDate ? value.toDate() : value ? new Date(value) : null);

/** 平均（値が無ければ null） */
const mean = (values) => {
  const nums = values.filter((v) => v != null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
};

/** 標本標準偏差（n-1）。反復が1つだけなら null */
const stdDev = (values) => {
  const nums = values.filter((v) => v != null && !Number.isNaN(v));
  if (nums.length < 2) return null;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((s, v) => s + (v - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
};

/** 研究に使う記録をまとめて取得する */
export const fetchResearchData = async (organizationId) => {
  const [plantings, harvestSnap, workLogSnap, nutrientSnap] = await Promise.all([
    getPlantings(organizationId),
    getDocs(query(collection(db, 'harvests'), where('organizationId', '==', organizationId))),
    getDocs(query(collection(db, 'workLogs'), where('organizationId', '==', organizationId))),
    getDocs(query(collection(db, 'nutrientLogs'), where('organizationId', '==', organizationId)))
  ]);

  const harvests = harvestSnap.docs.map((d) => ({
    id: d.id, ...d.data(), harvestDate: toDate(d.data().harvestDate)
  }));
  const workLogs = workLogSnap.docs.map((d) => ({
    id: d.id, ...d.data(), date: toDate(d.data().date)
  }));
  const nutrientLogs = nutrientSnap.docs.map((d) => ({
    id: d.id, ...d.data(), date: toDate(d.data().date)
  }));

  return { plantings, harvests, workLogs, nutrientLogs };
};

/**
 * 作付1件ごとの集計値を計算する。
 * 反復をまたぐ平均・標準偏差は、この値を使って求める。
 */
export const summarizePlanting = (planting, { harvests, workLogs, nutrientLogs }) => {
  const myHarvests = harvests.filter((h) => h.plantingId === planting.id);
  const myWorkLogs = workLogs.filter((w) => w.plantingId === planting.id);
  const myNutrient = nutrientLogs.filter((n) => n.plantingId === planting.id);

  // 収穫の集計
  let marketableWeight = 0;
  let totalPlants = 0;
  let discardedPlants = 0;
  const discardByReason = DISCARD_REASONS.reduce((acc, r) => ({ ...acc, [r.key]: 0 }), {});

  myHarvests.forEach((h) => {
    marketableWeight += Number(h.quantity) || 0;
    totalPlants += Number(h.totalPlants) || 0;
    discardedPlants += Number(h.discardedPlants) || 0;
    const counts = normalizeDiscardCounts(h.discardReasons || {});
    DISCARD_REASONS.forEach((r) => { discardByReason[r.key] += counts[r.key]; });
  });

  const marketablePlants = totalPlants > 0 ? totalPlants - discardedPlants : 0;
  const discardRate = totalPlants > 0 ? (discardedPlants / totalPlants) * 100 : null;

  // 理由別の廃棄率（総株数に対する割合）
  const discardRateByReason = {};
  DISCARD_REASONS.forEach((r) => {
    discardRateByReason[r.key] = totalPlants > 0
      ? (discardByReason[r.key] / totalPlants) * 100
      : null;
  });

  const plotArea = Number(planting.plotArea) || 0;
  const yieldPerArea = plotArea > 0 && marketableWeight > 0 ? marketableWeight / plotArea : null;
  // 1株あたり平均重量(g)。可販重量はkg想定
  const weightPerPlant = marketablePlants > 0 && marketableWeight > 0
    ? (marketableWeight * 1000) / marketablePlants
    : null;

  // 労働（延べ人時）
  const laborHours = myWorkLogs.reduce(
    (sum, w) => sum + (Number(w.laborHours) || Number(w.workHours) || 0), 0
  );
  const laborPerArea = plotArea > 0 && laborHours > 0 ? laborHours / plotArea : null;

  // EC実績
  const ecValues = myNutrient.map((n) => Number(n.ec)).filter((v) => !Number.isNaN(v) && v > 0);
  const ecMean = mean(ecValues);

  return {
    planting,
    harvestCount: myHarvests.length,
    marketableWeight,
    totalPlants,
    marketablePlants,
    discardedPlants,
    discardByReason,
    discardRate,
    discardRateByReason,
    yieldPerArea,
    weightPerPlant,
    laborHours,
    laborPerArea,
    ecMean,
    ecCount: ecValues.length,
    targetEc: planting.targetEc ?? null
  };
};

/**
 * 処理区ごとに、反復をまたいだ平均と標準偏差を求める。
 * 平均±標準偏差がそのままグラフのエラーバーになる。
 */
export const aggregateByTreatment = (plantingSummaries) => {
  const groups = {};
  plantingSummaries.forEach((s) => {
    const key = s.planting.treatment || '未設定';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  return Object.entries(groups).map(([treatment, items]) => {
    const pick = (fn) => items.map(fn);
    const stat = (values) => ({ mean: mean(values), sd: stdDev(values), n: values.filter((v) => v != null).length });

    const reasonStats = {};
    DISCARD_REASONS.forEach((r) => {
      reasonStats[r.key] = stat(pick((s) => s.discardRateByReason[r.key]));
    });

    return {
      treatment,
      replicates: items.length,
      totalMarketableWeight: items.reduce((sum, s) => sum + s.marketableWeight, 0),
      totalPlants: items.reduce((sum, s) => sum + s.totalPlants, 0),
      totalDiscarded: items.reduce((sum, s) => sum + s.discardedPlants, 0),
      discardRate: stat(pick((s) => s.discardRate)),
      yieldPerArea: stat(pick((s) => s.yieldPerArea)),
      weightPerPlant: stat(pick((s) => s.weightPerPlant)),
      laborPerArea: stat(pick((s) => s.laborPerArea)),
      totalLaborHours: items.reduce((sum, s) => sum + s.laborHours, 0),
      ecMean: stat(pick((s) => s.ecMean)),
      targetEc: items[0]?.targetEc ?? null,
      reasonStats,
      items
    };
  }).sort((a, b) => a.treatment.localeCompare(b.treatment));
};

// ---- CSV 書き出し ----
// 出力ルール: 日付は YYYY-MM-DD、数値セルに単位を書かない（単位は列名に含める）、
// セル結合なし、UTF-8 BOM付き（Excelでの文字化け防止）

const escapeCell = (value) => {
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const buildCsv = (headers, rows) => {
  const lines = [headers.join(',')];
  rows.forEach((row) => lines.push(row.map(escapeCell).join(',')));
  return '﻿' + lines.join('\n');
};

export const downloadCsv = (filename, content) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

/** plantings.csv */
export const buildPlantingsCsv = (plantings) => buildCsv(
  ['planting_id', 'field', 'crop', 'variety', 'crop_cycle', 'treatment', 'replicate', 'block',
    'plot_area_m2', 'plant_count', 'target_ec', 'target_n_g_m2', 'sowing_date', 'planting_date', 'status'],
  plantings.map((p) => [
    p.id, p.fieldName, p.cropName, p.variety, p.cropCycle, p.treatment, p.replicate, p.block,
    p.plotArea, p.plantCount, p.targetEc, p.targetNitrogen,
    toDateStr(p.sowingDate), toDateStr(p.plantingDate), p.status
  ])
);

/** harvests.csv（1行1収穫記録） */
export const buildHarvestsCsv = (harvests, plantings) => {
  const byId = {};
  plantings.forEach((p) => { byId[p.id] = p; });
  return buildCsv(
    ['harvest_id', 'planting_id', 'treatment', 'replicate', 'block', 'field', 'crop', 'harvest_date',
      'total_plants', 'marketable_plants', 'discarded_plants', 'discard_rate_percent',
      'marketable_weight', 'weight_unit', 'lot_number',
      ...DISCARD_REASONS.map((r) => `discard_${r.key}`)],
    harvests.map((h) => {
      const p = h.plantingId ? byId[h.plantingId] : null;
      const counts = normalizeDiscardCounts(h.discardReasons || {});
      const total = Number(h.totalPlants) || 0;
      const discarded = Number(h.discardedPlants) || 0;
      return [
        h.id, h.plantingId || '', p?.treatment || h.treatment || '', p?.replicate ?? '', p?.block ?? '',
        h.fieldName, h.cropName, toDateStr(h.harvestDate),
        h.totalPlants ?? '', h.marketablePlants ?? '', h.discardedPlants ?? '',
        total > 0 ? ((discarded / total) * 100).toFixed(2) : '',
        h.quantity ?? '', h.unit || '', h.lotNumber || '',
        ...DISCARD_REASONS.map((r) => counts[r.key])
      ];
    })
  );
};

/** labor.csv（1行1作業記録） */
export const buildLaborCsv = (workLogs, plantings) => {
  const byId = {};
  plantings.forEach((p) => { byId[p.id] = p; });
  return buildCsv(
    ['worklog_id', 'planting_id', 'treatment', 'replicate', 'field', 'date', 'work_type',
      'work_hours', 'worker_count', 'labor_hours'],
    workLogs.map((w) => {
      const p = w.plantingId ? byId[w.plantingId] : null;
      return [
        w.id, w.plantingId || '', p?.treatment || '', p?.replicate ?? '',
        w.fieldName, toDateStr(w.date), w.workType,
        w.workHours ?? '', w.workerCount ?? (w.workers?.length || ''), w.laborHours ?? ''
      ];
    })
  );
};

/** nutrient.csv（1行1測定。水耕では養分投入の実績にあたる） */
export const buildNutrientCsv = (nutrientLogs, plantings) => {
  const byId = {};
  plantings.forEach((p) => { byId[p.id] = p; });
  return buildCsv(
    ['log_id', 'planting_id', 'treatment', 'replicate', 'field', 'date',
      'ec_ms_cm', 'target_ec_ms_cm', 'ph', 'water_temp_c', 'replenish_l', 'out_of_range'],
    nutrientLogs.map((n) => {
      const p = n.plantingId ? byId[n.plantingId] : null;
      return [
        n.id, n.plantingId || '', p?.treatment || n.treatment || '', p?.replicate ?? '',
        n.fieldName, toDateStr(n.date),
        n.ec ?? '', n.targetEc ?? p?.targetEc ?? '', n.ph ?? '', n.waterTemp ?? '',
        n.replenishAmount ?? '', n.outOfRange ? 1 : 0
      ];
    })
  );
};
