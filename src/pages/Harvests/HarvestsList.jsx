import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { moveToTrash } from '../../services/trashService';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { findUnsyncedHarvestWorkLogs, backfillHarvests } from '../../services/harvestSyncService';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { firestoreLogger } from '../../utils/logger';

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const HarvestsList = () => {
  const navigate = useNavigate();
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();
  const { userProfile } = useAuth();

  // 集計期間（廃棄率などの算出範囲）
  const [periodPreset, setPeriodPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(toDateString(new Date()));

  // 作業日誌にあって収穫記録に未反映のもの
  const [unsynced, setUnsynced] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const fetchHarvests = useCallback(async () => {
    if (!currentOrganization) {
      setLoading(false);
      return;
    }

    try {
      const harvestsQuery = query(
        collection(db, 'harvests'),
        where('organizationId', '==', currentOrganization.id),
        orderBy('harvestDate', 'desc')
      );

      const querySnapshot = await getDocs(harvestsQuery);
      const harvestsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setHarvests(harvestsList);

      // 作業日誌の収穫で未反映のものを確認する
      const pending = await findUnsyncedHarvestWorkLogs(currentOrganization.id);
      setUnsynced(pending);
      setLoading(false);
    } catch (error) {
      firestoreLogger.error('収穫記録の取得に失敗しました', { organizationId: currentOrganization.id }, error);
      toast.error('収穫記録の取得中にエラーが発生しました');
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    fetchHarvests();
  }, [fetchHarvests]);

  // 作業日誌の収穫を収穫記録に取り込む
  const handleBackfill = async () => {
    if (!currentOrganization || unsynced.length === 0) return;
    if (!window.confirm(`作業日誌の収穫 ${unsynced.length}件を収穫記録に取り込みます。よろしいですか？`)) return;
    setSyncing(true);
    try {
      const fieldsSnap = await getDocs(query(
        collection(db, 'fields'),
        where('organizationId', '==', currentOrganization.id)
      ));
      const fields = fieldsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const count = await backfillHarvests(currentOrganization.id, unsynced, fields);
      toast.success(`${count}件を収穫記録に取り込みました`);
      await fetchHarvests();
    } catch (error) {
      firestoreLogger.error('収穫記録の取り込みに失敗しました', { organizationId: currentOrganization.id }, error);
      toast.error('取り込み中にエラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  // 期間で絞り込んだ収穫記録
  const filteredHarvests = useMemo(() => {
    if (!startDate && !endDate) return harvests;
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    return harvests.filter((h) => {
      const d = h.harvestDate?.toDate ? h.harvestDate.toDate() : h.harvestDate ? new Date(h.harvestDate) : null;
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [harvests, startDate, endDate]);

  // 期間プリセットの適用
  const applyPreset = (preset) => {
    setPeriodPreset(preset);
    const today = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'thisMonth') {
      setStartDate(toDateString(new Date(today.getFullYear(), today.getMonth(), 1)));
      setEndDate(toDateString(today));
    } else if (preset === 'thisYear') {
      setStartDate(toDateString(new Date(today.getFullYear(), 0, 1)));
      setEndDate(toDateString(today));
    } else if (preset === 'last3Months') {
      setStartDate(toDateString(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())));
      setEndDate(toDateString(today));
    }
  };

  // 期間内の廃棄率を計算
  const totalStats = useMemo(() => {
    let totalHarvest = 0;
    let totalDisposal = 0;
    // 株数ベースの集計（記録があるものだけ）
    let totalPlants = 0;
    let discardedPlants = 0;

    filteredHarvests.forEach(harvest => {
      totalHarvest += parseFloat(harvest.quantity) || 0;
      totalDisposal += parseFloat(harvest.disposalAmount) || 0;
      totalPlants += Number(harvest.totalPlants) || 0;
      discardedPlants += Number(harvest.discardedPlants) || 0;
    });

    const totalAmount = totalHarvest + totalDisposal;
    const disposalRate = totalAmount > 0 ? ((totalDisposal / totalAmount) * 100).toFixed(1) : 0;
    const plantDiscardRate = totalPlants > 0 ? ((discardedPlants / totalPlants) * 100).toFixed(1) : null;

    return {
      totalHarvest: totalHarvest.toFixed(1),
      totalDisposal: totalDisposal.toFixed(1),
      totalAmount: totalAmount.toFixed(1),
      disposalRate,
      totalPlants,
      discardedPlants,
      plantDiscardRate
    };
  }, [filteredHarvests]);

  const handleDelete = async (id) => {
    if (window.confirm('この収穫記録を削除してもよろしいですか？')) {
      try {
        await moveToTrash('harvests', id, currentOrganization.id, userProfile?.name);
        setHarvests(harvests.filter(harvest => harvest.id !== id));
        toast.success('収穫記録を削除しました');
      } catch (error) {
        firestoreLogger.error('収穫記録の削除に失敗しました', { harvestId: id }, error);
        toast.error('収穫記録の削除中にエラーが発生しました');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-20 md:pb-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">収穫記録</h1>
        <div className="flex gap-2">
          <Link
            to="/harvests/quick"
            className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-300 flex items-center justify-center"
          >
            ⚡ クイック記録
          </Link>
          <Link
            to="/harvests/new"
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded transition duration-300 flex items-center justify-center"
          >
            <span className="mr-1">新規記録</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>

      {/* 作業日誌の収穫が未反映の場合の取り込み案内 */}
      {unsynced.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
          <p className="text-sm text-amber-900 mb-2">
            ⚠️ 作業日誌に「収穫」として記録されているが、収穫記録に反映されていないものが
            <span className="font-bold">{unsynced.length}件</span>あります。
            取り込むと、廃棄率の集計・トレーサビリティ・マスバランスに反映されます。
          </p>
          <button
            onClick={handleBackfill}
            disabled={syncing}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {syncing ? '取り込み中...' : '収穫記録に取り込む'}
          </button>
        </div>
      )}

      {/* 集計期間の指定 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <p className="text-sm font-bold text-gray-700 mb-2">集計期間</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { key: 'all', label: '全期間' },
            { key: 'thisMonth', label: '今月' },
            { key: 'last3Months', label: '過去3ヶ月' },
            { key: 'thisYear', label: '今年' }
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-4 py-2 rounded-full border text-sm ${
                periodPreset === p.key
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPeriodPreset('custom'); }}
            className="border rounded px-3 py-2 text-sm"
          />
          <span className="text-gray-500">〜</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPeriodPreset('custom'); }}
            className="border rounded px-3 py-2 text-sm"
          />
          <span className="text-sm text-gray-500 ml-auto">
            対象 {filteredHarvests.length} 件 / 全 {harvests.length} 件
          </span>
        </div>
      </div>

      {/* 統計サマリー */}
      {harvests.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">総収穫量（出荷可能）</p>
            <p className="text-xl font-bold text-green-600">{totalStats.totalHarvest} kg</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">総廃棄量</p>
            <p className="text-xl font-bold text-red-600">{totalStats.totalDisposal} kg</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">総生産量</p>
            <p className="text-xl font-bold text-gray-700">{totalStats.totalAmount} kg</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">平均廃棄率</p>
            <div className="flex items-center">
              <p className={`text-xl font-bold ${
                parseFloat(totalStats.disposalRate) > 20
                  ? 'text-red-600'
                  : parseFloat(totalStats.disposalRate) > 10
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}>
                {totalStats.disposalRate}%
              </p>
              {parseFloat(totalStats.disposalRate) <= 10 && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">良好</span>
              )}
              {parseFloat(totalStats.disposalRate) > 10 && parseFloat(totalStats.disposalRate) <= 20 && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">注意</span>
              )}
              {parseFloat(totalStats.disposalRate) > 20 && (
                <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">要改善</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 株数ベースの廃棄率（記録がある場合のみ） */}
      {totalStats.plantDiscardRate != null && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <p className="text-xs text-gray-500 mb-1">株数ベースの廃棄率（期間内）</p>
          <p className="text-xl font-bold text-gray-800">
            {totalStats.plantDiscardRate}%
            <span className="ml-2 text-sm font-normal text-gray-500">
              （廃棄 {totalStats.discardedPlants} 株 / 総 {totalStats.totalPlants} 株）
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            株の大小に左右されないため、研究では株数ベースの廃棄率を主に使います。
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
        </div>
      ) : filteredHarvests.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  収穫日
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  圃場
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  作物
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  収穫量
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  廃棄量
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  廃棄率
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  品質
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredHarvests.map((harvest) => {
                const disposalRate = harvest.disposalRate || 0;
                return (
                  <tr
                  key={harvest.id}
                  onClick={() => navigate(`/harvests/${harvest.id}`)}
                  className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {harvest.harvestDate instanceof Date
                        ? format(harvest.harvestDate, 'yyyy/MM/dd')
                        : harvest.harvestDate && harvest.harvestDate.toDate
                          ? format(harvest.harvestDate.toDate(), 'yyyy/MM/dd')
                          : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {harvest.fieldName || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {harvest.cropName || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {harvest.quantity} {harvest.unit}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 hidden md:table-cell">
                      {harvest.disposalAmount ? (
                        <span className="text-red-600">
                          {harvest.disposalAmount} {harvest.unit}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        disposalRate > 20
                          ? 'bg-red-100 text-red-700'
                          : disposalRate > 10
                          ? 'bg-yellow-100 text-yellow-700'
                          : disposalRate > 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {disposalRate > 0 ? `${disposalRate}%` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 hidden lg:table-cell">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        harvest.quality === '優'
                          ? 'bg-green-100 text-green-800'
                          : harvest.quality === '良'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {harvest.quality}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()} className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link
                          to={`/harvests/${harvest.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          詳細
                        </Link>
                        <Link
                          to={`/harvests/edit/${harvest.id}`}
                          className="text-amber-600 hover:text-amber-900"
                        >
                          編集
                        </Link>
                        <button
                          onClick={() => handleDelete(harvest.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="bg-gray-50 px-4 py-2 border-t">
            <p className="text-sm text-gray-500">{filteredHarvests.length}件の収穫記録</p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <p className="text-gray-500 mb-4">収穫記録がまだありません</p>
          <Link
            to="/harvests/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            最初の収穫記録を作成する
          </Link>
        </div>
      )}
    </div>
  );
};

export default HarvestsList;
