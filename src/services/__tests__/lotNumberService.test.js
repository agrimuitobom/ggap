// ロットIDの採番・候補・推測のテスト
import {
  toReiwaYear,
  lotPrefix,
  nextLotNumber,
  collectSelectableLots,
  suggestLotForField
} from '../lotNumberService';

// Firestore の Timestamp の代わり
const ts = (iso) => ({ toDate: () => new Date(iso) });

describe('令和の年とロットIDの接頭辞', () => {
  test('2026年は令和8年', () => {
    expect(toReiwaYear(new Date('2026-05-01'))).toBe(8);
    expect(lotPrefix('2026-05-01')).toBe('R8.');
  });

  test('令和元年は2019年', () => {
    expect(toReiwaYear(new Date('2019-06-01'))).toBe(1);
  });

  test('令和より前は扱わない', () => {
    expect(toReiwaYear(new Date('2018-12-31'))).toBeNull();
    expect(lotPrefix('2018-12-31')).toBe('');
  });
});

describe('次のロットID', () => {
  test('その年の最初は 01', () => {
    expect(nextLotNumber([], '2026-04-01')).toBe('R8.01');
  });

  test('同じ年の最大番号の次を使う', () => {
    expect(nextLotNumber(['R8.01', 'R8.03', 'R8.02'], '2026-06-01')).toBe('R8.04');
  });

  test('欠番があっても番号を使い回さない', () => {
    expect(nextLotNumber(['R8.01', 'R8.05'], '2026-06-01')).toBe('R8.06');
  });

  test('別の年のロットは数えない', () => {
    expect(nextLotNumber(['R7.12', 'R7.13'], '2026-01-10')).toBe('R8.01');
  });

  test('1桁で入力されたロットも番号として読む', () => {
    expect(nextLotNumber(['R8.2'], '2026-06-01')).toBe('R8.03');
  });
});

describe('定植・収穫で選べるロットの候補', () => {
  // 以前は方法が「直播・条播…」の記録しか候補にせず、作業日誌から作られた
  // 方法「その他」の記録が候補に出なかった
  test('方法が「その他」でもロットIDがあれば候補になる', () => {
    const lots = collectSelectableLots([
      { id: 'a', lotNumber: 'R8.04', method: 'その他', date: ts('2026-05-07') }
    ]);
    expect(lots.map((l) => l.lotNumber)).toEqual(['R8.04']);
  });

  test('同じロットの播種と定植は1件にまとめ、播種側を残す', () => {
    const lots = collectSelectableLots([
      { id: 'sow', lotNumber: 'R8.04', method: 'その他', date: ts('2026-05-07') },
      { id: 'tp', lotNumber: 'R8.04', method: '定植', date: ts('2026-05-28') }
    ]);
    expect(lots).toHaveLength(1);
    expect(lots[0].id).toBe('sow');
  });

  test('新しい順に並ぶ', () => {
    const lots = collectSelectableLots([
      { id: 'a', lotNumber: 'R8.01', method: '直播', date: ts('2026-04-01') },
      { id: 'b', lotNumber: 'R8.03', method: '直播', date: ts('2026-06-01') },
      { id: 'c', lotNumber: 'R8.02', method: '直播', date: ts('2026-05-01') }
    ]);
    expect(lots.map((l) => l.lotNumber)).toEqual(['R8.03', 'R8.02', 'R8.01']);
  });

  test('ロットIDの無い記録は候補にしない', () => {
    expect(collectSelectableLots([{ id: 'a', lotNumber: '', method: '直播', date: ts('2026-04-01') }]))
      .toHaveLength(0);
  });
});

describe('収穫した播種ロットの推測', () => {
  const uses = [
    { lotNumber: 'R8.01', method: '直播', fieldId: 'f1', date: ts('2026-04-01') },
    { lotNumber: 'R8.01', method: '定植', fieldId: 'f1', date: ts('2026-04-20') },
    { lotNumber: 'R8.02', method: '直播', fieldId: 'f1', date: ts('2026-05-01') },
    { lotNumber: 'R8.02', method: '定植', fieldId: 'f1', date: ts('2026-05-20') },
    { lotNumber: 'R8.09', method: '定植', fieldId: 'f2', date: ts('2026-05-25') }
  ];

  test('同じ圃場で、収穫日までに定植した直近のロット', () => {
    expect(suggestLotForField(uses, 'f1', '2026-06-10')).toBe('R8.02');
  });

  test('収穫日より後の定植は対象外', () => {
    expect(suggestLotForField(uses, 'f1', '2026-05-10')).toBe('R8.01');
  });

  test('別の圃場のロットは選ばない', () => {
    expect(suggestLotForField(uses, 'f2', '2026-06-10')).toBe('R8.09');
  });

  test('圃場が未選択なら推測しない', () => {
    expect(suggestLotForField(uses, '', '2026-06-10')).toBe('');
  });
});
