// src/pages/PPE/PPEChecks.jsx
// 保護具（PPE）着用確認記録の一覧。
//
// FV-Smart 20.03.03 の「提供されたPPEが使用されていることを示す証拠」に
// 直接あたる記録。管理者が現場を見て記録したものなので、審査で最も強い証拠になる。
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getPpeChecks,
  deletePpeCheck,
  hasNonCompliance,
  daysSinceLastCheck,
  isCheckOverdue,
  CHECK_INTERVAL_DAYS
} from '../../services/ppeService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const PPEChecks = () => {
  const { currentOrganization, isMember } = useOrganization();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      setChecks(await getPpeChecks(currentOrganization.id));
    } catch (err) {
      firestoreLogger.error('着用確認記録の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('着用確認記録の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (check) => {
    if (!window.confirm(`${check.date} の記録をゴミ箱へ移動しますか？`)) return;
    try {
      await deletePpeCheck(check.id, currentOrganization.id, userProfile?.name || '');
      toast.success('ゴミ箱へ移動しました');
      await load();
    } catch (err) {
      firestoreLogger.error('着用確認記録の削除エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">読み込み中...</div>;
  }

  const days = daysSinceLastCheck(checks);
  const overdue = isCheckOverdue(checks);

  return (
    <div className="container mx-auto p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-bold">保護具の着用確認記録</h1>
        <div className="flex gap-2">
          <Link
            to="/ppe"
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          >
            品目・在庫へ
          </Link>
          {isMember && (
            <Link
              to="/ppe/checks/new"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
            >
              ＋ 確認を記録
            </Link>
          )}
        </div>
      </div>

      {overdue ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded p-3 mb-4 text-sm text-amber-900">
          <p className="font-bold mb-1">
            ⚠️ {days === null
              ? '着用確認がまだ1件も記録されていません'
              : `前回の着用確認から${days}日が経過しています`}
          </p>
          <p>
            提供した保護具が実際に使われていることを示す証拠が必要です。
            {CHECK_INTERVAL_DAYS}日に1回を目安に、現場を見て記録してください。
          </p>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm text-green-900">
          ✅ 前回の着用確認から{days}日です（目安は{CHECK_INTERVAL_DAYS}日に1回）。
        </div>
      )}

      {checks.length === 0 ? (
        <div className="bg-white rounded shadow p-6 text-center text-gray-600">
          <p className="mb-3">記録がありません。</p>
          <p className="text-sm">
            作業中の様子を見て、保護具が着用されているかを記録してください。
            写真を1枚添えておくと、審査での説明が楽になります。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {checks.map((check) => {
            const ng = hasNonCompliance(check);
            const okCount = (check.results || []).filter((r) => r.result === 'ok').length;
            const ngCount = (check.results || []).filter((r) => r.result === 'ng').length;
            return (
              <div
                key={check.id}
                onClick={() => isMember && navigate(`/ppe/checks/edit/${check.id}`)}
                className={`bg-white rounded shadow p-4 ${isMember ? 'cursor-pointer hover:bg-gray-50' : ''} ${
                  ng ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="font-bold">
                    {check.date}
                    {check.workName && (
                      <span className="ml-2 font-normal text-gray-600">{check.workName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${ng ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {ng ? `未着用 ${ngCount}件` : `着用 ${okCount}件`}
                    </span>
                    <span onClick={(e) => e.stopPropagation()}>
                      {isMember && (
                        <button
                          type="button"
                          onClick={() => handleDelete(check)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          削除
                        </button>
                      )}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-600">
                  確認者：{check.checkedByName || '—'}
                  {(check.targetNames?.length > 0 || check.otherTargets) && (
                    <>
                      　／　対象：
                      {[...(check.targetNames || []), check.otherTargets].filter(Boolean).join('、')}
                    </>
                  )}
                </p>

                {ng && check.correctiveAction && (
                  <p className="text-sm text-red-800 mt-1">是正：{check.correctiveAction}</p>
                )}
                {check.findings && (
                  <p className="text-sm text-gray-600 mt-1">気づき：{check.findings}</p>
                )}
                {check.photoUrls?.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {check.photoUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`確認写真${i + 1}`}
                        className="w-16 h-16 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PPEChecks;
