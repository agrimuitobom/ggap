// src/services/inventoryService.js
// 資材（肥料・農薬）の在庫推定。
// マスタに登録した購入量から使用記録の合計を引いて残量を計算する。
// 単位は kg↔g、L↔ml の換算に対応。換算できない使用記録は集計から除外し、
// その場合は「概算」フラグを立てる。

// 基準単位への換算係数（質量: g、容量: ml）
const UNIT_FACTORS = {
  kg: { base: 'mass', factor: 1000 },
  g: { base: 'mass', factor: 1 },
  t: { base: 'mass', factor: 1000000 },
  L: { base: 'volume', factor: 1000 },
  ml: { base: 'volume', factor: 1 }
};

const convert = (amount, fromUnit, toUnit) => {
  const from = UNIT_FACTORS[fromUnit];
  const to = UNIT_FACTORS[toUnit];
  if (!from || !to || from.base !== to.base) return null;
  return (amount * from.factor) / to.factor;
};

/**
 * 肥料の在庫を計算
 * @param {Object} fertilizer - 肥料マスタ（purchaseAmount, purchaseUnit）
 * @param {Array} uses - その肥料の使用記録（amount, unit）
 * @returns {{used: number, remaining: number, ratio: number, approximate: boolean}|null}
 */
export const calcFertilizerStock = (fertilizer, uses) => {
  const purchaseAmount = Number(fertilizer.purchaseAmount);
  const purchaseUnit = fertilizer.purchaseUnit;
  if (!purchaseAmount || !purchaseUnit) return null;

  let used = 0;
  let approximate = false;
  uses.forEach((use) => {
    if (!use.amount) return;
    const converted = convert(Number(use.amount), use.unit || purchaseUnit, purchaseUnit);
    if (converted === null) {
      approximate = true;
      return;
    }
    used += converted;
  });

  const remaining = purchaseAmount - used;
  return {
    used,
    remaining,
    ratio: remaining / purchaseAmount,
    approximate
  };
};

/**
 * 農薬の在庫を計算（原液換算）
 * 使用記録の散布量は希釈後の液量のため、希釈倍率で割って原液量を推定する。
 * @param {Object} pesticide - 農薬マスタ（purchaseAmount, purchaseUnit）
 * @param {Array} uses - その農薬の使用記録（amount, unit, dilutionRate）
 */
export const calcPesticideStock = (pesticide, uses) => {
  const purchaseAmount = Number(pesticide.purchaseAmount);
  const purchaseUnit = pesticide.purchaseUnit;
  if (!purchaseAmount || !purchaseUnit) return null;

  let used = 0;
  let approximate = false;
  uses.forEach((use) => {
    if (!use.amount) return;
    // 希釈倍率がある場合は原液量に換算（散布量 ÷ 希釈倍率）
    const dilution = Number(use.dilutionRate);
    const rawAmount = dilution > 0 ? Number(use.amount) / dilution : Number(use.amount);
    if (!(dilution > 0)) approximate = true;

    const converted = convert(rawAmount, use.unit || purchaseUnit, purchaseUnit);
    if (converted === null) {
      approximate = true;
      return;
    }
    used += converted;
  });

  const remaining = purchaseAmount - used;
  return {
    used,
    remaining,
    ratio: remaining / purchaseAmount,
    // 原液換算は推定値のため常に概算扱い
    approximate: true
  };
};

/**
 * 在庫表示用のフォーマット（残量と警告レベル）
 */
export const formatStock = (stock, unit) => {
  if (!stock) return null;
  const remaining = Math.max(stock.remaining, 0);
  const display = `${Number(remaining.toFixed(2))} ${unit}`;
  let level = 'ok'; // ok | low | empty
  if (stock.remaining <= 0) level = 'empty';
  else if (stock.ratio <= 0.2) level = 'low';
  return { display, level, approximate: stock.approximate };
};
