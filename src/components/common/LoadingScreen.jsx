// src/components/common/LoadingScreen.jsx
import React from 'react';

/**
 * 読み込み中の表示。
 * fullScreen: 起動時（認証・組織情報の確認中）に画面全体へ表示する
 * それ以外: レイアウト内でページの読み込みを待つ間に表示する
 */
const LoadingScreen = ({ fullScreen = false, message = '読み込み中…' }) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex flex-col items-center justify-center gap-4 text-gray-500 ${
      fullScreen ? 'app-shell bg-gray-100' : 'py-24'
    }`}
  >
    {fullScreen && (
      <img
        src={`${process.env.PUBLIC_URL}/icon-192.png`}
        alt=""
        className="w-16 h-16 rounded-2xl shadow"
      />
    )}
    <div className="h-8 w-8 rounded-full border-4 border-gray-200 border-t-green-600 animate-spin" />
    <span className="text-sm">{message}</span>
  </div>
);

export default LoadingScreen;
