// src/pages/Dashboard/DashboardView.jsx
// 管理者ダッシュボードの表示部分。データ取得は useDashboardData が担当し、
// このコンポーネントは受け取ったデータを描画するだけにする。
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { buildAlerts } from './dashboardUtils';

const CARD = 'bg-white rounded-lg shadow-sm border border-gray-200';

const QUICK_LINKS = [
  { to: '/work-logs/quick', icon: '⚡', label: '作業クイック記録' },
  { to: '/harvests/quick', icon: '🌾', label: '収穫クイック記録' },
  { to: '/cleaning', icon: '🧹', label: '清掃チェック' },
  { to: '/work-logs/new', icon: '📝', label: '作業日誌登録' },
  { to: '/pesticide-uses/new', icon: '🧪', label: '農薬使用記録' },
  { to: '/fertilizer-uses/new', icon: '🌱', label: '肥料使用記録' },
  { to: '/shipments/new', icon: '🚚', label: '出荷記録' },
  { to: '/field-inspections/new', icon: '🔍', label: '圃場点検記録' },
  { to: '/trainings/new', icon: '🎓', label: '教育・訓練記録' },
  { to: '/visitors/new', icon: '🪪', label: '訪問者記録' }
];

const SEVERITY_STYLES = {
  critical: { label: '重大', icon: '🚫', badge: 'bg-red-100 text-red-800', bar: 'bg-red-500' },
  warning: { label: '注意', icon: '⚠️', badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-400' },
  info: { label: '確認', icon: 'ℹ️', badge: 'bg-blue-100 text-blue-800', bar: 'bg-blue-400' }
};

const BADGE_COLORS = {
  完了: 'bg-green-100 text-green-800',
  適合: 'bg-green-100 text-green-800',
  進行中: 'bg-blue-100 text-blue-800',
  発送中: 'bg-blue-100 text-blue-800',
  準備中: 'bg-amber-100 text-amber-800',
  予定: 'bg-amber-100 text-amber-800',
  要追記: 'bg-amber-100 text-amber-800',
  不適合: 'bg-red-100 text-red-800'
};

const formatQuantity = (record) =>
  record.quantity ? `${Number(record.quantity).toLocaleString('ja-JP')} ${record.unit || 'kg'}` : '';

// 「最近の記録」タブの定義。各記録を「主・副・右側・バッジ」の4要素に写像する。
const RECENT_TABS = [
  {
    key: 'recentWorkLogs',
    label: '作業日誌',
    listTo: '/work-logs',
    newTo: '/work-logs/quick',
    rowTo: (r) => `/work-logs/edit/${r.id}`,
    primary: (r) => r.workType || '作業',
    secondary: (r) => r.fieldName,
    meta: (r) => r.workerNames?.join('、'),
    badge: (r) => (r.isDraft ? '要追記' : null)
  },
  {
    key: 'recentHarvests',
    label: '収穫',
    listTo: '/harvests',
    newTo: '/harvests/quick',
    rowTo: (r) => `/harvests/${r.id}`,
    primary: (r) => r.cropName || '収穫',
    secondary: (r) => r.fieldName,
    meta: formatQuantity
  },
  {
    key: 'recentShipments',
    label: '出荷',
    listTo: '/shipments',
    newTo: '/shipments/new',
    rowTo: (r) => `/shipments/${r.id}`,
    primary: (r) => r.destination || '出荷',
    secondary: (r) => r.cropName,
    meta: formatQuantity,
    badge: (r) => r.status
  },
  {
    key: 'recentTrainings',
    label: '教育・訓練',
    listTo: '/trainings',
    newTo: '/trainings/new',
    rowTo: (r) => `/trainings/edit/${r.id}`,
    primary: (r) => r.title || '研修',
    secondary: (r) => r.category,
    meta: (r) => r.instructor,
    badge: (r) => r.status || '予定'
  },
  {
    key: 'recentVisitors',
    label: '訪問者',
    listTo: '/visitors',
    newTo: '/visitors/new',
    rowTo: (r) => `/visitors/edit/${r.id}`,
    primary: (r) => r.name || '訪問者',
    secondary: (r) => r.organization,
    meta: (r) => r.purpose,
    // hygieneCompliance は真偽値で保存されている
    badge: (r) =>
      r.hygieneCompliance === true ? '適合' : r.hygieneCompliance === false ? '不適合' : null
  }
];

const UNAVAILABLE = '—';

/** 単位ごとの合計を「主要な値 + 残り」に分けて表示用に整形 */
const formatTotals = (totals) => {
  if (!totals) return { value: UNAVAILABLE, unit: '', rest: '' };
  if (totals.length === 0) return { value: '0', unit: '', rest: '' };
  const [main, ...others] = totals;
  return {
    value: main.total.toLocaleString('ja-JP'),
    unit: main.unit,
    rest: others.map((t) => `${t.total.toLocaleString('ja-JP')} ${t.unit}`).join(' ・ ')
  };
};

const StatTile = ({ to, label, value, unit, note, children }) => (
  <Link
    to={to}
    className={`${CARD} block p-4 hover:border-blue-400 hover:shadow transition focus:outline-none focus:ring-2 focus:ring-blue-500`}
  >
    <p className="text-sm text-gray-600">{label}</p>
    <p className="mt-1 text-3xl font-bold text-gray-900 leading-tight">
      {value}
      {unit && <span className="ml-1 text-base font-medium text-gray-600">{unit}</span>}
    </p>
    {children}
    <p className="mt-1 text-xs text-gray-500 min-h-[1rem]">{note}</p>
  </Link>
);

const AlertList = ({ alerts }) => {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-4 text-green-800">
        <span className="text-2xl" aria-hidden="true">✅</span>
        <span className="text-sm font-medium">対応が必要な項目はありません。</span>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {alerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity];
        return (
          <li key={alert.id}>
            <Link
              to={alert.to}
              className="relative flex items-center gap-3 py-3 pl-4 pr-2 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className={`absolute left-0 top-2 bottom-2 w-1 rounded ${style.bar}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${style.badge}`}>
                    <span aria-hidden="true">{style.icon} </span>
                    {style.label}
                  </span>
                  <span className="font-semibold text-gray-900">{alert.title}</span>
                </span>
                <span className="block mt-0.5 text-sm text-gray-600">{alert.detail}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-blue-700 whitespace-nowrap">
                {alert.action} →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

const RecentRecords = ({ data }) => {
  const [activeKey, setActiveKey] = useState(RECENT_TABS[0].key);
  const tab = RECENT_TABS.find((t) => t.key === activeKey);
  const records = data[tab.key];

  return (
    <section className={`${CARD} p-4 sm:p-6`} aria-labelledby="recent-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="recent-heading" className="text-lg font-semibold text-gray-900">最近の記録</h2>
        <Link to={tab.listTo} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
          すべて表示 →
        </Link>
      </div>

      <div role="tablist" aria-label="記録の種類" className="flex gap-1 overflow-x-auto border-b border-gray-200 mb-2">
        {RECENT_TABS.map((t) => {
          const selected = t.key === activeKey;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={selected}
              aria-controls="recent-panel"
              onClick={() => setActiveKey(t.key)}
              className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                selected
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="recent-panel" aria-labelledby={`tab-${tab.key}`}>
        {records === null ? (
          <p className="py-6 text-sm text-gray-500">{tab.label}の記録を取得できませんでした。</p>
        ) : records.length === 0 ? (
          <div className="py-6 text-sm text-gray-600">
            {tab.label}の記録はまだありません。
            <Link to={tab.newTo} className="ml-2 font-semibold text-blue-700 hover:text-blue-900">
              最初の記録を登録する →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {records.map((record) => {
              const badge = tab.badge ? tab.badge(record) : null;
              const secondary = tab.secondary(record);
              const meta = tab.meta(record);
              return (
                <li key={record.id}>
                  <Link
                    to={tab.rowTo(record)}
                    className="flex items-center gap-3 py-3 px-1 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <span className="shrink-0 w-12 text-sm text-gray-500 tabular-nums">
                      {record.date ? format(record.date, 'M/d') : UNAVAILABLE}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-gray-900 truncate">{tab.primary(record)}</span>
                      {(secondary || meta) && (
                        <span className="block text-sm text-gray-600 truncate">
                          {[secondary, meta].filter(Boolean).join(' ・ ')}
                        </span>
                      )}
                    </span>
                    {badge && (
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                          BADGE_COLORS[badge] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

const Skeleton = () => (
  <div className="animate-pulse" role="status" aria-label="データを読み込み中">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-28 rounded-lg bg-gray-200" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div className="lg:col-span-2 h-56 rounded-lg bg-gray-200" />
      <div className="h-56 rounded-lg bg-gray-200" />
    </div>
    <div className="h-64 rounded-lg bg-gray-200" />
  </div>
);

const DashboardView = ({ data, loading, onReload, organizationName, userName }) => {
  const today = new Date();

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-600">
          {format(today, 'yyyy年M月d日（E）', { locale: ja })}
          {organizationName && ` ・ ${organizationName}`}
          {userName && ` ・ ${userName}さん`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {data?.fetchedAt && (
          <span className="text-xs text-gray-500">最終更新 {format(data.fetchedAt, 'H:mm')}</span>
        )}
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '更新中…' : '↻ 更新'}
        </button>
      </div>
    </div>
  );

  if (!data) {
    return (
      <div className="container mx-auto p-4 max-w-6xl pb-24">
        {header}
        <Skeleton />
      </div>
    );
  }

  const alerts = buildAlerts(data, today);
  const urgentCount = alerts.filter((a) => a.severity !== 'info').length;
  const { monthSummary, cleaning } = data;
  const harvest = formatTotals(monthSummary.harvestTotals);
  const shipment = formatTotals(monthSummary.shipmentTotals);
  const cleaningRatio = cleaning && cleaning.total > 0 ? cleaning.done / cleaning.total : 0;
  const cleaningComplete = cleaning && cleaning.total > 0 && cleaning.done >= cleaning.total;
  const monthLabel = `${today.getMonth() + 1}月`;

  return (
    <div className="container mx-auto p-4 max-w-6xl pb-24">
      {header}

      {data.failedKeys.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-red-50 border border-red-300 text-red-800 px-4 py-3 mb-4 rounded-lg text-sm">
          <span>一部のデータを取得できませんでした。表示されている内容が不完全な可能性があります。</span>
          <button type="button" onClick={onReload} className="font-semibold underline">
            再読み込み
          </button>
        </div>
      )}

      {/* 今月の状況 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatTile
          to="/work-logs"
          label={`${monthLabel}の作業記録`}
          value={monthSummary.workLogCount ?? UNAVAILABLE}
          unit="件"
          note={data.draftCount > 0 ? `要追記 ${data.draftCount}件（全期間）` : data.draftCount === 0 ? '要追記なし' : ''}
        />
        <StatTile
          to="/harvests"
          label={`${monthLabel}の収穫量`}
          value={harvest.value}
          unit={harvest.unit}
          note={[
            monthSummary.harvestCount !== null && `${monthSummary.harvestCount}件`,
            harvest.rest
          ].filter(Boolean).join(' ・ ')}
        />
        <StatTile
          to="/shipments"
          label={`${monthLabel}の出荷量`}
          value={shipment.value}
          unit={shipment.unit}
          note={[
            monthSummary.shipmentCount !== null && `${monthSummary.shipmentCount}件`,
            shipment.rest
          ].filter(Boolean).join(' ・ ')}
        />
        <StatTile
          to="/cleaning"
          label="今日の清掃チェック"
          value={cleaning ? (cleaning.total > 0 ? `${cleaning.done}/${cleaning.total}` : '0') : UNAVAILABLE}
          unit="件"
          note={
            !cleaning ? '' : cleaning.total === 0 ? '清掃項目が未設定です' : cleaningComplete ? '✓ 本日完了' : '未完了の項目があります'
          }
        >
          <div
            className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden"
            role="progressbar"
            aria-label="清掃チェックの進捗"
            aria-valuemin={0}
            aria-valuemax={cleaning?.total || 0}
            aria-valuenow={cleaning?.done || 0}
          >
            <div
              className={`h-full rounded-full ${cleaningComplete ? 'bg-green-600' : 'bg-blue-600'}`}
              style={{ width: `${Math.min(cleaningRatio, 1) * 100}%` }}
            />
          </div>
        </StatTile>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 要対応 */}
        <section className={`${CARD} p-4 sm:p-6 lg:col-span-2`} aria-labelledby="alerts-heading">
          <div className="flex items-center gap-2 mb-3">
            <h2 id="alerts-heading" className="text-lg font-semibold text-gray-900">要対応</h2>
            {urgentCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold">{urgentCount}</span>
            )}
          </div>
          <AlertList alerts={alerts} />
        </section>

        {/* クイックアクセス */}
        <section className={`${CARD} p-4 sm:p-6`} aria-labelledby="quick-heading">
          <h2 id="quick-heading" className="text-lg font-semibold text-gray-900 mb-3">クイックアクセス</h2>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_LINKS.map((link, i) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  i === 0
                    ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                    : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span aria-hidden="true">{link.icon}</span>
                <span className="min-w-0">{link.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <RecentRecords data={data} />
    </div>
  );
};

export default DashboardView;
