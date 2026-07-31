// src/services/biodiversityService.js
// 生物多様性モニタリング（定期観察）の記録。
//
// 生物多様性計画の「5.1 定期観察（年2回）」「5.2 データベース化・経年変化の追跡」
// に対応する。1回の調査を1レコードとし、その中に観察した種を並べて持つ。
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { moveToTrash } from './trashService';

// 計画書の区分（3.1〜3.3）に合わせた調査エリア
export const SURVEY_AREAS = [
  '温室内',
  '温室周辺',
  '実習畑・果樹園',
  '緑地帯・未利用地',
  'その他'
];

// 観察対象の分類（植物、昆虫、鳥類等）
export const SPECIES_CATEGORIES = [
  { key: '植物', icon: '🌿' },
  { key: '昆虫', icon: '🦋' },
  { key: '鳥類', icon: '🐦' },
  { key: 'その他の動物', icon: '🐸' }
];

// 個体数を正確に数えにくい場合の目安
export const ABUNDANCE_LEVELS = ['多い', '普通', '少ない'];

export const WEATHER_OPTIONS = ['晴れ', '曇り', '雨'];

const toDate = (value) => (value?.toDate ? value.toDate() : value ? new Date(value) : null);

/** 調査の一覧を取得（新しい順） */
export const getBiodiversitySurveys = async (organizationId) => {
  const snapshot = await getDocs(query(
    collection(db, 'biodiversitySurveys'),
    where('organizationId', '==', organizationId)
  ));
  const list = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    surveyDate: toDate(d.data().surveyDate)
  }));
  list.sort((a, b) => (b.surveyDate?.getTime() || 0) - (a.surveyDate?.getTime() || 0));
  return list;
};

/** 調査を1件取得 */
export const getBiodiversitySurvey = async (id) => {
  const snap = await getDoc(doc(db, 'biodiversitySurveys', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: snap.id, ...data, surveyDate: toDate(data.surveyDate) };
};

/** 調査を保存（新規 or 更新） */
export const saveBiodiversitySurvey = async (organizationId, surveyId, form) => {
  const data = {
    organizationId,
    surveyDate: form.surveyDate ? new Date(`${form.surveyDate}T00:00:00`) : new Date(),
    area: form.area,
    weather: form.weather || '',
    surveyorNames: form.surveyorNames || '',
    // 観察した種のリスト（分類・種名・個体数・多度・メモ）
    observations: form.observations || [],
    notes: form.notes || '',
    recordedByName: form.recordedByName || '',
    updatedAt: serverTimestamp()
  };
  if (surveyId) {
    await updateDoc(doc(db, 'biodiversitySurveys', surveyId), data);
    return surveyId;
  }
  const ref = await addDoc(collection(db, 'biodiversitySurveys'), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
};

/** 調査を削除 */
export const deleteBiodiversitySurvey = async (id, organizationId, deletedByName) => {
  // すぐには消さず、ゴミ箱へ移して一定期間戻せるようにする
  await moveToTrash('biodiversitySurveys', id, organizationId, deletedByName);
};

/**
 * 年度（4月始まり）を求める。
 * 学校の年度に合わせ、1〜3月は前年の年度として扱う。
 */
export const fiscalYearOf = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
};

/**
 * 年度ごとに、分類別の確認種数と調査回数を集計する。
 * 経年変化（種数が増えたか減ったか）を追うために使う。
 */
export const aggregateByFiscalYear = (surveys) => {
  const years = {};

  surveys.forEach((s) => {
    const fy = fiscalYearOf(s.surveyDate);
    if (fy == null) return;
    if (!years[fy]) {
      years[fy] = {
        fiscalYear: fy,
        surveyCount: 0,
        totalIndividuals: 0,
        speciesByCategory: {},
        areas: new Set()
      };
    }
    const y = years[fy];
    y.surveyCount += 1;
    if (s.area) y.areas.add(s.area);

    (s.observations || []).forEach((o) => {
      if (!o.speciesName) return;
      const cat = o.category || 'その他の動物';
      if (!y.speciesByCategory[cat]) y.speciesByCategory[cat] = new Set();
      // 同じ種を複数回・複数エリアで観察しても1種として数える
      y.speciesByCategory[cat].add(o.speciesName.trim());
      y.totalIndividuals += Number(o.count) || 0;
    });
  });

  return Object.values(years)
    .map((y) => {
      const counts = {};
      let total = 0;
      SPECIES_CATEGORIES.forEach((c) => {
        const n = y.speciesByCategory[c.key]?.size || 0;
        counts[c.key] = n;
        total += n;
      });
      return {
        fiscalYear: y.fiscalYear,
        surveyCount: y.surveyCount,
        areaCount: y.areas.size,
        totalIndividuals: y.totalIndividuals,
        speciesCounts: counts,
        totalSpecies: total
      };
    })
    .sort((a, b) => b.fiscalYear - a.fiscalYear);
};

/** これまでに記録した種名の一覧（入力候補に使い、表記ゆれを防ぐ） */
export const collectSpeciesNames = (surveys) => {
  const names = new Set();
  surveys.forEach((s) => {
    (s.observations || []).forEach((o) => {
      if (o.speciesName) names.add(o.speciesName.trim());
    });
  });
  return [...names].sort();
};

/** CSV書き出し（1行1観察。経年変化の分析に使う） */
export const buildBiodiversityCsv = (surveys) => {
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headers = [
    'survey_id', 'fiscal_year', 'survey_date', 'area', 'weather', 'surveyors',
    'category', 'species_name', 'count', 'abundance', 'observation_note'
  ];
  const rows = [];
  surveys.forEach((s) => {
    const d = s.surveyDate;
    const dateStr = d
      ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
      : '';
    const base = [s.id, fiscalYearOf(d) ?? '', dateStr, s.area || '', s.weather || '', s.surveyorNames || ''];
    if (!s.observations || s.observations.length === 0) {
      rows.push([...base, '', '', '', '', '']);
      return;
    }
    s.observations.forEach((o) => {
      rows.push([...base, o.category || '', o.speciesName || '', o.count ?? '', o.abundance || '', o.note || '']);
    });
  });
  return '﻿' + [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
};
