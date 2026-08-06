// src/pages/Cleaning/CleaningCheck.jsx
// 清掃チェック。日付ごとに清掃項目の実施をチェックする。
// - 「本日分をすべて完了」でその日に対象の項目を一括チェック（入力の手間を削減）
// - 項目ごとに実施曜日が異なり、その日に対象の項目だけ表示・一括対象になる
// - 月間カレンダー（紙のおそうじカレンダー風）で実施状況を俯瞰・修正できる
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getCleaningItems,
  seedDefaultCleaningItems,
  getDayCheck,
  setDayCheck,
  getMonthChecks,
  isItemApplicable,
  toDateKey,
  WEEKDAY_LABELS
} from '../../services/cleaningService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  format,
  isSameDay,
  isAfter
} from 'date-fns';

// カレンダーの列幅（px）。項目名の列と日付の列で固定する
const LABEL_COL_WIDTH = 176;
const DAY_COL_WIDTH = 44;

const CleaningCheck = () => {
  const { userProfile } = useAuth();
  const { currentOrganization, isMember } = useOrganization();

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [view, setView] = useState('daily'); // daily | month

  // 日次ビュー
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [checkedItems, setCheckedItems] = useState([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 月間ビュー
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [monthChecks, setMonthChecks] = useState({});
  const [monthLoading, setMonthLoading] = useState(false);

  const checkedByName = userProfile?.name || '';

  const loadItems = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoadingItems(true);
      const list = await getCleaningItems(currentOrganization.id);
      setItems(list);
    } catch (err) {
      firestoreLogger.error('清掃項目の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('清掃項目の取得中にエラーが発生しました');
    } finally {
      setLoadingItems(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // 選択日のチェック状態を読み込み
  useEffect(() => {
    const loadDay = async () => {
      if (!currentOrganization) return;
      try {
        setDayLoading(true);
        const checked = await getDayCheck(currentOrganization.id, toDateKey(selectedDate));
        setCheckedItems(checked);
      } catch (err) {
        firestoreLogger.error('日次チェックの取得エラー', { organizationId: currentOrganization?.id }, err);
      } finally {
        setDayLoading(false);
      }
    };
    loadDay();
  }, [currentOrganization, selectedDate]);

  // 月間チェック状態を読み込み
  const loadMonth = useCallback(async () => {
    if (!currentOrganization || view !== 'month') return;
    try {
      setMonthLoading(true);
      const start = toDateKey(startOfMonth(currentMonth));
      const end = toDateKey(endOfMonth(currentMonth));
      const map = await getMonthChecks(currentOrganization.id, start, end);
      setMonthChecks(map);
    } catch (err) {
      firestoreLogger.error('月間チェックの取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('月間データの取得中にエラーが発生しました');
    } finally {
      setMonthLoading(false);
    }
  }, [currentOrganization, currentMonth, view]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const handleSeed = async () => {
    if (!currentOrganization) return;
    setSeeding(true);
    try {
      await seedDefaultCleaningItems(currentOrganization.id);
      await loadItems();
      toast.success('標準の清掃項目を読み込みました');
    } catch (err) {
      firestoreLogger.error('標準清掃項目の登録エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('項目の登録中にエラーが発生しました');
    } finally {
      setSeeding(false);
    }
  };

  // 選択日に対象の項目
  const applicableItems = items.filter((item) => isItemApplicable(item, selectedDate));

  const persistDay = async (newChecked) => {
    setCheckedItems(newChecked);
    setSaving(true);
    try {
      await setDayCheck(currentOrganization.id, toDateKey(selectedDate), newChecked, checkedByName);
    } catch (err) {
      firestoreLogger.error('日次チェックの保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (itemId) => {
    const next = checkedItems.includes(itemId)
      ? checkedItems.filter((id) => id !== itemId)
      : [...checkedItems, itemId];
    persistDay(next);
  };

  const handleCheckAll = () => {
    const applicableIds = applicableItems.map((i) => i.id);
    const next = [...new Set([...checkedItems, ...applicableIds])];
    persistDay(next);
    toast.success('本日分をすべて完了にしました');
  };

  const handleUncheckAll = () => {
    const applicableIds = new Set(applicableItems.map((i) => i.id));
    persistDay(checkedItems.filter((id) => !applicableIds.has(id)));
  };

  const changeDate = (option) => {
    if (option === 'today') setSelectedDate(new Date());
    else if (option === 'yesterday') setSelectedDate(new Date(Date.now() - 86400000));
  };

  const allDone = applicableItems.length > 0 && applicableItems.every((i) => checkedItems.includes(i.id));

  // 月間カレンダー用
  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });
  const today = new Date();

  const toggleMonthCell = async (item, day) => {
    if (!isMember) return; // 閲覧者は変更不可
    if (isAfter(day, today)) return; // 未来日は不可
    const dateKey = toDateKey(day);
    const current = monthChecks[dateKey] || [];
    const next = current.includes(item.id)
      ? current.filter((id) => id !== item.id)
      : [...current, item.id];
    setMonthChecks((prev) => ({ ...prev, [dateKey]: next }));
    try {
      await setDayCheck(currentOrganization.id, dateKey, next, checkedByName);
    } catch (err) {
      firestoreLogger.error('月間チェックの保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
      loadMonth();
    }
  };

  // 指定日の対象項目をまとめてチェック／解除（列見出しのボタン用）
  const checkAllForDay = async (day) => {
    if (!isMember || isAfter(day, today)) return;
    const dateKey = toDateKey(day);
    const applicableIds = items.filter((i) => isItemApplicable(i, day)).map((i) => i.id);
    if (applicableIds.length === 0) return;
    const current = monthChecks[dateKey] || [];
    const allDone = applicableIds.every((id) => current.includes(id));
    const next = allDone
      ? current.filter((id) => !applicableIds.includes(id)) // 全部済みなら解除
      : [...new Set([...current, ...applicableIds])]; // それ以外は全部チェック
    setMonthChecks((prev) => ({ ...prev, [dateKey]: next }));
    try {
      await setDayCheck(currentOrganization.id, dateKey, next, checkedByName);
      toast.success(allDone ? `${format(day, 'M月d日')}のチェックを解除しました` : `${format(day, 'M月d日')}を全てチェックしました`);
    } catch (err) {
      firestoreLogger.error('月間一括チェックの保存エラー', { organizationId: currentOrganization?.id, dateKey }, err);
      toast.error('保存中にエラーが発生しました');
      loadMonth();
    }
  };

  if (loadingItems) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">清掃チェック</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">読み込み中...</span>
        </div>
      </div>
    );
  }

  // 項目未登録時
  if (items.length === 0) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">清掃チェック</h1>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-5xl mb-4">🧹</div>
          <p className="text-gray-600 mb-2">清掃項目がまだ登録されていません。</p>
          <p className="text-sm text-gray-500 mb-6">
            紙の「おそうじカレンダー」に沿った標準の項目をすぐに読み込めます。
            あとから自由に追加・編集できます。
          </p>
          {isMember ? (
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="px-6 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50"
              >
                {seeding ? '読み込み中...' : '標準の清掃項目を読み込む'}
              </button>
              <Link
                to="/cleaning/items"
                className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded hover:bg-gray-300"
              >
                自分で項目を追加する
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-500">管理者またはメンバーが項目を登録できます。</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl pb-24">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
        <h1 className="text-2xl font-bold">清掃チェック</h1>
        <div className="flex gap-2">
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            <button
              onClick={() => setView('daily')}
              className={`px-4 py-2 text-sm ${view === 'daily' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
            >
              日次チェック
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-4 py-2 text-sm ${view === 'month' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
            >
              月間カレンダー
            </button>
          </div>
          <Link
            to="/cleaning/items"
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            項目を編集
          </Link>
        </div>
      </div>

      {view === 'daily' ? (
        <>
          {/* 日付選択 */}
          <div className="bg-white shadow rounded-lg p-4 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => changeDate('today')}
                className={`px-4 py-2 rounded-full border text-sm ${
                  isSameDay(selectedDate, new Date())
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                今日
              </button>
              <button
                onClick={() => changeDate('yesterday')}
                className={`px-4 py-2 rounded-full border text-sm ${
                  isSameDay(selectedDate, new Date(Date.now() - 86400000))
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                昨日
              </button>
              <input
                type="date"
                value={toDateKey(selectedDate)}
                max={toDateKey(new Date())}
                onChange={(e) => setSelectedDate(new Date(`${e.target.value}T00:00:00`))}
                className="px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <span className="text-sm text-gray-500 ml-auto">
                {format(selectedDate, 'M月d日')}（{WEEKDAY_LABELS[selectedDate.getDay()]}）
              </span>
            </div>
          </div>

          {/* 一括ボタン */}
          {isMember && applicableItems.length > 0 && (
            <button
              onClick={allDone ? handleUncheckAll : handleCheckAll}
              disabled={saving}
              className={`w-full py-4 mb-4 rounded-lg font-bold text-lg transition-colors disabled:opacity-50 ${
                allDone
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {allDone ? '本日分のチェックをすべて解除' : '✓ 本日分をすべて完了にする'}
            </button>
          )}

          {/* 項目リスト */}
          {dayLoading ? (
            <div className="flex justify-center items-center h-32">
              <span className="text-gray-500">読み込み中...</span>
            </div>
          ) : applicableItems.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              この曜日に対象の清掃項目はありません。
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow divide-y">
              {applicableItems.map((item) => {
                const checked = checkedItems.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => isMember && toggleItem(item.id)}
                    disabled={!isMember || saving}
                    className="w-full flex items-center p-4 text-left hover:bg-gray-50 disabled:opacity-60"
                  >
                    <span
                      className={`shrink-0 w-8 h-8 rounded-md border-2 flex items-center justify-center mr-3 ${
                        checked ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'
                      }`}
                    >
                      {checked && '✓'}
                    </span>
                    <span className="flex-1">
                      <span className={`font-medium ${checked ? 'text-gray-900' : 'text-gray-700'}`}>
                        {item.name}
                      </span>
                      {item.frequencyLabel && (
                        <span className="block text-xs text-gray-500">{item.frequencyLabel}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3">
            {applicableItems.length}件中 {applicableItems.filter((i) => checkedItems.includes(i.id)).length}件 完了
          </p>
        </>
      ) : (
        <>
          {/* 月ナビゲーション */}
          <div className="flex items-center justify-between bg-white shadow rounded-lg px-4 py-3 mb-4">
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold"
            >
              ← 前月
            </button>
            <h2 className="text-lg font-bold">{format(currentMonth, 'yyyy年M月')}</h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              disabled={isAfter(addMonths(currentMonth, 1), endOfMonth(today))}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold disabled:opacity-30"
            >
              翌月 →
            </button>
          </div>

          {monthLoading ? (
            <div className="flex justify-center items-center h-64">
              <span className="text-gray-500">読み込み中...</span>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-x-auto">
              {/* 列幅を内容に左右されず一定に保つ。
                  table-fixed だけでは表全体の幅が auto のままで、結局
                  内容に応じた幅になってしまうため、colgroup で各列の幅を
                  指定し、表の総幅も明示する。これで1桁の日と2桁の日で
                  列幅が変わらなくなる。 */}
              <table
                className="border-collapse text-sm table-fixed"
                style={{ width: LABEL_COL_WIDTH + monthDays.length * DAY_COL_WIDTH }}
              >
                <colgroup>
                  <col style={{ width: LABEL_COL_WIDTH }} />
                  {monthDays.map((day) => (
                    <col key={`col-${day.toISOString()}`} style={{ width: DAY_COL_WIDTH }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-100 border px-3 py-2 text-left whitespace-nowrap w-44">
                      項目
                    </th>
                    {monthDays.map((day) => {
                      const wd = day.getDay();
                      const canCheck = isMember && !isAfter(day, today);
                      return (
                        <th
                          key={day.toISOString()}
                          className={`border px-1 py-2 text-center w-10 ${
                            wd === 0 ? 'text-red-500' : wd === 6 ? 'text-blue-500' : 'text-gray-600'
                          } ${isSameDay(day, today) ? 'bg-green-50' : 'bg-gray-50'}`}
                        >
                          <div>{format(day, 'd')}</div>
                          <div className="text-[10px]">{WEEKDAY_LABELS[wd]}</div>
                          {canCheck && (
                            <button
                              type="button"
                              onClick={() => checkAllForDay(day)}
                              title="この日を全てチェック／解除"
                              className="mt-1 w-full text-[11px] leading-none py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                            >
                              ✓全
                            </button>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="sticky left-0 z-10 bg-white border px-3 py-2 whitespace-nowrap">
                        <span className="font-medium">{item.name}</span>
                        {item.frequencyLabel && (
                          <span className="block text-[10px] text-gray-500">{item.frequencyLabel}</span>
                        )}
                      </td>
                      {monthDays.map((day) => {
                        const dateKey = toDateKey(day);
                        const checked = (monthChecks[dateKey] || []).includes(item.id);
                        const applicable = isItemApplicable(item, day);
                        const future = isAfter(day, today);
                        return (
                          <td
                            key={day.toISOString()}
                            onClick={() => toggleMonthCell(item, day)}
                            className={`border text-center h-9 w-10 ${
                              !applicable ? 'bg-gray-100' : ''
                            } ${isMember && !future ? 'cursor-pointer hover:bg-green-50' : ''}`}
                          >
                            {checked ? (
                              <span className="text-green-600 text-lg font-bold">○</span>
                            ) : (
                              ''
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-3">
            ○ = 実施済み。グレーのマスはその曜日に対象外の項目です。各マスをタップして個別に修正できます。
            日付の下の「✓全」ボタンを押すと、その日の対象項目をまとめてチェック（もう一度押すと解除）できます。
          </p>
        </>
      )}
    </div>
  );
};

export default CleaningCheck;
