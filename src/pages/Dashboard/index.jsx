// src/pages/Dashboard/index.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { uiLogger } from '../../utils/logger';

const Dashboard = () => {
  const { userProfile, currentUser } = useAuth();
  const [recentWorkLogs, setRecentWorkLogs] = useState([]);
  const [recentHarvests, setRecentHarvests] = useState([]);
  const [recentShipments, setRecentShipments] = useState([]);
  const [recentTrainings, setRecentTrainings] = useState([]);
  const [recentVisitors, setRecentVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRecentData = async () => {
      if (!currentUser) return;
      
      try {
        // 最近の作業日誌を取得
        const workLogsQuery = query(
          collection(db, 'workLogs'),
          where('userId', '==', currentUser.uid),
          orderBy('date', 'desc'),
          limit(5)
        );
        const workLogsSnapshot = await getDocs(workLogsQuery);
        const workLogs = [];
        workLogsSnapshot.forEach((doc) => {
          workLogs.push({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate() // Firestoreのタイムスタンプをプレーンな日付に変換
          });
        });
        setRecentWorkLogs(workLogs);

        // 最近の収穫記録を取得
        const harvestsQuery = query(
          collection(db, 'harvests'),
          where('userId', '==', currentUser.uid),
          orderBy('harvestDate', 'desc'),
          limit(5)
        );
        const harvestsSnapshot = await getDocs(harvestsQuery);
        const harvests = [];
        harvestsSnapshot.forEach((doc) => {
          harvests.push({
            id: doc.id,
            ...doc.data(),
            date: doc.data().harvestDate?.toDate ? doc.data().harvestDate.toDate() : doc.data().harvestDate
          });
        });
        setRecentHarvests(harvests);
        
        // 最近の出荷記録を取得
        const shipmentsQuery = query(
          collection(db, 'shipments'),
          where('userId', '==', currentUser.uid),
          orderBy('shipmentDate', 'desc'),
          limit(5)
        );
        const shipmentsSnapshot = await getDocs(shipmentsQuery);
        const shipments = [];
        shipmentsSnapshot.forEach((doc) => {
          shipments.push({
            id: doc.id,
            ...doc.data(),
            date: doc.data().shipmentDate?.toDate ? doc.data().shipmentDate.toDate() : doc.data().shipmentDate
          });
        });
        setRecentShipments(shipments);

        // 最近の教育記録を取得
        const trainingsQuery = query(
          collection(db, 'trainings'),
          where('userId', '==', currentUser.uid),
          orderBy('trainingDate', 'desc'),
          limit(5)
        );
        const trainingsSnapshot = await getDocs(trainingsQuery);
        const trainings = [];
        trainingsSnapshot.forEach((doc) => {
          trainings.push({
            id: doc.id,
            ...doc.data(),
            date: doc.data().trainingDate?.toDate ? doc.data().trainingDate.toDate() : doc.data().trainingDate
          });
        });
        setRecentTrainings(trainings);

        // 最近の訪問者記録を取得
        const visitorsQuery = query(
          collection(db, 'visitors'),
          where('userId', '==', currentUser.uid),
          orderBy('visitDate', 'desc'),
          limit(5)
        );
        const visitorsSnapshot = await getDocs(visitorsQuery);
        const visitors = [];
        visitorsSnapshot.forEach((doc) => {
          visitors.push({
            id: doc.id,
            ...doc.data(),
            date: doc.data().visitDate?.toDate ? doc.data().visitDate.toDate() : doc.data().visitDate
          });
        });
        setRecentVisitors(visitors);
      } catch (err) {
        uiLogger.error('Error fetching dashboard data', { component: 'Dashboard', userId: currentUser?.uid }, err);
        setError('データの取得中にエラーが発生しました。');
        toast.error('データの取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentData();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-500">データを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">GAPTracker - ダッシュボード</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* クイックアクセスカード */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">クイックアクセス</h2>
          <div className="space-y-2">
            <Link to="/work-logs/new" className="block px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
              作業日誌登録
            </Link>
            <Link to="/harvests/new" className="block px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200">
              収穫記録登録
            </Link>
            <Link to="/fertilizer-uses/new" className="block px-4 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">
              肥料使用記録
            </Link>
            <Link to="/field-inspections/new" className="block px-4 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
              圃場点検記録
            </Link>
            <Link to="/trainings/new" className="block px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
              教育・訓練記録
            </Link>
            <Link to="/visitors/new" className="block px-4 py-2 bg-pink-100 text-pink-700 rounded hover:bg-pink-200">
              訪問者記録
            </Link>
          </div>
        </div>
        
        {/* ユーザー情報カード */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">ユーザー情報</h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">氏名: </span>
              {userProfile?.name || '-'}
            </p>
            <p>
              <span className="font-medium">メールアドレス: </span>
              {userProfile?.email || '-'}
            </p>
            <p>
              <span className="font-medium">役割: </span>
              {userProfile?.role === 'admin' ? '管理者' : 'スタッフ'}
            </p>
          </div>
        </div>
        
        {/* ステータスカード */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">ステータス</h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">システム状態: </span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">正常</span>
            </p>
            <p>
              <span className="font-medium">最終ログイン: </span>
              {format(new Date(), 'yyyy年MM月dd日 HH:mm')}
            </p>
          </div>
        </div>
      </div>
      
      {/* 最近の作業日誌 */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">最近の作業日誌</h2>
          <Link to="/work-logs" className="text-blue-600 hover:text-blue-800">
            すべて表示 →
          </Link>
        </div>
        
        {recentWorkLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">日付</th>
                  <th className="py-2 px-4 border-b">圃場</th>
                  <th className="py-2 px-4 border-b">作業内容</th>
                  <th className="py-2 px-4 border-b">担当者</th>
                </tr>
              </thead>
              <tbody>
                {recentWorkLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b">{log.date ? format(log.date, 'yyyy年MM月dd日') : '-'}</td>
                    <td className="py-2 px-4 border-b">{log.fieldName || '-'}</td>
                    <td className="py-2 px-4 border-b">{log.workType || '-'}</td>
                    <td className="py-2 px-4 border-b">{log.workerNames?.join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">作業日誌のデータがありません。</p>
        )}
      </div>
      
      {/* 最近の収穫記録 */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">最近の収穫記録</h2>
          <Link to="/harvests" className="text-blue-600 hover:text-blue-800">
            すべて表示 →
          </Link>
        </div>
        
        {recentHarvests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">日付</th>
                  <th className="py-2 px-4 border-b">圃場</th>
                  <th className="py-2 px-4 border-b">作物</th>
                  <th className="py-2 px-4 border-b">収穫量</th>
                </tr>
              </thead>
              <tbody>
                {recentHarvests.map((harvest) => (
                  <tr key={harvest.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b">
                      {harvest.date instanceof Date 
                        ? format(harvest.date, 'yyyy年MM月dd日')
                        : harvest.date
                          ? format(new Date(harvest.date), 'yyyy年MM月dd日')
                          : '-'}
                    </td>
                    <td className="py-2 px-4 border-b">{harvest.fieldName || '-'}</td>
                    <td className="py-2 px-4 border-b">{harvest.cropName || '-'}</td>
                    <td className="py-2 px-4 border-b">{harvest.quantity ? `${harvest.quantity} ${harvest.unit || 'kg'}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">収穫記録のデータがありません。</p>
        )}
      </div>
      
      {/* 最近の出荷記録 */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">最近の出荷記録</h2>
          <Link to="/shipments" className="text-blue-600 hover:text-blue-800">
            すべて表示 →
          </Link>
        </div>
        
        {recentShipments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">日付</th>
                  <th className="py-2 px-4 border-b">出荷先</th>
                  <th className="py-2 px-4 border-b">作物</th>
                  <th className="py-2 px-4 border-b">数量</th>
                  <th className="py-2 px-4 border-b">状態</th>
                </tr>
              </thead>
              <tbody>
                {recentShipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b">
                      {shipment.date instanceof Date 
                        ? format(shipment.date, 'yyyy年MM月dd日')
                        : shipment.date
                          ? format(new Date(shipment.date), 'yyyy年MM月dd日')
                          : '-'}
                    </td>
                    <td className="py-2 px-4 border-b">{shipment.destination || '-'}</td>
                    <td className="py-2 px-4 border-b">{shipment.cropName || '-'}</td>
                    <td className="py-2 px-4 border-b">{shipment.quantity ? `${shipment.quantity} ${shipment.unit || 'kg'}` : '-'}</td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded-full text-xs ${shipment.status === '完了' 
                        ? 'bg-green-100 text-green-800' 
                        : shipment.status === '準備中'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'}`}>
                        {shipment.status || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">出荷記録のデータがありません。</p>
        )}
      </div>
      
      {/* 最近の教育・訓練記録 */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">最近の教育・訓練記録</h2>
          <Link to="/trainings" className="text-blue-600 hover:text-blue-800">
            すべて表示 →
          </Link>
        </div>
        
        {recentTrainings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">実施日</th>
                  <th className="py-2 px-4 border-b">研修タイトル</th>
                  <th className="py-2 px-4 border-b">カテゴリ</th>
                  <th className="py-2 px-4 border-b">講師</th>
                  <th className="py-2 px-4 border-b">状態</th>
                </tr>
              </thead>
              <tbody>
                {recentTrainings.map((training) => (
                  <tr key={training.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b">
                      {training.date instanceof Date 
                        ? format(training.date, 'yyyy年MM月dd日')
                        : training.date
                          ? format(new Date(training.date), 'yyyy年MM月dd日')
                          : '-'}
                    </td>
                    <td className="py-2 px-4 border-b">{training.title || '-'}</td>
                    <td className="py-2 px-4 border-b">{training.category || '-'}</td>
                    <td className="py-2 px-4 border-b">{training.instructor || '-'}</td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded-full text-xs ${
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
        ) : (
          <p className="text-gray-500">教育・訓練記録のデータがありません。</p>
        )}
      </div>
      
      {/* 最近の訪問者記録 */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">最近の訪問者記録</h2>
          <Link to="/visitors" className="text-blue-600 hover:text-blue-800">
            すべて表示 →
          </Link>
        </div>
        
        {recentVisitors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">訪問日</th>
                  <th className="py-2 px-4 border-b">訪問者名</th>
                  <th className="py-2 px-4 border-b">所属組織</th>
                  <th className="py-2 px-4 border-b">訪問目的</th>
                  <th className="py-2 px-4 border-b">衛生適合</th>
                </tr>
              </thead>
              <tbody>
                {recentVisitors.map((visitor) => (
                  <tr key={visitor.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b">
                      {visitor.date instanceof Date 
                        ? format(visitor.date, 'yyyy年MM月dd日')
                        : visitor.date
                          ? format(new Date(visitor.date), 'yyyy年MM月dd日')
                          : '-'}
                    </td>
                    <td className="py-2 px-4 border-b">{visitor.name || '-'}</td>
                    <td className="py-2 px-4 border-b">{visitor.organization || '-'}</td>
                    <td className="py-2 px-4 border-b">{visitor.purpose || '-'}</td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        visitor.hygieneCompliance === '適合' 
                          ? 'bg-green-100 text-green-800' 
                          : visitor.hygieneCompliance === '不適合'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {visitor.hygieneCompliance || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">訪問者記録のデータがありません。</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;