// src/pages/Dashboard/TrendChart.jsx
// 収穫量・出荷量の月別推移（直近6か月）。
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// 系列の色は「収穫＝青、出荷＝橙」で固定（色覚特性に配慮した組み合わせ）
const SERIES = [
  { key: 'harvest', label: '収穫量', color: '#2a78d6' },
  { key: 'shipment', label: '出荷量', color: '#eb6834' }
];
const INK_SECONDARY = '#4b5563';
const GRID = '#e5e7eb';

const formatNumber = (value) => Number(value).toLocaleString('ja-JP');

const TrendTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-gray-700">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} aria-hidden="true" />
          {entry.name}
          <span className="ml-auto pl-3 font-semibold text-gray-900 tabular-nums">
            {formatNumber(entry.value)} {unit}
          </span>
        </p>
      ))}
    </div>
  );
};

const TrendChart = ({ trend, className = '' }) => {
  const [showTable, setShowTable] = useState(false);
  const headingId = 'trend-heading';

  const body = () => {
    if (!trend) {
      return <p className="py-6 text-sm text-gray-500">推移のデータを取得できませんでした。</p>;
    }
    if (!trend.unit) {
      return <p className="py-6 text-sm text-gray-600">直近6か月の収穫・出荷の記録はまだありません。</p>;
    }
    if (showTable) {
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b border-gray-200">
              <th className="py-2 font-medium">月</th>
              {SERIES.map((s) => (
                <th key={s.key} className="py-2 font-medium text-right">{s.label}（{trend.unit}）</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {trend.rows.map((row) => (
              <tr key={row.key}>
                <td className="py-2 text-gray-900">{row.label}</td>
                {SERIES.map((s) => (
                  <td key={s.key} className="py-2 text-right text-gray-900 tabular-nums">{formatNumber(row[s.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return (
      <>
        <ul className="flex flex-wrap gap-4 mb-2 text-sm text-gray-700">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="h-56" role="img" aria-label={`直近6か月の収穫量と出荷量の棒グラフ（単位: ${trend.unit}）。数値は「表で見る」で確認できます。`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend.rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: INK_SECONDARY, fontSize: 12 }} />
              <YAxis
                width={44}
                tickLine={false}
                axisLine={false}
                tick={{ fill: INK_SECONDARY, fontSize: 12 }}
                tickFormatter={formatNumber}
                allowDecimals={false}
              />
              <Tooltip cursor={{ fill: '#f3f4f6' }} content={<TrendTooltip unit={trend.unit} />} />
              {SERIES.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {trend.hasOtherUnits && (
          <p className="mt-2 text-xs text-gray-500">
            ※ {trend.unit} 以外の単位で記録された分は、このグラフに含まれていません。
          </p>
        )}
      </>
    );
  };

  return (
    <section className={className} aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 id={headingId} className="text-lg font-semibold text-gray-900">収穫量と出荷量の推移</h2>
          {trend?.unit && (
            <p className="text-sm text-gray-600">直近6か月・単位 {trend.unit}（今月は途中経過）</p>
          )}
        </div>
        {trend?.unit && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className="shrink-0 whitespace-nowrap text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            {showTable ? 'グラフで見る' : '表で見る'}
          </button>
        )}
      </div>
      {body()}
    </section>
  );
};

export default TrendChart;
