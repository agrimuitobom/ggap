// src/pages/PPE/PPECheckForm.jsx
// 保護具（PPE）の着用確認をその場で記録する画面。
//
// 現場でiPadを持って歩きながら記録するため、既定値を「全て着用（⭕）」にして
// 着ていないものだけタップで外す方式にしている（タップ数を最小にする）。
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getPpeItems,
  getPpeCheck,
  savePpeCheck
} from '../../services/ppeService';
import { getWorkers } from '../../services/workerService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const MAX_PHOTOS = 3;

// よく確認する作業。ボタンで選べるようにして入力を省く
const WORK_PRESETS = ['収穫・調製', '防除（農薬散布）', '養液管理', '播種・定植', '清掃', '機械作業'];

const todayKey = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const PPECheckForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { userProfile, currentUser } = useAuth();

  const [items, setItems] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(todayKey());
  const [workName, setWorkName] = useState('');
  const [targetIds, setTargetIds] = useState([]);
  const [otherTargets, setOtherTargets] = useState('');
  // { itemId: 'ok' | 'ng' | 'na' }
  const [results, setResults] = useState({});
  const [findings, setFindings] = useState('');
  // 保護具を要する作業自体がなかった期間も、記録を空けずに残す
  const [noApplicableWork, setNoApplicableWork] = useState(false);
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [photos, setPhotos] = useState([]); // { file, previewUrl }
  const [existingPhotoUrls, setExistingPhotoUrls] = useState([]);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [itemList, workerList] = await Promise.all([
        getPpeItems(currentOrganization.id),
        getWorkers(currentOrganization.id, currentUser?.uid)
      ]);
      setItems(itemList);
      setWorkers(workerList);

      if (id) {
        const check = await getPpeCheck(id);
        if (!check) {
          toast.error('記録が見つかりませんでした');
          navigate('/ppe/checks');
          return;
        }
        setDate(check.date || todayKey());
        setWorkName(check.workName || '');
        setTargetIds(check.targetIds || []);
        setOtherTargets(check.otherTargets || '');
        setFindings(check.findings || '');
        setNoApplicableWork(!!check.noApplicableWork);
        setCorrectiveAction(check.correctiveAction || '');
        setExistingPhotoUrls(check.photoUrls || []);
        const map = {};
        (check.results || []).forEach((r) => { map[r.itemId] = r.result; });
        setResults(map);
      } else {
        // 新規は「対象外」を初期値にし、その作業で使う保護具だけを⭕にしてもらう…
        // のではなく、逆に全て⭕にしておき、使わないものを外す方が実務では速い
        const map = {};
        itemList.forEach((i) => { map[i.id] = 'ok'; });
        setResults(map);
      }
    } catch (err) {
      firestoreLogger.error('着用確認フォームの読み込みエラー', { organizationId: currentOrganization?.id }, err);
      toast.error('読み込み中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, currentUser, id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // ⭕ → ❌ → 対象外 → ⭕ と回す
  const cycleResult = (itemId) => {
    setResults((prev) => {
      const next = prev[itemId] === 'ok' ? 'ng' : prev[itemId] === 'ng' ? 'na' : 'ok';
      return { ...prev, [itemId]: next };
    });
  };

  const toggleTarget = (workerId) => {
    setTargetIds((prev) =>
      prev.includes(workerId) ? prev.filter((w) => w !== workerId) : [...prev, workerId]
    );
  };

  // その作業に関係する保護具だけを一括で⭕にする（他は対象外）
  const applyWorkPreset = (preset) => {
    setWorkName(preset);
    const keyword = preset.replace(/（.*）/, '');
    setResults(() => {
      const map = {};
      items.forEach((i) => {
        const target = i.targetWork || '';
        map[i.id] = target.includes(keyword) || keyword.includes(target) || target.includes('全般')
          ? 'ok'
          : 'na';
      });
      return map;
    });
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS - photos.length - existingPhotoUrls.length;
    const accepted = files.slice(0, Math.max(0, remaining)).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setPhotos((prev) => [...prev, ...accepted]);
    e.target.value = '';
  };

  const removePhoto = (index) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadPhotos = async (checkKey) => {
    const urls = [];
    for (let i = 0; i < photos.length; i++) {
      const photoRef = storageRef(
        storage,
        `ppeCheckPhotos/${currentOrganization.id}/${checkKey}/${Date.now()}_${i}`
      );
      await uploadBytes(photoRef, photos[i].file);
      urls.push(await getDownloadURL(photoRef));
    }
    return urls;
  };

  const ngItems = noApplicableWork ? [] : items.filter((i) => results[i.id] === 'ng');
  const canSave = !!date && !saving && items.length > 0;

  const handleSave = async () => {
    if (!canSave || !currentOrganization) return;
    if (ngItems.length > 0 && !correctiveAction.trim()) {
      toast.error('未着用があるときは、是正した内容を入力してください');
      return;
    }
    if (noApplicableWork && !findings.trim()) {
      toast.error('保護具を要する作業がなかった理由を入力してください');
      return;
    }
    setSaving(true);
    try {
      let photoUrls = existingPhotoUrls;
      if (photos.length > 0) {
        try {
          const uploaded = await uploadPhotos(id || `${Date.now()}`);
          photoUrls = [...existingPhotoUrls, ...uploaded];
        } catch (uploadErr) {
          firestoreLogger.error('着用確認写真のアップロードエラー', {}, uploadErr);
          toast.error('写真の保存に失敗しました。記録は写真なしで保存します');
        }
      }

      const selected = workers.filter((w) => targetIds.includes(w.id));
      await savePpeCheck(currentOrganization.id, id, {
        date,
        workName,
        checkedByName: userProfile?.name || '',
        targetIds,
        targetNames: selected.map((w) => w.name),
        otherTargets,
        noApplicableWork,
        results: items.map((i) => ({
          itemId: i.id,
          itemName: i.name,
          // 該当作業がなかった期間は、すべて「対象外」として残す
          result: noApplicableWork ? 'na' : (results[i.id] || 'na')
        })),
        findings,
        correctiveAction,
        photoUrls
      });
      toast.success(id ? '記録を更新しました' : '記録しました');
      navigate('/ppe/checks');
    } catch (err) {
      firestoreLogger.error('着用確認記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">読み込み中...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">保護具の着用確認</h1>
        <div className="bg-amber-50 border border-amber-300 rounded p-4">
          <p className="mb-3">保護具の品目がまだ登録されていません。</p>
          <button
            type="button"
            onClick={() => navigate('/ppe')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            品目を登録する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 pb-32 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">
        {id ? '着用確認を編集' : '保護具の着用確認'}
      </h1>

      {/* 日付 */}
      <div className="bg-white rounded shadow p-4 mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">確認日 *</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border rounded px-3 py-3 text-lg"
          required
        />
        <p className="text-sm text-gray-500 mt-2">確認者：{userProfile?.name || '—'}</p>
      </div>

      {/* 保護具を要する作業がない期間も、確認した事実として記録に残す */}
      <div className="bg-white rounded shadow p-4 mb-4">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={noApplicableWork}
            onChange={(e) => setNoApplicableWork(e.target.checked)}
            className="h-5 w-5 mt-0.5"
          />
          <span className="text-sm">
            <span className="font-bold">この期間、保護具を要する作業がなかった</span>
            <span className="block text-xs text-gray-500 mt-1">
              薬剤の取扱いや母液の調製などが無ければ、着用の機会もありません。
              その場合は着用状況ではなく「該当作業がなかったこと」を記録します。
              記録が飛んでいるより、確認したうえで該当なしと残っている方が確実です。
            </span>
          </span>
        </label>
      </div>

      {!noApplicableWork && (
      <div className="bg-white rounded shadow p-4 mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          確認した作業
          <span className="font-normal text-gray-500">（選ぶと関係する保護具だけが⭕になります）</span>
        </label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {WORK_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyWorkPreset(preset)}
              className={`py-3 rounded border-2 text-sm font-medium ${
                workName === preset
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={workName}
          onChange={(e) => setWorkName(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="その他の作業を入力"
        />
      </div>
      )}

      {/* 着用状況 */}
      {!noApplicableWork && (
      <div className="bg-white rounded shadow p-4 mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-1">着用状況</label>
        <p className="text-xs text-gray-500 mb-3">
          タップするたびに ⭕着用 → ❌未着用 → —対象外 と切り替わります。
        </p>
        <div className="space-y-2">
          {items.map((item) => {
            const r = results[item.id] || 'na';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => cycleResult(item.id)}
                className={`w-full flex items-center justify-between px-3 py-3 rounded border-2 text-left ${
                  r === 'ok'
                    ? 'border-green-500 bg-green-50'
                    : r === 'ng'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <span className={`text-sm ${r === 'na' ? 'text-gray-400' : 'text-gray-800'}`}>
                  {item.name}
                  {item.targetWork && (
                    <span className="block text-xs text-gray-400">{item.targetWork}</span>
                  )}
                </span>
                <span className="text-2xl ml-2 shrink-0">
                  {r === 'ok' ? '⭕' : r === 'ng' ? '❌' : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* 対象者 */}
      {!noApplicableWork && (
      <div className="bg-white rounded shadow p-4 mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          対象者<span className="font-normal text-gray-500">（任意）</span>
        </label>
        {workers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {workers.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => toggleTarget(w.id)}
                className={`px-3 py-2 rounded-full border-2 text-sm ${
                  targetIds.includes(w.id)
                    ? 'border-green-600 bg-green-50 text-green-800'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {w.name}
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          value={otherTargets}
          onChange={(e) => setOtherTargets(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="例: 2年生 実習班A（8名）"
        />
      </div>
      )}

      {/* 未着用があったときだけ是正を求める */}
      {ngItems.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded p-4 mb-4">
          <p className="font-bold text-red-800 mb-2">
            未着用があります（{ngItems.map((i) => i.name).join('、')}）
          </p>
          <label className="block text-sm font-bold text-red-800 mb-1">
            その場で行った是正 *
          </label>
          <textarea
            value={correctiveAction}
            onChange={(e) => setCorrectiveAction(e.target.value)}
            rows={2}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="例: その場で着用を指示し、予備の手袋を支給した"
          />
          <p className="text-xs text-red-700 mt-2">
            未着用を見つけたこと自体は不適合ではありません。見つけて直した記録が残っている方が、
            管理が機能している証拠になります。
          </p>
        </div>
      )}

      {/* 気づき */}
      <div className="bg-white rounded shadow p-4 mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          {noApplicableWork ? (
            <>該当作業がなかった理由 <span className="text-red-600">*</span></>
          ) : (
            <>気づいたこと<span className="font-normal text-gray-500">（任意）</span></>
          )}
        </label>
        <textarea
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          rows={2}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder={noApplicableWork
            ? '例: 5月以降、pH調整剤の取扱いと母液の調製を行っておらず、保護具を要する作業が発生していない'
            : '例: 手袋のサイズがSしか残っていないため、Mを補充する'}
        />
      </div>

      {/* 写真 */}
      <div className="bg-white rounded shadow p-4 mb-4">
        <p className="text-sm font-bold text-gray-700 mb-1">
          写真<span className="font-normal text-gray-500">（任意・{MAX_PHOTOS}枚まで）</span>
        </p>
        <p className="text-xs text-gray-500 mb-2">
          着用している様子が写っていると、審査での説明が確実になります。
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          {existingPhotoUrls.map((url, index) => (
            <img
              key={`existing-${index}`}
              src={url}
              alt={`保存済み写真${index + 1}`}
              className="w-20 h-20 object-cover rounded-lg border"
            />
          ))}
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
          {photos.length + existingPhotoUrls.length < MAX_PHOTOS && (
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

      <div className="space-y-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className={`w-full py-4 rounded-lg font-bold text-white text-lg ${
            canSave ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {saving ? '保存中...' : id ? '更新する' : '記録する'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/ppe/checks')}
          className="w-full py-3 rounded-lg bg-gray-200 hover:bg-gray-300"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
};

export default PPECheckForm;
