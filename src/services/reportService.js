// src/services/reportService.js
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import ExcelJS from 'exceljs';
import { businessLogger } from '../utils/logger';

export class ReportService {
  constructor(userId) {
    this.userId = userId;
  }

  // 日付範囲でクエリを作成
  createDateRangeQuery(collectionName, dateField, startDate, endDate) {
    // 日付文字列をローカル時刻として処理
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
    
    return query(
      collection(db, collectionName),
      where('userId', '==', this.userId),
      where(dateField, '>=', Timestamp.fromDate(start)),
      where(dateField, '<=', Timestamp.fromDate(end)),
      orderBy(dateField, 'desc')
    );
  }

  // 農薬使用記録レポート
  async getPesticideUsageReport(startDate, endDate) {
    try {
      const pesticideUsesQuery = this.createDateRangeQuery('pesticideUses', 'date', startDate, endDate);
      const pesticideUsesSnapshot = await getDocs(pesticideUsesQuery);
      
      const pesticideUsage = [];
      
      pesticideUsesSnapshot.forEach(doc => {
        const data = doc.data();
        pesticideUsage.push({
          id: doc.id,
          date: data.date?.toDate() || new Date(),
          fieldName: data.fieldName,
          pesticideName: data.pesticideName,
          targetPest: data.targetPest,
          dilutionRate: data.dilutionRate,
          applicationMethod: data.method,
          weather: data.weather,
          temperature: data.temperature,
          windSpeed: data.windSpeed,
          applicator: data.appliedByName || '',
          notes: data.notes
        });
      });

      return pesticideUsage.sort((a, b) => b.date - a.date);
    } catch (error) {
      businessLogger.error('農薬使用記録の取得エラー', { operation: 'getPesticideUsageReport', userId: this.userId }, error);
      throw error;
    }
  }

