// src/pages/Seeds/NurseryChecks.jsx
// 育苗中の病害虫モニタリング記録（FV-Smart 26.03）。
//
// 育苗中のロット（播種済み・未定植）を自動で並べ、既定は「なし」。
// 見つけたときだけ「あり」にして、病害虫名と対応を書く。
// 1回の観察が数タップで終わるようにして、定期的な記録を続けやすくする。
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  lotsInNursery,
  getNurseryChecks,
  saveNurseryCheck,
  deleteNurseryCheck,
  daysSinceLastNurseryCheck,
  isNurseryCheckOverdue,
  NURSERY_CHECK_INTERVAL_DAYS
} from '../../services/nurseryCheckService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const todayKey = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const NurseryChecks = () => {
  const { currentOrganization, isMember } = useOrganization();
  const { userProfile } = useAuth();

  const [seedUses, setSeedUses] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [date, setDate] = useState(todayKey());
  const [results, setResults] = useState([]);
  const [noNursery, setNoNursery] = useState(false);
  const [notes, setNotes] = useState('');
  const formRef = useRef(null);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [usesSnap, checkList] = await Promise.all([
        getDocs(query(collection(db, 'seedUses'), where('organizationId', '==', currentOrganization.id))),
        getNurseryChecks(currentOrganization.id)
      ]);
      setSeedUses(usesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setChecks(checkList);
    } catch (err) {
      firestoreLogger.error('育苗観察記録の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('育苗観察記録の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    load();
  }, [load]);

  const nurseryLots = lotsInNursery(seedUses);

  // 新規入力のときは、育苗中のロットを「なし」で並べておく
  const resetForm = useCallback(() => {
    setEditingId(null);
    setDate(todayKey());
    setResults(lotsInNursery(seedUses).map((u) => ({
      lotNumber: u.lotNumber,
      seedName: u.seedName || '',
      status: 'なし',
      detail: '',
      action: ''
    })));
    setNoNursery(lotsInNursery(seedUses).length === 0);
    setNotes('');
  }, [seedUses]);

  useEffect(() => {
    if (!editingId) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedUses]);

  const updateResult = (index, patch) => {
    setResults((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const startEdit = (check) => {
    setEditingId(check.id);
    setDate(check.date || todayKey());
    setResults(check.results || []);
    setNoNursery(!!check.noNursery);
    setNotes(check.notes || '');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSave = async () => {
    if (!currentOrganization) return;
    const found = results.filter((r) => r.status === 'あり');
    if (found.some((r) => !r.detail.trim() || !r.action.trim())) {
      toast.error('「あり」のロットは、病害虫名・症状と対応を入力してください');
      return;
    }
    if (!noNursery && results.length === 0) {
      toast.error('観察したロットがありません。育苗中のロットが無い場合はチェックを入れてください');
      return;
    }
    try {
      setSaving(true);
      await saveNurseryCheck(currentOrganization.id, editingId, {
        date,
        checkedByName: userProfile?.name || '',
        noNursery,
        results: noNursery ? [] : results,
        notes
      });
      toast.success(editingId ? '観察記録を更新しました' : '観察を記録しました');
      await load();
      resetForm();
    } catch (err) {
      firestoreLogger.error('育苗観察記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (check) => {
    if (!window.confirm(`${check.date} の観察記録をゴミ箱へ移動しますか？`)) return;
    try {
      await deleteNurseryCheck(check.id, currentOrganization.id, userProfile?.name || '');
      toast.success('ゴミ箱へ移動しました');
      await load();
    } catch (err) {
      firestoreLogger.error('育苗観察記録の削除エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">読み込み中...</div>;
  }

  const days = daysSinceLastNurseryCheck(checks);
  const overdue = isNurseryCheckOverdue(checks, nurseryLots);

  return (
    <div className="container mx-auto p-4 pb-24 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-bold">育苗の病害虫観察</h1>
        <Link to="/seed-uses" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm">
          播種・定植記録へ
        </Link>
      </div>

      {overdue ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded p-3 mb-4 text-sm text-amber-900">
          <p className="font-bold">
            ⚠️ {days === null ? '育苗中のロットがありますが、観察記録がまだありません' : `前回の観察から${days}日たっています`}
          </p>
          <p>育苗中は{NURSERY_CHECK_INTERVAL_DAYS}日に1回を目安に、苗を見て記録してください。</p>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-900">
          育苗中の苗に病害虫の兆候がないかを定期的に見て、その結果を残す記録です。
          「なし」も確認した証拠になります。目安は{NURSERY_CHECK_INTERVAL_DAYS}日に1回です。
        </div>
      )}

      {isMember && (
        <div ref={formRef} className="bg-white rounded shadow p-4 mb-6">
          <h2 className="font-bold mb-3">{editingId ? '観察記録を編集' : '観察を記録'}</h2>

          <label className="block text-sm text-gray-700 mb-1">観察日</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-2 mb-4"
          />

          <label className="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              checked={noNursery}
              onChange={(e) => setNoNursery(e.target.checked)}
              className="h-5 w-5"
            />
            育苗中のロットはなかった
          </label>

          {!noNursery && (
            <>
              {results.length === 0 ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3 mb-3">
                  育苗中（播種済み・未定植）のロットが見つかりません。播種記録にロットIDが入っているか確認してください。
                </p>
              ) : (
                <div className="space-y-3 mb-3">
                  {results.map((r, i) => (
                    <div
                      key={`${r.lotNumber}-${i}`}
                      className={`border-2 rounded p-3 ${r.status === 'あり' ? 'border-red-300 bg-red-50' : 'border-green-200 bg-green-50'}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm">
                          <span className="font-mono font-bold">{r.lotNumber}</span>
                          {r.seedName && <span className="ml-2 text-gray-600">{r.seedName}</span>}
                        </span>
                        <div className="flex gap-2">
                          {['なし', 'あり'].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => updateResult(i, { status: v })}
                              className={`px-4 py-2 rounded border-2 text-sm font-medium ${
                                r.status === v
                                  ? v === 'あり'
                                    ? 'border-red-500 bg-white text-red-800'
                                    : 'border-green-600 bg-white text-green-800'
                                  : 'border-gray-200 bg-white text-gray-500'
                              }`}
                            >
                              {v === 'あり' ? '⚠️ あり' : '⭕ なし'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {r.status === 'あり' && (
                        <div className="mt-3 space-y-2">
                          <input
                            type="text"
                            value={r.detail}
                            onChange={(e) => updateResult(i, { detail: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                            placeholder="病害虫名・症状（例: アブラムシを数株で確認）"
                          />
                          <input
                            type="text"
                            value={r.action}
                            onChange={(e) => updateResult(i, { action: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                            placeholder="とった対応（例: 該当株を抜き取り処分、翌日も確認）"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <label className="block text-sm text-gray-700 mb-1">備考</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-4"
            placeholder="例: 葉色良好、徒長なし"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded disabled:bg-gray-300"
            >
              {saving ? '保存中...' : editingId ? '更新する' : '記録する'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">
                キャンセル
              </button>
            )}
          </div>
        </div>
      )}

      <h2 className="font-bold text-gray-700 mb-2">観察記録</h2>
      {checks.length === 0 ? (
        <p className="text-gray-500 text-center py-8">記録がありません。</p>
      ) : (
        <div className="space-y-2">
          {checks.map((c) => {
            const found = (c.results || []).filter((r) => r.status === 'あり');
            return (
              <div
                key={c.id}
                onClick={() => isMember && startEdit(c)}
                className={`bg-white rounded shadow p-3 border-l-4 ${
                  c.noNursery ? 'border-gray-400' : found.length > 0 ? 'border-red-500' : 'border-green-500'
                } ${isMember ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{c.date}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      c.noNursery
                        ? 'bg-gray-100 text-gray-700'
                        : found.length > 0
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {c.noNursery ? '育苗なし' : found.length > 0 ? `発生あり ${found.length}ロット` : `異常なし ${(c.results || []).length}ロット`}
                    </span>
                    {isMember && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  確認者：{c.checkedByName || '—'}
                  {(c.results || []).length > 0 && `　／　${c.results.map((r) => r.lotNumber).join('、')}`}
                </p>
                {found.map((r, i) => (
                  <p key={i} className="text-sm text-red-800">
                    {r.lotNumber}：{r.detail}　→ {r.action}
                  </p>
                ))}
                {c.notes && <p className="text-sm text-gray-600">{c.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NurseryChecks;
