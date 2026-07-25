// src/pages/SelfAssessment/SelfAssessmentList.jsx
// 自己点検（内部監査）の一覧と新規開始。
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getSelfAssessments,
  createSelfAssessment,
  deleteSelfAssessment,
  summarize
} from '../../services/selfAssessmentService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const SelfAssessmentList = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { currentOrganization, isMember } = useOrganization();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      setAssessments(await getSelfAssessments(currentOrganization.id));
    } catch (err) {
      firestoreLogger.error('自己点検一覧の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!currentOrganization) return;
    setCreating(true);
    try {
      const now = new Date();
      const title = `${now.getFullYear()}年度 自己点検`;
      const id = await createSelfAssessment(currentOrganization.id, title, userProfile?.name);
      toast.success('自己点検を開始しました');
      navigate(`/self-assessments/${id}`);
    } catch (err) {
      firestoreLogger.error('自己点検の作成エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('作成中にエラーが発生しました');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, id, title) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`「${title}」を削除しますか？`)) return;
    try {
      await deleteSelfAssessment(id);
      setAssessments((prev) => prev.filter((a) => a.id !== id));
      toast.success('削除しました');
    } catch (err) {
      firestoreLogger.error('自己点検の削除エラー', { id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-24">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
        <h1 className="text-2xl font-bold">✅ 自己点検（内部監査）</h1>
        {isMember && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? '作成中...' : '新しい自己点検を開始'}
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-900">
        GAP認証では、年1回以上の自己点検と、その記録・是正処置の保管が求められます。
        ここでのチェックリストは日常運用向けの簡易版です。審査では認証機関が配布する
        最新の管理点・適合基準が正式な基準になるため、併せてご確認ください。
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-gray-600 mb-1">まだ自己点検の記録がありません。</p>
          <p className="text-sm text-gray-500">「新しい自己点検を開始」から始められます。</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg divide-y">
          {assessments.map((a) => {
            const s = summarize(a.items);
            const startedAt = a.startedAt?.toDate ? a.startedAt.toDate() : null;
            return (
              <Link
                key={a.id}
                to={`/self-assessments/${a.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">
                    {a.title}
                    {a.completedAt && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">完了</span>
                    )}
                    {s.nonConform > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                        不適合 {s.nonConform}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {startedAt ? startedAt.toLocaleDateString('ja-JP') : '-'} 開始 ・
                    {' '}{s.answered}/{s.total} 項目 点検済み
                    {a.createdByName && ` ・ 担当: ${a.createdByName}`}
                  </p>
                </div>
                {isMember && (
                  <button
                    onClick={(e) => handleDelete(e, a.id, a.title)}
                    className="text-red-600 hover:text-red-800 text-sm shrink-0 ml-3"
                  >
                    削除
                  </button>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SelfAssessmentList;
