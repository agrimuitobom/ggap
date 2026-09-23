// 育苗中の判定、母液の残量、在庫計算のテスト
import { lotsInNursery, isNurseryCheckOverdue } from '../nurseryCheckService';
import { calcSolutionUsage, findActiveSolution } from '../stockSolutionService';
import { calcFertilizerStock, calcPesticideStock } from '../inventoryService';

jest.mock('../firebase', () => ({ db: {} }));

const ts = (iso) => ({ toDate: () => new Date(iso) });
const today = new Date('2026-06-15T12:00:00');

describe('育苗中のロット', () => {
  const uses = [
    { lotNumber: 'R8.05', method: 'その他', date: ts('2026-06-01') },
    { lotNumber: 'R8.04', method: '直播', date: ts('2026-05-20') },
    { lotNumber: 'R8.04', method: '定植', date: ts('2026-06-10') },
    { lotNumber: 'R8.01', method: '直播', date: ts('2026-01-10') }
  ];

  test('播種済みで未定植のロットだけ', () => {
    expect(lotsInNursery(uses, today).map((u) => u.lotNumber)).toEqual(['R8.05']);
  });

  test('育苗中のロットが無ければ観察の警告を出さない', () => {
    expect(isNurseryCheckOverdue([], [], today)).toBe(false);
  });

  test('育苗中なのに観察が無ければ警告', () => {
    expect(isNurseryCheckOverdue([], lotsInNursery(uses, today), today)).toBe(true);
  });

  test('7日以内に観察していれば警告しない', () => {
    expect(isNurseryCheckOverdue([{ date: '2026-06-12' }], lotsInNursery(uses, today), today)).toBe(false);
  });
});

describe('母液の残量', () => {
  test('母液そのままの使用量を引く', () => {
    const u = calcSolutionUsage({ totalVolume: 50 }, [{ amount: 10, unit: 'L' }, { amount: 6, unit: 'L' }]);
    expect(u.remaining).toBeCloseTo(34);
    expect(u.overdrawn).toBe(false);
  });

  test('作った量より多く使っていれば検出する', () => {
    const u = calcSolutionUsage({ totalVolume: 50 }, [{ amount: 58, unit: 'L' }]);
    expect(u.overdrawn).toBe(true);
  });

  test('その日に使っていた母液は、それ以前で最も新しい調製', () => {
    const solutions = [
      { id: 'a', preparedDate: '2026-04-01' },
      { id: 'b', preparedDate: '2026-05-27' },
      { id: 'c', preparedDate: '2026-07-01' }
    ];
    expect(findActiveSolution(solutions, '2026-06-10').id).toBe('b');
  });
});

describe('在庫', () => {
  test('肥料: 購入記録を合算して使用量を引く', () => {
    const stock = calcFertilizerStock(
      { purchaseAmount: 20, purchaseUnit: 'kg' },
      [{ amount: 5, unit: 'kg' }],
      [{ amount: 20, unit: 'kg' }]
    );
    expect(stock.remaining).toBeCloseTo(35);
  });

  test('農薬: 購入記録を合算し、散布量は希釈倍率で原液に直す', () => {
    const stock = calcPesticideStock(
      { purchaseAmount: 500, purchaseUnit: 'ml' },
      [{ amount: 100, unit: 'L', dilutionRate: 1000 }],
      [{ amount: 500, unit: 'ml' }]
    );
    // 購入 1000ml − 散布100L÷1000 = 100ml → 900ml
    expect(stock.remaining).toBeCloseTo(900);
  });
});
