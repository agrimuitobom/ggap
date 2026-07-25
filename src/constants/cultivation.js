// src/constants/cultivation.js
// 栽培方式の定義。圃場（fields.cultivationType）に持たせ、
// 入力項目や養分管理の考え方を方式ごとに切り替えるために使う。
//
// - 水耕 / 養液土耕: 養分は「養液（EC・pH・給液量）」で管理する
// - 土耕: 養分は「施肥（肥料量 × 成分%）」で管理する

export const CULTIVATION_TYPES = ['水耕', '養液土耕', '土耕'];

// 培地を使う（＝土壌タイプを持たない）方式
export const SOILLESS_TYPES = ['水耕', '養液土耕'];

// 水耕で使われる代表的な培地
export const SUBSTRATES = [
  'ウレタンスポンジ',
  'ロックウール',
  'ヤシガラ',
  'パーライト',
  '培地なし（湛液・NFT）',
  'その他'
];

/** 培地を使う方式か（水耕・養液土耕） */
export const isSoillessType = (cultivationType) =>
  SOILLESS_TYPES.includes(cultivationType);

/** 土壌タイプの入力が必要な方式か（土耕・養液土耕） */
export const needsSoilTypeInput = (cultivationType) =>
  cultivationType === '土耕' || cultivationType === '養液土耕';

/** 養液（EC・pH）管理の対象となる方式か */
export const usesNutrientSolution = (cultivationType) =>
  isSoillessType(cultivationType);
