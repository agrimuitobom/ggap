// src/pages/SelfAssessment/SelfAssessmentDetail.jsx
// 自己点検チェックリストの実施画面。
// 各項目を 適合／不適合／該当なし で判定し、不適合には是正処置と期限を記録する。
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getSelfAssessment,
  updateSelfAssessment,
  summarize,
  ASSESSMENT_STATUS
} from '../../services/selfAssessmentService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const STATUS_STYLE = {
  '適合': 'border-green-600 bg-green-600 text-white',
  '不適合': 'border-red-600 bg-red-600 text-white',
  '該当なし': 'border-gray-500 bg-gray-500 text-white'
};

const SelfAssessmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMember } = useOrganization();

  const [assessment, setAssessment] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSelfAssessment(id);
      if (!data) {
        toast.error('指定された自己点検が見つかりません');
        navigate('/self-assessments');
        return;
      }
      setAssessment(data);
      setItems(data.items || []);
    } catch (err) {
      firestoreLogger.error('自己点検の取得エラー', { id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const updateItem = (key, changes) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));
    setDirty(true);
  };

  const handleSave = async (markComplete) => {
    setSaving(true);
    try {
      await updateSelfAssessment(id, {
        items,
        ...(markComplete ? { completedAt: new Date() } : {})
      });
      setDirty(false);
      toast.success(markComplete ? '自己点検を完了しました' : '保存しました');
      if (markComplete) navigate('/self-assessments');
    } catch (err) {
      firestoreLogger.error('自己点検の保存エラー', { id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">自己点検</h1>
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const s = summarize(items);
  const progress = s.total > 0 ? Math.round((s.answered / s.total) * 100) : 0;

  // カテゴリごとにまとめて表示
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-32">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">{assessment?.title || '自己点検'}</h1>
        <Link to="/self-assessments" className="text-sm text-blue-600 hover:text-blue-800 underline">
          一覧へ
        </Link>
      </div>

      {/* 進捗 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4 sticky top-0 z-10">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold">{s.answered}/{s.total} 項目 点検済み（{progress}%）</span>
          <span>
            <span className="text-green-700">適合 {s.conform}</span>
            {s.nonConform > 0 && <span className="text-red-700 ml-2">不適合 {s.nonConform}</span>}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-green-600 h-2 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {categories.map((category) => (
        <div key={category} className="bg-white shadow rounded-lg mb-4 overflow-hidden">
          <h2 className="bg-gray-100 px-4 py-2 font-bold text-gray-700">{category}</h2>
          <div className="divide-y">
            {items.filter((i) => i.category === category).map((item) => (
              <div key={item.key} className="p-4">
                <p className="text-sm mb-3">{item.text}</p>
                <div className="flex flex-wrap gap-2">
                  {ASSESSMENT_STATUS.map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={!isMember}
                      onClick={() => updateItem(item.key, { status: item.status === st ? '' : st })}
                      className={`px-4 py-2 rounded-full border text-sm disabled:opacity-60 ${
                        item.status === st ? STATUS_STYLE[st] : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                {item.status === '不適合' && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 space-y-2">
                    <div>
                      <label className="block text-xs font-bold text-red-800 mb-1">是正処置</label>
                      <input
                        type="text"
                        value={item.correctiveAction || ''}
                        disabled={!isMember}
                        onChange={(e) => updateItem(item.key, { correctiveAction: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="どう改善するかを記入"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-800 mb-1">対応期限</label>
                      <input
                        type="date"
                        value={item.dueDate || ''}
                        disabled={!isMember}
                        onChange={(e) => updateItem(item.key, { dueDate: e.target.value })}
                        className="border rounded px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {isMember && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex gap-2 md:static md:border-0 md:bg-transparent md:p-0 md:mt-4">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || !dirty}
            className="flex-1 py-3 rounded-lg font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : dirty ? '保存する' : '保存済み'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 py-3 rounded-lg font-bold border-2 border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            点検を完了
          </button>
        </div>
      )}
    </div>
  );
};

export default SelfAssessmentDetail;
