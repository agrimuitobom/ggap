// src/services/fertilizerCalc.js
// 施肥量から成分量（N・P・K）を計算する。
//
// 液肥を希釈して灌水施肥する場合、記録に残る「6L」は原液の量であって
// 重量ではない。成分量を出すには次の順で換算する必要がある。
//
//   希釈後の量 → （÷ 希釈倍率）→ 原液の量 → （× 比重）→ 重量kg → （× 成分%）→ 成分kg
//
// 比重が未登録の液肥は重量に換算できないため、合計から除外して
// 「換算できなかった記録」として画面に出す（黙って0にしない）。

// 肥料の性状。液体は比重がないと重量に換算できない
export const FORM_TYPES = ['固形', '液体'];

// 使用量として入力した数値が何を指すか
export const AMOUNT_BASES = [
  { value: '原液', label: '原液（タンクに入れた量）' },
  { value: '希釈後', label: '希釈後の液（散布した量）' }
];

/** 液肥の比重の目安（kg/L）。未入力のときの参考値としてのみ使う */
export const DEFAULT_LIQUID_DENSITY = 1.2;

/**
 * 入力された使用量から「原液としての量」を求める。
 * 希釈後の量で入力されている場合だけ、希釈倍率で割る。
 */
export const toStockAmount = (amount, amountBasis, dilutionRatio) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  if (amountBasis !== '希釈後') return value;
  const ratio = Number(dilutionRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return value / ratio;
};

/**
 * 使用量を重量(kg)に換算する。
 * 換算できない場合は null を返す（袋・その他、比重未登録の液肥など）。
 * @param {number} amount 数量
 * @param {string} unit 単位
 * @param {number|null} density 比重 kg/L（液体のみ）
 */
export const toKilograms = (amount, unit, density) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;

  switch (unit) {
    case 'kg':
      return value;
    case 'g':
      return value / 1000;
    case 'L': {
      const d = Number(density);
      return Number.isFinite(d) && d > 0 ? value * d : null;
    }
    case 'ml': {
      const d = Number(density);
      return Number.isFinite(d) && d > 0 ? (value / 1000) * d : null;
    }
    default:
      // 袋・その他は1単位あたりの重量が分からないため換算しない
      return null;
  }
};

/**
 * 使用記録1件の成分量を求める。
 * @param {object} record 使用記録（amount, unit, amountBasis, dilutionRatio）
 * @param {object} fertilizer 肥料マスタ（nitrogenContent 等, density）
 * @returns {{stockAmount:number|null, massKg:number|null, n:number|null, p:number|null, k:number|null, reason:string}}
 */
export const calcNutrients = (record = {}, fertilizer = {}) => {
  const stockAmount = toStockAmount(record.amount, record.amountBasis, record.dilutionRatio);
  if (stockAmount === null) {
    return {
      stockAmount: null, massKg: null, n: null, p: null, k: null,
      reason: '希釈倍率が未入力のため原液量を計算できません'
    };
  }

  const massKg = toKilograms(stockAmount, record.unit, fertilizer.density);
  if (massKg === null) {
    const reason =
      record.unit === 'L' || record.unit === 'ml'
        ? '液肥の比重が未登録のため重量に換算できません'
        : `単位「${record.unit || '—'}」は重量に換算できません`;
    return { stockAmount, massKg: null, n: null, p: null, k: null, reason };
  }

  const pct = (v) => {
    const num = Number(v);
    return Number.isFinite(num) ? num : 0;
  };

  return {
    stockAmount,
    massKg,
    n: (massKg * pct(fertilizer.nitrogenContent)) / 100,
    p: (massKg * pct(fertilizer.phosphorusContent)) / 100,
    k: (massKg * pct(fertilizer.potassiumContent)) / 100,
    reason: ''
  };
};

/**
 * 母液（原液タンク）を希釈して施用した場合の成分量を求める。
 *
 *   希釈後の使用量 ÷ 希釈倍率 = 使った母液の量
 *   使った母液の量 ÷ 母液の全量 = 母液のうち使った割合
 *   各肥料製品の投入量 × その割合 = その施肥で消費した製品の量
 *   製品の量(kg) × 保証成分(%) = 成分量
 *
 * @param {object} record 施肥記録（amount, unit, dilutionRatio）
 * @param {object} solution 母液の調製記録（ingredients, totalVolume）
 * @param {object} fertilizerMap { fertilizerId: 肥料マスタ }
 */
