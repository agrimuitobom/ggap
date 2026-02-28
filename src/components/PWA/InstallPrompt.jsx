// src/components/PWA/InstallPrompt.jsx
import React, { useState, useEffect } from 'react';

const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // 既に非表示設定されているか確認
    const dismissed = localStorage.getItem('installPromptDismissed');
    const dismissedTime = localStorage.getItem('installPromptDismissedTime');

    // 7日間は再表示しない
    if (dismissed && dismissedTime) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // スタンドアロンモード（既にインストール済み）かチェック
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;

    if (isStandalone) {
      return;
    }

    // デバイス判定
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    const isMobile = isIOSDevice || isAndroidDevice;

    if (isMobile) {
      setIsIOS(isIOSDevice);
      setIsAndroid(isAndroidDevice);

      // 少し遅延してから表示（UX向上）
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
    localStorage.setItem('installPromptDismissedTime', Date.now().toString());
  };

  const handleInstallLater = () => {
    setShowPrompt(false);
    // 1日後に再表示
    localStorage.setItem('installPromptDismissedTime', (Date.now() - 6 * 24 * 60 * 60 * 1000).toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-end justify-center p-4">
      <div className="bg-white rounded-t-2xl w-full max-w-md shadow-2xl animate-slide-up">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="GGAP"
              className="w-12 h-12 rounded-xl"
            />
            <div>
              <h3 className="font-bold text-gray-900">GAPTracker</h3>
              <p className="text-sm text-gray-500">アプリとして使う</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-2 text-gray-400 hover:text-gray-600"
            aria-label="閉じる"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4">
          <p className="text-gray-700 mb-4">
            ホーム画面に追加すると、アプリのように素早くアクセスできます。
          </p>

          {isIOS && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <p className="text-sm text-gray-700">
                  画面下の <span className="inline-flex items-center"><svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></span> 共有ボタンをタップ
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <p className="text-sm text-gray-700">
                  「ホーム画面に追加」を選択
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <p className="text-sm text-gray-700">
                  右上の「追加」をタップ
                </p>
              </div>
            </div>
          )}

          {isAndroid && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <p className="text-sm text-gray-700">
                  ブラウザのメニュー <span className="inline-flex items-center"><svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg></span> をタップ
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <p className="text-sm text-gray-700">
                  「ホーム画面に追加」または「アプリをインストール」を選択
                </p>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={handleInstallLater}
            className="flex-1 py-3 px-4 text-gray-600 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            あとで
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 py-3 px-4 text-white bg-green-600 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default InstallPrompt;
