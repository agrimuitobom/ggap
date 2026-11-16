// src/components/Layout/MobileBottomNav.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ICON_PATHS } from './navigation';

// match: この接頭辞で始まるパスにいるとき、そのタブを選択中として表示する
const NAV_ITEMS = [
  { path: '/', label: 'ホーム', icon: 'home', match: [] },
  { path: '/work-logs', label: '作業', icon: 'worklog', match: ['/work-logs', '/cleaning', '/nutrient-logs'] },
  { path: '/harvests', label: '収穫', icon: 'harvest', match: ['/harvests', '/shipments'] },
  {
    path: '/fertilizers',
    label: '資材',
    icon: 'materials',
    match: ['/fertilizers', '/fertilizer-uses', '/pesticides', '/pesticide-uses', '/material-disposals']
  }
];

const isActive = (item, pathname) =>
  item.path === '/'
    ? pathname === '/'
    : item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const ITEM_CLASS =
  'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600';

const NavIcon = ({ name }) => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICON_PATHS[name]} />
  </svg>
);

const MobileBottomNav = ({ onOpenMenu, menuOpen = false }) => {
  const { pathname } = useLocation();

  return (
    <nav
      className="md:hidden shrink-0 border-t border-gray-200 bg-white px-1 pt-1 app-safe-bottom"
      aria-label="クイックナビゲーション"
    >
      <div className="flex items-stretch">
        {NAV_ITEMS.map((item) => {
          const selected = isActive(item, pathname);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={selected ? 'page' : undefined}
              className={`${ITEM_CLASS} ${
                selected ? 'text-green-700 bg-green-50' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          className={`${ITEM_CLASS} text-gray-600 hover:bg-gray-50`}
        >
          <NavIcon name="menu" />
          <span>メニュー</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
