// src/pages/WorkLogs/QuickWorkLogForm.jsx
// クイック記録モード: 作業内容→圃場→保存の最短3タップで記録する。
// - 施肥・防除・播種など詳細が必要な作業は「要追記」(isDraft) として保存
// - 保存後は画面に留まり連続記録できる
// - オフラインでも即時保存（通信回復時に自動同期）
// - 収穫選択時はPHI（収穫前日数）違反を自動チェック
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkLogData } from '../../hooks/useWorkLogData';
import { loadWorkLogDefaults, saveWorkLogDefaults } from '../../utils/workLogDefaults';
import { checkPreHarvestInterval } from '../../services/phiService';
import PhiWarningBanner from '../../components/Phi/PhiWarningBanner';
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

const MAX_PHOTOS = 3;

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const QuickWorkLogForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // カレンダーから「この日の記録を追加」で開いた場合の日付指定
  const presetDate = searchParams.get('date');
  const { currentOrganization } = useOrganization();
  const { currentUser, userProfile } = useAuth();
  const { fields, users, loading: fetchLoading } = useWorkLogData();

  const [workType, setWorkType] = useState('');
  const [selectedFieldIds, setSelectedFieldIds] = useState([]); // 複数圃場まとめて記録に対応
  const [workHours, setWorkHours] = useState('');
  const [workers, setWorkers] = useState([]);
  const [dateOption, setDateOption] = useState(presetDate ? 'custom' : 'today'); // today | yesterday | day2 | custom
  const [customDate, setCustomDate] = useState(presetDate || toDateString(new Date()));
  const [photos, setPhotos] = useState([]); // { file, previewUrl }
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [lastSaved, setLastSaved] = useState(null); // { workType, fieldName }
  const [phiResult, setPhiResult] = useState(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const dateChips = [
    { key: 'today', label: '今日', date: new Date() },
    { key: 'yesterday', label: '昨日', date: new Date(Date.now() - 86400000) },
    { key: 'day2', label: 'おととい', date: new Date(Date.now() - 2 * 86400000) }
  ];

  const selectedDate = dateOption === 'custom'
    ? new Date(`${customDate}T00:00:00`)
    : dateChips.find(c => c.key === dateOption)?.date || new Date();

  // 前回値（圃場・担当者）を初期選択に反映
  useEffect(() => {
    if (fetchLoading || defaultsApplied || !currentOrganization) return;
    const defaults = loadWorkLogDefaults(currentOrganization.id);
    if (defaults) {
      if (defaults.fieldId && fields.some(f => f.id === defaults.fieldId)) {
        setSelectedFieldIds([defaults.fieldId]);
      }
      if (Array.isArray(defaults.workers)) {
        const validWorkers = defaults.workers.filter(id => users.some(u => u.id === id));
        setWorkers(validWorkers);
      }
    }
    setDefaultsApplied(true);
  }, [fetchLoading, defaultsApplied, currentOrganization, fields, users]);

  // 収穫選択時、PHI（収穫前日数）違反を自動チェック
  useEffect(() => {
    let isCancelled = false;

    const runPhiCheck = async () => {
      if (workType !== '収穫' || selectedFieldIds.length === 0 || !currentOrganization) {
        setPhiResult(null);
        return;
      }
      // 選択した全圃場のPHIをチェックして結果をまとめる
      const results = await Promise.all(
        selectedFieldIds.map((fid) => checkPreHarvestInterval(currentOrganization.id, fid, selectedDate))
      );
      if (!isCancelled) {
        setPhiResult({
          violations: results.flatMap((r) => r?.violations || []),
          unchecked: results.flatMap((r) => r?.unchecked || [])
        });
      }
    };

    runPhiCheck();
    return () => { isCancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workType, selectedFieldIds, dateOption, customDate, currentOrganization]);

  const toggleField = (id) => {
    setSelectedFieldIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const toggleWorker = (workerId) => {
    setWorkers(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS - photos.length;
    const accepted = files.slice(0, remaining).map(file => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setPhotos(prev => [...prev, ...accepted]);
    e.target.value = '';
  };

  const removePhoto = (index) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const canSave = workType && selectedFieldIds.length > 0 && !saving;

  // 詳細が必要な作業、または担当者・作業時間が未入力なら「要追記」とする
  const willBeDraft = NEEDS_DETAILS.includes(workType) || workers.length === 0 || !workHours;

  const uploadPhotos = async (workLogId) => {
    const urls = [];
    for (let i = 0; i < photos.length; i++) {
      const photoRef = storageRef(
        storage,
        `workLogPhotos/${currentOrganization.id}/${workLogId}/${Date.now()}_${i}`
      );
      await uploadBytes(photoRef, photos[i].file);
      urls.push(await getDownloadURL(photoRef));
    }
    return urls;
  };

  const handleSave = async (continueToDetail) => {
    if (!canSave || !currentOrganization) return;

    setSaving(true);
    try {
      const selectedWorkers = users.filter(u => workers.includes(u.id));
      const selectedFields = fields.filter(f => selectedFieldIds.includes(f.id));

      // 写真は最初のレコードにのみ添付（複数圃場でも重複アップロードしない）
      let photoUrls = [];
      if (photos.length > 0) {
        try {
          photoUrls = await uploadPhotos(`${currentOrganization.id}_${Date.now()}`);
        } catch (err) {
          firestoreLogger.error('写真のアップロードエラー', { organizationId: currentOrganization?.id }, err);
          toast.error('写真をアップロードできませんでした（記録は写真なしで保存します）');
        }
      }

      // 選択した圃場の数だけ作業日誌を作成
      let firstRef = null;
      selectedFields.forEach((selectedField, index) => {
        const workLogRef = doc(collection(db, 'workLogs'));
        if (index === 0) firstRef = workLogRef;
        const workLogData = {
          organizationId: currentOrganization.id,
          date: selectedDate,
          fieldId: selectedField.id,
          fieldName: selectedField.name || '',
          workType,
          workers,
          workerNames: selectedWorkers.map(w => w.name),
          details: '',
          workHours: workHours ? Number(workHours) : null,
          harvestAmount: null,
          wasteAmount: null,
          photoUrls: index === 0 ? photoUrls : [],
          isDraft: willBeDraft,
          createdByUid: currentUser?.uid || null,
          createdByName: userProfile?.name || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        // オフラインでも即時保存できるよう、サーバー応答は待たない
        setDoc(workLogRef, workLogData).catch((err) => {
          firestoreLogger.error('クイック記録の同期エラー', {
            organizationId: currentOrganization?.id,
            workLogId: workLogRef.id
          }, err);
        });
      });

      saveWorkLogDefaults(currentOrganization.id, { fieldId: selectedFieldIds[0], workers });

      // 詳細追記は単一圃場のときのみ（複数圃場では一覧から追記）
      if (continueToDetail && selectedFields.length === 1 && firstRef) {
        toast.success('仮保存しました。詳細を入力してください');
        navigate(`/work-logs/edit/${firstRef.id}`);
        return;
      }

      // 連続記録モード: 画面に留まり、作業内容と時間・写真だけリセット
      setSavedCount(prev => prev + selectedFields.length);
      setLastSaved({
        workType,
        fieldName: selectedFields.length === 1
          ? selectedFields[0].name
          : `${selectedFields.length}圃場`,
        isDraft: willBeDraft
      });
      setWorkType('');
      setWorkHours('');
      photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
      setPhotos([]);
      setPhiResult(null);
      toast.success(willBeDraft ? '記録しました（あとで詳細の追記が必要です）' : '記録しました');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        作業を最短3タップで記録。詳細はあとから追記できます。
      </p>

      {/* 連続記録: 直前の保存内容 */}
      {lastSaved && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-green-800">
            ✓ 「{lastSaved.fieldName}」の{lastSaved.workType}を記録しました
            {lastSaved.isDraft && <span className="text-amber-700">（要追記）</span>}
            <span className="block text-xs text-green-600 mt-0.5">続けて次の作業を記録できます（{savedCount}件記録済み）</span>
          </p>
          <Link
            to="/work-logs"
            className="shrink-0 ml-3 px-3 py-2 text-sm bg-white border border-green-400 text-green-700 rounded hover:bg-green-100"
          >
            一覧を見る
          </Link>
        </div>
      )}

      {/* 日付選択 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-3">いつ？</h2>
        <div className="flex flex-wrap gap-2">
          {dateChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setDateOption(chip.key)}
              className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                dateOption === chip.key
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {chip.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDateOption('custom')}
            className={`px-4 py-2 rounded-full border text-sm transition-colors ${
              dateOption === 'custom'
                ? 'border-green-600 bg-green-600 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            別の日付
          </button>
        </div>
        {dateOption === 'custom' && (
          <input
            type="date"
            value={customDate}
            max={toDateString(new Date())}
            onChange={(e) => setCustomDate(e.target.value)}
            className="mt-3 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        )}
      </div>

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

      {/* 2. 圃場（複数選択可） */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-1">
          2. どこで？ <span className="text-red-500">*</span>
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          複数の圃場を選ぶと、同じ作業をまとめて記録できます（{selectedFieldIds.length}圃場 選択中）
        </p>
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
                onClick={() => toggleField(field.id)}
                className={`touch-target p-3 rounded-lg border-2 text-sm transition-colors flex items-center justify-center gap-1 ${
                  selectedFieldIds.includes(field.id)
                    ? 'border-green-600 bg-green-50 text-green-800 font-bold'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {selectedFieldIds.includes(field.id) && <span>✓</span>}
                {field.name}
              </button>
            ))}
          </div>
        )}
        {fields.length > 1 && (
          <button
            type="button"
            onClick={() => setSelectedFieldIds(
              selectedFieldIds.length === fields.length ? [] : fields.map(f => f.id)
            )}
            className="mt-3 text-xs text-green-700 underline"
          >
            {selectedFieldIds.length === fields.length ? 'すべて解除' : 'すべての圃場を選択'}
          </button>
        )}
      </div>

      {/* PHI（収穫前日数）チェック結果 */}
      <PhiWarningBanner phiResult={phiResult} />

      {/* 3. 任意項目（担当者・時間・写真） */}
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
        <div className="flex flex-wrap gap-2 mb-4">
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

        <p className="text-xs text-gray-500 mb-2">写真（任意・{MAX_PHOTOS}枚まで）</p>
        <div className="flex flex-wrap gap-2 items-center">
          {photos.map((photo, index) => (
            <div key={index} className="relative">
              <img
                src={photo.previewUrl}
                alt={`添付写真${index + 1}`}
                className="w-20 h-20 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-gray-600 hover:bg-red-600 text-white rounded-full text-xs leading-none"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-500">
              <span className="text-2xl">📷</span>
              <span className="text-xs">追加</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </label>
          )}
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
        {NEEDS_DETAILS.includes(workType) && selectedFieldIds.length === 1 && (
          <button
            type="button"
            disabled={!canSave}
            onClick={() => handleSave(true)}
            className="w-full py-3 rounded-lg font-bold border-2 border-green-600 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            保存して今すぐ詳細を入力
          </button>
        )}
        {savedCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/work-logs')}
            className="w-full py-3 rounded-lg font-bold border-2 border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            記録を終了して一覧へ（{savedCount}件記録済み）
          </button>
        )}
      </div>
    </div>
  );
};

export default QuickWorkLogForm;
