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
  doc
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  getStockSolutions,
  saveStockSolution,
  deleteStockSolution,
  calcSolutionUsage
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

  const [uses, setUses] = useState([]);

  // 既存の施肥記録を調製日ごとに自動で振り分けるための状態
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState('そのまま'); // そのまま | 希釈
  const [assignRatio, setAssignRatio] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [solutionList, fertilizerSnapshot, usesSnapshot] = await Promise.all([
        getStockSolutions(currentOrganization.id),
        getDocs(query(
          collection(db, 'fertilizers'),
          where('organizationId', '==', currentOrganization.id)
        )),
        getDocs(query(
          collection(db, 'fertilizerUses'),
          where('organizationId', '==', currentOrganization.id)
        ))
      ]);
      setSolutions(solutionList);
      setFertilizers(fertilizerSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setUses(usesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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

  const usesBySolution = {};
  uses.forEach((u) => {
    if (!u.stockSolutionId) return;
    if (!usesBySolution[u.stockSolutionId]) usesBySolution[u.stockSolutionId] = [];
    usesBySolution[u.stockSolutionId].push(u);
  });

  // 調製日で区切って「この期間はこの母液」と決める
  const periodOf = (index) => {
    const sorted = [...solutions].sort((a, b) => (a.preparedDate || '').localeCompare(b.preparedDate || ''));
    const pos = sorted.findIndex((s) => s.id === solutions[index].id);
    return {
      from: sorted[pos]?.preparedDate || '',
      to: sorted[pos + 1]?.preparedDate || ''
    };
  };

  /**
   * 既存の施肥記録を、日付が入る期間の母液へ自動で振り分ける。
   * 母液は作った順に使い切るので、調製日で区切れば正しく割り当てられる。
   */
  const handleAutoAssign = async () => {
    if (solutions.length === 0) return;
    if (assignMode === '希釈' && !Number(assignRatio)) {
      toast.error('希釈倍率を入力してください');
      return;
    }
    try {
      setAssigning(true);
      const sorted = [...solutions]
        .filter((s) => s.preparedDate)
        .sort((a, b) => a.preparedDate.localeCompare(b.preparedDate));
      if (sorted.length === 0) {
        toast.error('調製日が入力された母液がありません');
        return;
      }

      const ingredientIds = new Set();
      sorted.forEach((s) => (s.ingredients || []).forEach((i) => ingredientIds.add(i.fertilizerId)));

      // 対象: まだ母液に紐づいておらず、母液の材料になっている肥料で記録されたもの
      const targets = [];
      uses.forEach((u) => {
        if (u.sourceType === '母液') return;
        if (!ingredientIds.has(u.fertilizerId)) return;
        const d = u.date?.toDate ? u.date.toDate() : u.date ? new Date(u.date) : null;
        if (!d) return;
        const key = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        // その日以前で最も新しい調製記録
        let match = null;
        sorted.forEach((s) => {
          if (s.preparedDate <= key) match = s;
        });
        if (match) targets.push({ id: u.id, solutionId: match.id });
      });

      if (targets.length === 0) {
        toast('振り分けの対象になる施肥記録が見つかりませんでした', { icon: 'ℹ️' });
        return;
      }
      if (!window.confirm(
        `${targets.length}件の施肥記録を、調製日にもとづいて各母液へ振り分けます。\n` +
        `使用形態：${assignMode === 'そのまま' ? '母液をそのまま投入' : `${assignRatio}倍に希釈して施用`}\n` +
        'よろしいですか？'
      )) {
        return;
      }

      for (let i = 0; i < targets.length; i += 400) {
        const batch = writeBatch(db);
        targets.slice(i, i + 400).forEach((t) => {
          batch.update(doc(db, 'fertilizerUses', t.id), {
            sourceType: '母液',
            stockSolutionId: t.solutionId,
            amountBasis: assignMode === 'そのまま' ? '原液' : '希釈後',
            dilutionRatio: assignMode === 'そのまま' ? null : Number(assignRatio)
          });
        });
        await batch.commit();
      }

      toast.success(`${targets.length}件を振り分けました`);
      setAssignOpen(false);
      await load();
    } catch (err) {
      firestoreLogger.error('施肥記録の自動振り分けエラー', { organizationId: currentOrganization?.id }, err);
      toast.error('更新中にエラーが発生しました');
    } finally {
      setAssigning(false);
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
          {solutions.map((s, index) => {
            const usage = calcSolutionUsage(s, usesBySolution[s.id] || []);
            const period = periodOf(index);
            return (
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

              {/* 残量。なくなったら次を作る運用なので、ここが次の調製の目安になる */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">
                    使用 {usage.used.toFixed(1)}L / {usage.total}L
                  </span>
                  <span className={`font-bold ${
                    usage.overdrawn ? 'text-red-700' : usage.ratio < 0.2 ? 'text-amber-700' : 'text-green-700'
                  }`}>
                    残り {usage.remaining.toFixed(1)}L
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      usage.overdrawn ? 'bg-red-500' : usage.ratio < 0.2 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, usage.ratio * 100))}%` }}
                  />
                </div>
                {usage.overdrawn && (
                  <p className="text-xs text-red-700 mt-1">
                    作った量より多く使ったことになっています。調製量か使用量の記録を確認してください。
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  この母液を使った期間：{period.from} 〜 {period.to ? period.to : '現在'}
                  （施肥記録 {(usesBySolution[s.id] || []).length}件）
                </p>
              </div>

              {s.notes && <p className="text-sm text-gray-600 mt-2">{s.notes}</p>}
            </div>
            );
          })}
        </div>
      )}

      {/* 既存記録の自動振り分け */}
      {isMember && solutions.length > 0 && uses.some((u) => u.sourceType !== '母液') && (
        <div className="bg-white rounded shadow border-2 border-green-500 p-4 mb-6">
          <h2 className="font-bold mb-2">既存の施肥記録を母液に振り分ける</h2>
          <p className="text-sm text-gray-600 mb-3">
            母液は作った順に使い切るので、<strong>調製日で期間を区切れば、どの記録がどの母液のものか自動で決まります</strong>。
            登録済みの母液が{solutions.length}件あるので、その日付にもとづいて振り分けます。記録の作り直しは不要です。
          </p>

          {!assignOpen ? (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
            >
              振り分けの設定を開く
            </button>
          ) : (
            <>
              <p className="text-sm font-bold text-gray-700 mb-2">施肥記録に入力してある量は？</p>
              <div className="space-y-2 mb-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    checked={assignMode === 'そのまま'}
                    onChange={() => setAssignMode('そのまま')}
                    className="h-4 w-4 mt-1"
                  />
                  <span>
                    <strong>母液そのものの量</strong>（タンクに入れた母液が◯L）
                    <span className="block text-xs text-gray-500">
                      母液を作り置きして少しずつ投入する運用では、通常こちらです。
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    checked={assignMode === '希釈'}
                    onChange={() => setAssignMode('希釈')}
                    className="h-4 w-4 mt-1"
                  />
                  <span>
                    <strong>希釈後の液の量</strong>（薄めた液を◯L散布した）
                  </span>
                </label>
              </div>

              {assignMode === '希釈' && (
                <div className="mb-3">
                  <label className="block text-sm text-gray-700 mb-1">希釈倍率</label>
                  <input
                    type="number"
                    min="1"
                    value={assignRatio}
                    onChange={(e) => setAssignRatio(e.target.value)}
                    className="border rounded px-3 py-2 w-32"
                    placeholder="例: 100"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAutoAssign}
                  disabled={assigning}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-300"
                >
                  {assigning ? '振り分け中...' : '調製日にもとづいて振り分ける'}
                </button>
                <button type="button" onClick={() => setAssignOpen(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">
                  キャンセル
                </button>
              </div>
            </>
          )}
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
