// src/components/QuickActions/QuickActionFAB.jsx
import React, { useState, useEffect, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';

const QUICK_ACTIONS = [
  { label: '作業クイック記録', icon: '⚡', link: '/work-logs/quick', color: 'bg-green-600' },
  { label: '作業日誌', icon: '📝', link: '/work-logs/new', color: 'bg-blue-600' },
  { label: '収穫記録', icon: '🌾', link: '/harvests/quick', color: 'bg-emerald-600' },
  { label: '施肥記録', icon: '🌱', link: '/fertilizer-uses/new', color: 'bg-yellow-600' },
  { label: '農薬使用記録', icon: '🧪', link: '/pesticide-uses/new', color: 'bg-red-600' },
  { label: '播種・定植記録', icon: '🌿', link: '/seed-uses/new', color: 'bg-purple-600' }
];

// 入力フォームでは保存ボタンなどに重なるため表示しない
const isFormPath = (pathname) => /\/(new|quick)$|\/edit\//.test(pathname);

const QuickActionFAB = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (isFormPath(pathname)) return null;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="app-fab fixed right-4 z-30 flex flex-col items-end gap-3 md:right-6">
        {isOpen && (
          <ul id="quick-action-menu" className="flex flex-col items-end gap-3">
            {QUICK_ACTIONS.map((action, index) => (
              <li
                key={action.link}
                className="app-fab-item"
                style={{ animationDelay: `${(QUICK_ACTIONS.length - 1 - index) * 30}ms` }}
              >
                <Link
                  to={action.link}
                  onClick={() => setIsOpen(false)}
                  className="group flex items-center gap-3 rounded-full focus:outline-none"
                >
                  <span className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white shadow-lg">
                    {action.label}
                  </span>
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-xl text-white shadow-lg transition-transform group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-white ${action.color}`}
                    aria-hidden="true"
                  >
                    {action.icon}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-label={isOpen ? '記録メニューを閉じる' : '記録を追加'}
          aria-expanded={isOpen}
          aria-controls="quick-action-menu"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition hover:bg-green-700 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300"
        >
          <svg
            className={`h-7 w-7 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </>
  );
};

export default memo(QuickActionFAB);
