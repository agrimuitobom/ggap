// src/pages/Reports/TrainingReport.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ReportService } from '../../services/reportService';
import { format } from 'date-fns';
import logger from '../../utils/logger';

const TrainingReport = () => {
  const { currentUser } = useAuth();
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const reportService = useMemo(() => new ReportService(currentUser?.uid), [currentUser?.uid]);

  const fetchReport = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const data = await reportService.getTrainingReport(
        new Date(startDate),
        new Date(endDate)
      );
      
      setReport(data);
    } catch (err) {
      logger.error('Error fetching training report', {}, err);
      setError('教育・訓練記録の取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [currentUser, reportService, startDate, endDate]);

  useEffect(() => {
    if (currentUser) {
      fetchReport();
    }
  }, [currentUser, fetchReport]);


  const exportToCSV = () => {
    const headers = [
      '実施日',
      '研修タイトル',
      'カテゴリ',
      '講師',
      '参加者',
      '実施時間',
      '状態',
      '研修内容',
      '使用材料',
      '備考'
    ];
    
    const csvData = report.map(training => [
      format(training.date, 'yyyy-MM-dd'),
      training.title,
      training.category || '',
      training.instructor || '',
      training.participants?.join('; ') || '',
      training.duration || '',
      training.status || '予定',
      training.description || '',
      training.materials || '',
      training.notes || ''
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `教育訓練記録簿_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  return (
    <div className="mobile-container">
      <h1 className="mobile-text-lg font-bold mb-6">教育・訓練記録簿</h1>
      
      {/* 期間設定 */}
      <div className="mobile-card mb-6">
        <h2 className="mobile-text-base font-semibold mb-4">期間設定</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mobile-form-group">
            <label className="mobile-form-label">開始日</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mobile-input w-full"
            />
          </div>
          <div className="mobile-form-group">
            <label className="mobile-form-label">終了日</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mobile-input w-full"
            />
          </div>
        </div>
        <button
          onClick={fetchReport}
          className="mobile-btn mobile-btn-primary mt-4"
          disabled={loading}
        >
          {loading ? 'データ取得中...' : 'レポート生成'}
        </button>
      </div>

      {error && (
        <div className="mobile-alert mobile-alert-error mb-6">
          {error}
        </div>
      )}

      {/* エクスポートボタン */}
      {report.length > 0 && (
        <div className="mobile-card mb-6">
          <h2 className="mobile-text-base font-semibold mb-4">エクスポート</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={exportToCSV}
              className="mobile-btn mobile-btn-secondary flex-1"
            >
              📊 CSV出力
            </button>
          </div>
        </div>
      )}

      {/* 統計サマリー */}
      {report.length > 0 && (
        <div className="mobile-card mb-6">
          <h2 className="mobile-text-base font-semibold mb-4">研修統計</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{report.length}</div>
              <div className="text-sm text-gray-600">総研修数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {report.filter(t => t.status === '完了').length}
              </div>
              <div className="text-sm text-gray-600">完了研修</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {report.filter(t => t.status === '進行中').length}
              </div>
              <div className="text-sm text-gray-600">進行中</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {report.length > 0 ? Math.round((report.filter(t => t.status === '完了').length / report.length) * 100) : 0}%
              </div>
              <div className="text-sm text-gray-600">完了率</div>
            </div>
          </div>
        </div>
      )}

      {/* カテゴリ別集計 */}
      {report.length > 0 && (
        <div className="mobile-card mb-6">
          <h2 className="mobile-text-base font-semibold mb-4">カテゴリ別内訳</h2>
          <div className="space-y-2">
            {Object.entries(
              report.reduce((acc, training) => {
                const category = training.category || 'その他';
                acc[category] = (acc[category] || 0) + 1;
                return acc;
              }, {})
            ).map(([category, count]) => (
              <div key={category} className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="mobile-text-sm">{category}</span>
                <span className="mobile-text-sm font-semibold">{count}件</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 詳細記録 */}
      {loading ? (
        <div className="mobile-loading">
          <div className="mobile-loading-spinner"></div>
          <span className="ml-2">データを読み込み中...</span>
        </div>
      ) : report.length > 0 ? (
        <div className="mobile-card">
          <h2 className="mobile-text-base font-semibold mb-4">研修記録詳細</h2>
          <div className="mobile-table-container">
            <table className="mobile-table min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">実施日</th>
                  <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">研修タイトル</th>
                  <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">カテゴリ</th>
                  <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">講師</th>
                  <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">参加者数</th>
                  <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">実施時間</th>
                  <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">状態</th>
                </tr>
              </thead>
              <tbody>
                {report.map((training) => (
                  <tr key={training.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {format(training.date, 'yyyy年MM月dd日')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium">
                      {training.title}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {training.category || '-'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {training.instructor || '-'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      {training.participants?.length || 0}名
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {training.duration ? `${training.duration}時間` : '-'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        training.status === '完了' 
                          ? 'bg-green-100 text-green-800' 
                          : training.status === '進行中'
                            ? 'bg-blue-100 text-blue-800'
                            : training.status === '予定'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}>
                        {training.status || '予定'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* GAP認証コメント */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">GAP認証に関する注記</h3>
            <p className="text-sm text-blue-700">
              本記録簿は、適正農業規範（GAP）の要求事項に従い、教育・訓練活動を記録したものです。
              定期的な教育・訓練の実施により、食品安全と品質管理の向上を図っています。
            </p>
          </div>
        </div>
      ) : (
        <div className="mobile-empty-state mobile-card">
          <div className="mobile-empty-icon">📚</div>
          <h3 className="mobile-empty-title">教育・訓練記録がありません</h3>
          <p className="mobile-empty-description">
            指定した期間内に教育・訓練記録がありません。期間を変更するか、新しい研修を登録してください。
          </p>
        </div>
      )}
    </div>
  );
};

export default TrainingReport;