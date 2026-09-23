// 施肥量から成分量を求める計算のテスト
import {
  toKilograms,
  toStockAmount,
  calcNutrients,
  calcFromStockSolution,
  summarizeUsage
} from '../fertilizerCalc';

describe('重量への換算', () => {
  test('kg と g', () => {
    expect(toKilograms(2, 'kg')).toBe(2);
    expect(toKilograms(500, 'g')).toBe(0.5);
  });

  test('L は比重を掛ける', () => {
    expect(toKilograms(10, 'L', 1.2)).toBeCloseTo(12);
  });

  test('比重が無い液体は換算しない（0 にしない）', () => {
    expect(toKilograms(10, 'L')).toBeNull();
  });

  test('袋は換算しない', () => {
    expect(toKilograms(1, '袋')).toBeNull();
  });
});

describe('原液量', () => {
  test('希釈後の量は倍率で割る', () => {
    expect(toStockAmount(100, '希釈後', 100)).toBe(1);
  });

  test('原液ならそのまま', () => {
    expect(toStockAmount(6, '原液', 100)).toBe(6);
  });

  test('希釈後なのに倍率が無ければ計算しない', () => {
    expect(toStockAmount(100, '希釈後', '')).toBeNull();
  });
});

describe('肥料を直接施用したときの成分量', () => {
  test('重量 × 保証成分%', () => {
    const r = calcNutrients(
      { amount: 10, unit: 'kg' },
      { nitrogenContent: 10, phosphorusContent: 8, potassiumContent: 6 }
    );
    expect(r.n).toBeCloseTo(1);
    expect(r.p).toBeCloseTo(0.8);
    expect(r.k).toBeCloseTo(0.6);
  });

  test('換算できないときは理由を返す', () => {
    const r = calcNutrients({ amount: 10, unit: 'L' }, { nitrogenContent: 10 });
    expect(r.massKg).toBeNull();
    expect(r.reason).toMatch(/比重/);
  });
});

describe('母液を使ったときの成分量', () => {
  const fertilizerMap = { mk1: { nitrogenContent: 10, phosphorusContent: 0, potassiumContent: 20 } };
  const solution = {
    totalVolume: 50,
    ingredients: [{ fertilizerId: 'mk1', fertilizerName: 'Mk1号', amount: 7.5, unit: 'kg' }]
  };

  test('母液そのままの量（倍率なし）は1倍として計算する', () => {
    // 10L / 50L = 20% → 7.5kg × 20% = 1.5kg → N 10% = 0.15kg
    const r = calcFromStockSolution({ amount: 10, unit: 'L' }, solution, fertilizerMap);
    expect(r.stockAmount).toBeCloseTo(10);
    expect(r.massKg).toBeCloseTo(1.5);
    expect(r.n).toBeCloseTo(0.15);
    expect(r.k).toBeCloseTo(0.3);
  });

  test('希釈後の量は倍率で割ってから按分する', () => {
    const r = calcFromStockSolution({ amount: 1000, unit: 'L', dilutionRatio: 100 }, solution, fertilizerMap);
    expect(r.stockAmount).toBeCloseTo(10);
    expect(r.n).toBeCloseTo(0.15);
  });

  test('母液の全量が無いと計算しない', () => {
    const r = calcFromStockSolution({ amount: 10, unit: 'L' }, { ...solution, totalVolume: 0 }, fertilizerMap);
    expect(r.massKg).toBeNull();
  });
});

describe('単位をまたいで合計しない', () => {
  // 以前は L と kg を足して「876kg」と表示していた
  test('単位ごとに集計する', () => {
    const s = summarizeUsage([
      { unit: 'L', amount: 10, massKg: 1, n: 0.1, p: 0, k: 0 },
      { unit: 'kg', amount: 2, massKg: 2, n: 0.2, p: 0, k: 0 }
    ]);
    expect(s.byUnit).toEqual({ L: 10, kg: 2 });
    expect(s.nutrients.n).toBeCloseTo(0.3);
  });

  test('換算できない記録は成分量に含めず、別に数える', () => {
    const s = summarizeUsage([{ unit: '袋', amount: 1, massKg: null }]);
    expect(s.unconvertible).toHaveLength(1);
    expect(s.nutrients.n).toBe(0);
  });
});
