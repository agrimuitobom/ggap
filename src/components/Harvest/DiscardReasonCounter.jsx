// src/components/Harvest/DiscardReasonCounter.jsx
// 廃棄株数を理由別にタップで数えるカウンター。
// 選別しながら「＋」を押すだけで入力できるようにし、
// 廃棄株数の合計は自動計算する（3つの数値を手入力して突き合わせる方式だと
// 必ず食い違いが出るため、合計は常に足し算の結果とする）。
import React from 'react';
import { DISCARD_REASONS, sumDiscardCounts } from '../../constants/discardReasons';

const DiscardReasonCounter = ({ counts, onChange, totalPlants }) => {
  const total = sumDiscardCounts(counts);
  const marketable = totalPlants !== '' && totalPlants != null
    ? Number(totalPlants) - total
    : null;
  const over = marketable != null && marketable < 0;

  const bump = (key, delta) => {
    const next = { ...counts, [key]: Math.max(0, (Number(counts[key]) || 0) + delta) };
    onChange(next);
  };

  const setValue = (key, value) => {
    onChange({ ...counts, [key]: Math.max(0, Number(value) || 0) });
  };

  return (
    <div>
      <div className="space-y-2">
        {DISCARD_REASONS.map((r) => {
          const value = Number(counts[r.key]) || 0;
          return (
            <div
              key={r.key}
              className={`flex items-center gap-2 p-2 rounded-lg border ${
                value > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className="text-xl shrink-0">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-[11px] text-gray-500 truncate">{r.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => bump(r.key, -1)}
                disabled={value === 0}
                className="w-10 h-10 rounded-full border border-gray-300 text-lg font-bold text-gray-600 disabled:opacity-30"
              >
                −
              </button>
              <input
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(r.key, e.target.value)}
                className="w-16 text-center border rounded py-2"
              />
              <button
                type="button"
                onClick={() => bump(r.key, 1)}
                className="w-12 h-12 rounded-full bg-red-600 text-white text-xl font-bold hover:bg-red-700"
              >
                ＋
              </button>
            </div>
          );
        })}
      </div>

      {/* 集計 */}
      <div className={`mt-3 rounded-lg p-3 text-sm border ${
        over ? 'bg-red-50 border-red-300 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-700'
      }`}>
        <div className="flex justify-between">
          <span>廃棄株数（合計）</span>
          <span className="font-bold">{total} 株</span>
        </div>
        {marketable != null && (
          <>
            <div className="flex justify-between mt-1">
              <span>可販株数（自動計算）</span>
              <span className="font-bold">{marketable} 株</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>廃棄率</span>
              <span className="font-bold">
                {Number(totalPlants) > 0 ? ((total / Number(totalPlants)) * 100).toFixed(1) : '0.0'} %
              </span>
            </div>
          </>
        )}
        {over && (
          <p className="mt-2 text-xs font-bold">
            ⚠️ 廃棄株数が総株数を超えています。総株数か廃棄数を確認してください。
          </p>
        )}
      </div>
    </div>
  );
};

export default DiscardReasonCounter;
