// src/pages/Biodiversity/BiodiversityList.jsx
// 生物多様性モニタリングの一覧と経年変化。
// 生物多様性計画の「年2回の定期観察」「データベース化・経年変化の追跡」に対応する。
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  SPECIES_CATEGORIES,
  getBiodiversitySurveys,
  deleteBiodiversitySurvey,
  aggregateByFiscalYear,
  fiscalYearOf,
  buildBiodiversityCsv
} from '../../services/biodiversityService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const BiodiversityList = () => {
  const navigate = useNavigate();
  const { currentOrganization, isMember } = useOrganization();
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      setSurveys(await getBiodiversitySurveys(currentOrganization.id));
    } catch (err) {
      firestoreLogger.error('生物多様性調査の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  const yearly = useMemo(() => aggregateByFiscalYear(surveys), [surveys]);

  // 今年度の実施状況（計画では年2回）
  const currentFy = fiscalYearOf(new Date());
  const thisYear = yearly.find((y) => y.fiscalYear === currentFy);
  const doneThisYear = thisYear?.surveyCount || 0;
  const lastSurvey = surveys[0]?.surveyDate || null;

  const handleDelete = async (e, s) => {
    e.stopPropagation();
    if (!window.confirm(`${s.surveyDate?.toLocaleDateString('ja-JP')} の観察記録を削除しますか？`)) return;
    try {
      await deleteBiodiversitySurvey(s.id);
      setSurveys((prev) => prev.filter((x) => x.id !== s.id));
      toast.success('削除しました');
    } catch (err) {
      firestoreLogger.error('生物多様性調査の削除エラー', { id: s.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const exportCsv = () => {
    if (surveys.length === 0) {
      toast.error('書き出すデータがありません');
      return;
    }
    const csv = buildBiodiversityCsv(surveys);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `生物多様性観察記録_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('CSVを書き出しました');
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl pb-24">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
        <h1 className="text-2xl font-bold">🦋 生物多様性モニタリング</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
            CSV書き出し
          </button>
          {isMember && (
            <Link to="/biodiversity/new" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-center">
              ＋ 観察を記録
            </Link>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        温室周辺および学校敷地内の生物種（植物・昆虫・鳥類等）を定期的に観察し記録します。
        生物多様性計画にもとづき、年2回の実施と経年変化の追跡を行います。
      </p>

      {/* 今年度の実施状況 */}
      <div className={`rounded-lg p-4 mb-4 border-2 ${
        doneThisYear >= 2 ? 'bg-green-50 border-green-300 text-green-900'
          : 'bg-amber-50 border-amber-300 text-amber-900'
      }`}>
        <p className="text-sm">
          <span className="font-bold">{currentFy}年度の実施状況: {doneThisYear} / 2回</span>
          {doneThisYear >= 2
            ? ' — 計画どおり実施できています。'
            : ` — あと${2 - doneThisYear}回の観察が必要です。`}
          {lastSurvey && (
            <span className="block text-xs mt-1">
              前回の観察: {lastSurvey.toLocaleDateString('ja-JP')}
            </span>
          )}
        </p>
      </div>

      {/* 経年変化 */}
      {yearly.length > 0 && (
        <>
          <h2 className="font-bold text-gray-700 mb-2">経年変化（確認された種数）</h2>
          <div className="bg-white shadow rounded-lg overflow-x-auto mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-3 text-left whitespace-nowrap">年度</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">調査回数</th>
                  {SPECIES_CATEGORIES.map((c) => (
                    <th key={c.key} className="py-2 px-3 text-right whitespace-nowrap">{c.icon} {c.key}</th>
                  ))}
                  <th className="py-2 px-3 text-right whitespace-nowrap">合計種数</th>
                </tr>
              </thead>
              <tbody>
                {yearly.map((y, i) => {
                  const prev = yearly[i + 1];
                  const diff = prev ? y.totalSpecies - prev.totalSpecies : null;
                  return (
                    <tr key={y.fiscalYear} className="border-t">
                      <td className="py-2 px-3 font-medium whitespace-nowrap">{y.fiscalYear}年度</td>
                      <td className="py-2 px-3 text-right">
                        {y.surveyCount}
                        {y.surveyCount < 2 && <span className="text-amber-600 ml-1" title="年2回の実施が計画されています">⚠️</span>}
                      </td>
                      {SPECIES_CATEGORIES.map((c) => (
                        <td key={c.key} className="py-2 px-3 text-right">{y.speciesCounts[c.key] || '-'}</td>
                      ))}
                      <td className="py-2 px-3 text-right font-bold">
                        {y.totalSpecies}
                        {diff != null && diff !== 0 && (
                          <span className={`ml-1 text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ({diff > 0 ? '+' : ''}{diff})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            ※ 同じ種を複数回観察しても1種として数えます。前年度との差を括弧内に表示しています。
          </p>
        </>
      )}

      {/* 調査の一覧 */}
      <h2 className="font-bold text-gray-700 mb-2">観察記録</h2>
      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : surveys.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-5xl mb-3">🦋</div>
          <p className="text-gray-600 mb-1">まだ観察記録がありません。</p>
          <p className="text-sm text-gray-500 mb-4">
            温室周辺や学校敷地内を歩いて、見つけた植物・昆虫・鳥を記録してみましょう。
          </p>
          {isMember && (
            <Link to="/biodiversity/new" className="inline-block px-6 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700">
              最初の観察を記録する
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg divide-y">
          {surveys.map((s) => {
            const byCat = {};
            (s.observations || []).forEach((o) => {
              const c = o.category || 'その他の動物';
              byCat[c] = (byCat[c] || 0) + 1;
            });
            return (
              <div
                key={s.id}
                onClick={() => navigate(`/biodiversity/edit/${s.id}`)}
                className="p-4 flex items-start justify-between hover:bg-gray-50 cursor-pointer"
              >
                <div>
                  <p className="font-medium">
                    {s.surveyDate?.toLocaleDateString('ja-JP') || '-'}
                    <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{s.area}</span>
                    {s.weather && <span className="ml-1 text-xs text-gray-500">{s.weather}</span>}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {(s.observations || []).length}種を記録
                    {Object.keys(byCat).length > 0 && (
                      <span className="text-xs text-gray-500 ml-2">
                        （{Object.entries(byCat).map(([c, n]) => {
                          const cat = SPECIES_CATEGORIES.find((x) => x.key === c);
                          return `${cat?.icon || ''}${n}`;
                        }).join(' ')}）
                      </span>
                    )}
                  </p>
                  {s.surveyorNames && <p className="text-xs text-gray-500">観察者: {s.surveyorNames}</p>}
                  {s.notes && <p className="text-xs text-gray-500 mt-1">{s.notes}</p>}
                </div>
                {isMember && (
                  <button
                    onClick={(e) => handleDelete(e, s)}
                    className="text-red-600 hover:text-red-800 text-sm shrink-0 ml-3"
                  >
                    削除
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BiodiversityList;
