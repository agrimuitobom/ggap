// src/services/phiService.js
// PHI（Pre-Harvest Interval: 収穫前日数）チェック。
// 指定圃場の直近の農薬散布記録と、農薬マスタの収穫前日数を突き合わせ、
// 収穫予定日がPHI期間内にある場合は警告情報を返す。
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { firestoreLogger } from '../utils/logger';

// 散布記録をさかのぼって確認する日数（一般的なPHIは最長でも90日程度）
const LOOKBACK_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * 指定圃場・収穫日に対するPHI違反をチェック
 * @param {string} organizationId - 組織ID
 * @param {string} fieldId - 圃場ID
 * @param {Date} harvestDate - 収穫（予定）日
 * @returns {Promise<{violations: Array, unchecked: Array}>}
 *   violations: PHI期間内の散布（収穫不可）
 *   unchecked: 直近に散布があるがPHI未登録のためチェックできなかった農薬
 */
export const checkPreHarvestInterval = async (organizationId, fieldId, harvestDate) => {
  const result = { violations: [], unchecked: [] };
  if (!organizationId || !fieldId || !harvestDate) return result;

  try {
    const harvestDay = startOfDay(harvestDate);
    const lookbackStart = new Date(harvestDay.getTime() - LOOKBACK_DAYS * MS_PER_DAY);

    const usesQuery = query(
      collection(db, 'pesticideUses'),
      where('organizationId', '==', organizationId),
      where('fieldId', '==', fieldId)
    );
    const snapshot = await getDocs(usesQuery);

    const recentUses = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((use) => {
        const useDate = use.date?.toDate ? use.date.toDate() : use.date ? new Date(use.date) : null;
        if (!useDate) return false;
        const useDay = startOfDay(useDate);
        return useDay >= lookbackStart && useDay <= harvestDay;
      });

    if (recentUses.length === 0) return result;

    // 農薬マスタからPHIを取得（同じ農薬の重複取得を避ける）
    const pesticideIds = [...new Set(recentUses.map((u) => u.pesticideId).filter(Boolean))];
    const pesticideMap = {};
    await Promise.all(
      pesticideIds.map(async (pesticideId) => {
        const snap = await getDoc(doc(db, 'pesticides', pesticideId));
        if (snap.exists()) {
          pesticideMap[pesticideId] = snap.data();
        }
      })
    );

    recentUses.forEach((use) => {
      const useDate = startOfDay(use.date?.toDate ? use.date.toDate() : new Date(use.date));
      const pesticide = use.pesticideId ? pesticideMap[use.pesticideId] : null;
      const phi = pesticide?.preHarvestInterval;
      const name = use.pesticideName || pesticide?.name || '不明な農薬';

      if (phi === undefined || phi === null || phi === '') {
        result.unchecked.push({ pesticideName: name, useDate });
        return;
      }

      const okFrom = new Date(useDate.getTime() + Number(phi) * MS_PER_DAY);
      if (harvestDay < okFrom) {
        result.violations.push({
          pesticideName: name,
          useDate,
          phi: Number(phi),
          okFrom
        });
      }
    });

    // 同じ農薬の警告が複数出る場合は最も遅いokFromだけ残す
    const seen = {};
    result.violations.forEach((v) => {
      if (!seen[v.pesticideName] || seen[v.pesticideName].okFrom < v.okFrom) {
        seen[v.pesticideName] = v;
      }
    });
    result.violations = Object.values(seen).sort((a, b) => b.okFrom - a.okFrom);

    const seenUnchecked = new Set();
    result.unchecked = result.unchecked.filter((u) => {
      if (seenUnchecked.has(u.pesticideName)) return false;
      seenUnchecked.add(u.pesticideName);
      return true;
    });

    return result;
  } catch (err) {
    firestoreLogger.error('PHIチェックの実行エラー', { organizationId, fieldId }, err);
    // チェック失敗時は警告を出さない（記録自体は妨げない）
    return result;
  }
};
