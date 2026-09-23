// 作業日誌から作る関連記録の組み立てのテスト。
// 作業日誌の更新で「関連記録の側でだけ入力した値」を上書きしないことを確かめる。
import { buildRelatedRecords } from '../workLogRelatedService';

jest.mock('../firebase', () => ({ db: {} }));

const base = {
  date: '2026-06-03',
  fieldId: 'f1',
  workers: ['w1', 'w2']
};
const users = [
  { id: 'w1', name: '石川 雅人' },
  { id: 'w2', name: '野田 昇吾' }
];

describe('施肥', () => {
  const records = buildRelatedRecords({
    formData: { ...base, workType: '施肥', fertilizerId: 'mk1', fertilizerAmount: '10', fertilizerUnit: 'L' },
    workLogId: 'log1',
    selectedField: { name: 'サラダ菜温室' },
    users,
    fertilizers: [{ id: 'mk1', name: 'Mk1号' }]
  });

  test('施肥記録だけが作られる', () => {
    expect(records.fertilizerUses).not.toBeNull();
    expect(records.seedUses).toBeNull();
    expect(records.pesticideUses).toBeNull();
  });

  test('作業日誌の更新で母液の紐づけを上書きしない', () => {
    const owned = records.fertilizerUses.owned;
    ['sourceType', 'stockSolutionId', 'dilutionRatio', 'amountBasis', 'notes'].forEach((key) => {
      expect(owned).not.toHaveProperty(key);
    });
  });

  test('施用者は組織名ではなく担当者', () => {
    expect(records.fertilizerUses.owned.appliedByName).toBe('石川 雅人、野田 昇吾');
  });
});

describe('担当者が未入力', () => {
  test('記録した人を施用者にする', () => {
    const records = buildRelatedRecords({
      formData: { ...base, workers: [], workType: '施肥', fertilizerId: 'mk1' },
      workLogId: 'log1',
      users,
      fertilizers: [{ id: 'mk1', name: 'Mk1号' }],
      fallbackName: '野田 昇吾'
    });
    expect(records.fertilizerUses.owned.appliedByName).toBe('野田 昇吾');
  });
});

describe('播種', () => {
  const records = buildRelatedRecords({
    formData: { ...base, workType: '播種', seedId: 's1', seedAmount: '300', seedMethod: '直播', lotNumber: ' R8.06 ' },
    workLogId: 'log2',
    users,
    seeds: [{ id: 's1', name: 'サラダ菜', variety: 'バイオサラダ' }]
  });

  test('ロットIDを前後の空白なしで残す', () => {
    expect(records.seedUses.owned.lotNumber).toBe('R8.06');
  });

  test('病害虫の記録は作るときだけ入れ、更新では上書きしない', () => {
    expect(records.seedUses.owned).not.toHaveProperty('pestStatus');
    expect(records.seedUses.createOnly.pestStatus).toBe('なし');
  });
});

describe('定植', () => {
  test('選んだ播種ロットから種子を引き継ぐ', () => {
    const records = buildRelatedRecords({
      formData: { ...base, workType: '定植', lotNumber: 'R8.04' },
      workLogId: 'log3',
      users,
      seedUses: [
        { lotNumber: 'R8.04', method: '定植', seedId: 'x', seedName: '古い定植' },
        { lotNumber: 'R8.04', method: 'その他', seedId: 's1', seedName: 'サラダ菜 (バイオサラダ)' }
      ]
    });
    expect(records.seedUses.owned.method).toBe('定植');
    expect(records.seedUses.owned.seedId).toBe('s1');
  });

  test('ロットを選んでいなければ記録を作らない', () => {
    const records = buildRelatedRecords({
      formData: { ...base, workType: '定植', lotNumber: '' },
      workLogId: 'log3'
    });
    expect(records.seedUses).toBeNull();
  });
});

describe('防除', () => {
  test('保護具の確認など農薬記録の側の値は上書きしない', () => {
    const records = buildRelatedRecords({
      formData: { ...base, workType: '防除', pesticideId: 'p1', dilutionRate: '1000' },
      workLogId: 'log4',
      pesticides: [{ id: 'p1', name: '農薬A' }]
    });
    expect(records.pesticideUses.owned).not.toHaveProperty('ppeUsed');
    expect(records.pesticideUses.owned.dilutionRate).toBe(1000);
  });
});

describe('作業の種類を変えたとき', () => {
  test('合わなくなった記録は null（同期でゴミ箱へ移される）', () => {
    const records = buildRelatedRecords({
      formData: { ...base, workType: '清掃' },
      workLogId: 'log5'
    });
    expect(records).toEqual({ fertilizerUses: null, seedUses: null, pesticideUses: null });
  });
});
