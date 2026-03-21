// src/pages/Reports/TraceabilityReport.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ReportService } from '../../services/reportService';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import jsPDF from 'jspdf';
import logger from '../../utils/logger';

const TraceabilityReport = () => {
  const { currentUser } = useAuth();
  const [report, setReport] = useState({
    harvests: [],
    shipments: [],
    pesticideUses: [],
    fertilizerUses: [],
    workLogs: []
  });
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
  const [selectedLot, setSelectedLot] = useState('');
  const [searchMode, setSearchMode] = useState('forward'); // forward: 生産→出荷, reverse: 出荷→生産
  const [reverseSearchDestination, setReverseSearchDestination] = useState('');

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
      logger.error('Error fetching traceability report', {}, err);
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

  // ロット番号別のトレーサビリティチェーン構築（拡張版）
  const buildTraceabilityChain = useCallback(() => {
    const chains = {};

    report.harvests.forEach(harvest => {
      const lotNumber = harvest.lotNumber || `LOT-${harvest.id?.substring(0, 8)}`;

      // 関連する出荷記録
      const relatedShipments = report.shipments.filter(shipment =>
        shipment.harvestId === harvest.id ||
        shipment.lotNumber === lotNumber ||
        (shipment.cropName === harvest.cropName && shipment.fieldName === harvest.fieldName)
      );

      // 関連する農薬使用記録（圃場と日付で紐付け）
      const relatedPesticides = report.pesticideUses.filter(pu =>
        (pu.fieldId === harvest.fieldId || pu.fieldName === harvest.fieldName) &&
        pu.date <= harvest.date
      );

      // 関連する肥料使用記録
      const relatedFertilizers = report.fertilizerUses.filter(fu =>
        (fu.fieldId === harvest.fieldId || fu.fieldName === harvest.fieldName) &&
        fu.date <= harvest.date
      );

      // 関連する作業記録
      const relatedWorkLogs = report.workLogs.filter(wl =>
        (wl.fieldId === harvest.fieldId || wl.fieldName === harvest.fieldName) &&
        wl.date <= harvest.date
      );

      // タイムラインイベントを構築
      const timelineEvents = [
        ...relatedPesticides.map(p => ({ ...p, eventType: 'pesticide', icon: '🧪' })),
        ...relatedFertilizers.map(f => ({ ...f, eventType: 'fertilizer', icon: '🌱' })),
        ...relatedWorkLogs.map(w => ({ ...w, eventType: 'workLog', icon: '🔧' })),
        { ...harvest, eventType: 'harvest', icon: '🌾' },
        ...relatedShipments.map(s => ({ ...s, eventType: 'shipment', icon: '📦' }))
      ].sort((a, b) => new Date(a.date) - new Date(b.date));

      chains[lotNumber] = {
        harvest,
        shipments: relatedShipments,
        pesticides: relatedPesticides,
        fertilizers: relatedFertilizers,
        workLogs: relatedWorkLogs,
        timeline: timelineEvents,
        lotNumber
      };
    });

    return chains;
  }, [report]);

  const traceabilityChains = useMemo(() => buildTraceabilityChain(), [buildTraceabilityChain]);

  // 逆引き検索（出荷先から生産履歴を追跡）
  const reverseTraceability = useMemo(() => {
    if (searchMode !== 'reverse' || !reverseSearchDestination) return null;

    const matchingShipments = report.shipments.filter(s =>
      s.destination?.toLowerCase().includes(reverseSearchDestination.toLowerCase())
    );

    const relatedChains = {};
    matchingShipments.forEach(shipment => {
      // ロット番号または収穫IDで紐付け
      Object.entries(traceabilityChains).forEach(([lotNumber, chain]) => {
        if (chain.shipments.some(s => s.id === shipment.id)) {
          relatedChains[lotNumber] = chain;
        }
      });
    });

    return relatedChains;
  }, [searchMode, reverseSearchDestination, report.shipments, traceabilityChains]);

  // フィルタリング
  const filteredChains = useMemo(() => {
    if (searchMode === 'reverse' && reverseTraceability) {
      return reverseTraceability;
    }

    if (selectedLot) {
      return Object.fromEntries(
        Object.entries(traceabilityChains).filter(([lot]) =>
          lot.toLowerCase().includes(selectedLot.toLowerCase())
        )
      );
    }

    return traceabilityChains;
  }, [searchMode, reverseTraceability, selectedLot, traceabilityChains]);

  // CSV出力
  const exportToCSV = () => {
    const headers = [
      'ロット番号', '収穫日', '圃場名', '作物名', '収穫量', '単位', '品質等級',
      '農薬使用回数', '肥料使用回数', '作業記録数',
      '出荷日', '出荷先', '出荷量', '出荷状態'
    ];

    const csvData = [];

    Object.entries(filteredChains).forEach(([lotNumber, chain]) => {
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
            chain.pesticides.length,
            chain.fertilizers.length,
            chain.workLogs.length,
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
          chain.pesticides.length,
          chain.fertilizers.length,
          chain.workLogs.length,
          '', '未出荷', '', ''
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

  // PDF出力
  const exportToPDF = () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPos = 20;

    // タイトル
    pdf.setFontSize(18);
    pdf.text('トレーサビリティ報告書', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // 期間
    pdf.setFontSize(10);
    pdf.text(`期間: ${startDate} 〜 ${endDate}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    pdf.text(`出力日: ${format(new Date(), 'yyyy年MM月dd日', { locale: ja })}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // 各ロットの詳細
    Object.entries(filteredChains).forEach(([lotNumber, chain], index) => {
      if (yPos > 250) {
        pdf.addPage();
        yPos = 20;
      }

      // ロット番号
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text(`Lot: ${lotNumber}`, 15, yPos);
      yPos += 8;

      pdf.setFontSize(9);
      pdf.setFont(undefined, 'normal');

      // 収穫情報
      pdf.text(`[収穫] ${format(chain.harvest.date, 'yyyy/MM/dd')} | ${chain.harvest.fieldName} | ${chain.harvest.cropName} | ${chain.harvest.quantity}${chain.harvest.unit}`, 20, yPos);
      yPos += 5;

      // 農薬・肥料使用
      if (chain.pesticides.length > 0) {
        pdf.text(`[農薬] ${chain.pesticides.length}回使用`, 20, yPos);
        yPos += 5;
      }
      if (chain.fertilizers.length > 0) {
        pdf.text(`[肥料] ${chain.fertilizers.length}回使用`, 20, yPos);
        yPos += 5;
      }

      // 出荷情報
      if (chain.shipments.length > 0) {
        chain.shipments.forEach(shipment => {
          pdf.text(`[出荷] ${format(shipment.date, 'yyyy/MM/dd')} | ${shipment.destination} | ${shipment.quantity}${shipment.unit} | ${shipment.status}`, 20, yPos);
          yPos += 5;
        });
      } else {
        pdf.text('[出荷] 未出荷', 20, yPos);
        yPos += 5;
      }

      yPos += 8;
    });

    // GAP認証注記
    if (yPos > 260) {
      pdf.addPage();
      yPos = 20;
    }
    pdf.setFontSize(8);
    pdf.text('本トレーサビリティ報告書は、適正農業規範(GAP)の要求事項に従い作成されています。', 15, yPos);

    pdf.save(`トレーサビリティ報告書_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="mobile-container">
      <h1 className="mobile-text-lg font-bold mb-6">トレーサビリティ報告書</h1>

      {/* 検索モード切替 */}
      <div className="mobile-card mb-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSearchMode('forward')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              searchMode === 'forward'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            生産→出荷 追跡
          </button>
          <button
            onClick={() => setSearchMode('reverse')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              searchMode === 'reverse'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            出荷先→生産 逆引き
          </button>
        </div>

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
          {searchMode === 'forward' ? (
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
          ) : (
            <div className="mobile-form-group">
              <label className="mobile-form-label">出荷先</label>
              <input
                type="text"
                value={reverseSearchDestination}
                onChange={(e) => setReverseSearchDestination(e.target.value)}
                placeholder="出荷先名で逆引き検索"
                className="mobile-input w-full"
              />
            </div>
          )}
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
              CSV出力
            </button>
            <button
              onClick={exportToPDF}
              className="mobile-btn mobile-btn-secondary flex-1"
            >
              PDF出力
            </button>
          </div>
        </div>
      )}

      {/* 統計サマリー */}
      {Object.keys(filteredChains).length > 0 && (
        <div className="mobile-card mb-6">
          <h2 className="mobile-text-base font-semibold mb-4">トレーサビリティ統計</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{report.harvests.length}</div>
              <div className="text-sm text-gray-600">収穫記録</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{report.shipments.length}</div>
              <div className="text-sm text-gray-600">出荷記録</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{report.pesticideUses.length}</div>
              <div className="text-sm text-gray-600">農薬使用</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{report.fertilizerUses.length}</div>
              <div className="text-sm text-gray-600">肥料使用</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{Object.keys(traceabilityChains).length}</div>
              <div className="text-sm text-gray-600">トレースチェーン</div>
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
                <h3 className="mobile-text-base font-bold text-green-800">
                  Lot: {lotNumber}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  chain.shipments.length > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {chain.shipments.length > 0 ? '出荷済み' : '未出荷'}
                </span>
              </div>

              {/* ビジュアルタイムライン */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3">生産履歴タイムライン</h4>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-4">
                    {chain.timeline.map((event, idx) => (
                      <div key={`${event.eventType}-${event.id}-${idx}`} className="relative flex items-start pl-10">
                        <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                          event.eventType === 'harvest' ? 'bg-green-500' :
                          event.eventType === 'shipment' ? 'bg-blue-500' :
                          event.eventType === 'pesticide' ? 'bg-red-400' :
                          event.eventType === 'fertilizer' ? 'bg-yellow-400' :
                          'bg-gray-400'
                        }`}>
                          {event.icon}
                        </div>
                        <div className={`flex-1 p-3 rounded-lg ${
                          event.eventType === 'harvest' ? 'bg-green-50' :
                          event.eventType === 'shipment' ? 'bg-blue-50' :
                          event.eventType === 'pesticide' ? 'bg-red-50' :
                          event.eventType === 'fertilizer' ? 'bg-yellow-50' :
                          'bg-gray-50'
                        }`}>
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-medium text-gray-500">
                              {format(event.date, 'yyyy/MM/dd', { locale: ja })}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-white">
                              {event.eventType === 'harvest' ? '収穫' :
                               event.eventType === 'shipment' ? '出荷' :
                               event.eventType === 'pesticide' ? '農薬散布' :
                               event.eventType === 'fertilizer' ? '施肥' :
                               '作業'}
                            </span>
                          </div>
                          <div className="mt-1 text-sm">
                            {event.eventType === 'harvest' && (
                              <span>{event.cropName} {event.quantity}{event.unit} ({event.qualityGrade || '等級なし'})</span>
                            )}
                            {event.eventType === 'shipment' && (
                              <span>{event.destination} へ {event.quantity}{event.unit} ({event.status})</span>
                            )}
                            {event.eventType === 'pesticide' && (
                              <span>{event.name} - {event.targetPest}</span>
                            )}
                            {event.eventType === 'fertilizer' && (
                              <span>{event.name} {event.amount}{event.unit}</span>
                            )}
                            {event.eventType === 'workLog' && (
                              <span>{event.workType} ({event.workHours}h)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* サマリー情報 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-gray-500">圃場</div>
                  <div className="font-medium">{chain.harvest.fieldName}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-gray-500">作物</div>
                  <div className="font-medium">{chain.harvest.cropName}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-gray-500">農薬使用</div>
                  <div className="font-medium">{chain.pesticides.length}回</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-gray-500">肥料使用</div>
                  <div className="font-medium">{chain.fertilizers.length}回</div>
                </div>
              </div>
            </div>
          ))}

          {/* GAP認証コメント */}
          <div className="mobile-card">
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">GAP認証に関する注記</h3>
              <p className="text-sm text-green-700">
                本トレーサビリティ報告書は、適正農業規範（GAP）の要求事項に従い、
                播種・定植から収穫、出荷までの完全な追跡記録を提供しています。
                農薬・肥料の使用履歴、作業記録を含む全工程が記録・管理されています。
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
