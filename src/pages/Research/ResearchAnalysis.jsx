// src/pages/Research/ResearchAnalysis.jsx
// 研究用の集計ビューとCSV書き出し。
// 処理区ごとに反復をまたいだ平均±標準偏差を表示するので、
// そのままグラフのエラーバーとして使える。
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  fetchResearchData,
  summarizePlanting,
  aggregateByTreatment,
  buildPlantingsCsv,
  buildHarvestsCsv,
  buildLaborCsv,
  buildNutrientCsv,
  downloadCsv
} from '../../services/researchService';
import { DISCARD_REASONS } from '../../constants/discardReasons';
import { plantingLabel } from '../../services/plantingService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const fmt = (value, digits = 1) =>
  value == null || Number.isNaN(value) ? '-' : Number(value).toFixed(digits);

/** 平均±標準偏差の表示（反復が1つだとSDは出ない） */
const meanSd = (stat, digits = 1) => {
  if (!stat || stat.mean == null) return '-';
  const m = fmt(stat.mean, digits);
  return stat.sd != null ? `${m} ± ${fmt(stat.sd, digits)}` : m;
};

const ResearchAnalysis = () => {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cropFilter, setCropFilter] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      setData(await fetchResearchData(currentOrganization.id));
    } catch (err) {
      firestoreLogger.error('研究データの取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  // 作物・作次で絞り込んだ作付
  const filteredPlantings = useMemo(() => {
    if (!data) return [];
    return data.plantings.filter((p) =>
      (!cropFilter || p.cropName === cropFilter) &&
      (!cycleFilter || String(p.cropCycle) === cycleFilter)
    );
  }, [data, cropFilter, cycleFilter]);

  const summaries = useMemo(() => {
    if (!data) return [];
    return filteredPlantings.map((p) => summarizePlanting(p, data));
  }, [data, filteredPlantings]);

  const treatments = useMemo(() => aggregateByTreatment(summaries), [summaries]);

  const crops = data ? [...new Set(data.plantings.map((p) => p.cropName).filter(Boolean))] : [];
  const cycles = data ? [...new Set(data.plantings.map((p) => p.cropCycle).filter(Boolean))].sort() : [];

  const exportCsv = (kind) => {
    if (!data) return;
    const stamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const plantingIds = new Set(filteredPlantings.map((p) => p.id));
    try {
      if (kind === 'plantings') {
        downloadCsv(`plantings_${stamp}.csv`, buildPlantingsCsv(filteredPlantings));
      } else if (kind === 'harvests') {
        const rows = data.harvests.filter((h) => !h.plantingId || plantingIds.has(h.plantingId));
        downloadCsv(`harvests_${stamp}.csv`, buildHarvestsCsv(rows, data.plantings));
      } else if (kind === 'labor') {
        const rows = data.workLogs.filter((w) => !w.plantingId || plantingIds.has(w.plantingId));
        downloadCsv(`labor_${stamp}.csv`, buildLaborCsv(rows, data.plantings));
      } else if (kind === 'nutrient') {
        const rows = data.nutrientLogs.filter((n) => !n.plantingId || plantingIds.has(n.plantingId));
        downloadCsv(`nutrient_${stamp}.csv`, buildNutrientCsv(rows, data.plantings));
      }
      toast.success('CSVを書き出しました');
    } catch (err) {
      firestoreLogger.error('CSV書き出しエラー', { kind }, err);
      toast.error('書き出し中にエラーが発生しました');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-5xl">
        <h1 className="text-2xl font-bold mb-4">📊 研究データ分析</h1>
        <p className="text-gray-500">集計中...</p>
      </div>
    );
  }

  const hasPlantings = data && data.plantings.length > 0;

  return (
    <div className="container mx-auto p-4 max-w-5xl pb-24">
      <h1 className="text-2xl font-bold mb-1">📊 研究データ分析</h1>
      <p className="text-sm text-gray-500 mb-4">
        処理区ごとに反復をまたいだ平均と標準偏差を集計します。数値はそのままグラフのエラーバーに使えます。
      </p>

      {!hasPlantings ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-5xl mb-3">🌱</div>
          <p className="text-gray-600 mb-1">作付（処理区）がまだ登録されていません。</p>
          <p className="text-sm text-gray-500">
            「作付・処理区」から実験区を登録し、収穫記録を紐づけると集計されます。
          </p>
        </div>
      ) : (
        <>
          {/* 絞り込み */}
          <div className="bg-white shadow rounded-lg p-4 mb-4 flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">作物</label>
              <select value={cropFilter} onChange={(e) => setCropFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
                <option value="">すべて</option>
                {crops.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">作次</label>
              <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
                <option value="">すべて</option>
                {cycles.map((c) => <option key={c} value={String(c)}>第{c}作</option>)}
              </select>
            </div>
            <div className="ml-auto text-sm text-gray-500">
              対象 {filteredPlantings.length} 作付
            </div>
          </div>

          {/* CSV書き出し */}
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 mb-4">
            <h2 className="font-semibold text-indigo-900 mb-1">📁 分析用CSVの書き出し</h2>
            <p className="text-xs text-indigo-800 mb-3">
              1行1レコードの形式で書き出します（日付はYYYY-MM-DD、単位は列名に記載、UTF-8 BOM付き）。
              Excelやスプレッドシートでそのままグラフにできます。
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => exportCsv('plantings')} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                plantings.csv（作付）
              </button>
              <button onClick={() => exportCsv('harvests')} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                harvests.csv（収穫・廃棄）
              </button>
              <button onClick={() => exportCsv('labor')} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                labor.csv（労働時間）
              </button>
              <button onClick={() => exportCsv('nutrient')} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                nutrient.csv（養液EC）
              </button>
            </div>
          </div>

          {/* 処理区別サマリー */}
          <h2 className="font-bold text-gray-700 mb-2">処理区別の集計（平均 ± 標準偏差）</h2>
          {treatments.length === 0 ? (
            <p className="text-sm text-gray-500 mb-6">該当する作付がありません。</p>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-x-auto mb-6">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-3 text-left whitespace-nowrap">処理区</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">反復</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">収量 (kg/m²)</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">1株重 (g)</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">廃棄率 (%)</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">労働 (人時/m²)</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">EC実測</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">目標EC</th>
                  </tr>
                </thead>
                <tbody>
                  {treatments.map((t) => (
                    <tr key={t.treatment} className="border-t">
                      <td className="py-2 px-3 font-medium whitespace-nowrap">{t.treatment}</td>
                      <td className="py-2 px-3 text-right">
                        {t.replicates}
                        {t.replicates < 3 && <span className="text-amber-600 ml-1" title="反復3以上を推奨">⚠️</span>}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">{meanSd(t.yieldPerArea, 2)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">{meanSd(t.weightPerPlant, 0)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap font-bold">{meanSd(t.discardRate, 1)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">{meanSd(t.laborPerArea, 3)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">{meanSd(t.ecMean, 2)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap text-gray-500">{t.targetEc ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 理由別廃棄率 */}
          {treatments.length > 0 && (
            <>
              <h2 className="font-bold text-gray-700 mb-2">理由別の廃棄率（%・総株数に対する割合）</h2>
              <div className="bg-white shadow rounded-lg overflow-x-auto mb-6">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-3 text-left whitespace-nowrap">処理区</th>
                      {DISCARD_REASONS.map((r) => (
                        <th key={r.key} className="py-2 px-3 text-right whitespace-nowrap">
                          {r.icon} {r.label}
                        </th>
                      ))}
                      <th className="py-2 px-3 text-right whitespace-nowrap">合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatments.map((t) => (
                      <tr key={t.treatment} className="border-t">
                        <td className="py-2 px-3 font-medium whitespace-nowrap">{t.treatment}</td>
                        {DISCARD_REASONS.map((r) => (
                          <td key={r.key} className="py-2 px-3 text-right whitespace-nowrap">
                            {meanSd(t.reasonStats[r.key], 1)}
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right whitespace-nowrap font-bold">
                          {meanSd(t.discardRate, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mb-6">
                ※ 生理障害（チップバーン等）の割合が処理区で違えば、養分管理との関係を考察できます。
              </p>
            </>
          )}

          {/* 作付ごとの内訳 */}
          <h2 className="font-bold text-gray-700 mb-2">作付ごとの内訳</h2>
          <div className="bg-white shadow rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-3 text-left whitespace-nowrap">作付</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">収穫回数</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">可販重量</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">総株数</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">廃棄株数</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">廃棄率(%)</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">延べ人時</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">EC実測</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.planting.id} className="border-t">
                    <td className="py-2 px-3 whitespace-nowrap">{plantingLabel(s.planting)}</td>
                    <td className="py-2 px-3 text-right">{s.harvestCount || '-'}</td>
                    <td className="py-2 px-3 text-right">{s.marketableWeight ? fmt(s.marketableWeight, 1) : '-'}</td>
                    <td className="py-2 px-3 text-right">{s.totalPlants || '-'}</td>
                    <td className="py-2 px-3 text-right">{s.discardedPlants || '-'}</td>
                    <td className="py-2 px-3 text-right font-bold">{fmt(s.discardRate, 1)}</td>
                    <td className="py-2 px-3 text-right">{s.laborHours ? fmt(s.laborHours, 1) : '-'}</td>
                    <td className="py-2 px-3 text-right">
                      {s.ecMean != null ? `${fmt(s.ecMean, 2)} (n=${s.ecCount})` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ResearchAnalysis;
