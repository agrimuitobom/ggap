// src/pages/WorkLogs/WorkLogCalendar.jsx
// 作業日誌の月間カレンダー表示。記録がない日が一目でわかり、
// 日付タップでその日の記録確認・クイック記録への導線を提供する。
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { firestoreLogger } from '../../utils/logger';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  format,
  isSameMonth,
  isSameDay,
  isAfter
} from 'date-fns';

const WORK_TYPE_ICONS = {
  '収穫': '🌾',
  '除草': '🌿',
  '潅水': '💧',
  '施肥': '🌱',
  '防除': '🚿',
  '播種': '🌰',
  '定植': '🪴',
  '清掃': '🧹',
  'その他': '📝'
};

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const toDateParam = (date) => format(date, 'yyyy-MM-dd');

const WorkLogCalendar = () => {
  const { currentOrganization } = useOrganization();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [logs, setLogs] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMonthLogs = useCallback(async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      monthEnd.setHours(23, 59, 59, 999);

      const logsQuery = query(
        collection(db, 'workLogs'),
        where('organizationId', '==', currentOrganization.id),
        where('date', '>=', Timestamp.fromDate(monthStart)),
        where('date', '<=', Timestamp.fromDate(monthEnd)),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(logsQuery);
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate()
      }));
      setLogs(list);
    } catch (err) {
      firestoreLogger.error('カレンダー用作業日誌の取得エラー', {
        organizationId: currentOrganization?.id,
        month: format(currentMonth, 'yyyy-MM')
      }, err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, currentMonth]);

  useEffect(() => {
    fetchMonthLogs();
    setSelectedDay(null);
  }, [fetchMonthLogs]);

  const today = new Date();
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth))
  });

  const logsForDay = (day) => logs.filter((log) => log.date && isSameDay(log.date, day));
  const selectedDayLogs = selectedDay ? logsForDay(selectedDay) : [];

  return (
    <div className="container mx-auto p-4 max-w-4xl pb-24">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
        <h1 className="text-2xl font-bold">作業カレンダー</h1>
        <div className="flex gap-2">
          <Link
            to="/work-logs/quick"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            ⚡ クイック記録
          </Link>
          <Link
            to="/work-logs"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            📋 一覧表示
          </Link>
        </div>
      </div>

      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between bg-white shadow rounded-lg px-4 py-3 mb-4">
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold"
        >
          ← 前月
        </button>
        <h2 className="text-lg font-bold">{format(currentMonth, 'yyyy年M月')}</h2>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          disabled={isAfter(addMonths(currentMonth, 1), endOfMonth(today))}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold disabled:opacity-30"
        >
          翌月 →
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      ) : (
        <>
          {/* カレンダー本体 */}
          <div className="bg-white shadow rounded-lg overflow-hidden mb-4">
            <div className="grid grid-cols-7 border-b">
              {WEEKDAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`py-2 text-center text-xs font-bold ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dayLogs = logsForDay(day);
                const inMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, today);
                const isFuture = isAfter(day, today);
                const isPastNoRecord = inMonth && !isFuture && !isToday && dayLogs.length === 0;
                const hasDraft = dayLogs.some((log) => log.isDraft);
                const icons = [...new Set(dayLogs.map((log) => WORK_TYPE_ICONS[log.workType] || '📝'))];

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => inMonth && setSelectedDay(day)}
                    className={`min-h-16 md:min-h-20 p-1 border-b border-r text-left align-top transition-colors ${
                      !inMonth ? 'bg-gray-50 text-gray-300'
                        : isToday ? 'bg-green-50'
                        : isPastNoRecord ? 'bg-gray-100'
                        : 'bg-white hover:bg-gray-50'
                    } ${selectedDay && isSameDay(day, selectedDay) ? 'ring-2 ring-green-500 ring-inset' : ''}`}
                  >
                    <span className={`text-xs ${isToday ? 'font-bold text-green-700' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    {inMonth && dayLogs.length > 0 && (
                      <div className="mt-0.5">
                        <span className="text-sm leading-none">{icons.slice(0, 3).join('')}</span>
                        <span className="block text-[10px] text-gray-500">
                          {dayLogs.length}件{hasDraft && <span className="text-amber-600 font-bold">・要追記</span>}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            ■ グレーの日は記録がありません。日付をタップすると記録の確認・追加ができます。
          </p>

          {/* 選択した日の詳細 */}
          {selectedDay && (
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">{format(selectedDay, 'M月d日')}の記録（{selectedDayLogs.length}件）</h3>
                {!isAfter(selectedDay, today) && (
                  <Link
                    to={`/work-logs/quick?date=${toDateParam(selectedDay)}`}
                    className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ⚡ この日の記録を追加
                  </Link>
                )}
              </div>
              {selectedDayLogs.length === 0 ? (
                <p className="text-sm text-gray-500">この日の記録はありません。</p>
              ) : (
                <ul className="divide-y">
                  {selectedDayLogs.map((log) => (
                    <li key={log.id} className="py-2 flex items-center justify-between">
                      <span className="text-sm">
                        {WORK_TYPE_ICONS[log.workType] || '📝'} {log.workType}
                        <span className="text-gray-500"> @ {log.fieldName || '-'}</span>
                        {log.isDraft && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-full">
                            要追記
                          </span>
                        )}
                      </span>
                      <Link
                        to={`/work-logs/edit/${log.id}`}
                        className="text-sm text-blue-600 hover:text-blue-800 shrink-0 ml-3"
                      >
                        {log.isDraft ? '追記' : '編集'}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WorkLogCalendar;
