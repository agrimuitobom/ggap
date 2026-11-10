import {
  sumByUnit,
  classifyPesticideExpiry,
  findOverdueEquipments,
  findOverdueWaterTests,
  summarizeSelfAssessments,
  buildAlerts
} from './dashboardUtils';

const NOW = new Date(2026, 10, 10, 9, 0); // 2026-11-10
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const ts = (date) => ({ toDate: () => date }); // Firestoreタイムスタンプの代用

describe('sumByUnit', () => {
  it('単位ごとに合計し、多い順に並べる', () => {
    expect(sumByUnit([
      { quantity: 2.5, unit: 'kg' },
      { quantity: '10', unit: '袋' },
      { quantity: 1.25, unit: 'kg' },
      { quantity: 3 },
      { quantity: 'abc', unit: 'kg' }
    ])).toEqual([{ unit: '袋', total: 10 }, { unit: 'kg', total: 6.75 }]);
  });
});

describe('classifyPesticideExpiry', () => {
  it('期限切れと30日以内を分類し、期限なし・余裕ありは除外する', () => {
    const { expired, expiring } = classifyPesticideExpiry([
      { id: 'a', name: 'A', expiryDate: ts(daysAgo(1)) },
      { id: 'b', name: 'B', expiryDate: ts(daysAgo(-10)) },
      { id: 'c', name: 'C', expiryDate: ts(daysAgo(-60)) },
      { id: 'd', name: 'D' }
    ], NOW);
    expect(expired.map((p) => p.id)).toEqual(['a']);
    expect(expiring.map((p) => p.id)).toEqual(['b']);
  });
});

describe('findOverdueEquipments', () => {
  it('未実施・予定日超過の機器だけを返す', () => {
    const equipments = [
      { id: 'never', name: '未実施', intervalDays: 180 },
      { id: 'late', name: '超過', intervalDays: 30 },
      { id: 'ok', name: '実施済み', intervalDays: 180 },
      { id: 'noInterval', name: '間隔なし', intervalDays: null }
    ];
    const checks = [
      { equipmentId: 'late', date: ts(daysAgo(200)) },
      { equipmentId: 'late', date: ts(daysAgo(45)) },
      { equipmentId: 'ok', date: ts(daysAgo(10)) },
      { equipmentId: 'noInterval', date: ts(daysAgo(900)) }
    ];
    expect(findOverdueEquipments(equipments, checks, NOW).map((e) => e.id)).toEqual(['never', 'late']);
  });
});

describe('findOverdueWaterTests', () => {
  it('水源ごとの最新の検査だけで判定する', () => {
    const tests = [
      // 古い検査は予定日超過だが、新しい検査で解消済み
      { waterSourceId: 's1', waterSourceName: '井戸', testDate: ts(daysAgo(400)), nextTestDate: ts(daysAgo(35)) },
      { waterSourceId: 's1', waterSourceName: '井戸', testDate: ts(daysAgo(30)), nextTestDate: ts(daysAgo(-335)) },
      { waterSourceId: 's2', waterSourceName: '水道', testDate: ts(daysAgo(380)), nextTestDate: ts(daysAgo(15)) }
    ];
    expect(findOverdueWaterTests(tests, NOW).map((t) => t.waterSourceName)).toEqual(['水道']);
  });
});

describe('summarizeSelfAssessments', () => {
  it('最新の点検について、是正処置が未記入の不適合を数える', () => {
    const summary = summarizeSelfAssessments([
      { id: 'old', startedAt: ts(daysAgo(500)), items: [{ status: '不適合' }] },
      {
        id: 'new',
        startedAt: ts(daysAgo(20)),
        items: [
          { status: '不適合', correctiveAction: '' },
          { status: '不適合', correctiveAction: '対応済み' },
          { status: '適合' }
        ]
      }
    ], NOW);
    expect(summary.latest.id).toBe('new');
    expect(summary.daysSince).toBe(20);
    expect(summary.openNonConformities).toBe(1);
  });

  it('記録がなければ latest は null', () => {
    expect(summarizeSelfAssessments([], NOW).latest).toBeNull();
  });
});

describe('buildAlerts', () => {
  const clean = {
    pesticides: [],
    openComplaints: [],
    overdueWaterTests: [],
    overdueEquipments: [],
    draftCount: 0,
    cleaning: { total: 5, done: 5 },
    selfAssessment: { latest: { id: 'x' }, daysSince: 10, openNonConformities: 0 },
    lastRecallTestDate: daysAgo(10)
  };

  it('問題がなければ空', () => {
    expect(buildAlerts(clean, NOW)).toEqual([]);
  });

  it('重大 → 注意 → 確認 の順に並べる', () => {
    const alerts = buildAlerts({
      ...clean,
      pesticides: [{ id: 'a', name: 'A', expiryDate: ts(daysAgo(1)) }],
      draftCount: 100,
      cleaning: { total: 5, done: 2 },
      lastRecallTestDate: null
    }, NOW);
    expect(alerts.map((a) => a.id)).toEqual(['pesticide-expired', 'drafts', 'cleaning-today', 'recall-test-due']);
    expect(alerts[1].title).toContain('100件以上');
  });

  it('取得に失敗した項目（null / undefined）は判定しない', () => {
    expect(buildAlerts({
      pesticides: null,
      openComplaints: null,
      overdueWaterTests: null,
      overdueEquipments: null,
      draftCount: null,
      cleaning: null,
      selfAssessment: null
    }, NOW)).toEqual([]);
  });
});
