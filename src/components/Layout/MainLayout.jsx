// src/components/Layout/MainLayout.jsx
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import QuickActionFAB from '../QuickActions/QuickActionFAB';
import MobileBottomNav from './MobileBottomNav';
import LoadingScreen from '../common/LoadingScreen';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import { authLogger } from '../../utils/logger';
import { NAV_SECTIONS, HOME_ITEM, ICON_PATHS, findActiveNav } from './navigation';

const ROLE_LABELS = { admin: '管理者', member: 'メンバー', viewer: '閲覧者' };

const Icon = ({ name, className = 'h-5 w-5' }) => (
  <svg className={`shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICON_PATHS[name]} />
  </svg>
);

const Badge = ({ count }) =>
  count > 0 ? (
    <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded-full">
      {count}
      <span className="sr-only">件の未対応</span>
    </span>
  ) : null;

const MainLayout = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const { currentOrganization, invitations, userRole, isMember } = useOrganization();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const online = useOnlineStatus();
  const mainRef = useRef(null);

  const active = findActiveNav(pathname);
  const activeSectionId = active?.section?.id;
  const pageTitle = active?.item.label;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 現在地を含むセクションは最初から開いておく
  const [expanded, setExpanded] = useState(() => ({
    daily: true,
    ...(activeSectionId ? { [activeSectionId]: true } : {})
  }));

  const badgeCounts = { invitations: invitations.length };
  const sectionBadge = (section) =>
    section.items.reduce((sum, item) => sum + (item.badge ? badgeCounts[item.badge] || 0 : 0), 0);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  // 画面を移動したら: メニューを閉じる・先頭へスクロール・現在地のセクションを開く
  useEffect(() => {
    setSidebarOpen(false);
    mainRef.current?.scrollTo(0, 0);
    if (activeSectionId) {
      setExpanded((prev) => (prev[activeSectionId] ? prev : { ...prev, [activeSectionId]: true }));
    }
  }, [pathname, activeSectionId]);

  useEffect(() => {
    document.title = pageTitle && pathname !== '/' ? `${pageTitle} | GAPTracker` : 'GAPTracker';
  }, [pageTitle, pathname]);

  // Escキーでモバイルメニューを閉じる
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      toast.error('ログアウトに失敗しました');
      authLogger.error('ログアウトエラー', { component: 'MainLayout', userId: currentUser?.uid }, error);
    }
  };

  const toggleSection = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const userName = userProfile?.name || currentUser?.displayName || currentUser?.email || '';
  const isHome = pathname === '/';

  return (
    <div className="app-shell flex bg-gray-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-white focus:text-green-800 focus:rounded-lg focus:shadow-lg"
      >
        本文へ移動
      </a>

      {/* モバイル用オーバーレイ */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* サイドバー（モバイルではドロワー） */}
      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-green-900 text-white transition-[transform,visibility] duration-200 ease-in-out md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 md:visible ${
          sidebarOpen ? 'translate-x-0 visible shadow-2xl' : '-translate-x-full invisible'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <img src={`${process.env.PUBLIC_URL}/icon-192.png`} alt="" className="h-9 w-9 rounded-lg" />
            <span className="text-xl font-bold tracking-tight">GAPTracker</span>
          </Link>
          <button
            type="button"
            onClick={closeSidebar}
            className="md:hidden flex h-11 w-11 items-center justify-center rounded-lg text-green-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="メニューを閉じる"
          >
            <Icon name="close" className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1" aria-label="メインメニュー">
          <Link
            to={HOME_ITEM.to}
            aria-current={isHome ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              isHome ? 'bg-white/15 text-white' : 'text-green-50 hover:bg-white/10'
            }`}
          >
            <Icon name={HOME_ITEM.icon} />
            {HOME_ITEM.label}
          </Link>

          {NAV_SECTIONS.map((section) => {
            const isOpen = !!expanded[section.id];
            const containsActive = activeSectionId === section.id;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isOpen}
                  aria-controls={`nav-section-${section.id}`}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    containsActive ? 'text-white' : 'text-green-50'
                  }`}
                >
                  <Icon name={section.icon} />
                  <span className="flex-1 text-left">{section.label}</span>
                  {!isOpen && <Badge count={sectionBadge(section)} />}
                  <Icon
                    name="chevronDown"
                    className={`h-4 w-4 text-green-200 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <ul id={`nav-section-${section.id}`} className="mt-1 mb-2 ml-5 space-y-0.5 border-l border-white/15 pl-2">
                    {section.items.map((item) => {
                      const isActive = active?.item.to === item.to;
                      return (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                              isActive
                                ? 'bg-white/15 font-semibold text-white'
                                : 'text-green-100 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span>{item.label}</span>
                            {item.badge && <Badge count={badgeCounts[item.badge]} />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* ログイン中のユーザー */}
        {currentUser && (
          <div className="shrink-0 border-t border-white/10 p-3 app-safe-bottom">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-base font-bold"
                aria-hidden="true"
              >
                {userName.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{userName}</p>
                <p className="truncate text-xs text-green-200">
                  {[currentOrganization?.name, ROLE_LABELS[userRole]].filter(Boolean).join(' ・ ')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-green-100 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="ログアウト"
                title="ログアウト"
              >
                <Icon name="logout" className="h-6 w-6" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* メインコンテンツエリア */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-10 flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-2 md:h-16 md:px-6">
          <button
            type="button"
            onClick={openSidebar}
            className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
            aria-label="メニューを開く"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
          >
            <Icon name="menu" className="h-6 w-6" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-gray-900 md:text-lg">
              {pageTitle || 'GAPTracker'}
            </p>
            {currentOrganization && (
              <p className="truncate text-xs text-gray-500 md:hidden">{currentOrganization.name}</p>
            )}
          </div>

          {!online && (
            <span
              className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
              role="status"
              title="記録は端末に保存され、通信が回復すると自動で同期されます"
            >
              オフライン
            </span>
          )}

          {currentOrganization && (
            <Link
              to="/organizations/switch"
              className="hidden md:flex shrink-0 items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
              title="組織を切り替える"
            >
              <Icon name="organization" className="h-4 w-4 text-gray-500" />
              <span className="max-w-[16rem] truncate">{currentOrganization.name}</span>
            </Link>
          )}
        </header>

        {!online && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 md:px-6">
            オフラインです。記録は端末に保存され、通信が回復すると自動で同期されます。
          </div>
        )}

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 focus:outline-none"
        >
          {/* ページの遅延読み込み中もサイドバーとヘッダーは表示したままにする */}
          <Suspense fallback={<LoadingScreen />}>
            <Outlet />
          </Suspense>
        </main>

        <MobileBottomNav onOpenMenu={openSidebar} menuOpen={sidebarOpen} />
      </div>

      {/* クイックアクション（記録できる権限があるときのみ） */}
      {isMember && <QuickActionFAB />}
    </div>
  );
};

export default MainLayout;
