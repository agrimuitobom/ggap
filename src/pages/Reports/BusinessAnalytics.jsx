// src/pages/Reports/BusinessAnalytics.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ReportService from '../../services/reportService';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { format, subMonths, eachMonthOfInterval } from 'date-fns';
import toast from 'react-hot-toast';
import { businessLogger } from '../../utils/logger';

const BusinessAnalytics = () => {
  const { currentUser } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('1year');
  const [monthlyData, setMonthlyData] = useState([]);

  const reportService = new ReportService(currentUser?.uid);

  const getPeriodDates = (period) => {
    const endDate = new Date();
    let startDate;

    switch (period) {
      case '6months':
        startDate = subMonths(endDate, 6);
        break;
      case '1year':
        startDate = subMonths(endDate, 12);
        break;
      case '2years':
        startDate = subMonths(endDate, 24);
        break;
      default:
        startDate = subMonths(endDate, 12);
    }

    return { startDate, endDate };
  };

  const fetchAnalytics = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const { startDate, endDate } = getPeriodDates(selectedPeriod);
      const data = await reportService.getBusinessAnalytics(startDate, endDate);
      setAnalytics(data);

      // 月別データを生成
      await generateMonthlyData(startDate, endDate);
    } catch (error) {
      businessLogger.error('経営分析データの取得エラー', { component: 'BusinessAnalytics', period: selectedPeriod }, error);
      toast.error('経営分析データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyData = async (startDate, endDate) => {
    try {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      const monthlyAnalytics = [];

      for (const month of months) {
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        
        const monthData = await reportService.getBusinessAnalytics(monthStart, monthEnd);
        
        monthlyAnalytics.push({
          month: format(month, 'yyyy-MM'),
          monthName: format(month, 'MM月'),
          totalHarvest: monthData.summary.totalHarvest,
          totalWorkHours: monthData.summary.totalWorkHours,
          efficiency: monthData.summary.totalWorkHours > 0 
            ? monthData.summary.totalHarvest / monthData.summary.totalWorkHours 
            : 0,
          activeFields: monthData.summary.activeFields,
          harvestRecords: monthData.summary.harvestRecords,
          workRecords: monthData.summary.workRecords
        });
      }

      setMonthlyData(monthlyAnalytics);
    } catch (error) {
      businessLogger.error('月別データの生成エラー', { component: 'BusinessAnalytics', period: selectedPeriod }, error);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [currentUser, selectedPeriod]);

  // 生産性指標の計算
  const calculateProductivityMetrics = () => {
    if (!analytics) return {};

    const totalHarvest = analytics.summary.totalHarvest;
    const totalWorkHours = analytics.summary.totalWorkHours;
    const activeFields = analytics.summary.activeFields;

    return {
      harvestPerHour: totalWorkHours > 0 ? totalHarvest / totalWorkHours : 0,
      harvestPerField: activeFields > 0 ? totalHarvest / activeFields : 0,
      workHoursPerField: activeFields > 0 ? totalWorkHours / activeFields : 0,
      recordsPerField: activeFields > 0 ? analytics.summary.harvestRecords / activeFields : 0
    };
  };

  // 成長率の計算
  const calculateGrowthRates = () => {
    if (monthlyData.length < 2) return {};

    const latest = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];

    return {
      harvestGrowth: previous.totalHarvest > 0 
        ? ((latest.totalHarvest - previous.totalHarvest) / previous.totalHarvest) * 100 
        : 0,
      efficiencyGrowth: previous.efficiency > 0 
        ? ((latest.efficiency - previous.efficiency) / previous.efficiency) * 100 
        : 0,
      productivityTrend: monthlyData.slice(-3).map(d => d.efficiency).reduce((a, b) => a + b, 0) / 3
    };
  };

  const productivityMetrics = calculateProductivityMetrics();
  const growthRates = calculateGrowthRates();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-500">経営分析データを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">経営分析・収益性分析</h1>
        
        {/* 期間選択 */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="6months">過去6ヶ月</option>
            <option value="1year">過去1年</option>
            <option value="2years">過去2年</option>
          </select>
        </div>
      </div>

      {/* KPIサマリー */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800">時間当たり収穫量</h3>
          <p className="text-2xl font-bold text-blue-600">
            {productivityMetrics.harvestPerHour?.toFixed(2) || '0.00'}
          </p>
          <p className="text-sm text-blue-600">kg/h</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800">圃場当たり収穫量</h3>
          <p className="text-2xl font-bold text-green-600">
            {productivityMetrics.harvestPerField?.toFixed(1) || '0.0'}
          </p>
          <p className="text-sm text-green-600">kg/圃場</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-800">圃場当たり作業時間</h3>
          <p className="text-2xl font-bold text-purple-600">
            {productivityMetrics.workHoursPerField?.toFixed(1) || '0.0'}
          </p>
          <p className="text-sm text-purple-600">h/圃場</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-800">圃場当たり収穫回数</h3>
          <p className="text-2xl font-bold text-orange-600">
            {productivityMetrics.recordsPerField?.toFixed(1) || '0.0'}
          </p>
          <p className="text-sm text-orange-600">回/圃場</p>
        </div>
      </div>

      {/* 成長率指標 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-800">前月比収穫量成長率</h3>
          <p className={`text-2xl font-bold ${
            growthRates.harvestGrowth > 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {growthRates.harvestGrowth?.toFixed(1) || '0.0'}%
          </p>
          <p className="text-sm text-gray-600">
            {growthRates.harvestGrowth > 0 ? '↗ 成長' : '↘ 減少'}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-800">前月比効率性成長率</h3>
          <p className={`text-2xl font-bold ${
            growthRates.efficiencyGrowth > 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {growthRates.efficiencyGrowth?.toFixed(1) || '0.0'}%
          </p>
          <p className="text-sm text-gray-600">
            {growthRates.efficiencyGrowth > 0 ? '↗ 改善' : '↘ 悪化'}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-800">3ヶ月平均生産性</h3>
          <p className="text-2xl font-bold text-blue-600">
            {growthRates.productivityTrend?.toFixed(2) || '0.00'}
          </p>
          <p className="text-sm text-gray-600">kg/h (移動平均)</p>
        </div>
      </div>

      {/* 月別トレンド分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 収穫量トレンド */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">月別収穫量トレンド</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthName" />
              <YAxis />
              <Tooltip formatter={(value) => [value + 'kg', '収穫量']} />
              <Area 
                type="monotone" 
                dataKey="totalHarvest" 
                stroke="#8884d8" 
                fill="#8884d8" 
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 効率性トレンド */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">月別効率性トレンド</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthName" />
              <YAxis />
              <Tooltip formatter={(value) => [value.toFixed(2) + 'kg/h', '効率性']} />
              <Line 
                type="monotone" 
                dataKey="efficiency" 
                stroke="#82ca9d" 
                strokeWidth={3}
                dot={{ fill: '#82ca9d', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 作業時間 vs 収穫量 */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">月別作業時間 vs 収穫量</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="totalWorkHours" fill="#ffc658" name="作業時間(h)" />
            <Bar dataKey="totalHarvest" fill="#8884d8" name="収穫量(kg)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 詳細データテーブル */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">月別詳細データ</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">月</th>
                <th className="px-4 py-2 text-left">収穫量(kg)</th>
                <th className="px-4 py-2 text-left">作業時間(h)</th>
                <th className="px-4 py-2 text-left">効率性(kg/h)</th>
                <th className="px-4 py-2 text-left">活動圃場数</th>
                <th className="px-4 py-2 text-left">収穫記録数</th>
                <th className="px-4 py-2 text-left">作業記録数</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((month, index) => (
                <tr key={month.month} className="border-t">
                  <td className="px-4 py-2 font-medium">{month.monthName}</td>
                  <td className="px-4 py-2">{month.totalHarvest.toFixed(1)}</td>
                  <td className="px-4 py-2">{month.totalWorkHours.toFixed(1)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-sm ${
                      month.efficiency > 10 
                        ? 'bg-green-100 text-green-800' 
                        : month.efficiency > 5 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {month.efficiency.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-2">{month.activeFields}</td>
                  <td className="px-4 py-2">{month.harvestRecords}</td>
                  <td className="px-4 py-2">{month.workRecords}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 改善提案 */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">経営改善の提案</h3>
        <div className="text-sm text-blue-700 space-y-2">
          {productivityMetrics.harvestPerHour < 5 && (
            <div>• 作業効率が低下しています。作業手順の見直しや設備投資を検討してください。</div>
          )}
          {growthRates.harvestGrowth < 0 && (
            <div>• 収穫量が減少傾向にあります。栽培技術の見直しや土壌改良を検討してください。</div>
          )}
          {monthlyData.length > 3 && monthlyData.slice(-3).every(m => m.efficiency < 3) && (
            <div>• 継続的に効率性が低下しています。作業プロセスの抜本的な見直しが必要です。</div>
          )}
          <div>• 定期的なデータ分析により、さらなる改善機会を発見できます。</div>
        </div>
      </div>
    </div>
  );
};

export default BusinessAnalytics;