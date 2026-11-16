// src/components/Layout/navigation.js
// サイドバー・ヘッダーのページ名・ボトムナビが共有するナビゲーション定義。
// 画面を追加したときはここに1行足すだけでメニューとページ名の両方に反映される。

// Heroicons (outline) のパス
export const ICON_PATHS = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  daily: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  cultivation: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  materials: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10',
  harvest: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  safety: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  people: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  reports: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  worklog: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 18L18 6M6 6l12 12',
  chevronDown: 'M19 9l-7 7-7-7',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  organization: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
};

// match: 項目の to 以外にも、この項目を「現在地」として扱うパスの接頭辞
export const NAV_SECTIONS = [
  {
    id: 'daily',
    label: '毎日の記録',
    icon: 'daily',
    items: [
      { to: '/work-logs', label: '作業日誌' },
      { to: '/work-logs/calendar', label: '作業カレンダー' },
      { to: '/cleaning', label: '清掃チェック' },
      { to: '/nutrient-logs', label: '養液管理記録' }
    ]
  },
  {
    id: 'cultivation',
    label: '栽培・圃場',
    icon: 'cultivation',
    items: [
      { to: '/plantings', label: '作付・処理区' },
      { to: '/fields', label: '圃場' },
      { to: '/field-inspections/new', label: '圃場点検記録', match: ['/field-inspections'] },
      { to: '/seeds', label: '種子・苗' },
      { to: '/seed-uses', label: '播種・定植記録' }
    ]
  },
  {
    id: 'materials',
    label: '肥料・農薬',
    icon: 'materials',
    items: [
      { to: '/fertilizers', label: '肥料' },
      { to: '/fertilizer-uses', label: '施肥記録' },
      { to: '/pesticides', label: '農薬' },
      { to: '/pesticide-uses', label: '農薬使用記録' },
      { to: '/material-disposals', label: '保管・廃棄記録' }
    ]
  },
  {
    id: 'harvest',
    label: '収穫・出荷',
    icon: 'harvest',
    items: [
      { to: '/harvests', label: '収穫記録' },
      { to: '/shipments', label: '出荷記録' }
    ]
  },
  {
    id: 'safety',
    label: '衛生・安全管理',
    icon: 'safety',
    items: [
      { to: '/water', label: '水源・水質管理' },
      { to: '/self-assessments', label: '自己点検' },
      { to: '/incidents', label: '事故・ヒヤリハット' },
      { to: '/equipment', label: '機器の校正・点検' },
      { to: '/complaints', label: '苦情・回収テスト' },
      { to: '/visitors', label: '訪問者記録' },
      { to: '/trainings', label: '教育・訓練記録' }
    ]
  },
  {
    id: 'reports',
    label: 'レポート・分析',
    icon: 'reports',
    items: [
      { to: '/reports', label: 'レポート一覧' },
      { to: '/reports/pesticide-usage', label: '農薬使用記録簿' },
      { to: '/reports/fertilizer-usage', label: '肥料使用記録簿' },
      { to: '/reports/mass-balance', label: 'マスバランス照合' },
      { to: '/reports/traceability', label: 'トレーサビリティ' },
      { to: '/reports/training', label: '教育・訓練記録簿' },
      { to: '/reports/business-analytics', label: '経営分析' }
    ]
  },
  {
    id: 'people',
    label: '従業員・組織',
    icon: 'people',
    items: [
      { to: '/workers', label: '従業員' },
      { to: '/groups', label: 'グループ' },
      { to: '/organizations/switch', label: '組織の切り替え' },
      { to: '/organizations/settings', label: '組織設定' },
      { to: '/organizations/invitations', label: '招待一覧', badge: 'invitations' }
    ]
  }
];

export const HOME_ITEM = { to: '/', label: 'ホーム', icon: 'home' };

const matchLength = (pathname, prefix) => {
  if (pathname === prefix) return prefix.length;
  if (pathname.startsWith(`${prefix}/`)) return prefix.length;
  return 0;
};

/**
 * 現在のパスに対応するメニュー項目を返す。
 * 「/work-logs」と「/work-logs/calendar」のように入れ子になる場合は
 * 最も長く一致した項目を採用する。
 * @returns {{ section: object|null, item: object }|null}
 */
export const findActiveNav = (pathname) => {
  if (pathname === '/') return { section: null, item: HOME_ITEM };

  let best = null;
  let bestLength = 0;
  NAV_SECTIONS.forEach((section) => {
    section.items.forEach((item) => {
      [item.to, ...(item.match || [])].forEach((prefix) => {
        const length = matchLength(pathname, prefix);
        if (length > bestLength) {
          best = { section, item };
          bestLength = length;
        }
      });
    });
  });
  return best;
};
