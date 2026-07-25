// src/pages/Reports/MassBalanceReport.jsx
// マスバランス照合（ロット別の収穫量と出荷量の突き合わせ）。
// GAP認証では「収穫した量と出荷した量の辻褄が合うこと」がトレーサビリティの
// 裏づけとして確認される。出荷量が収穫量を超えるロットは矛盾として警告する。
import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';
import { subMonths } from 'date-fns';

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const MassBalanceReport = () => {
  const { currentOrganization } = useOrganization();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(toDateString(subMonths(new Date(), 6)));
  const [endDate, setEndDate] = useState(toDateString(new Date()));

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [harvestSnap, shipmentSnap] = await Promise.all([
        getDocs(query(collection(db, 'harvests'), where('organizationId', '==', currentOrganization.id))),
        getDocs(query(collection(db, 'shipments'), where('organizationId', '==', currentOrganization.id)))
      ]);

      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);

      // ロット番号ごとに収穫量・廃棄量を集計
      const byLot = {};
      harvestSnap.forEach((d) => {
        const data = d.data();
        const date = data.harvestDate?.toDate ? data.harvestDate.toDate() : null;
        if (!date || date < start || date > end) return;
        const lot = data.lotNumber || '(ロット番号なし)';
        if (!byLot[lot]) {
          byLot[lot] = {
            lot, cropName: data.cropName || '', fieldName: data.fieldName || '',
            harvestDate: date, unit: data.unit || 'kg',
            harvested: 0, disposed: 0, shipped: 0, shipments: 0
          };
        }
        byLot[lot].harvested += Number(data.quantity) || 0;
        byLot[lot].disposed += Number(data.disposalAmount) || 0;
      });

      // 出荷量を突き合わせ（同じロット番号）
      shipmentSnap.forEach((d) => {
        const data = d.data();
        const lot = data.lotNumber;
        if (!lot || !byLot[lot]) return;
        byLot[lot].shipped += Number(data.quantity) || 0;
        byLot[lot].shipments += 1;
      });

      const list = Object.values(byLot).sort((a, b) => b.harvestDate - a.harvestDate);
      setRows(list);
    } catch (err) {
      firestoreLogger.error('マスバランスの集計エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const totals = rows.reduce(
    (acc, r) => ({
      harvested: acc.harvested + r.harvested,
      disposed: acc.disposed + r.disposed,
      shipped: acc.shipped + r.shipped
    }),
    { harvested: 0, disposed: 0, shipped: 0 }
  );

  const inconsistent = rows.filter((r) => r.shipped > r.harvested + 0.001);

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.error('エクスポートするデータがありません');
      return;
    }
    const headers = ['ロット番号', '作物', '圃場', '収穫日', '収穫量', '廃棄量', '出荷量', '在庫（残）', '単位', '出荷件数', '判定'];
    const lines = rows.map((r) => [
      r.lot, r.cropName, r.fieldName,
      r.harvestDate.toLocaleDateString('ja-JP'),
      r.harvested, r.disposed, r.shipped,
      (r.harvested - r.shipped).toFixed(2), r.unit, r.shipments,
      r.shipped > r.harvested + 0.001 ? '要確認（出荷超過）' : '整合'
    ].join(','));
    const csv = '﻿' + [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `マスバランス_${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('CSVをエクスポートしました');
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl pb-24">
      <h1 className="text-2xl font-bold mb-1">⚖️ マスバランス照合</h1>
      <p className="text-sm text-gray-500 mb-4">
        ロット番号ごとに収穫量と出荷量を突き合わせます。数量の辻褄が合うことは
        トレーサビリティが機能している証拠として審査で確認されます。
      </p>

      {/* 期間指定 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4 flex flex-wrap items-center gap-2">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded px-3 py-2 text-sm" />
        <span className="text-gray-500">〜</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded px-3 py-2 text-sm" />
        <button onClick={exportCsv} className="ml-auto px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">
          CSVエクスポート
        </button>
      </div>

      {inconsistent.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 text-red-800 rounded-lg p-3 mb-4 text-sm">
          ⚠️ 出荷量が収穫量を超えているロットが{inconsistent.length}件あります（
          {inconsistent.slice(0, 3).map((r) => r.lot).join('、')}
          {inconsistent.length > 3 ? ' ほか' : ''}）。
          記録の入力漏れ・重複がないか確認してください。
        </div>
      )}

      {/* 集計サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg shadow p-3">
          <p className="text-xs text-gray-500">総収穫量</p>
          <p className="text-xl font-bold text-green-600">{totals.harvested.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3">
          <p className="text-xs text-gray-500">総出荷量</p>
          <p className="text-xl font-bold text-blue-600">{totals.shipped.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3">
          <p className="text-xs text-gray-500">総廃棄量</p>
          <p className="text-xl font-bold text-red-600">{totals.disposed.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3">
          <p className="text-xs text-gray-500">未出荷（在庫）</p>
          <p className="text-xl font-bold text-gray-700">{(totals.harvested - totals.shipped).toFixed(1)}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">集計中...</p>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          この期間に収穫記録がありません。
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left whitespace-nowrap">ロット番号</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">作物</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">圃場</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">収穫日</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">収穫量</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">廃棄量</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">出荷量</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">残</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">判定</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const remaining = r.harvested - r.shipped;
                const over = r.shipped > r.harvested + 0.001;
                return (
                  <tr key={r.lot} className={`border-t ${over ? 'bg-red-50' : ''}`}>
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-xs">{r.lot}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{r.cropName || '-'}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{r.fieldName || '-'}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{r.harvestDate.toLocaleDateString('ja-JP')}</td>
                    <td className="py-2 px-3 text-right">{r.harvested.toFixed(1)} {r.unit}</td>
                    <td className="py-2 px-3 text-right text-red-600">{r.disposed ? r.disposed.toFixed(1) : '-'}</td>
                    <td className="py-2 px-3 text-right">{r.shipped ? r.shipped.toFixed(1) : '-'}</td>
                    <td className={`py-2 px-3 text-right ${over ? 'text-red-600 font-bold' : ''}`}>
                      {remaining.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {over ? (
                        <span className="text-red-600 font-bold">要確認</span>
                      ) : r.shipped === 0 ? (
                        <span className="text-gray-500">未出荷</span>
                      ) : remaining <= 0.001 ? (
                        <span className="text-green-700">出荷完了</span>
                      ) : (
                        <span className="text-blue-600">一部出荷</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MassBalanceReport;
