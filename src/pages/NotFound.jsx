// src/pages/NotFound.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-5xl font-bold text-gray-300">404</p>
      <h1 className="mt-4 text-xl font-bold text-gray-900">ページが見つかりません</h1>
      <p className="mt-2 text-sm text-gray-600">
        URLが間違っているか、ページが移動した可能性があります。
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/"
          className="rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
        >
          ホームへ戻る
        </Link>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
        >
          前の画面へ戻る
        </button>
      </div>
    </div>
  );
};

export default NotFound;
