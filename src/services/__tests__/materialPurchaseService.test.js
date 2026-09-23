// 資材の重複判定と有効期限のテスト
import { findDuplicates, latestExpiry, purchasesOf } from '../materialPurchaseService';

jest.mock('../firebase', () => ({ db: {} }));

const ts = (iso) => ({ toDate: () => new Date(iso) });

describe('重複した登録の判定', () => {
  test('肥料: 名前と製造元が同じなら重複（空白・大文字小文字は無視）', () => {
    const groups = findDuplicates('fertilizer', [
      { id: 'a', name: 'M2号', manufacturer: 'X社' },
      { id: 'b', name: 'M2 号', manufacturer: 'x社' },
      { id: 'c', name: 'Mk1号', manufacturer: 'X社' }
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  test('農薬: 登録番号が同じなら名前が違っても重複', () => {
    const groups = findDuplicates('pesticide', [
      { id: 'a', name: '農薬A', registrationNumber: '12345' },
      { id: 'b', name: '農薬Ａ（新）', registrationNumber: '12345' }
    ]);
    expect(groups).toHaveLength(1);
  });

  test('種子: 品種が違えば別物', () => {
    const groups = findDuplicates('seed', [
      { id: 'a', name: 'サラダ菜', variety: 'バイオサラダ' },
      { id: 'b', name: 'サラダ菜', variety: '岡山サラダ' }
    ]);
    expect(groups).toHaveLength(0);
  });

  test('古い登録が先頭（統合先の候補）になる', () => {
    const groups = findDuplicates('fertilizer', [
      { id: 'new', name: 'M2号', purchaseDate: ts('2026-04-01') },
      { id: 'old', name: 'M2号', purchaseDate: ts('2025-04-01') }
    ]);
    expect(groups[0][0].id).toBe('old');
  });
});

describe('農薬の有効期限', () => {
  const master = { id: 'p1', expiryDate: ts('2026-03-31') };

  test('買い直したロットがあれば、最も遅い期限で判定する', () => {
    const d = latestExpiry('pesticide', master, [
      { pesticideId: 'p1', expiryDate: '2028-03-31' }
    ]);
    expect(d.getFullYear()).toBe(2028);
  });

  test('他の農薬の購入記録は含めない', () => {
    const d = latestExpiry('pesticide', master, [
      { pesticideId: 'other', expiryDate: '2030-01-01' }
    ]);
    expect(d.getFullYear()).toBe(2026);
  });

  test('期限が1つも無ければ null', () => {
    expect(latestExpiry('pesticide', { id: 'p1' }, [])).toBeNull();
  });

  test('マスタの旧方式の購入情報も購入の1件として数える', () => {
    const entries = purchasesOf('pesticide', { id: 'p1', purchaseAmount: 500, purchaseUnit: 'ml' }, []);
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBe(500);
  });
});
