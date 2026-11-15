// src/components/Auth/AuthLayout.jsx
// ログイン・新規登録画面で共通の枠と入力部品
import React, { useState } from 'react';

const INPUT_CLASS =
  'block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/30';

export const AuthLayout = ({ title, error, notice, children }) => (
  <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center">
        <img
          src={`${process.env.PUBLIC_URL}/icon-192.png`}
          alt=""
          className="h-16 w-16 rounded-2xl shadow"
        />
        <p className="mt-3 text-2xl font-bold text-gray-900">GAPTracker</p>
        <p className="text-sm text-gray-500">農業生産工程管理</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-5 text-lg font-bold text-gray-900">{title}</h1>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
            {notice}
          </div>
        )}

        {children}
      </div>
    </div>
  </div>
);

export const TextField = ({ id, label, hint, ...inputProps }) => (
  <div>
    <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
      {label}
    </label>
    <input id={id} className={INPUT_CLASS} aria-describedby={hint ? `${id}-hint` : undefined} {...inputProps} />
    {hint && (
      <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">
        {hint}
      </p>
    )}
  </div>
);

export const PasswordField = ({ id, label, hint, ...inputProps }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`${INPUT_CLASS} pr-16`}
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'パスワードを隠す' : 'パスワードを表示'}
          className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-green-700 hover:text-green-900 focus:outline-none focus-visible:underline"
        >
          {visible ? '隠す' : '表示'}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
};

export const PrimaryButton = ({ children, className = '', ...props }) => (
  <button
    className={`flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const Divider = () => (
  <div className="relative my-5">
    <div className="absolute inset-0 flex items-center" aria-hidden="true">
      <div className="w-full border-t border-gray-200" />
    </div>
    <div className="relative flex justify-center text-sm">
      <span className="bg-white px-3 text-gray-500">または</span>
    </div>
  </div>
);

export const GoogleButton = ({ children, ...props }) => (
  <button
    type="button"
    className="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    {...props}
  >
    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
    {children}
  </button>
);

/** Googleログイン失敗時のメッセージ（ログイン・新規登録で共通） */
export const googleErrorMessage = (error) => {
  if (error.code === 'auth/popup-closed-by-user') return 'ログインがキャンセルされました';
  if (error.code === 'auth/popup-blocked') return 'ポップアップがブロックされました。ポップアップを許可してください';
  if (error.code === 'auth/network-request-failed') return '通信できませんでした。電波状況を確認してください';
  return 'Googleログインに失敗しました: ' + error.message;
};
