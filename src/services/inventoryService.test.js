import { calcFertilizerStock, calcPesticideStock, findLowStock } from './inventoryService';

describe('findLowStock', () => {
  it('在庫切れ・残り2割以下の資材だけを返し、購入量が未登録のものは除外する', () => {
    const fertilizers = [
      { id: 'ok', name: '十分', purchaseAmount: 10, purchaseUnit: 'kg' },
      { id: 'low', name: '少ない', purchaseAmount: 10, purchaseUnit: 'kg' },
      { id: 'empty', name: '切れ', purchaseAmount: 1, purchaseUnit: 'kg' },
      { id: 'unknown', name: '購入量なし' }
    ];
    const uses = [
      { fertilizerId: 'ok', amount: 2, unit: 'kg' },
      { fertilizerId: 'low', amount: 8500, unit: 'g' },
      { fertilizerId: 'empty', amount: 1.2, unit: 'kg' },
      { fertilizerId: 'unknown', amount: 5, unit: 'kg' }
    ];
    expect(findLowStock(fertilizers, uses, 'fertilizerId', calcFertilizerStock)).toEqual([
      { id: 'low', name: '少ない', level: 'low', display: '1.5 kg' },
      { id: 'empty', name: '切れ', level: 'empty', display: '0 kg' }
    ]);
  });

  it('農薬は希釈倍率で原液量に換算する', () => {
    const pesticides = [{ id: 'p', name: '農薬', purchaseAmount: 500, purchaseUnit: 'ml' }];
    // 1000倍希釈で450L散布 → 原液450ml使用 → 残り50ml（1割）
    const uses = [{ pesticideId: 'p', amount: 450, unit: 'L', dilutionRate: 1000 }];
    expect(findLowStock(pesticides, uses, 'pesticideId', calcPesticideStock)).toEqual([
      { id: 'p', name: '農薬', level: 'low', display: '50 ml' }
    ]);
  });
});