  // 肥料使用記録レポート
  async getFertilizerUsageReport(startDate, endDate) {
    try {
      businessLogger.debug('getFertilizerUsageReport called', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId: this.userId
      });

      const fertilizerUsesQuery = this.createDateRangeQuery('fertilizerUses', 'date', startDate, endDate);
      
      businessLogger.debug('Query created for date range', {
        startTimestamp: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0),
        endTimestamp: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59)
      });

      const fertilizerUsesSnapshot = await getDocs(fertilizerUsesQuery);
      
      businessLogger.debug('Query result received', { count: fertilizerUsesSnapshot.size });
      
      const fertilizerUsage = [];
      
      fertilizerUsesSnapshot.forEach(doc => {
        const data = doc.data();
        
        businessLogger.debug('Processing document', {
          id: doc.id,
          date: data.date?.toDate?.() || data.date,
          dateType: typeof data.date,
          hasToDate: typeof data.date?.toDate === 'function',
          fieldName: data.fieldName,
          fertilizerName: data.fertilizerName
        });
        
        fertilizerUsage.push({
          id: doc.id,
          date: data.date?.toDate() || new Date(),
          fieldName: data.fieldName,
          fertilizerName: data.fertilizerName,
          amount: data.amount,
          unit: data.unit,
          method: data.method,
          nitrogen: data.nitrogen || 0,
          phosphorus: data.phosphorus || 0,
          potassium: data.potassium || 0,
          applicator: data.appliedByName || '',
          notes: data.notes
        });
      });

      businessLogger.debug('Final processed results', { 
        count: fertilizerUsage.length,
        sample: fertilizerUsage.slice(0, 3)
      });

      return fertilizerUsage.sort((a, b) => b.date - a.date);
    } catch (error) {
      businessLogger.error('肥料使用記録の取得エラー', { operation: 'getFertilizerUsageReport', userId: this.userId }, error);
      throw error;
    }
  }

  // 教育・訓練記録レポート
  async getTrainingReport(startDate, endDate) {
    try {
      const trainingsQuery = this.createDateRangeQuery('trainings', 'trainingDate', startDate, endDate);
      const trainingsSnapshot = await getDocs(trainingsQuery);
      
      const trainings = [];
      
      trainingsSnapshot.forEach(doc => {
        const data = doc.data();
        trainings.push({
          id: doc.id,
          date: data.trainingDate?.toDate() || new Date(),
          title: data.title,
          description: data.description,
          instructor: data.instructor,
          participants: data.participants || [],
          duration: data.duration,
          materials: data.materials,
          notes: data.notes
        });
      });

      return trainings.sort((a, b) => b.date - a.date);
    } catch (error) {
      businessLogger.error('教育記録の取得エラー', { operation: 'getTrainingReport', userId: this.userId }, error);
      throw error;
    }
  }

  // 訪問者記録レポート
  async getVisitorReport(startDate, endDate) {
    try {
      const visitorsQuery = this.createDateRangeQuery('visitors', 'visitDate', startDate, endDate);
      const visitorsSnapshot = await getDocs(visitorsQuery);
      
      const visitors = [];
      
      visitorsSnapshot.forEach(doc => {
        const data = doc.data();
        visitors.push({
          id: doc.id,
          date: data.visitDate?.toDate() || new Date(),
          name: data.name,
          organization: data.organization,
          purpose: data.purpose,
          notes: data.notes
        });
      });

      return visitors.sort((a, b) => b.date - a.date);
    } catch (error) {
      businessLogger.error('訪問者記録の取得エラー', { operation: 'getVisitorReport', userId: this.userId }, error);
      throw error;
    }
  }

  // 収穫・出荷トレーサビリティレポート
  async getTraceabilityReport(startDate, endDate) {
    try {
      const harvestsQuery = this.createDateRangeQuery('harvests', 'harvestDate', startDate, endDate);
      const harvestsSnapshot = await getDocs(harvestsQuery);
      
      const shipmentsQuery = this.createDateRangeQuery('shipments', 'shipmentDate', startDate, endDate);
      const shipmentsSnapshot = await getDocs(shipmentsQuery);
      
      const harvests = [];
      const shipments = [];
      
      harvestsSnapshot.forEach(doc => {
        const data = doc.data();
        harvests.push({
          id: doc.id,
          date: data.harvestDate?.toDate() || new Date(),
          fieldName: data.fieldName,
          cropName: data.cropName,
          quantity: data.quantity,
          unit: data.unit,
          qualityGrade: data.qualityGrade,
          notes: data.notes
        });
      });

      shipmentsSnapshot.forEach(doc => {
        const data = doc.data();
        shipments.push({
          id: doc.id,
          date: data.shipmentDate?.toDate() || new Date(),
          destination: data.destination,
          cropName: data.cropName,
          quantity: data.quantity,
          unit: data.unit,
          lotNumber: data.lotNumber,
          harvestId: data.harvestId,
          status: data.status,
          notes: data.notes
        });
      });

      return { harvests, shipments };
    } catch (error) {
      businessLogger.error('トレーサビリティレポートの取得エラー', { operation: 'getTraceabilityReport', userId: this.userId }, error);
      throw error;
    }
  }

  // 経営分析データ
  async getBusinessAnalytics(startDate, endDate) {
    try {
      const [harvests, workLogs] = await Promise.all([
        this.getHarvestData(startDate, endDate),
        this.getWorkLogData(startDate, endDate)
      ]);

      // 収穫量分析
      const harvestAnalytics = this.calculateHarvestAnalytics(harvests);
      
      // 作業効率分析
      const workEfficiencyAnalytics = this.calculateWorkEfficiencyAnalytics(workLogs);
      
      // 圃場別パフォーマンス
      const fieldPerformance = this.calculateFieldPerformance(harvests, workLogs);

      return {
        harvestAnalytics,
        workEfficiencyAnalytics,
        fieldPerformance,
        summary: {
          totalHarvest: harvests.reduce((sum, h) => sum + (h.quantity || 0), 0),
          totalWorkHours: workLogs.reduce((sum, w) => sum + (w.workHours || 0), 0),
          activeFields: [...new Set(harvests.map(h => h.fieldName))].length,
          harvestRecords: harvests.length,
          workRecords: workLogs.length
        }
      };
    } catch (error) {
      businessLogger.error('経営分析データの取得エラー', { operation: 'getBusinessAnalytics', userId: this.userId }, error);
      throw error;
    }
  }

  // 収穫データ取得
  async getHarvestData(startDate, endDate) {
    const harvestsQuery = this.createDateRangeQuery('harvests', 'harvestDate', startDate, endDate);
    const harvestsSnapshot = await getDocs(harvestsQuery);
    
    const harvests = [];
    harvestsSnapshot.forEach(doc => {
      const data = doc.data();
      harvests.push({
        id: doc.id,
        date: data.harvestDate?.toDate() || new Date(),
        fieldName: data.fieldName,
        cropName: data.cropName,
        quantity: data.quantity || 0,
        unit: data.unit,
        qualityGrade: data.qualityGrade
      });
    });

    return harvests;
  }

  // 作業ログデータ取得
  async getWorkLogData(startDate, endDate) {
    const workLogsQuery = this.createDateRangeQuery('workLogs', 'date', startDate, endDate);
    const workLogsSnapshot = await getDocs(workLogsQuery);
    
    const workLogs = [];
    workLogsSnapshot.forEach(doc => {
      const data = doc.data();
      workLogs.push({
        id: doc.id,
        date: data.date?.toDate() || new Date(),
        fieldName: data.fieldName,
        workType: data.workType,
        workHours: data.workHours || 0,
        harvestAmount: data.harvestAmount || 0,
        workerNames: data.workerNames || []
      });
    });

    return workLogs;
  }

  // 収穫分析計算
  calculateHarvestAnalytics(harvests) {
    const byCrop = {};
    const byField = {};
    const byMonth = {};

    harvests.forEach(harvest => {
      const crop = harvest.cropName;
      const field = harvest.fieldName;
      const month = format(harvest.date, 'yyyy-MM');
      const quantity = harvest.quantity || 0;

      // 作物別集計
      if (!byCrop[crop]) {
        byCrop[crop] = { quantity: 0, records: 0 };
      }
      byCrop[crop].quantity += quantity;
      byCrop[crop].records += 1;

      // 圃場別集計
      if (!byField[field]) {
        byField[field] = { quantity: 0, records: 0 };
      }
      byField[field].quantity += quantity;
      byField[field].records += 1;

      // 月別集計
      if (!byMonth[month]) {
        byMonth[month] = { quantity: 0, records: 0 };
      }
      byMonth[month].quantity += quantity;
      byMonth[month].records += 1;
    });

    return { byCrop, byField, byMonth };
  }

  // 作業効率分析計算
  calculateWorkEfficiencyAnalytics(workLogs) {
    const byWorkType = {};
    const byField = {};
    const byMonth = {};

    workLogs.forEach(log => {
      const workType = log.workType;
      const field = log.fieldName;
      const month = format(log.date, 'yyyy-MM');
      const hours = log.workHours || 0;

      // 作業タイプ別集計
      if (!byWorkType[workType]) {
        byWorkType[workType] = { hours: 0, records: 0 };
      }
      byWorkType[workType].hours += hours;
      byWorkType[workType].records += 1;

      // 圃場別集計
      if (!byField[field]) {
        byField[field] = { hours: 0, records: 0 };
      }
      byField[field].hours += hours;
      byField[field].records += 1;

      // 月別集計
      if (!byMonth[month]) {
        byMonth[month] = { hours: 0, records: 0 };
      }
      byMonth[month].hours += hours;
      byMonth[month].records += 1;
    });

    return { byWorkType, byField, byMonth };
  }

  // 圃場別パフォーマンス計算
  calculateFieldPerformance(harvests, workLogs) {
    const fields = {};

    // 収穫データから圃場別データを集計
    harvests.forEach(harvest => {
      const field = harvest.fieldName;
      if (!fields[field]) {
        fields[field] = { harvest: 0, workHours: 0, efficiency: 0 };
      }
      fields[field].harvest += harvest.quantity || 0;
    });

    // 作業データから圃場別作業時間を集計
    workLogs.forEach(log => {
      const field = log.fieldName;
      if (!fields[field]) {
        fields[field] = { harvest: 0, workHours: 0, efficiency: 0 };
      }
      fields[field].workHours += log.workHours || 0;
    });

    // 効率性計算（収穫量/作業時間）
    Object.keys(fields).forEach(field => {
      const data = fields[field];
      data.efficiency = data.workHours > 0 ? data.harvest / data.workHours : 0;
    });

    return fields;
  }

  // 月次レポート用のヘルパー関数
  getMonthlyDateRange(year, month) {
    const date = new Date(year, month - 1, 1);
    return {
      start: startOfMonth(date),
      end: endOfMonth(date)
    };
  }

  // 年次レポート用のヘルパー関数
  getYearlyDateRange(year) {
    const date = new Date(year, 0, 1);
    return {
      start: startOfYear(date),
      end: endOfYear(date)
    };
  }

  // Excelエクスポート機能
  async exportToExcel(reportType, data, filename) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(reportType);

      switch (reportType) {
        case '農薬使用記録':
          this.addPesticideDataToWorksheet(worksheet, data);
          break;
        case '肥料使用記録':
          this.addFertilizerDataToWorksheet(worksheet, data);
          break;
        case '教育・訓練記録':
          this.addTrainingDataToWorksheet(worksheet, data);
          break;
        case 'トレーサビリティ':
          this.addTraceabilityDataToWorksheet(worksheet, data);
          break;
        default:
          throw new Error('未対応のレポートタイプです');
      }

      // ファイルのダウンロード
      const buffer = await workbook.xlsx.writeBuffer();
      this.downloadFile(buffer, filename || `${reportType}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      businessLogger.info(`${reportType}をExcelエクスポートしました`, { userId: this.userId, filename });
    } catch (error) {
      businessLogger.error('Excelエクスポートエラー', { reportType, userId: this.userId }, error);
      throw error;
    }
  }

  // 農薬使用記録をワークシートに追加
  addPesticideDataToWorksheet(worksheet, data) {
    worksheet.columns = [
      { header: '日付', key: 'date', width: 12 },
      { header: '圃場名', key: 'fieldName', width: 15 },
      { header: '農薬名', key: 'pesticideName', width: 20 },
      { header: '対象害虫・病気', key: 'targetPest', width: 15 },
      { header: '希釈倍率', key: 'dilutionRate', width: 12 },
      { header: '散布方法', key: 'applicationMethod', width: 15 },
      { header: '天候', key: 'weather', width: 10 },
      { header: '気温', key: 'temperature', width: 10 },
      { header: '風速', key: 'windSpeed', width: 10 },
      { header: '散布者', key: 'applicator', width: 15 },
      { header: '備考', key: 'notes', width: 30 }
    ];

    data.forEach(row => {
      worksheet.addRow({
        date: format(row.date, 'yyyy-MM-dd'),
        fieldName: row.fieldName,
        pesticideName: row.pesticideName,
        targetPest: row.targetPest,
        dilutionRate: row.dilutionRate,
        applicationMethod: row.applicationMethod,
        weather: row.weather,
        temperature: row.temperature,
        windSpeed: row.windSpeed,
        applicator: row.applicator,
        notes: row.notes
      });
    });

    this.styleWorksheet(worksheet);
  }

  // 肥料使用記録をワークシートに追加
  addFertilizerDataToWorksheet(worksheet, data) {
    worksheet.columns = [
      { header: '日付', key: 'date', width: 12 },
      { header: '圃場名', key: 'fieldName', width: 15 },
      { header: '肥料名', key: 'fertilizerName', width: 20 },
      { header: '量', key: 'amount', width: 10 },
      { header: '単位', key: 'unit', width: 10 },
      { header: '施用方法', key: 'method', width: 15 },
      { header: '窒素(N)', key: 'nitrogen', width: 10 },
      { header: 'リン(P)', key: 'phosphorus', width: 10 },
      { header: 'カリ(K)', key: 'potassium', width: 10 },
      { header: '施用者', key: 'applicator', width: 15 },
      { header: '備考', key: 'notes', width: 30 }
    ];

    data.forEach(row => {
      worksheet.addRow({
        date: format(row.date, 'yyyy-MM-dd'),
        fieldName: row.fieldName,
        fertilizerName: row.fertilizerName,
        amount: row.amount,
        unit: row.unit,
        method: row.method,
        nitrogen: row.nitrogen,
        phosphorus: row.phosphorus,
        potassium: row.potassium,
        applicator: row.applicator,
        notes: row.notes
      });
    });

    this.styleWorksheet(worksheet);
  }

  // 教育・訓練記録をワークシートに追加
  addTrainingDataToWorksheet(worksheet, data) {
    worksheet.columns = [
      { header: '日付', key: 'date', width: 12 },
      { header: 'タイトル', key: 'title', width: 25 },
      { header: '内容', key: 'description', width: 30 },
      { header: '講師', key: 'instructor', width: 15 },
      { header: '参加者', key: 'participants', width: 20 },
      { header: '時間', key: 'duration', width: 10 },
      { header: '教材', key: 'materials', width: 20 },
      { header: '備考', key: 'notes', width: 30 }
    ];

    data.forEach(row => {
      worksheet.addRow({
        date: format(row.date, 'yyyy-MM-dd'),
        title: row.title,
        description: row.description,
        instructor: row.instructor,
        participants: Array.isArray(row.participants) ? row.participants.join(', ') : row.participants,
        duration: row.duration,
        materials: row.materials,
        notes: row.notes
      });
    });

    this.styleWorksheet(worksheet);
  }

  // トレーサビリティデータをワークシートに追加
  addTraceabilityDataToWorksheet(worksheet, data) {
    // 収穫データシート
    worksheet.name = '収穫記録';
    worksheet.columns = [
      { header: '日付', key: 'date', width: 12 },
      { header: '圃場名', key: 'fieldName', width: 15 },
      { header: '作物名', key: 'cropName', width: 15 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '単位', key: 'unit', width: 10 },
      { header: '品質等級', key: 'qualityGrade', width: 12 },
      { header: '備考', key: 'notes', width: 30 }
    ];

    data.harvests.forEach(row => {
      worksheet.addRow({
        date: format(row.date, 'yyyy-MM-dd'),
        fieldName: row.fieldName,
        cropName: row.cropName,
        quantity: row.quantity,
        unit: row.unit,
        qualityGrade: row.qualityGrade,
        notes: row.notes
      });
    });

    this.styleWorksheet(worksheet);

    // 出荷データシート
    const shipmentWorksheet = worksheet.workbook.addWorksheet('出荷記録');
    shipmentWorksheet.columns = [
      { header: '日付', key: 'date', width: 12 },
      { header: '出荷先', key: 'destination', width: 20 },
      { header: '作物名', key: 'cropName', width: 15 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '単位', key: 'unit', width: 10 },
      { header: 'ロット番号', key: 'lotNumber', width: 15 },
      { header: '収穫ID', key: 'harvestId', width: 15 },
      { header: 'ステータス', key: 'status', width: 12 },
      { header: '備考', key: 'notes', width: 30 }
    ];

    data.shipments.forEach(row => {
      shipmentWorksheet.addRow({
        date: format(row.date, 'yyyy-MM-dd'),
        destination: row.destination,
        cropName: row.cropName,
        quantity: row.quantity,
        unit: row.unit,
        lotNumber: row.lotNumber,
        harvestId: row.harvestId,
        status: row.status,
        notes: row.notes
      });
    });

    this.styleWorksheet(shipmentWorksheet);
  }

  // ワークシートのスタイリング
  styleWorksheet(worksheet) {
    // ヘッダー行のスタイル
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };
    headerRow.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    // すべてのセルに枠線を追加
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });
  }

  // ファイルダウンロード
  downloadFile(buffer, filename) {
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}

export default ReportService;