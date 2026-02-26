// src/components/QuickActions/QuickActionFAB.jsx
import React, { useState, memo, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';

const QuickActionFAB = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const quickActions = useMemo(() => [
    {
      label: '作業記録',
      icon: '📝',
      link: '/work-logs/new',
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      label: '収穫記録',
      icon: '🌾',
      link: '/harvests/new',
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      label: '施肥記録',
      icon: '🌱',
      link: '/fertilizer-uses/new',
      color: 'bg-yellow-600 hover:bg-yellow-700'
    },
    {
      label: '農薬記録',
      icon: '🚿',
      link: '/pesticide-uses/new',
      color: 'bg-red-600 hover:bg-red-700'
    },
    {
      label: '播種記録',
      icon: '🌿',
      link: '/seed-uses/new',
      color: 'bg-purple-600 hover:bg-purple-700'
    }
  ], []);

  return (
    <>
      {/* メインFABボタン */}
      <button
        className="mobile-fab fixed bottom-6 right-6 w-16 h-16 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 z-50"
        onClick={toggleMenu}
      >
        <span className={`text-2xl transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>

      {/* クイックアクションメニュー */}
      {isOpen && (
        <>
          {/* 背景オーバーレイ */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
            onClick={toggleMenu}
          ></div>
          
          {/* アクションボタン群 */}
          <div className="fixed bottom-24 right-6 z-50 space-y-3">
            {quickActions.map((action, index) => (
              <Link
                key={action.label}
                to={action.link}
                onClick={closeMenu}
                className={`mobile-quick-action flex items-center justify-center w-14 h-14 ${action.color} text-white rounded-full shadow-lg transition-all duration-200 hover:scale-105`}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: isOpen ? 'slideInUp 0.3s ease-out forwards' : ''
                }}
                title={action.label}
              >
                <span className="text-xl">{action.icon}</span>
              </Link>
            ))}
          </div>
          
          {/* アクションラベル */}
          <div className="fixed bottom-24 right-24 z-50 space-y-3">
            {quickActions.map((action, index) => (
              <div
                key={`label-${action.label}`}
                className="flex items-center justify-end h-14"
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: isOpen ? 'slideInRight 0.3s ease-out forwards' : ''
                }}
              >
                <span className="bg-gray-800 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg">
                  {action.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slideInUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slideInRight {
          from {
            transform: translateX(20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default memo(QuickActionFAB);