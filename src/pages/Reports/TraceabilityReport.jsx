// src/pages/Reports/TraceabilityReport.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ReportService } from '../../services/reportService';
import { format } from 'date-fns';

const TraceabilityReport = () => {
  const { currentUser } = useAuth();
  const [report, setReport] = useState({ harvests: [], shipments: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedLot, setSelectedLot] = useState('');

  const reportService = useMemo(() => new ReportService(currentUser?.uid), [currentUser?.uid]);

  const fetchReport = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const data = await reportService.getTraceabilityReport(
        new Date(startDate),
        new Date(endDate)
      );
      
      setReport(data);
    } catch (err) {
      console.error('Error fetching traceability report:', err);
      setError('トレーサビリティレポートの取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [currentUser, reportService, startDate, endDate]);

  useEffect(() => {
    if (currentUser) {
      fetchReport();
    }
  }, [currentUser, fetchReport]);

  // ロット番号別のトレーサビリティチェーン構築
  const buildTraceabilityChain = () => {
    const chains = {};
    
    // 収穫記録をベースに
    report.harvests.forEach(harvest => {
      const relatedShipments = report.shipments.filter(shipment => 
        shipment.harvestId === harvest.id || 
        shipment.lotNumber === harvest.lotNumber ||
        (shipment.cropName === harvest.cropName && shipment.fieldName === harvest.fieldName)
      );
      
      const lotNumber = harvest.lotNumber || `LOT-${harvest.id?.substring(0, 8)}`;
      
      chains[lotNumber] = {
        harvest,
        shipments: relatedShipments,
        lotNumber
      };
    });
    
    return chains;
  };

  const traceabilityChains = buildTraceabilityChain();


  const exportToCSV = () => {
    const headers = [
      'ロット番号',
      '収穫日',
      '圃場名',
      '作物名',
      '収穫量',
      '単位',
      '品質等級',
      '出荷日',
      '出荷先',
      '出荷量',
      '出荷状態'
    ];
    
    const csvData = [];
    
    Object.entries(traceabilityChains).forEach(([lotNumber, chain]) => {
      if (chain.shipments.length > 0) {
        chain.shipments.forEach(shipment => {
          csvData.push([
            lotNumber,
            format(chain.harvest.date, 'yyyy-MM-dd'),
            chain.harvest.fieldName,
            chain.harvest.cropName,
            chain.harvest.quantity,
            chain.harvest.unit,
            chain.harvest.qualityGrade || '',
            format(shipment.date, 'yyyy-MM-dd'),
            shipment.destination,
            shipment.quantity,
            shipment.status
          ]);
        });
      } else {
        csvData.push([
          lotNumber,
          format(chain.harvest.date, 'yyyy-MM-dd'),
          chain.harvest.fieldName,
          chain.harvest.cropName,
          chain.harvest.quantity,
          chain.harvest.unit,
          chain.harvest.qualityGrade || '',
          '',
          '未出荷',
          '',
          ''
        ]);
      }
    });
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `トレーサビリティ報告書_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const filteredChains = selectedLot 
    ? Object.fromEntries(Object.entries(traceabilityChains).filter(([lot]) => lot.includes(selectedLot)))
    : traceabilityChains;

  return (
    <div className="mobile-container">
      <h1 className="mobile-text-lg font-bold mb-6">トレーサビリティ報告書</h1>
      
      {/* 期間設定・フィルター */}
      <div className="mobile-card mb-6">
        <h2 className="mobile-text-base font-semibold mb-4">検索条件</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="mobile-form-group">
            <label className="mobile-form-label">ロット番号</label>
            <input
              type="text"
              value={selectedLot}
              onChange={(e) => setSelectedLot(e.target.value)}
              placeholder="ロット番号で検索"
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
      {Object.keys(filteredChains).length > 0 && (
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
      {Object.keys(filteredChains).length > 0 && (
        <div className="mobile-card mb-6">
          <h2 className="mobile-text-base font-semibold mb-4">トレーサビリティ統計</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{report.harvests.length}</div>
              <div className="text-sm text-gray-600">収穫記録</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{report.shipments.length}</div>
              <div className="text-sm text-gray-600">出荷記録</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{Object.keys(traceabilityChains).length}</div>
              <div className="text-sm text-gray-600">トレースチェーン</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {report.harvests.length > 0 
                  ? Math.round((report.shipments.length / report.harvests.length) * 100)
                  : 0}%
              </div>
              <div className="text-sm text-gray-600">出荷率</div>
            </div>
          </div>
        </div>
      )}

      {/* トレーサビリティチェーン */}
      {loading ? (
        <div className="mobile-loading">
          <div className="mobile-loading-spinner"></div>
          <span className="ml-2">データを読み込み中...</span>
        </div>
      ) : Object.keys(filteredChains).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(filteredChains).map(([lotNumber, chain]) => (
            <div key={lotNumber} className="mobile-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="mobile-text-base font-bold text-blue-800">
                  🏷️ ロット番号: {lotNumber}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  chain.shipments.length > 0 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {chain.shipments.length > 0 ? '出荷済み' : '未出荷'}
                </span>
              </div>
              
              {/* 収穫情報 */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                  🌾 収穫情報
                </h4>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-600">収穫日:</span>
                      <span className="ml-2">{format(chain.harvest.date, 'yyyy年MM月dd日')}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">圃場:</span>
                      <span className="ml-2">{chain.harvest.fieldName}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">作物:</span>
                      <span className="ml-2">{chain.harvest.cropName}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">収穫量:</span>
                      <span className="ml-2">{chain.harvest.quantity} {chain.harvest.unit}</span>
                    </div>
                    {chain.harvest.qualityGrade && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">品質等級:</span>
                        <span className="ml-2">{chain.harvest.qualityGrade}</span>
                      </div>
                    )}
                  </div>
                  {chain.harvest.notes && (
                    <div className="mt-3">
                      <span className="text-sm font-medium text-gray-600">備考:</span>
                      <span className="ml-2">{chain.harvest.notes}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 出荷情報 */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                  📦 出荷情報
                </h4>
                {chain.shipments.length > 0 ? (
                  <div className="space-y-3">
                    {chain.shipments.map((shipment, index) => (
                      <div key={shipment.id} className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">出荷 #{index + 1}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            shipment.status === '完了' 
                              ? 'bg-green-100 text-green-800' 
                              : shipment.status === '準備中'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                          }`}>
                            {shipment.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-600">出荷日:</span>
                            <span className="ml-2">{format(shipment.date, 'yyyy年MM月dd日')}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">出荷先:</span>
                            <span className="ml-2">{shipment.destination}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">出荷量:</span>
                            <span className="ml-2">{shipment.quantity} {shipment.unit}</span>
                          </div>
                          {shipment.lotNumber && (
                            <div>
                              <span className="font-medium text-gray-600">出荷ロット:</span>
                              <span className="ml-2">{shipment.lotNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-600">
                    まだ出荷されていません
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* GAP認証コメント */}
          <div className="mobile-card">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">GAP認証に関する注記</h3>
              <p className="text-sm text-blue-700">
                本トレーサビリティ報告書は、適正農業規範（GAP）の要求事項に従い、
                収穫から出荷までの完全な追跡記録を提供しています。
                食品安全と品質保証のため、すべての工程が記録・管理されています。
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mobile-empty-state mobile-card">
          <div className="mobile-empty-icon">📋</div>
          <h3 className="mobile-empty-title">トレーサビリティ記録がありません</h3>
          <p className="mobile-empty-description">
            指定した期間内にトレーサビリティ記録がありません。期間を変更するか、収穫・出荷記録を登録してください。
          </p>
        </div>
      )}
    </div>
  );
};

export default TraceabilityReport;