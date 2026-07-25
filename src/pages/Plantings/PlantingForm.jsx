// src/pages/Plantings/PlantingForm.jsx
// 作付（栽培サイクル）の登録・編集。
// 新規登録時は「実験区として一括作成」も選べる（処理区 × 反復をまとめて作る）。
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  TREATMENTS,
  PLANTING_STATUS,
  getPlanting,
  savePlanting,
  createExperimentPlantings
} from '../../services/plantingService';
import { usesNutrientSolution } from '../../constants/cultivation';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const emptyForm = {
  fieldId: '',
  cropName: '',
  variety: '',
  cropCycle: '1',
  treatment: '慣行区',
  treatmentDetail: '',
  replicate: '1',
  block: '1',
  plotArea: '',
  plantCount: '',
  targetEc: '',
  targetNitrogen: '',
  harvestCriteria: '',
  sowingDate: toDateString(new Date()),
  plantingDate: '',
  status: '栽培中',
  notes: ''
};

const chip = (active) =>
  `px-4 py-2 rounded-full border text-sm ${
    active ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
  }`;

const PlantingForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const isEditMode = !!id;

  const [fields, setFields] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 実験区の一括作成モード
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkTreatments, setBulkTreatments] = useState([
    { name: '慣行区', detail: '', targetEc: '' },
    { name: '減肥区', detail: '', targetEc: '' }
  ]);
  const [bulkReplicates, setBulkReplicates] = useState(3);

  useEffect(() => {
    const load = async () => {
      if (!currentOrganization) return;
      try {
        setLoading(true);
        const snap = await getDocs(query(
          collection(db, 'fields'),
          where('organizationId', '==', currentOrganization.id)
        ));
        setFields(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

        if (isEditMode) {
          const p = await getPlanting(id);
          if (!p) {
            toast.error('指定された作付が見つかりません');
            navigate('/plantings');
            return;
          }
          setForm({
            fieldId: p.fieldId || '',
            cropName: p.cropName || '',
            variety: p.variety || '',
            cropCycle: p.cropCycle?.toString() || '',
            treatment: p.treatment || '慣行区',
            treatmentDetail: p.treatmentDetail || '',
            replicate: p.replicate?.toString() || '',
            block: p.block?.toString() || '',
            plotArea: p.plotArea?.toString() || '',
            plantCount: p.plantCount?.toString() || '',
            targetEc: p.targetEc?.toString() || '',
            targetNitrogen: p.targetNitrogen?.toString() || '',
            harvestCriteria: p.harvestCriteria || '',
            sowingDate: p.sowingDate ? toDateString(p.sowingDate) : '',
            plantingDate: p.plantingDate ? toDateString(p.plantingDate) : '',
            status: p.status || '栽培中',
            notes: p.notes || ''
          });
        }
      } catch (err) {
        firestoreLogger.error('作付フォームの読み込みエラー', { plantingId: id }, err);
        toast.error('データの取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentOrganization, id, isEditMode, navigate]);

  const selectedField = fields.find((f) => f.id === form.fieldId);
  const isHydroponic = usesNutrientSolution(selectedField?.cultivationType);

  const update = (changes) => setForm((prev) => ({ ...prev, ...changes }));

  const selectField = (field) => {
    // 圃場を選んだら区画面積の初期値として圃場面積を入れる（後から調整可）
    update({
      fieldId: field.id,
      plotArea: form.plotArea || (field.area ? String(field.area) : '')
    });
  };

  const canSave = form.fieldId && form.cropName.trim() && !saving;

  const handleSave = async () => {
    if (!canSave || !currentOrganization) return;
    setSaving(true);
    try {
      if (bulkMode && !isEditMode) {
        const treatments = bulkTreatments.filter((t) => t.name);
        if (treatments.length === 0) {
          toast.error('処理区を1つ以上設定してください');
          return;
        }
        const created = await createExperimentPlantings(
          currentOrganization.id, form, selectedField, treatments, Number(bulkReplicates)
        );
        toast.success(`${created.length}件の作付（処理区）を作成しました`);
      } else {
        await savePlanting(currentOrganization.id, id, form, selectedField);
        toast.success(isEditMode ? '作付を更新しました' : '作付を登録しました');
      }
      navigate('/plantings');
    } catch (err) {
      firestoreLogger.error('作付の保存エラー', { organizationId: currentOrganization?.id, plantingId: id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const updateBulkTreatment = (index, changes) => {
    setBulkTreatments((prev) => prev.map((t, i) => (i === index ? { ...t, ...changes } : t)));
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">作付の登録</h1>
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl pb-24">
      <h1 className="text-2xl font-bold mb-1">{isEditMode ? '作付を編集' : '作付を登録'}</h1>
      <p className="text-sm text-gray-500 mb-4">
        「いつ・どの圃場に・何を・どの条件で植えたか」を登録します。以後の収穫・作業の記録をこれに紐づけます。
      </p>

      {/* 一括作成モード */}
      {!isEditMode && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
          <label className="flex items-center gap-2 text-sm font-bold text-blue-900">
            <input
              type="checkbox"
              checked={bulkMode}
              onChange={(e) => setBulkMode(e.target.checked)}
              className="h-5 w-5"
            />
            比較実験として、処理区と反復をまとめて作成する
          </label>
          <p className="text-xs text-blue-800 mt-1">
            慣行区・減肥区などを反復ごとに一度に作れます。反復番号はそのままブロック番号になります。
          </p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-4 mb-4">
        {/* 圃場 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-1">
            圃場 <span className="text-red-500">*</span>
          </label>
          {fields.length === 0 ? (
            <p className="text-sm text-gray-500">圃場が登録されていません。先に圃場を登録してください。</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {fields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => selectField(f)}
                  className={`touch-target p-3 rounded-lg border-2 text-sm ${
                    form.fieldId === f.id
                      ? 'border-green-600 bg-green-50 text-green-800 font-bold'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {f.name}
                  {f.cultivationType && (
                    <span className="block text-xs text-gray-500">{f.cultivationType}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 作物・品種・作次 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              作物名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.cropName}
              onChange={(e) => update({ cropName: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="例: サラダ菜"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">品種</label>
            <input
              type="text"
              value={form.variety}
              onChange={(e) => update({ variety: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="例: レガシー"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">作次</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={form.cropCycle}
              onChange={(e) => update({ cropCycle: e.target.value })}
              className="w-24 border rounded px-3 py-2"
            />
            <span className="text-sm text-gray-500">作目（1=第1作、2=第2作）</span>
          </div>
        </div>

        {/* 日付 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">播種日</label>
            <input
              type="date"
              value={form.sowingDate}
              onChange={(e) => update({ sowingDate: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">定植日</label>
            <input
              type="date"
              value={form.plantingDate}
              onChange={(e) => update({ plantingDate: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        {/* 面積・株数 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">区画面積 (m²)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.plotArea}
              onChange={(e) => update({ plotArea: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="この処理区の面積"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">定植株数</label>
            <input
              type="number"
              min="0"
              value={form.plantCount}
              onChange={(e) => update({ plantCount: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="例: 200"
            />
            <p className="text-xs text-gray-500 mt-1">廃棄率を計算するときの母数になります。</p>
          </div>
        </div>

        {/* 収穫基準 */}
        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">収穫の判定基準</label>
          <input
            type="text"
            value={form.harvestCriteria}
            onChange={(e) => update({ harvestCriteria: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="例: 定植後35日で一斉収穫 / 株重80g到達で収穫"
          />
          <p className="text-xs text-amber-700 mt-1">
            処理区ごとに収穫のタイミングがずれると比較になりません。先に基準を決めて書いておきましょう。
          </p>
        </div>
      </div>

      {/* 処理区の設定 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="font-bold mb-3">処理区の設定</h2>

        {bulkMode && !isEditMode ? (
          <>
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">反復数（各処理区あたり）</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={bulkReplicates}
                  onChange={(e) => setBulkReplicates(e.target.value)}
                  className="w-24 border rounded px-3 py-2"
                />
                <span className="text-sm text-gray-500">反復</span>
              </div>
              {Number(bulkReplicates) < 3 && (
                <p className="text-xs text-amber-700 mt-1">
                  反復が3未満だとばらつきが評価できず「たまたま」と見なされやすくなります。3以上を推奨します。
                </p>
              )}
            </div>

            <div className="space-y-3">
              {bulkTreatments.map((t, i) => (
                <div key={i} className="border rounded p-3 bg-gray-50">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {TREATMENTS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => updateBulkTreatment(i, { name })}
                        className={chip(t.name === name)}
                      >
                        {name}
                      </button>
                    ))}
                    {bulkTreatments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBulkTreatments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="ml-auto text-red-600 hover:text-red-800 text-sm"
                      >
                        削除
                      </button>
                    )}
                  </div>
                  {isHydroponic ? (
                    <div className="mb-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">目標EC (mS/cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={t.targetEc}
                        onChange={(e) => updateBulkTreatment(i, { targetEc: e.target.value })}
                        className="w-32 border rounded px-3 py-2 text-sm"
                        placeholder="例: 1.8"
                      />
                    </div>
                  ) : (
                    <div className="mb-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">目標窒素施用量 (g/m²)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={t.targetNitrogen || ''}
                        onChange={(e) => updateBulkTreatment(i, { targetNitrogen: e.target.value })}
                        className="w-32 border rounded px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  <input
                    type="text"
                    value={t.detail}
                    onChange={(e) => updateBulkTreatment(i, { detail: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="処理内容の説明（例: 慣行の70%の濃度）"
                  />
                </div>
              ))}
            </div>

            {bulkTreatments.length < 4 && (
              <button
                type="button"
                onClick={() => setBulkTreatments((prev) => [...prev, { name: 'その他', detail: '', targetEc: '' }])}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
              >
                ＋ 処理区を追加
              </button>
            )}

            <div className="mt-4 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
              作成される作付: <span className="font-bold">
                {bulkTreatments.filter((t) => t.name).length} 処理区 × {bulkReplicates} 反復 = {bulkTreatments.filter((t) => t.name).length * Number(bulkReplicates || 0)} 件
              </span>
              <p className="text-xs mt-1">
                各ブロックに全処理区が1つずつ入ります。温室内で位置が偏らないよう、
                ブロック1・2・3を離して配置してください。
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">処理区</label>
              <div className="flex flex-wrap gap-2">
                {TREATMENTS.map((t) => (
                  <button key={t} type="button" onClick={() => update({ treatment: t })} className={chip(form.treatment === t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">反復番号</label>
                <input type="number" min="1" value={form.replicate} onChange={(e) => update({ replicate: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ブロック番号</label>
                <input type="number" min="1" value={form.block} onChange={(e) => update({ block: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
            </div>
            {isHydroponic ? (
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">目標EC (mS/cm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.targetEc}
                  onChange={(e) => update({ targetEc: e.target.value })}
                  className="w-32 border rounded px-3 py-2"
                  placeholder="例: 1.8"
                />
                <p className="text-xs text-gray-500 mt-1">
                  養液管理記録の実測ECと突き合わせ、狙いどおり管理できていたか確認できます。
                </p>
              </div>
            ) : (
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">目標窒素施用量 (g/m²)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.targetNitrogen}
                  onChange={(e) => update({ targetNitrogen: e.target.value })}
                  className="w-32 border rounded px-3 py-2"
                />
              </div>
            )}
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">処理内容の説明</label>
              <input
                type="text"
                value={form.treatmentDetail}
                onChange={(e) => update({ treatmentDetail: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="例: 慣行の70%の濃度で管理"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">状態</label>
              <div className="flex flex-wrap gap-2">
                {PLANTING_STATUS.map((s) => (
                  <button key={s} type="button" onClick={() => update({ status: s })} className={chip(form.status === s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">備考</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="メモ"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`flex-1 py-4 rounded-lg font-bold text-white text-lg ${
            canSave ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {saving ? '保存中...' : bulkMode && !isEditMode ? 'まとめて作成する' : isEditMode ? '更新する' : '登録する'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/plantings')}
          className="px-6 py-4 rounded-lg font-bold bg-gray-200 text-gray-700 hover:bg-gray-300"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
};

export default PlantingForm;
