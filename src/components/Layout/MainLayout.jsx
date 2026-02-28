// src/components/Layout/MainLayout.jsx
import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import QuickActionFAB from '../QuickActions/QuickActionFAB';
import MobileBottomNav from './MobileBottomNav';
import { authLogger } from '../../utils/logger';

const MainLayout = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    workManagement: false,
    materialManagement: false,
    seedManagement: false,
    fieldManagement: false,
    harvestShipment: false,
    workerManagement: false,
    others: false,
    reports: false
  });

  const handleLogout = async () => {
    setError('');
    
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      setError('ログアウトに失敗しました');
      authLogger.error('ログアウトエラー', { component: 'MainLayout', userId: currentUser?.uid }, error);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* サイドバー（モバイルではトグル可能） */}
      <div 
        className={`bg-blue-800 text-white w-80 md:w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0 transition duration-200 ease-in-out z-30 overflow-y-auto min-h-screen max-h-full`}
        style={{ backgroundColor: '#1e3a8a' }}
      >
        <div className="flex items-center justify-between px-3">
          <h2 className="text-3xl font-semibold">GAPTracker</h2>
          <button 
            onClick={toggleSidebar} 
            className="md:hidden touch-target mobile-btn mobile-btn-secondary"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav>
          <Link to="/" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-blue-700 text-white">
            ダッシュボード
          </Link>
          
          {/* 作業管理 */}
          <div className="mt-4">
            <button
              onClick={() => toggleSection('workManagement')}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-300 hover:text-white hover:bg-blue-700 rounded transition duration-200"
            >
              <span>作業管理</span>
              <svg className={`w-4 h-4 transform transition-transform ${expandedSections.workManagement ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.workManagement && (
              <div className="ml-4 mt-1 space-y-1">
                <Link to="/work-logs" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  作業日誌一覧
                </Link>
                <Link to="/work-logs/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  作業日誌登録
                </Link>
              </div>
            )}
          </div>
          
          {/* 資材管理 */}
          <div className="mt-2">
            <button
              onClick={() => toggleSection('materialManagement')}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-300 hover:text-white hover:bg-blue-700 rounded transition duration-200"
            >
              <span>資材管理</span>
              <svg className={`w-4 h-4 transform transition-transform ${expandedSections.materialManagement ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.materialManagement && (
              <div className="ml-4 mt-1 space-y-1">
                <Link to="/fertilizers" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  肥料一覧
                </Link>
                <Link to="/fertilizers/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  肥料登録
                </Link>
                <Link to="/fertilizer-uses" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  施肥記録一覧
                </Link>
                <Link to="/fertilizer-uses/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  施肥記録登録
                </Link>
                <Link to="/pesticides" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  農薬一覧
                </Link>
                <Link to="/pesticides/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  農薬登録
                </Link>
                <Link to="/pesticide-uses" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  農薬使用記録一覧
                </Link>
                <Link to="/pesticide-uses/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  農薬使用記録登録
                </Link>
              </div>
            )}
          </div>
          
          {/* 種苗管理 */}
          <div className="mt-2">
            <button
              onClick={() => toggleSection('seedManagement')}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-300 hover:text-white hover:bg-blue-700 rounded transition duration-200"
            >
              <span>種苗管理</span>
              <svg className={`w-4 h-4 transform transition-transform ${expandedSections.seedManagement ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.seedManagement && (
              <div className="ml-4 mt-1 space-y-1">
                <Link to="/seeds" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  種子・苗一覧
                </Link>
                <Link to="/seeds/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  種子・苗登録
                </Link>
                <Link to="/seed-uses" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  播種・定植記録一覧
                </Link>
                <Link to="/seed-uses/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  播種・定植記録登録
                </Link>
              </div>
            )}
          </div>
          
          {/* 圃場管理 */}
          <div className="mt-2">
            <button
              onClick={() => toggleSection('fieldManagement')}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-300 hover:text-white hover:bg-blue-700 rounded transition duration-200"
            >
              <span>圃場管理</span>
              <svg className={`w-4 h-4 transform transition-transform ${expandedSections.fieldManagement ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.fieldManagement && (
              <div className="ml-4 mt-1 space-y-1">
                <Link to="/fields" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  圃場一覧
                </Link>
                <Link to="/fields/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  圃場登録
                </Link>
                <Link to="/field-inspections/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  圃場点検記録
                </Link>
              </div>
            )}
          </div>
          
          {/* 収穫・出荷管理 */}
          <div className="mt-2">
            <button
              onClick={() => toggleSection('harvestShipment')}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-300 hover:text-white hover:bg-blue-700 rounded transition duration-200"
            >
              <span>収穫・出荷</span>
              <svg className={`w-4 h-4 transform transition-transform ${expandedSections.harvestShipment ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.harvestShipment && (
              <div className="ml-4 mt-1 space-y-1">
                <Link to="/harvests" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  収穫記録一覧
                </Link>
                <Link to="/harvests/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  収穫記録登録
                </Link>
                <Link to="/shipments" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  出荷記録一覧
                </Link>
                <Link to="/shipments/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  出荷記録登録
                </Link>
              </div>
            )}
          </div>
          
          {/* 従業員管理 */}
          <div className="mt-2">
            <button
              onClick={() => toggleSection('workerManagement')}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-300 hover:text-white hover:bg-blue-700 rounded transition duration-200"
            >
              <span>従業員・グループ</span>
              <svg className={`w-4 h-4 transform transition-transform ${expandedSections.workerManagement ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.workerManagement && (
              <div className="ml-4 mt-1 space-y-1">
                <Link to="/workers" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  従業員一覧
                </Link>
                <Link to="/workers/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  従業員登録
                </Link>
                <Link to="/groups" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  グループ一覧
                </Link>
                <Link to="/groups/new" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  グループ登録
                </Link>
              </div>
            )}
          </div>

          {/* その他の記録 */}
          <div className="mt-2">
            <button
              onClick={() => toggleSection('others')}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-300 hover:text-white hover:bg-blue-700 rounded transition duration-200"
            >
              <span>その他</span>
              <svg className={`w-4 h-4 transform transition-transform ${expandedSections.others ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.others && (
              <div className="ml-4 mt-1 space-y-1">
                <Link to="/visitors" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  訪問者記録
                </Link>
                <Link to="/trainings" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  教育・訓練記録
                </Link>
              </div>
            )}
          </div>
          
          {/* レポート・分析 */}
          <div className="mt-2">
            <button
              onClick={() => toggleSection('reports')}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-300 hover:text-white hover:bg-blue-700 rounded transition duration-200"
            >
              <span>レポート・分析</span>
              <svg className={`w-4 h-4 transform transition-transform ${expandedSections.reports ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.reports && (
              <div className="ml-4 mt-1 space-y-1">
                <Link to="/reports" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  ダッシュボード
                </Link>
                <Link to="/reports/pesticide-usage" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  農薬使用記録簿
                </Link>
                <Link to="/reports/fertilizer-usage" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  肥料使用記録簿
                </Link>
                <Link to="/reports/business-analytics" className="block py-2 px-4 text-sm rounded transition duration-200 hover:bg-blue-700 text-blue-100">
                  経営分析
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
      
      {/* モバイル用オーバーレイ */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" 
          onClick={toggleSidebar}
        ></div>
      )}
      
      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <header className="bg-white shadow-md z-10 mobile-header">
          <div className="h-16 px-4 flex items-center justify-between">
            <button 
              onClick={toggleSidebar} 
              className="md:hidden touch-target mobile-btn mobile-btn-secondary"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-4">
              {currentUser && (
                <>
                  <span className="hidden md:inline mobile-text-sm">{userProfile?.name || currentUser.email}</span>
                  <button 
                    onClick={handleLogout} 
                    className="mobile-btn mobile-btn-primary"
                  >
                    ログアウト
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
        
        {/* メインコンテンツ */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 mobile-container">
          {error && (
            <div className="mobile-alert mobile-alert-error">
              {error}
            </div>
          )}
          <Outlet />
        </main>
      </div>
      
      {/* クイックアクションFAB（モバイル用） */}
      <QuickActionFAB />
      
      {/* モバイル用ボトムナビゲーション */}
      <MobileBottomNav />
    </div>
  );
};

export default MainLayout;
