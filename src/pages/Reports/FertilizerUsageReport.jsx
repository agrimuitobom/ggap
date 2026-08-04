// src/pages/Reports/FertilizerUsageReport.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import ReportService from '../../services/reportService';
import { firestoreLogger } from '../../utils/logger';
import { format, subMonths } from 'date-fns';
import toast from 'react-hot-toast';
import { summarizeUsage } from '../../services/fertilizerCalc';

const FertilizerUsageReport = () => {
  const { currentUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  const reportService = useMemo(() => new ReportService(currentOrganization?.id), [currentOrganization?.id]);

  const fetchReport = useCallback(async () => {
    if (!currentUser || !currentOrganization) return;

    setLoading(true);
    try {
      // デバッグ情報を記録
      const debugData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        startDate: startDate,
        endDate: endDate,
        startDateObj: new Date(startDate),
        endDateObj: new Date(endDate),
        reportServiceExists: !!reportService,
        timestamp: new Date().toISOString()
      };
      
      firestoreLogger.debug('肥料使用記録レポートの取得を開始します', { ...debugData });
      setDebugInfo(debugData);

      const data = await reportService.getFertilizerUsageReport(
        new Date(startDate),
        new Date(endDate)
      );
      
      firestoreLogger.debug('肥料使用記録レポートのデータを取得しました', {
        dataLength: data.length,
        firstItem: data[0] || null,
        dateRange: data.map(d => d.date).sort()
      });
      
      setReportData(data);
      setDebugInfo(prev => ({
        ...prev,
        resultCount: data.length,
        firstResult: data[0] || null
      }));
      
    } catch (error) {
      firestoreLogger.error('肥料使用記録レポートの取得エラー', {
        organizationId: currentOrganization?.id,
        startDate,
        endDate
      }, error);
      setDebugInfo(prev => ({
        ...prev,
        error: error.message,
        errorStack: error.stack
      }));
      toast.error('レポートの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentUser, currentOrganization, reportService, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      toast.error('エクスポートするデータがありません');
      return;
    }

    const headers = [
      '使用日',
      '圃場名',
      '肥料名',
      '使用量',
      '単位',
      '施肥方法',
      'N成分(%)',
      'P成分(%)',
      'K成分(%)',
      '原液換算量',
      '重量(kg)',
      'N成分量(kg)',
      'P成分量(kg)',
      'K成分量(kg)',
      '施肥者',
      '備考'
    ];

    const csvData = reportData.map(record => [
      format(record.date, 'yyyy年MM月dd日'),
      record.fieldName || '',
      record.fertilizerName || '',
      record.amount || '',
      record.unit || '',
      record.method || '',
      record.nitrogen || '',
      record.phosphorus || '',
      record.potassium || '',
      record.stockAmount !== null && record.stockAmount !== undefined ? record.stockAmount.toFixed(3) : '',
      record.massKg !== null && record.massKg !== undefined ? record.massKg.toFixed(3) : '',
      record.n !== null && record.n !== undefined ? record.n.toFixed(3) : '',
      record.p !== null && record.p !== undefined ? record.p.toFixed(3) : '',
      record.k !== null && record.k !== undefined ? record.k.toFixed(3) : '',
      record.applicator || '',
      record.notes || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `肥料使用記録_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSVファイルをダウンロードしました');
  };


  // 単位別の使用量と、重量に換算できた記録だけの成分量を集計する。
  // L と kg を足すと意味のない数字になるため、単位をまたいだ合計は出さない。
  const summary = summarizeUsage(reportData);
  const npkTotals = { N: summary.nutrients.n, P: summary.nutrients.p, K: summary.nutrients.k };
  const unitEntries = Object.entries(summary.byUnit);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-500">レポートを生成中...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">肥料使用記録簿</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
            >
              DEBUG
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              disabled={reportData.length === 0}
            >
              CSV出力
            </button>
          </div>
        </div>

        {/* 期間選択 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              終了日
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchReport}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              レポート更新
            </button>
          </div>
        </div>

        {/* デバッグ情報 */}
        {showDebug && debugInfo && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="text-lg font-semibold text-yellow-800 mb-3">デバッグ情報</h3>
            <pre className="text-xs text-yellow-700 bg-yellow-100 p-3 rounded overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}

        {/* 統計サマリー */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-blue-800">施肥回数</h3>
            <p className="text-2xl font-bold text-blue-600">{reportData.length}回</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-green-800">使用肥料種類</h3>
            <p className="text-2xl font-bold text-green-600">
              {[...new Set(reportData.map(r => r.fertilizerName))].length}種類
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-purple-800">対象圃場</h3>
            <p className="text-2xl font-bold text-purple-600">
              {[...new Set(reportData.map(r => r.fieldName))].length}圃場
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-orange-800">使用量（単位別）</h3>
            {unitEntries.length === 0 ? (
              <p className="text-2xl font-bold text-orange-600">—</p>
            ) : (
              unitEntries.map(([unit, total]) => (
                <p key={unit} className="text-2xl font-bold text-orange-600">
                  {total.toFixed(1)}{unit}
                </p>
              ))
            )}
          </div>
        </div>

        {/* NPK成分サマリー */}
        <p className="text-sm text-gray-600 mb-2">
          成分量は「原液の重量 × 保証成分（%）」で計算しています
          （{reportData.length}件中 {summary.convertedCount}件を計算に使用）。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-red-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-red-800">窒素(N)成分総量</h3>
            <p className="text-2xl font-bold text-red-600">{npkTotals.N.toFixed(2)}kg</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-yellow-800">リン酸(P)成分総量</h3>
            <p className="text-2xl font-bold text-yellow-600">{npkTotals.P.toFixed(2)}kg</p>
          </div>
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-blue-800">カリウム(K)成分総量</h3>
            <p className="text-2xl font-bold text-blue-600">{npkTotals.K.toFixed(2)}kg</p>
          </div>
        </div>

        {/* 計算できなかった理由を隠さずに出す */}
        {summary.missingNutrientNames.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded p-3 mb-4 text-sm text-amber-900">
            <p className="font-bold mb-1">成分（N-P-K）が未登録の肥料があります</p>
            <p>
              {summary.missingNutrientNames.join('、')} は成分が0%として計算されています。
              <Link to="/fertilizers" className="underline font-medium ml-1">肥料一覧</Link>
              から成分を入力すると、過去の記録もすべて計算し直されます（記録の入れ直しは不要です）。
            </p>
          </div>
        )}

        {summary.unconvertible.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded p-3 mb-4 text-sm text-amber-900">
            <p className="font-bold mb-1">
              重量に換算できなかった記録が{summary.unconvertible.length}件あります（成分量に含めていません）
            </p>
            <ul className="list-disc list-outside ml-5">
              {[...new Set(summary.unconvertible.map((r) => `${r.fertilizerName}：${r.calcReason}`))]
                .slice(0, 5)
                .map((line, i) => <li key={i}>{line}</li>)}
            </ul>
            <p className="mt-1">
              液肥は
              <Link to="/fertilizers" className="underline font-medium mx-1">肥料一覧</Link>
              で「性状＝液体」と「比重(kg/L)」を登録すると計算できるようになります。
            </p>
          </div>
        )}

        {/* レポートテーブル */}
        {reportData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    使用日
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    圃場名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    肥料名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    使用量
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    施肥方法
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    成分(%)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    成分量(kg)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    実施者
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reportData.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {format(record.date, 'yyyy年MM月dd日')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {record.fieldName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {record.fertilizerName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {record.amount || '-'} {record.unit || ''}
                      {record.amountBasis === '希釈後' && record.dilutionRatio && (
                        <div className="text-xs text-gray-500">
                          {record.dilutionRatio}倍希釈 → 原液 {record.stockAmount?.toFixed(2)}{record.unit}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {record.method || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      <div className="text-xs">
                        <div>N: {record.nitrogen || 0}%</div>
                        <div>P: {record.phosphorus || 0}%</div>
                        <div>K: {record.potassium || 0}%</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {record.massKg === null ? (
                        <span className="text-xs text-amber-700">換算不可</span>
                      ) : (
                        <div className="text-xs">
                          <div>N: {record.n.toFixed(3)}</div>
                          <div>P: {record.p.toFixed(3)}</div>
                          <div>K: {record.k.toFixed(3)}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {record.applicator || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">
              指定期間内に肥料使用記録がありません
            </div>
            <p className="text-gray-400 mt-2">
              期間を変更して再度検索してください
            </p>
          </div>
        )}

        {/* GAP認証注意事項 */}
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="text-lg font-semibold text-green-800 mb-2">GAP認証における注意事項</h3>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• 土壌分析結果に基づく適正施肥量の設定を記録してください</li>
            <li>• 有機質肥料の完熟度確認記録を保管してください</li>
            <li>• 施肥設計書と実績の照合を定期的に行ってください</li>
            <li>• 環境負荷軽減のための施肥改善取組を記録してください</li>
            <li>• 肥料の保管・管理状況の点検記録を併せて保管してください</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FertilizerUsageReport;