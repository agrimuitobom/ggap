import { findActiveNav, NAV_SECTIONS } from './navigation';

describe('findActiveNav', () => {
  it('ホームは "/" のみに一致する', () => {
    expect(findActiveNav('/').item.to).toBe('/');
  });

  it('一覧・登録・編集のいずれでも同じ項目を返す', () => {
    expect(findActiveNav('/harvests').item.to).toBe('/harvests');
    expect(findActiveNav('/harvests/new').item.to).toBe('/harvests');
    expect(findActiveNav('/harvests/edit/abc').item.to).toBe('/harvests');
  });

  it('入れ子のパスは最も長く一致した項目を返す', () => {
    expect(findActiveNav('/work-logs/calendar').item.to).toBe('/work-logs/calendar');
    expect(findActiveNav('/work-logs/quick').item.to).toBe('/work-logs');
    expect(findActiveNav('/reports/mass-balance').item.to).toBe('/reports/mass-balance');
    expect(findActiveNav('/reports').item.to).toBe('/reports');
  });

  it('接頭辞が似た別の画面と混同しない', () => {
    expect(findActiveNav('/fertilizer-uses/new').item.to).toBe('/fertilizer-uses');
    expect(findActiveNav('/fertilizers/new').item.to).toBe('/fertilizers');
    expect(findActiveNav('/seed-uses').item.to).toBe('/seed-uses');
  });

  it('match で指定した別パスも同じ項目として扱う', () => {
    expect(findActiveNav('/field-inspections/edit/1').item.to).toBe('/field-inspections/new');
    expect(findActiveNav('/field-inspections/edit/1').section.id).toBe('cultivation');
  });

  it('未定義のパスは null を返す', () => {
    expect(findActiveNav('/no-such-page')).toBeNull();
  });

  it('メニュー項目のリンク先は重複しない', () => {
    const all = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.to));
    expect(new Set(all).size).toBe(all.length);
  });
});
