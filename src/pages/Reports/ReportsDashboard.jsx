// src/pages/Reports/ReportsDashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ReportService from '../../services/reportService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { subMonths } from 'date-fns';
import toast from 'react-hot-toast';

const ReportsDashboard = () => {
  const { currentUser } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('3months');

  const reportService = useMemo(() => new ReportService(currentUser?.uid), [currentUser?.uid]);

  const getPeriodDates = (period) => {
    const endDate = new Date();
    let startDate;

    switch (period) {
      case '1month':
        startDate = subMonths(endDate, 1);
        break;
      case '3months':
        startDate = subMonths(endDate, 3);
        break;
      case '6months':
        startDate = subMonths(endDate, 6);
        break;
      case '1year':
        startDate = subMonths(endDate, 12);
        break;
      default:
        startDate = subMonths(endDate, 3);
    }

    return { startDate, endDate };
  };

  const fetchAnalytics = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const { startDate, endDate } = getPeriodDates(selectedPeriod);
      const data = await reportService.getBusinessAnalytics(startDate, endDate);
      setAnalytics(data);
    } catch (error) {
      console.error('分析データの取得エラー:', error);
      toast.error('分析データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentUser, selectedPeriod, reportService]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // チャート用のカラーパレット
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // 収穫データをチャート用に変換
  const getHarvestChartData = () => {
    if (!analytics?.harvestAnalytics?.byCrop) return [];
    
    return Object.entries(analytics.harvestAnalytics.byCrop).map(([crop, data]) => ({
      name: crop,
      quantity: data.quantity,
      records: data.records
    }));
  };

  // 作業効率データをチャート用に変換
  const getWorkEfficiencyChartData = () => {
    if (!analytics?.workEfficiencyAnalytics?.byWorkType) return [];
    
    return Object.entries(analytics.workEfficiencyAnalytics.byWorkType).map(([workType, data]) => ({
      name: workType,
      hours: data.hours,
      records: data.records
    }));
  };

  // 圃場別パフォーマンスデータをチャート用に変換
  const getFieldPerformanceChartData = () => {
    if (!analytics?.fieldPerformance) return [];
    
    return Object.entries(analytics.fieldPerformance).map(([field, data]) => ({
      name: field,
      harvest: data.harvest,
      workHours: data.workHours,
      efficiency: data.efficiency
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-500">分析データを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">レポート・分析ダッシュボード</h1>
        
        {/* 期間選択 */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1month">過去1ヶ月</option>
            <option value="3months">過去3ヶ月</option>
            <option value="6months">過去6ヶ月</option>
            <option value="1year">過去1年</option>
          </select>
        </div>

        {/* クイックレポートアクセス */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            to="/reports/pesticide-usage"
            className="bg-red-50 border border-red-200 rounded-lg p-4 hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-red-800">農薬使用記録簿</h3>
                <p className="text-sm text-red-600">GAP認証必須</p>
              </div>
              <div className="text-2xl">🧪</div>
            </div>
          </Link>

          <Link
            to="/reports/fertilizer-usage"
            className="bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-green-800">肥料使用記録簿</h3>
                <p className="text-sm text-green-600">GAP認証必須</p>
              </div>
              <div className="text-2xl">🌱</div>
            </div>
          </Link>

          <Link
            to="/reports/training"
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-800">教育記録簿</h3>
                <p className="text-sm text-blue-600">GAP認証必須</p>
              </div>
              <div className="text-2xl">📚</div>
            </div>
          </Link>

          <Link
            to="/reports/traceability"
            className="bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-purple-800">トレーサビリティ</h3>
                <p className="text-sm text-purple-600">出荷管理</p>
              </div>
              <div className="text-2xl">📋</div>
            </div>
          </Link>
        </div>
      </div>

      {/* サマリーカード */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800">総収穫量</h3>
            <p className="text-2xl font-bold text-blue-600">
              {analytics.summary.totalHarvest.toFixed(1)}kg
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800">総作業時間</h3>
            <p className="text-2xl font-bold text-green-600">
              {analytics.summary.totalWorkHours.toFixed(1)}h
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-800">活動圃場数</h3>
            <p className="text-2xl font-bold text-purple-600">
              {analytics.summary.activeFields}圃場
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-orange-800">収穫記録</h3>
            <p className="text-2xl font-bold text-orange-600">
              {analytics.summary.harvestRecords}件
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-red-800">作業記録</h3>
            <p className="text-2xl font-bold text-red-600">
              {analytics.summary.workRecords}件
            </p>
          </div>
        </div>
      )}

      {/* チャートセクション */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 作物別収穫量 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">作物別収穫量</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getHarvestChartData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value, name) => [value + 'kg', '収穫量']} />
              <Bar dataKey="quantity" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 作業タイプ別時間 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">作業タイプ別時間</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={getWorkEfficiencyChartData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="hours"
              >
                {getWorkEfficiencyChartData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value + 'h', '作業時間']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 圃場別パフォーマンス */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">圃場別パフォーマンス</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={getFieldPerformanceChartData()}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="harvest" fill="#82ca9d" name="収穫量(kg)" />
            <Bar dataKey="workHours" fill="#8884d8" name="作業時間(h)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 効率性ランキング */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">圃場効率性ランキング</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">順位</th>
                <th className="px-4 py-2 text-left">圃場名</th>
                <th className="px-4 py-2 text-left">収穫量(kg)</th>
                <th className="px-4 py-2 text-left">作業時間(h)</th>
                <th className="px-4 py-2 text-left">効率性(kg/h)</th>
              </tr>
            </thead>
            <tbody>
              {getFieldPerformanceChartData()
                .sort((a, b) => b.efficiency - a.efficiency)
                .map((field, index) => (
                  <tr key={field.name} className="border-t">
                    <td className="px-4 py-2">{index + 1}</td>
                    <td className="px-4 py-2 font-medium">{field.name}</td>
                    <td className="px-4 py-2">{field.harvest.toFixed(1)}</td>
                    <td className="px-4 py-2">{field.workHours.toFixed(1)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-sm ${
                        field.efficiency > 10 
                          ? 'bg-green-100 text-green-800' 
                          : field.efficiency > 5 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {field.efficiency.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsDashboard;