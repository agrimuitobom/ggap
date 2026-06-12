// src/pages/WorkLogs/QuickWorkLogForm.jsx
// クイック記録モード: 作業内容→圃場→保存の最短3タップで記録する。
// 施肥・防除・播種など詳細が必要な作業は「要追記」(isDraft) として保存し、
// 後から通常フォームで追記して完成させる。
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useWorkLogData } from '../../hooks/useWorkLogData';
import { loadWorkLogDefaults, saveWorkLogDefaults } from '../../utils/workLogDefaults';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const WORK_TYPES = [
  { value: '収穫', icon: '🌾' },
  { value: '除草', icon: '🌿' },
  { value: '潅水', icon: '💧' },
  { value: '施肥', icon: '🌱' },
  { value: '防除', icon: '🚿' },
  { value: '播種', icon: '🌰' },
  { value: '定植', icon: '🪴' },
  { value: '清掃', icon: '🧹' },
  { value: 'その他', icon: '📝' }
];

const HOUR_PRESETS = ['0.5', '1', '2', '4', '8'];

// 詳細入力（資材・希釈倍率など）が必要な作業種別
const NEEDS_DETAILS = ['施肥', '防除', '播種'];

const QuickWorkLogForm = () => {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { fields, users, loading: fetchLoading } = useWorkLogData();

  const [workType, setWorkType] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [workHours, setWorkHours] = useState('');
  const [workers, setWorkers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  // 前回値（圃場・担当者）を初期選択に反映
  useEffect(() => {
    if (fetchLoading || defaultsApplied || !currentOrganization) return;
    const defaults = loadWorkLogDefaults(currentOrganization.id);
    if (defaults) {
      if (defaults.fieldId && fields.some(f => f.id === defaults.fieldId)) {
        setFieldId(defaults.fieldId);
      }
      if (Array.isArray(defaults.workers)) {
        const validWorkers = defaults.workers.filter(id => users.some(u => u.id === id));
        setWorkers(validWorkers);
      }
    }
    setDefaultsApplied(true);
  }, [fetchLoading, defaultsApplied, currentOrganization, fields, users]);

  const toggleWorker = (workerId) => {
    setWorkers(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  const canSave = workType && fieldId && !saving;

  // 詳細が必要な作業、または担当者・作業時間が未入力なら「要追記」とする
  const willBeDraft = NEEDS_DETAILS.includes(workType) || workers.length === 0 || !workHours;

  const handleSave = async (continueToDetail) => {
    if (!canSave || !currentOrganization) return;

    setSaving(true);
    try {
      const selectedField = fields.find(f => f.id === fieldId);
      const selectedWorkers = users.filter(u => workers.includes(u.id));

      const workLogData = {
        organizationId: currentOrganization.id,
        date: new Date(),
        fieldId,
        fieldName: selectedField?.name || '',
        workType,
        workers,
        workerNames: selectedWorkers.map(w => w.name),
        details: '',
        workHours: workHours ? Number(workHours) : null,
        harvestAmount: null,
        wasteAmount: null,
        isDraft: willBeDraft,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, 'workLogs'), workLogData);

      saveWorkLogDefaults(currentOrganization.id, { fieldId, workers });

      if (continueToDetail) {
        toast.success('仮保存しました。詳細を入力してください');
        navigate(`/work-logs/edit/${ref.id}`);
      } else if (willBeDraft) {
        toast.success('記録しました（あとで詳細の追記が必要です）');
        navigate('/work-logs');
      } else {
        toast.success('記録しました');
        navigate('/work-logs');
      }
    } catch (err) {
      firestoreLogger.error('クイック記録の保存エラー', {
        organizationId: currentOrganization?.id,
        workType
      }, err);
      toast.error('記録の保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">⚡ クイック記録</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container container mx-auto p-4 max-w-2xl pb-24">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">⚡ クイック記録</h1>
        <button
          type="button"
          onClick={() => navigate('/work-logs/new')}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          通常フォームで入力
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        今日の作業を最短3タップで記録。詳細はあとから追記できます。
      </p>

      {/* 1. 作業内容 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-3">
          1. 何をした？ <span className="text-red-500">*</span>
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {WORK_TYPES.map(({ value, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setWorkType(value)}
              className={`touch-target flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                workType === value
                  ? 'border-green-600 bg-green-50 text-green-800 font-bold'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-2xl mb-1">{icon}</span>
              <span className="text-sm">{value}</span>
            </button>
          ))}
        </div>
        {NEEDS_DETAILS.includes(workType) && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3">
            ※ {workType}はGGAPの記録要件として資材名・使用量などの詳細が必要です。
            保存後「要追記」と表示されるので、あとで追記してください。
          </p>
        )}
      </div>

      {/* 2. 圃場 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-3">
          2. どこで？ <span className="text-red-500">*</span>
        </h2>
        {fields.length === 0 ? (
          <p className="text-sm text-gray-500">
            圃場が登録されていません。先に圃場管理から登録してください。
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {fields.map((field) => (
              <button
                key={field.id}
                type="button"
                onClick={() => setFieldId(field.id)}
                className={`touch-target p-3 rounded-lg border-2 text-sm transition-colors ${
                  fieldId === field.id
                    ? 'border-green-600 bg-green-50 text-green-800 font-bold'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {field.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. 任意項目（担当者・時間） */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-3">
          3. だれが・どれくらい？（前回値を記憶します）
        </h2>

        {users.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">担当者</p>
            <div className="flex flex-wrap gap-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleWorker(user.id)}
                  className={`px-3 py-2 rounded-full border text-sm transition-colors ${
                    workers.includes(user.id)
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {user.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mb-2">作業時間</p>
        <div className="flex flex-wrap gap-2">
          {HOUR_PRESETS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setWorkHours(h === workHours ? '' : h)}
              className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                workHours === h
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {h}時間
            </button>
          ))}
        </div>
      </div>

      {/* 保存ボタン */}
      <div className="space-y-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => handleSave(false)}
          className={`w-full py-4 rounded-lg font-bold text-white text-lg transition-colors ${
            canSave ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {saving ? '保存中...' : willBeDraft && workType ? '保存する（あとで追記）' : '保存する'}
        </button>
        {NEEDS_DETAILS.includes(workType) && (
          <button
            type="button"
            disabled={!canSave}
            onClick={() => handleSave(true)}
            className="w-full py-3 rounded-lg font-bold border-2 border-green-600 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            保存して今すぐ詳細を入力
          </button>
        )}
      </div>
    </div>
  );
};

export default QuickWorkLogForm;
