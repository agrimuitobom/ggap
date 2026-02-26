// src/pages/Reports/PesticideUsageReport.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ReportService from '../../services/reportService';
import { format, subMonths } from 'date-fns';
import toast from 'react-hot-toast';

const PesticideUsageReport = () => {
  const { currentUser } = useAuth();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const reportService = useMemo(() => new ReportService(currentUser?.uid), [currentUser?.uid]);

  const fetchReport = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const data = await reportService.getPesticideUsageReport(
        new Date(startDate),
        new Date(endDate)
      );
      setReportData(data);
    } catch (error) {
      console.error('農薬使用記録レポートの取得エラー:', error);
      toast.error('レポートの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentUser, reportService, startDate, endDate]);

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
      '農薬名',
      '対象病害虫',
      '希釈倍率',
      '散布方法',
      '天候',
      '気温(°C)',
      '風速(m/s)',
      '散布者',
      '備考'
    ];

    const csvData = reportData.map(record => [
      format(record.date, 'yyyy年MM月dd日'),
      record.fieldName || '',
      record.pesticideName || '',
      record.targetPest || '',
      record.dilutionRate || '',
      record.applicationMethod || '',
      record.weather || '',
      record.temperature || '',
      record.windSpeed || '',
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
    link.setAttribute('download', `農薬使用記録_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSVファイルをダウンロードしました');
  };


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
          <h1 className="text-2xl font-bold text-gray-800">農薬使用記録簿</h1>
          <div className="flex space-x-2">
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

        {/* 統計サマリー */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-blue-800">使用回数</h3>
            <p className="text-2xl font-bold text-blue-600">{reportData.length}回</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-green-800">使用農薬種類</h3>
            <p className="text-2xl font-bold text-green-600">
              {[...new Set(reportData.map(r => r.pesticideName))].length}種類
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-purple-800">対象圃場</h3>
            <p className="text-2xl font-bold text-purple-600">
              {[...new Set(reportData.map(r => r.fieldName))].length}圃場
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded">
            <h3 className="text-lg font-semibold text-orange-800">対象病害虫</h3>
            <p className="text-2xl font-bold text-orange-600">
              {[...new Set(reportData.map(r => r.targetPest).filter(Boolean))].length}種類
            </p>
          </div>
        </div>

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
                    農薬名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    対象病害虫
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    希釈倍率
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    散布方法
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    天候・環境
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    散布者
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
                      {record.pesticideName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {record.targetPest || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {record.dilutionRate || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {record.applicationMethod || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      <div className="text-xs">
                        {record.weather && <div>天候: {record.weather}</div>}
                        {record.temperature && <div>気温: {record.temperature}°C</div>}
                        {record.windSpeed && <div>風速: {record.windSpeed}m/s</div>}
                      </div>
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
              指定期間内に農薬使用記録がありません
            </div>
            <p className="text-gray-400 mt-2">
              期間を変更して再度検索してください
            </p>
          </div>
        )}

        {/* GAP認証注意事項 */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">GAP認証における注意事項</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• 農薬使用前後の安全管理記録を別途保管してください</li>
            <li>• 収穫前日数（PHI）の遵守状況を確認してください</li>
            <li>• 農薬登録番号と使用基準の適合性を定期的に確認してください</li>
            <li>• 散布者の資格・研修受講状況を記録に含めてください</li>
            <li>• 近隣への飛散防止対策の実施状況を記録してください</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PesticideUsageReport;