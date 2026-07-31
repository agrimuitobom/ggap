// src/pages/Trainings/TrainingsList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { getTrainingItems } from '../../services/trainingItemService';
import { firestoreLogger } from '../../utils/logger';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const TrainingsList = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { currentOrganization, isAdmin } = useOrganization();
  const [trainings, setTrainings] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // 審査時に絞り込んで見せるためのフィルタ
  const [filterItemId, setFilterItemId] = useState('');
  const [filterAudience, setFilterAudience] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  useEffect(() => {
    if (currentOrganization) {
      fetchTrainings();
    }
  }, [currentOrganization]);

  const fetchTrainings = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'trainings'),
        where('organizationId', '==', currentOrganization.id),
        orderBy('trainingDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const trainingsData = [];
      querySnapshot.forEach((doc) => {
        trainingsData.push({
          id: doc.id,
          ...doc.data(),
          trainingDate: doc.data().trainingDate?.toDate()
        });
      });
      setTrainings(trainingsData);
      setItems(await getTrainingItems(currentOrganization.id));
    } catch (err) {
      firestoreLogger.error('教育・訓練記録一覧の取得に失敗しました', {
        organizationId: currentOrganization?.id
      }, err);
      setError('教育・訓練記録の取得中にエラーが発生しました。');
      toast.error('教育・訓練記録の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    try {
      await deleteDoc(doc(db, 'trainings', id));
      setTrainings(trainings.filter(training => training.id !== id));
      setDeleteConfirm(null);
      toast.success('教育・訓練記録を削除しました');
    } catch (err) {
      firestoreLogger.error('教育・訓練記録の削除に失敗しました', {
        trainingId: id,
        organizationId: currentOrganization?.id
      }, err);
      setError('教育・訓練記録の削除中にエラーが発生しました。');
      toast.error('教育・訓練記録の削除中にエラーが発生しました');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  // 責任者による確認（紙の「責任者確認印」に相当する電子承認）
  const handleApprove = async (training) => {
    try {
      await updateDoc(doc(db, 'trainings', training.id), {
        approvedByUid: currentUser?.uid || null,
        approvedByName: userProfile?.name || '',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('確認済みにしました');
      await fetchTrainings();
    } catch (err) {
      firestoreLogger.error('教育訓練記録の承認エラー', { trainingId: training.id }, err);
      toast.error('更新中にエラーが発生しました');
    }
  };

  // 欠席者へのフォロー（後日指導）を記録する
  const handleFollowUp = async (training) => {
    const note = window.prompt(
      `欠席者（${(training.absentNames || []).join('、')}）へのフォローを記録します。\n実施した内容を入力してください。`,
      '次回実習時に個別指導を実施'
    );
    if (note == null) return;
    try {
      await updateDoc(doc(db, 'trainings', training.id), {
        absentFollowUpNote: note,
        absentFollowUpAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('フォローを記録しました');
      await fetchTrainings();
    } catch (err) {
      firestoreLogger.error('欠席者フォローの記録エラー', { trainingId: training.id }, err);
      toast.error('更新中にエラーが発生しました');
    }
  };

  // フィルタ適用後の記録
  const filtered = useMemo(() => {
    const start = filterStart ? new Date(`${filterStart}T00:00:00`) : null;
    const end = filterEnd ? new Date(`${filterEnd}T23:59:59`) : null;
    return trainings.filter((t) => {
      if (filterItemId && !(t.itemIds || []).includes(filterItemId)) return false;
      if (filterAudience) {
        const label = [...(t.audiences || []), t.groupName || ''].join('・');
        if (!label.includes(filterAudience)) return false;
      }
      if (start && (!t.trainingDate || t.trainingDate < start)) return false;
      if (end && (!t.trainingDate || t.trainingDate > end)) return false;
      return true;
    });
  }, [trainings, filterItemId, filterAudience, filterStart, filterEnd]);

  // 受講者区分の候補（記録から自動で集める）
  const audienceOptions = useMemo(() => {
    const set = new Set();
    trainings.forEach((t) => {
      (t.audiences || []).forEach((a) => set.add(a));
      if (t.groupName) set.add(t.groupName);
    });
    return [...set].sort();
  }, [trainings]);

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error('書き出すデータがありません');
      return;
    }
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['実施日', '訓練項目', '受講者', '出席人数', '欠席者', '実施内容', '所要時間(分)', '実施者', '確認者', '確認日'];
    const rows = filtered.map((t) => [
      t.trainingDate ? toDateString(t.trainingDate) : '',
      (t.itemTitles || []).join(' / ') || t.title || '',
      [...(t.audiences || []), t.groupName || ''].filter(Boolean).join('・'),
      (t.attendeeNames || t.participants || []).length || '',
      (t.absentNames || []).join('・'),
      t.description || '',
      t.duration ?? '',
      t.instructor || t.recordedByName || '',
      t.approvedByName || '',
      t.approvedAt?.toDate ? toDateString(t.approvedAt.toDate()) : ''
    ]);
    const csv = '﻿' + [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `教育訓練記録_${toDateString(new Date()).replace(/-/g, '')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('CSVを書き出しました');
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      '完了': 'bg-green-100 text-green-800',
      '進行中': 'bg-blue-100 text-blue-800',
      '予定': 'bg-yellow-100 text-yellow-800',
      '延期': 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status || '-'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">教育・訓練記録管理</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
        <h1 className="text-2xl font-bold">教育・訓練記録</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/trainings/quick"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            ⚡ 実施を記録
          </Link>
          <Link
            to="/trainings/items"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            📚 計画（項目）
          </Link>
          <Link
            to="/trainings/new"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            詳細入力
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}

      {/* 審査時にすぐ絞り込めるフィルタ */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">訓練項目</label>
            <select value={filterItemId} onChange={(e) => setFilterItemId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="">すべて</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.code}{i.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">受講者</label>
            <select value={filterAudience} onChange={(e) => setFilterAudience(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="">すべて</option>
              {audienceOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          <span className="text-gray-500">〜</span>
          <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          <button onClick={exportCsv} className="ml-auto px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">
            CSV書き出し
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {filtered.length}件を表示中（全{trainings.length}件）。
          審査で「この項目の訓練はいつ実施しましたか？」と聞かれたら、ここで絞り込んで提示できます。
        </p>
      </div>

      {filtered.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">実施日</th>
                <th className="py-3 px-4 text-left font-semibold">教育・訓練名</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">受講者</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">実施者</th>
                <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">責任者確認</th>
                <th className="py-3 px-4 text-left font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((training) => {
                const audienceLabel = [...(training.audiences || []), training.groupName || '']
                  .filter(Boolean).join('・');
                const attendees = training.attendeeNames || training.participants || [];
                const absents = training.absentNames || [];
                // クイック記録（項目に紐づく記録）はクイック画面で編集する
                const editPath = (training.itemIds || []).length > 0
                  ? `/trainings/quick/edit/${training.id}`
                  : `/trainings/edit/${training.id}`;
                return (
                <tr
                  key={training.id}
                  onClick={() => navigate(editPath)}
                  className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <td className="py-3 px-4 whitespace-nowrap">
                    {training.trainingDate ? format(training.trainingDate, 'yyyy/MM/dd') : '-'}
                  </td>
                  <td className="py-3 px-4">
                    {(training.itemTitles || []).length > 0
                      ? training.itemTitles.map((t, i) => (
                          <span key={i} className="block text-sm">{t}</span>
                        ))
                      : (training.title || '-')}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {audienceLabel || '-'}
                    {attendees.length > 0 && (
                      <span className="block text-xs text-gray-500">出席 {attendees.length}名</span>
                    )}
                    {absents.length > 0 && (
                      <span className={`block text-xs ${training.absentFollowUpAt ? 'text-gray-500' : 'text-amber-700 font-semibold'}`}>
                        欠席 {absents.length}名{training.absentFollowUpAt ? '（フォロー済）' : '（要フォロー）'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {training.instructor || training.recordedByName || '-'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="py-3 px-4 whitespace-nowrap">
                    {training.approvedAt ? (
                      <span className="text-green-700 text-sm">
                        ✓ {training.approvedByName}
                        <span className="block text-xs text-gray-500">
                          {training.approvedAt?.toDate ? format(training.approvedAt.toDate(), 'yyyy/MM/dd') : ''}
                        </span>
                      </span>
                    ) : isAdmin ? (
                      <button
                        onClick={() => handleApprove(training)}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        確認する
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">未確認</span>
                    )}
                    {absents.length > 0 && !training.absentFollowUpAt && (
                      <button
                        onClick={() => handleFollowUp(training)}
                        className="block mt-1 text-xs text-amber-700 underline"
                      >
                        欠席者フォローを記録
                      </button>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="py-3 px-4">
                    {deleteConfirm === training.id ? (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleDelete(training.id)} 
                          className="text-red-700 hover:text-red-900"
                        >
                          確認
                        </button>
                        <button 
                          onClick={handleCancelDelete} 
                          className="text-gray-600 hover:text-gray-800"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <Link
                          to={editPath}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          編集
                        </Link>
                        <button 
                          onClick={() => handleDelete(training.id)} 
                          className="text-red-600 hover:text-red-800"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-gray-500 mb-4">教育・訓練記録がありません。</p>
          <Link 
            to="/trainings/new" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            最初の教育・訓練記録を登録する
          </Link>
        </div>
      )}
    </div>
  );
};

export default TrainingsList;