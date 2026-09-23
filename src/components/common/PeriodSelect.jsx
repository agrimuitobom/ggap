// src/components/common/PeriodSelect.jsx
// 一覧画面の表示期間を選ぶボタン列
import React from 'react';
import { PERIOD_OPTIONS } from '../../utils/period';

const PeriodSelect = ({ value, onChange, count, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-2 ${className}`}>
    <span className="text-sm text-gray-600">表示期間</span>
    {PERIOD_OPTIONS.map((o) => (
      <button
        key={o.key}
        type="button"
        onClick={() => onChange(o.key)}
        className={`px-3 py-1.5 rounded-full border text-sm ${
          value === o.key
            ? 'border-green-600 bg-green-600 text-white'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        {o.label}
      </button>
    ))}
    {typeof count === 'number' && (
      <span className="text-sm text-gray-500 ml-1">{count}件</span>
    )}
  </div>
);

export default PeriodSelect;
