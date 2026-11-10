// src/pages/Dashboard/useDashboardData.js
// 管理者ダッシュボードのデータ取得。
// 各クエリを並列に実行し、一部が失敗しても残りは表示できるようにする。
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getCleaningItems, getDayCheck, isItemApplicable, toDateKey } from '../../services/cleaningService';
import { getSelfAssessments } from '../../services/selfAssessmentService';
import { calcFertilizerStock, calcPesticideStock, findLowStock } from '../../services/inventoryService';
import { uiLogger } from '../../utils/logger';
import { findOverdueEquipments, findOverdueWaterTests } from '../../utils/complianceChecks';
import {
  DRAFT_COUNT_LIMIT,
  toDate,
  startOfMonth,
  sumByUnit,
  buildMonthlyTrend,
  TREND_MONTHS,
  findFieldsInPhi,
  summarizeSelfAssessments
} from './dashboardUtils';

const RECENT_LIMIT = 5;

const toRecords = (snapshot, dateField) =>
  snapshot.docs.map((d) => ({ id: d.id, ...d.data(), date: toDate(d.data()[dateField]) }));

const fetchDashboardData = async (orgId, now) => {
  const monthStart = startOfMonth(now);
  const trendStart = new Date(now.getFullYear(), now.getMonth() - (TREND_MONTHS - 1), 1);
  const inOrg = (name, ...constraints) =>
    getDocs(query(collection(db, name), where('organizationId', '==', orgId), ...constraints));
  const recent = (name, dateField) =>
    inOrg(name, orderBy(dateField, 'desc'), limit(RECENT_LIMIT)).then((s) => toRecords(s, dateField));
  const since = (name, dateField, start) =>
    inOrg(name, where(dateField, '>=', start), orderBy(dateField, 'desc')).then((s) => toRecords(s, dateField));
  const all = (name) => inOrg(name).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));

  // 複数の集計で使うものは1回だけ取得して共有する
  const pesticides = all('pesticides');
  const pesticideUses = all('pesticideUses');

  // キー名 → 取得処理。失敗したキーは null になり、該当箇所だけ「取得できませんでした」と表示する。
  const tasks = {
    recentWorkLogs: recent('workLogs', 'date'),
    recentHarvests: recent('harvests', 'harvestDate'),
    recentShipments: recent('shipments', 'shipmentDate'),
    recentTrainings: recent('trainings', 'trainingDate'),
    recentVisitors: recent('visitors', 'visitDate'),
    monthWorkLogs: since('workLogs', 'date', monthStart),
    // 推移グラフ用に直近数か月分を取得し、今月分はここから絞り込む
    trendHarvests: since('harvests', 'harvestDate', trendStart),
    trendShipments: since('shipments', 'shipmentDate', trendStart),
    draftCount: inOrg('workLogs', where('isDraft', '==', true), limit(DRAFT_COUNT_LIMIT)).then((s) => s.size),
    pesticides,
    fieldsInPhi: Promise.all([pesticideUses, pesticides]).then(
      ([uses, list]) => findFieldsInPhi(uses, list, now)
    ),
    lowStock: Promise.all([pesticides, pesticideUses, all('fertilizers'), all('fertilizerUses')]).then(
      ([pesticideList, pesticideUseList, fertilizers, fertilizerUses]) => [
        ...findLowStock(pesticideList, pesticideUseList, 'pesticideId', calcPesticideStock)
          .map((item) => ({ ...item, kind: 'pesticide' })),
        ...findLowStock(fertilizers, fertilizerUses, 'fertilizerId', calcFertilizerStock)
          .map((item) => ({ ...item, kind: 'fertilizer' }))
      ]
    ),
    cleaning: Promise.all([getCleaningItems(orgId), getDayCheck(orgId, toDateKey(now))]).then(
      ([items, checked]) => {
        const applicable = items.filter((item) => isItemApplicable(item, now));
        return {
          total: applicable.length,
          done: applicable.filter((item) => checked.includes(item.id)).length
        };
      }
    ),
    overdueEquipments: Promise.all([all('equipments'), all('equipmentChecks')]).then(
      ([equipments, checks]) => findOverdueEquipments(equipments, checks, now)
    ),
    overdueWaterTests: all('waterTests').then((tests) => findOverdueWaterTests(tests, now)),
    openComplaints: all('complaints').then((list) => list.filter((c) => c.status && c.status !== '対応済み')),
    lastRecallTestDate: all('recallTests').then((list) => {
      const dates = list.map((t) => toDate(t.date)).filter(Boolean);
      return dates.length > 0 ? new Date(Math.max(...dates)) : null;
    }),
    selfAssessment: getSelfAssessments(orgId).then((list) => summarizeSelfAssessments(list, now))
  };

  const keys = Object.keys(tasks);
  const results = await Promise.allSettled(Object.values(tasks));
  const data = {};
  const failedKeys = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      data[keys[i]] = result.value;
    } else {
      data[keys[i]] = null;
      failedKeys.push(keys[i]);
      uiLogger.error('Error fetching dashboard data', { component: 'Dashboard', key: keys[i] }, result.reason);
    }
  });

  const inThisMonth = (records) => records && records.filter((record) => record.date && record.date >= monthStart);
  data.monthHarvests = inThisMonth(data.trendHarvests);
  data.monthShipments = inThisMonth(data.trendShipments);

  return {
    ...data,
    trend:
      data.trendHarvests && data.trendShipments
        ? buildMonthlyTrend(data.trendHarvests, data.trendShipments, now)
        : null,
    monthSummary: {
      workLogCount: data.monthWorkLogs ? data.monthWorkLogs.length : null,
      harvestCount: data.monthHarvests ? data.monthHarvests.length : null,
      harvestTotals: data.monthHarvests ? sumByUnit(data.monthHarvests) : null,
      shipmentCount: data.monthShipments ? data.monthShipments.length : null,
      shipmentTotals: data.monthShipments ? sumByUnit(data.monthShipments) : null
    },
    failedKeys,
    fetchedAt: now
  };
};

/**
 * @param {string|undefined} organizationId
 * @param {boolean} enabled - false の間は取得しない（管理者以外など）
 */
const useDashboardData = (organizationId, enabled = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!organizationId || !enabled) {
      setData(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchDashboardData(organizationId, new Date())
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // 組織の切り替え時に、古い組織の結果で上書きしないようにする
    return () => {
      cancelled = true;
    };
  }, [organizationId, enabled, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, loading, reload };
};

export default useDashboardData;
