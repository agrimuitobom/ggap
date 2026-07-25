// src/pages/Dashboard/EmployeeHome.jsx
// 従業員（管理者以外）向けのシンプルなホーム。
// 大きなボタン・今日やること・自分の今日の記録だけを表示し、迷わず使える。
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getCleaningItems,
  getDayCheck,
  isItemApplicable,
  toDateKey
} from '../../services/cleaningService';
import { firestoreLogger } from '../../utils/logger';

const isSameDate = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const EmployeeHome = () => {
  const { currentUser, userProfile } = useAuth();
  const { currentOrganization } = useOrganization();
  const [cleaning, setCleaning] = useState({ total: 0, done: 0 });
  const [myRecords, setMyRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!currentOrganization || !currentUser) return;
      try {
        setLoading(true);
        const today = new Date();
        const orgId = currentOrganization.id;

        // 清掃チェックの今日の進捗
        const [items, checkedToday] = await Promise.all([
          getCleaningItems(orgId),
          getDayCheck(orgId, toDateKey(today))
        ]);
        const applicable = items.filter((i) => isItemApplicable(i, today));
        const done = applicable.filter((i) => checkedToday.includes(i.id)).length;
        setCleaning({ total: applicable.length, done });

        // 自分の今日の記録（作業日誌・収穫）
        const [workSnap, harvestSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'workLogs'),
            where('organizationId', '==', orgId),
            orderBy('date', 'desc'),
            limit(40)
          )),
          getDocs(query(
            collection(db, 'harvests'),
            where('organizationId', '==', orgId),
            orderBy('harvestDate', 'desc'),
            limit(40)
          ))
        ]);

        const mine = [];
        workSnap.forEach((d) => {
          const data = d.data();
          const date = data.date?.toDate ? data.date.toDate() : null;
          if (data.createdByUid === currentUser.uid && isSameDate(date, today)) {
            mine.push({
              id: d.id,
              kind: '作業',
              label: `${data.workType || '作業'} @ ${data.fieldName || '-'}`,
              isDraft: data.isDraft
            });
          }
        });
        harvestSnap.forEach((d) => {
          const data = d.data();
          const date = data.harvestDate?.toDate ? data.harvestDate.toDate() : null;
          if (data.createdByUid === currentUser.uid && isSameDate(date, today)) {
            mine.push({
              id: d.id,
              kind: '収穫',
              label: `${data.cropName || '収穫'} ${data.quantity || ''}${data.unit || ''} @ ${data.fieldName || '-'}`
            });
          }
        });
        setMyRecords(mine);
      } catch (err) {
        firestoreLogger.error('従業員ホームの取得エラー', { organizationId: currentOrganization?.id }, err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentOrganization, currentUser]);

  const cleaningDone = cleaning.total > 0 && cleaning.done >= cleaning.total;

  const bigButtons = [
    { to: '/work-logs/quick', icon: '⚡', label: '作業を記録', color: 'bg-blue-600 hover:bg-blue-700' },
    { to: '/harvests/quick', icon: '🌾', label: '収穫を記録', color: 'bg-green-600 hover:bg-green-700' },
    { to: '/cleaning', icon: '🧹', label: '清掃チェック', color: 'bg-teal-600 hover:bg-teal-700' }
  ];

  return (
    <div className="container mx-auto p-4 max-w-2xl pb-24">
      <h1 className="text-2xl font-bold mb-1">
        こんにちは、{userProfile?.name || 'おつかれさまです'}さん
      </h1>
      <p className="text-sm text-gray-500 mb-5">今日の作業を記録しましょう。</p>

      {/* 大きいボタン */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        {bigButtons.map((b) => (
          <Link
            key={b.to}
            to={b.to}
            className={`flex items-center gap-4 px-6 py-5 rounded-xl text-white font-bold text-xl shadow ${b.color}`}
          >
            <span className="text-3xl">{b.icon}</span>
            {b.label}
          </Link>
        ))}
      </div>

      {/* 今日やること */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-bold text-gray-700 mb-3">今日やること</h2>
        {loading ? (
          <p className="text-sm text-gray-400">読み込み中...</p>
        ) : (
          <Link
            to="/cleaning"
            className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 ${
              cleaning.total === 0
                ? 'border-gray-200 bg-gray-50 text-gray-500'
                : cleaningDone
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            <span>
              🧹 清掃チェック
              {cleaning.total === 0
                ? '（項目未設定）'
                : cleaningDone
                ? '：本日完了 ✓'
                : `：${cleaning.done}/${cleaning.total}件 完了`}
            </span>
            {!cleaningDone && cleaning.total > 0 && (
              <span className="text-sm font-semibold">記録する →</span>
            )}
          </Link>
        )}
      </div>

      {/* 自分の今日の記録 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-bold text-gray-700 mb-3">自分の今日の記録（{myRecords.length}件）</h2>
        {loading ? (
          <p className="text-sm text-gray-400">読み込み中...</p>
        ) : myRecords.length === 0 ? (
          <p className="text-sm text-gray-500">まだ記録がありません。上のボタンから記録してください。</p>
        ) : (
          <ul className="divide-y">
            {myRecords.map((r) => (
              <li key={`${r.kind}-${r.id}`} className="py-2 flex items-center justify-between">
                <span className="text-sm">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs mr-2 ${
                    r.kind === '収穫' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {r.kind}
                  </span>
                  {r.label}
                  {r.isDraft && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-full">
                      要追記
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default EmployeeHome;
