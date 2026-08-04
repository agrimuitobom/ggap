// src/pages/Fertilizers/StockSolutions.jsx
// 母液（原液）の調製記録。
//
// 水耕栽培では、肥料製品を水に溶かして母液タンクを作り、それを希釈して
// 灌水施肥する。肥料製品が消費されるのはこの「調製」の時点なので、
// ここを記録しないと日々の施肥量から製品の使用量・成分量へたどれない。
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getStockSolutions,
  saveStockSolution,
  deleteStockSolution
} from '../../services/stockSolutionService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const todayKey = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const emptyIngredient = () => ({ fertilizerId: '', fertilizerName: '', amount: '', unit: 'kg' });

const emptyForm = () => ({
  name: '',
  preparedDate: todayKey(),
  ingredients: [emptyIngredient()],
  totalVolume: '',
  defaultDilutionRatio: '',
  notes: ''
});

const StockSolutions = () => {
  const { currentOrganization, isMember } = useOrganization();
  const { userProfile } = useAuth();

  const [solutions, setSolutions] = useState([]);
  const [fertilizers, setFertilizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  // 既存の施肥記録をまとめて母液に紐づけるための状態
  const [linkTarget, setLinkTarget] = useState(null); // 母液
  const [linkFrom, setLinkFrom] = useState('');
  const [linkTo, setLinkTo] = useState('');
  const [linkRatio, setLinkRatio] = useState('');
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [solutionList, fertilizerSnapshot] = await Promise.all([
        getStockSolutions(currentOrganization.id),
        getDocs(query(
          collection(db, 'fertilizers'),
          where('organizationId', '==', currentOrganization.id)
        ))
      ]);
      setSolutions(solutionList);
      setFertilizers(fertilizerSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      firestoreLogger.error('母液調製記録の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('母液の調製記録の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const startEdit = (solution) => {
    setEditingId(solution.id);
    setForm({
      name: solution.name || '',
      preparedDate: solution.preparedDate || todayKey(),
      ingredients: solution.ingredients?.length
        ? solution.ingredients.map((ing) => ({ ...ing, amount: ing.amount?.toString() || '' }))
        : [emptyIngredient()],
      totalVolume: solution.totalVolume?.toString() || '',
      defaultDilutionRatio: solution.defaultDilutionRatio?.toString() || '',
      notes: solution.notes || ''
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateIngredient = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing))
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentOrganization) return;
    if (!form.name.trim()) {
      toast.error('母液の名称を入力してください');
      return;
    }
    if (!Number(form.totalVolume)) {
      toast.error('できあがった母液の量(L)を入力してください');
      return;
    }
    const valid = form.ingredients.filter((ing) => ing.fertilizerId && Number(ing.amount) > 0);
    if (valid.length === 0) {
      toast.error('溶かした肥料を1つ以上入力してください');
      return;
    }
    try {
      setSaving(true);
      await saveStockSolution(currentOrganization.id, editingId, {
        ...form,
        ingredients: valid,
        preparedByName: userProfile?.name || ''
      });
      toast.success(editingId ? '調製記録を更新しました' : '調製記録を登録しました');
      resetForm();
      await load();
    } catch (err) {
      firestoreLogger.error('母液調製記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (solution) => {
    if (!window.confirm(`「${solution.name}」の調製記録をゴミ箱へ移動しますか？`)) return;
    try {
      await deleteStockSolution(solution.id, currentOrganization.id, userProfile?.name || '');
      toast.success('ゴミ箱へ移動しました');
      await load();
    } catch (err) {
      firestoreLogger.error('母液調製記録の削除エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const openLink = (solution) => {
    setLinkTarget(solution);
    setLinkFrom(solution.preparedDate || '');
    setLinkTo(todayKey());
    setLinkRatio(solution.defaultDilutionRatio?.toString() || '');
  };

  /** 期間内の施肥記録をまとめてこの母液に紐づける（過去の記録を作り直さずに済ませるため） */
  const handleBulkLink = async () => {
    if (!linkTarget || !linkFrom || !linkTo || !Number(linkRatio)) {
      toast.error('期間と希釈倍率を入力してください');
      return;
    }
    try {
      setLinking(true);
      const start = new Date(`${linkFrom}T00:00:00`);
      const end = new Date(`${linkTo}T23:59:59`);
      const snapshot = await getDocs(query(
        collection(db, 'fertilizerUses'),
        where('organizationId', '==', currentOrganization.id),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end))
      ));

      // 母液の材料に含まれる肥料で記録されているものだけを対象にする
      const ingredientIds = new Set((linkTarget.ingredients || []).map((i) => i.fertilizerId));
      const targets = snapshot.docs.filter((d) => {
        const data = d.data();
        if (data.sourceType === '母液') return false;
        return ingredientIds.has(data.fertilizerId);
      });

      if (targets.length === 0) {
        toast('対象になる施肥記録が見つかりませんでした', { icon: 'ℹ️' });
        return;
      }
      if (!window.confirm(
        `${targets.length}件の施肥記録を「${linkTarget.name}」からの希釈（${linkRatio}倍）として更新します。よろしいですか？`
      )) {
        return;
      }

      // 500件ずつに分けて更新
      for (let i = 0; i < targets.length; i += 400) {
        const batch = writeBatch(db);
        targets.slice(i, i + 400).forEach((d) => {
          batch.update(doc(db, 'fertilizerUses', d.id), {
            sourceType: '母液',
            stockSolutionId: linkTarget.id,
            amountBasis: '希釈後',
            dilutionRatio: Number(linkRatio)
          });
        });
        await batch.commit();
      }

      toast.success(`${targets.length}件を更新しました`);
      setLinkTarget(null);
    } catch (err) {
      firestoreLogger.error('施肥記録の一括紐づけエラー', { organizationId: currentOrganization?.id }, err);
      toast.error('更新中にエラーが発生しました');
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-bold">母液（原液）の調製記録</h1>
        <Link to="/fertilizer-uses" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm">
          施肥記録一覧へ
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-900">
        <p className="font-bold mb-1">なぜこの記録が必要か</p>
        <p>
          肥料製品が実際に消費されるのは「母液を作ったとき」です。
          ここに<strong>どの肥料を何kg溶かして、何Lの母液にしたか</strong>を記録しておくと、
          日々の施肥記録（希釈後◯L）から肥料製品の使用量と成分量をさかのぼって計算できます。
        </p>
      </div>

      {fertilizers.length === 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 mb-4 text-sm text-amber-900">
          肥料が登録されていません。先に
          <Link to="/fertilizers/new" className="underline font-medium mx-1">肥料登録</Link>
          から、母液に溶かす製品を登録してください。
        </div>
      )}

      {/* 一覧 */}
      {solutions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">調製記録がありません。</p>
      ) : (
        <div className="space-y-3 mb-6">
          {solutions.map((s) => (
            <div key={s.id} className="bg-white rounded shadow p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold">
                    {s.name}
                    <span className="ml-2 font-normal text-gray-600 text-sm">{s.preparedDate}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    できあがり {s.totalVolume}L
                    {s.defaultDilutionRatio ? `　／　標準 ${s.defaultDilutionRatio}倍希釈` : ''}
                    {s.preparedByName ? `　／　調製者 ${s.preparedByName}` : ''}
                  </p>
                </div>
                {isMember && (
                  <div className="flex gap-3 shrink-0">
                    <button type="button" onClick={() => startEdit(s)} className="text-blue-600 hover:text-blue-800 text-sm">
                      編集
                    </button>
                    <button type="button" onClick={() => openLink(s)} className="text-green-700 hover:text-green-900 text-sm">
                      既存記録を紐づけ
                    </button>
                    <button type="button" onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-800 text-sm">
                      削除
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500 mb-1">溶かした肥料</p>
                <ul className="text-sm text-gray-800">
                  {(s.ingredients || []).map((ing, i) => (
                    <li key={i}>・{ing.fertilizerName}　{ing.amount}{ing.unit}</li>
                  ))}
                </ul>
              </div>

              {s.notes && <p className="text-sm text-gray-600 mt-2">{s.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 既存記録の一括紐づけ */}
      {linkTarget && (
        <div className="bg-white rounded shadow border-2 border-green-500 p-4 mb-6">
          <h2 className="font-bold mb-2">既存の施肥記録を「{linkTarget.name}」に紐づける</h2>
          <p className="text-sm text-gray-600 mb-3">
            すでに登録済みの施肥記録を、この母液からの希釈として更新します。
            対象は、期間内で「{(linkTarget.ingredients || []).map((i) => i.fertilizerName).join('、')}」として
            記録されているものです。記録を作り直す必要はありません。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">開始日</label>
              <input type="date" value={linkFrom} onChange={(e) => setLinkFrom(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">終了日</label>
              <input type="date" value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">希釈倍率</label>
              <input type="number" min="1" value={linkRatio} onChange={(e) => setLinkRatio(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="例: 100" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBulkLink}
              disabled={linking}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-300"
            >
              {linking ? '更新中...' : 'まとめて更新する'}
            </button>
            <button type="button" onClick={() => setLinkTarget(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 登録フォーム */}
      {isMember && (
        <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded shadow p-4">
          <h2 className="font-bold mb-3">{editingId ? '調製記録を編集' : '母液の調製を記録'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">母液の名称 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="例: A液（Mk1号）"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">調製日 *</label>
              <input
                type="date"
                value={form.preparedDate}
                onChange={(e) => setForm({ ...form, preparedDate: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>

          <label className="block text-sm text-gray-700 mb-1">溶かした肥料 *</label>
          <div className="space-y-2 mb-3">
            {form.ingredients.map((ing, index) => (
              <div key={index} className="flex flex-wrap gap-2 items-center">
                <select
                  value={ing.fertilizerId}
                  onChange={(e) => {
                    const f = fertilizers.find((x) => x.id === e.target.value);
                    updateIngredient(index, { fertilizerId: e.target.value, fertilizerName: f?.name || '' });
                  }}
                  className="border rounded px-3 py-2 flex-1 min-w-[12rem]"
                >
                  <option value="">肥料を選択</option>
                  {fertilizers.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ing.amount}
                  onChange={(e) => updateIngredient(index, { amount: e.target.value })}
                  className="border rounded px-3 py-2 w-28"
                  placeholder="数量"
                />
                <select
                  value={ing.unit}
                  onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                  className="border rounded px-3 py-2 w-20"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                  <option value="ml">ml</option>
                </select>
                {form.ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      ingredients: prev.ingredients.filter((_, i) => i !== index)
                    }))}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, ingredients: [...prev.ingredients, emptyIngredient()] }))}
            className="text-blue-600 hover:text-blue-800 text-sm mb-3"
          >
            ＋ 肥料を追加
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">できあがった母液の量 (L) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.totalVolume}
                onChange={(e) => setForm({ ...form, totalVolume: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="例: 200"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">標準の希釈倍率</label>
              <input
                type="number"
                min="1"
                value={form.defaultDilutionRatio}
                onChange={(e) => setForm({ ...form, defaultDilutionRatio: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="例: 100"
              />
              <p className="text-xs text-gray-500 mt-1">施肥記録で母液を選んだとき、この倍率が初期値になります。</p>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm text-gray-700 mb-1">備考</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="例: 水道水180Lに溶解。撹拌後に溶け残りなし"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-300"
            >
              {saving ? '保存中...' : editingId ? '更新' : '登録'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">
                キャンセル
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};

export default StockSolutions;