export const calcFromStockSolution = (record = {}, solution = null, fertilizerMap = {}) => {
  const empty = { stockAmount: null, massKg: null, n: null, p: null, k: null, consumed: [] };

  if (!solution) {
    return { ...empty, reason: '母液の調製記録が見つかりません' };
  }
  const totalVolume = Number(solution.totalVolume);
  if (!Number.isFinite(totalVolume) || totalVolume <= 0) {
    return { ...empty, reason: '母液の全量(L)が未登録のため計算できません' };
  }

  const applied = Number(record.amount);
  const ratio = Number(record.dilutionRatio);
  if (!Number.isFinite(applied)) {
    return { ...empty, reason: '使用量が未入力です' };
  }
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { ...empty, reason: '希釈倍率が未入力のため母液の使用量を計算できません' };
  }

  // 使用量は L で記録されている前提。ml の場合だけ L に直す
  const appliedLiters = record.unit === 'ml' ? applied / 1000 : applied;
  const usedStockLiters = appliedLiters / ratio;
  const share = usedStockLiters / totalVolume;

  const nutrients = { n: 0, p: 0, k: 0 };
  const consumed = [];
  let massKg = 0;
  let unconvertible = null;

  (solution.ingredients || []).forEach((ing) => {
    const fertilizer = fertilizerMap[ing.fertilizerId] || {};
    const ingKg = toKilograms(ing.amount, ing.unit, fertilizer.density);
    if (ingKg === null) {
      unconvertible = `母液の材料「${ing.fertilizerName}」を重量に換算できません`;
      return;
    }
    const usedKg = ingKg * share;
    massKg += usedKg;
    consumed.push({
      fertilizerId: ing.fertilizerId,
      fertilizerName: ing.fertilizerName,
      usedKg
    });
    nutrients.n += (usedKg * (Number(fertilizer.nitrogenContent) || 0)) / 100;
    nutrients.p += (usedKg * (Number(fertilizer.phosphorusContent) || 0)) / 100;
    nutrients.k += (usedKg * (Number(fertilizer.potassiumContent) || 0)) / 100;
  });

  if (unconvertible) {
    return { ...empty, reason: unconvertible };
  }
  if (consumed.length === 0) {
    return { ...empty, reason: '母液に肥料が登録されていません' };
  }

  return {
    stockAmount: usedStockLiters,
    massKg,
    n: nutrients.n,
    p: nutrients.p,
    k: nutrients.k,
    consumed,
    reason: ''
  };
};

/**
 * 母液の調製で消費した肥料製品の量を、製品ごとに集計する。
 * 在庫計算で「母液を作った分」を引くために使う。
 */
export const stockSolutionConsumption = (solutions = []) => {
  const byFertilizer = {};
  solutions.forEach((s) => {
    (s.ingredients || []).forEach((ing) => {
      if (!ing.fertilizerId) return;
      if (!byFertilizer[ing.fertilizerId]) byFertilizer[ing.fertilizerId] = [];
      byFertilizer[ing.fertilizerId].push({ amount: ing.amount, unit: ing.unit });
    });
  });
  return byFertilizer;
};

/** 成分が1つも登録されていない肥料か（0%表示の原因を画面で説明するために使う） */
export const hasNoNutrientData = (fertilizer = {}) =>
  !Number(fertilizer.nitrogenContent) &&
  !Number(fertilizer.phosphorusContent) &&
  !Number(fertilizer.potassiumContent);

/**
 * 使用記録の一覧から、単位ごとの使用量合計と成分量合計を求める。
 * 単位をまたいで足すと意味のない数字になるため、単位別に集計する。
 */
export const summarizeUsage = (records = []) => {
  const byUnit = {};
  const nutrients = { n: 0, p: 0, k: 0 };
  const unconvertible = [];
  const missingNutrientNames = new Set();
  let convertedCount = 0;

  records.forEach((r) => {
    const unit = r.unit || '—';
    byUnit[unit] = (byUnit[unit] || 0) + (Number(r.amount) || 0);

    if (r.massKg === null || r.massKg === undefined) {
      unconvertible.push(r);
      return;
    }
    convertedCount += 1;
    nutrients.n += r.n || 0;
    nutrients.p += r.p || 0;
    nutrients.k += r.k || 0;
    if (r.hasNoNutrientData) missingNutrientNames.add(r.fertilizerName);
  });

  return {
    byUnit,
    nutrients,
    unconvertible,
    convertedCount,
    missingNutrientNames: Array.from(missingNutrientNames)
  };
};
