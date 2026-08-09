// src/pages/Seeds/SeedUseForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { uiLogger } from '../../utils/logger';
import { nextLotNumber, isSowingMethod, lotPrefix } from '../../services/lotNumberService';

// 定植で選べるロットの表示件数。これを超える古いものは「その他」にまとめる
const RECENT_LOT_COUNT = 10;
// 「その他（それ以前のロット）」を選んだことを表す値
const OLDER_LOTS = '__older__';

const SeedUseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrganization } = useOrganization();
  const [seeds, setSeeds] = useState([]);
  // 既存の播種記録。ロットIDの採番と、定植時の選択肢に使う
  const [seedUses, setSeedUses] = useState([]);
  // 「その他」を選んで、古いロットの一覧を開いているか
  const [showOlderLots, setShowOlderLots] = useState(false);
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    seedId: '',
    fieldId: '',
    amount: '',
    unit: '粒',
    method: '',
    // トレーサビリティの背番号。播種で採番し、定植・収穫へ引き継ぐ
    lotNumber: '',
    // FV-Smart 26.03: 育苗した種苗の病害虫モニタリング記録
    pestStatus: 'なし',
    pestDetail: '',
    pestAction: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isEditMode = !!id;

  // URLクエリパラメータから種子IDを取得
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const seedIdParam = queryParams.get('seedId');
    
    if (seedIdParam) {
      setFormData(prev => ({
        ...prev,
        seedId: seedIdParam
      }));
    }
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentOrganization) return;

      try {
        // 種子データを取得（組織IDでフィルタリング）
        const seedsQuery = query(
          collection(db, 'seeds'),
          where('organizationId', '==', currentOrganization.id)
        );
        const seedsSnapshot = await getDocs(seedsQuery);
        const seedsList = [];
        seedsSnapshot.forEach((doc) => {
          seedsList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setSeeds(seedsList);

        // 既存の播種・定植記録（ロットIDの採番と定植時の選択に使う）
        const usesSnapshot = await getDocs(query(
          collection(db, 'seedUses'),
          where('organizationId', '==', currentOrganization.id)
        ));
        setSeedUses(usesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));

        // 圃場データを取得（組織IDでフィルタリング）
        const fieldsQuery = query(
          collection(db, 'fields'),
          where('organizationId', '==', currentOrganization.id)
        );
        const fieldsSnapshot = await getDocs(fieldsQuery);
        const fieldsList = [];
        fieldsSnapshot.forEach((doc) => {
          fieldsList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setFields(fieldsList);

        // 編集モードの場合、既存データを取得
        if (isEditMode) {
          const docRef = doc(db, 'seedUses', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              date: data.date?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              seedId: data.seedId || '',
              fieldId: data.fieldId || '',
              amount: data.amount?.toString() || '',
              unit: data.unit || '粒',
              method: data.method || '',
              lotNumber: data.lotNumber || '',
              pestStatus: data.pestStatus || 'なし',
              pestDetail: data.pestDetail || '',
              pestAction: data.pestAction || '',
              notes: data.notes || ''
            });
          } else {
            setError('指定された播種・定植記録が見つかりません。');
            navigate('/seeds');
          }
        }
      } catch (err) {
        uiLogger.error('Error fetching form data', { component: 'SeedUseForm', isEditMode }, err);
        setError('データの取得中にエラーが発生しました。');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchData();
  }, [id, isEditMode, navigate, currentOrganization]);

  // 既存のロットID（播種で採番されたもの）
  const existingLots = seedUses
    .map((u) => u.lotNumber)
    .filter(Boolean);

  // 定植のときに選べるロット（新しい順）
  const sowingLots = seedUses
    .filter((u) => u.lotNumber && isSowingMethod(u.method))
    .sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate().getTime() : 0;
      const dbb = b.date?.toDate ? b.date.toDate().getTime() : 0;
      return dbb - da;
    });

  const recentLots = sowingLots.slice(0, RECENT_LOT_COUNT);
  const olderLots = sowingLots.slice(RECENT_LOT_COUNT);

  const transplanting = formData.method === '定植';

  // 編集などで古いロットが選ばれている場合は、最初から古い一覧を開いておく
  const selectedIsOlder = olderLots.some((u) => u.lotNumber === formData.lotNumber);
  const olderOpen = showOlderLots || selectedIsOlder;

  const lotLabel = (u) => {
    const d = u.date?.toDate ? u.date.toDate().toLocaleDateString('ja-JP') : '';
    return `${u.lotNumber}${d ? `（${d} 播種）` : ''}${u.seedName ? ` ${u.seedName}` : ''}`;
  };

  const suggestLotNumber = () => {
    // 編集中の記録自身のロットIDは、採番の対象から外す
    const others = isEditMode
      ? seedUses.filter((u) => u.id !== id).map((u) => u.lotNumber).filter(Boolean)
      : existingLots;
    const next = nextLotNumber(others, formData.date);
    if (!next) {
      setError('作業日から令和の年を判定できませんでした。');
      return;
    }
    setFormData((prev) => ({ ...prev, lotNumber: next }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentOrganization) {
      setError('組織情報が必要です。');
      return;
    }
    
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      // 選択された種子と圃場の名前を取得
      const selectedSeed = seeds.find(seed => seed.id === formData.seedId);
      const selectedField = fields.find(field => field.id === formData.fieldId);
      
      if (formData.pestStatus === 'あり' && !formData.pestDetail.trim()) {
        setError('病害虫の発生が「あり」の場合は、病害虫名・症状を入力してください。');
        setLoading(false);
        return;
      }
      if (formData.pestStatus === 'あり' && !formData.pestAction.trim()) {
        setError('病害虫の発生が「あり」の場合は、とった対応を入力してください。');
        setLoading(false);
        return;
      }

      const seedUseData = {
        date: new Date(formData.date),
        seedId: formData.seedId,
        seedName: selectedSeed ? `${selectedSeed.name} (${selectedSeed.variety})` : '',
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        organizationId: currentOrganization.id,
        amount: formData.amount ? Number(formData.amount) : null,
        unit: formData.unit || '粒',
        method: formData.method,
        lotNumber: (formData.lotNumber || '').trim(),
        // 育苗時の病害虫モニタリング（FV-Smart 26.03）
        pestStatus: formData.pestStatus || 'なし',
        pestDetail: formData.pestStatus === 'あり' ? formData.pestDetail : '',
        pestAction: formData.pestStatus === 'あり' ? formData.pestAction : '',
        notes: formData.notes,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        // 既存のドキュメントを更新
        await updateDoc(doc(db, 'seedUses', id), seedUseData);
        setMessage('播種・定植記録が正常に更新されました');
      } else {
        // 新規ドキュメントを作成
        seedUseData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'seedUses'), seedUseData);
        setMessage('播種・定植記録が正常に登録されました');
      }

      // 成功メッセージを表示後、播種・定植記録一覧に遷移
      setTimeout(() => {
        navigate('/seed-uses');
      }, 2000);
    } catch (err) {
      uiLogger.error('Error saving seed use record', { component: 'SeedUseForm', isEditMode, seedId: formData.seedId }, err);
      setError('播種・定植記録の保存中にエラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '播種・定植記録編集' : '播種・定植記録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? '播種・定植記録編集' : '播種・定植記録'}</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}
      
      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 mb-4 rounded">
          {message}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="date">
            作業日 *
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="date"
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="seedId">
            種子・苗 *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="seedId"
            name="seedId"
            value={formData.seedId}
            onChange={handleChange}
            required
          >
            <option value="">種子・苗を選択してください</option>
            {seeds.map(seed => (
              <option key={seed.id} value={seed.id}>{seed.name} ({seed.variety})</option>
            ))}
          </select>
          {seeds.length === 0 && (
            <p className="text-red-500 text-xs mt-1">
              種子・苗が登録されていません。先に種子・苗を登録してください。
            </p>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="fieldId">
            圃場 *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="fieldId"
            name="fieldId"
            value={formData.fieldId}
            onChange={handleChange}
            required
          >
            <option value="">圃場を選択してください</option>
            {fields.map(field => (
              <option key={field.id} value={field.id}>{field.name}</option>
            ))}
          </select>
          {fields.length === 0 && (
            <p className="text-red-500 text-xs mt-1">
              圃場が登録されていません。先に圃場を登録してください。
            </p>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amount">
            使用量
          </label>
          {/* よく使う粒数のプリセット（プラグトレイの穴数など） */}
          <div className="flex flex-wrap gap-2 mb-2">
            {['128', '200', '288'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, amount: preset, unit: '粒' }))}
                className={`px-3 py-1.5 rounded-full border text-sm ${
                  formData.amount === preset && formData.unit === '粒'
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {preset}粒
              </button>
            ))}
          </div>
          <div className="flex items-center">
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="amount"
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.1"
              min="0"
              placeholder="数量を入力"
            />
            <select
              className="ml-2 shadow border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
            >
              <option value="粒">粒</option>
              <option value="g">g</option>
              <option value="本">本</option>
              <option value="袋">袋</option>
              <option value="mL">mL</option>
            </select>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            例: 200穴トレイに200粒なら「200」＋「粒」。種子の重さで管理する場合は「g」も選べます。
          </p>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="method">
            播種・定植方法 *
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="method"
            name="method"
            value={formData.method}
            onChange={handleChange}
            required
          >
            <option value="">選択してください</option>
            <option value="直播">直播</option>
            <option value="条播">条播</option>
            <option value="点播">点播</option>
            <option value="散播">散播</option>
            <option value="定植">定植</option>
            <option value="その他">その他</option>
          </select>
        </div>
        
        {/* ロットID。播種で採番し、定植・収穫へ引き継ぐ背番号 */}
        {/* 方法によらず常に表示する。作業日誌から自動作成された記録は
            方法が「その他」になるため、条件を絞ると編集できなくなる。 */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded p-4">
            {!transplanting ? (
              <>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="lotNumber">
                  ロットID
                </label>
                <p className="text-xs text-gray-600 mb-2">
                  この記録に背番号を付けます。定植・収穫・出荷まで引き継ぐことで、
                  出荷先から播種までさかのぼれるようになります。
                </p>
                <div className="flex gap-2">
                  <input
                    className="shadow appearance-none border rounded flex-1 py-2 px-3 text-gray-700"
                    id="lotNumber"
                    type="text"
                    name="lotNumber"
                    value={formData.lotNumber}
                    onChange={handleChange}
                    placeholder={`例: ${lotPrefix(formData.date) || 'R8.'}01`}
                  />
                  <button
                    type="button"
                    onClick={suggestLotNumber}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm whitespace-nowrap"
                  >
                    自動採番
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  「自動採番」を押すと、作業日の年（令和）とその年の通し番号から
                  {lotPrefix(formData.date) || 'R8.'}01 の形で付けます。手で書き換えることもできます。
                </p>

                {sowingLots.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs text-gray-600 mb-1">
                      既存のロットから選ぶ（同じロットの続きを記録する場合）
                    </label>
                    <select
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 text-sm"
                      value={recentLots.some((u) => u.lotNumber === formData.lotNumber) ? formData.lotNumber : ''}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setFormData({ ...formData, lotNumber: e.target.value });
                      }}
                    >
                      <option value="">選択してください</option>
                      {recentLots.map((u) => (
                        <option key={u.id} value={u.lotNumber}>{lotLabel(u)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            ) : (
              <>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="lotNumber">
                  定植するロット
                </label>
                <p className="text-xs text-gray-600 mb-2">
                  どの播種ロットを定植したのかを選びます。新しく採番はしません。
                  新しい順に直近{RECENT_LOT_COUNT}件を表示し、それ以前は「その他」からたどれます。
                </p>
                {/* 新しい順に直近20件。それ以前は「その他」を選ぶと出す。
                    ロットが増えても選択肢が長くなりすぎないようにする。 */}
                <select
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-2"
                  value={
                    olderOpen
                      ? OLDER_LOTS
                      : recentLots.some((u) => u.lotNumber === formData.lotNumber)
                      ? formData.lotNumber
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value === OLDER_LOTS) {
                      setShowOlderLots(true);
                      return;
                    }
                    setShowOlderLots(false);
                    setFormData({ ...formData, lotNumber: e.target.value });
                  }}
                >
                  <option value="">選択してください</option>
                  {recentLots.map((u) => (
                    <option key={u.id} value={u.lotNumber}>{lotLabel(u)}</option>
                  ))}
                  {olderLots.length > 0 && (
                    <option value={OLDER_LOTS}>
                      その他（それ以前のロット {olderLots.length}件）…
                    </option>
                  )}
                </select>

                {olderOpen && olderLots.length > 0 && (
                  <div className="mb-2">
                    <label className="block text-xs text-gray-600 mb-1">
                      それ以前のロット（新しい順）
                    </label>
                    <select
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                      value={selectedIsOlder ? formData.lotNumber : ''}
                      onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                    >
                      <option value="">選択してください</option>
                      {olderLots.map((u) => (
                        <option key={u.id} value={u.lotNumber}>{lotLabel(u)}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setShowOlderLots(false); setFormData({ ...formData, lotNumber: '' }); }}
                      className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
                    >
                      直近のロットから選び直す
                    </button>
                  </div>
                )}
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  id="lotNumber"
                  type="text"
                  name="lotNumber"
                  value={formData.lotNumber}
                  onChange={handleChange}
                  placeholder="一覧にない場合は直接入力（例: R8.01）"
                />
                {sowingLots.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    ロットIDの付いた播種記録がまだありません。直接入力するか、
                    先に播種記録へロットIDを登録してください。
                  </p>
                )}
              </>
            )}
        </div>

        {/* 病害虫のモニタリング記録。
            育苗した種苗について「見て、どうだったか」を残さないと、
            記録から発生の有無が読み取れない（FV-Smart 26.03）。 */}
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded p-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            病害虫の発生 <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-600 mb-3">
            苗の状態を確認した結果を記録します。「なし」も確認した証拠になります。
          </p>
          <div className="flex gap-2 mb-3">
            {['なし', 'あり'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFormData({ ...formData, pestStatus: v })}
                className={`flex-1 py-3 rounded border-2 font-medium ${
                  formData.pestStatus === v
                    ? v === 'あり'
                      ? 'border-red-500 bg-red-50 text-red-800'
                      : 'border-green-600 bg-green-50 text-green-800'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {v === 'あり' ? '⚠️ あり' : '⭕ なし'}
              </button>
            ))}
          </div>

          {formData.pestStatus === 'あり' && (
            <div className="space-y-3">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-1" htmlFor="pestDetail">
                  病害虫名・症状 <span className="text-red-500">*</span>
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  id="pestDetail"
                  type="text"
                  name="pestDetail"
                  value={formData.pestDetail}
                  onChange={handleChange}
                  placeholder="例: アブラムシを数株で確認"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-1" htmlFor="pestAction">
                  とった対応 <span className="text-red-500">*</span>
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  id="pestAction"
                  type="text"
                  name="pestAction"
                  value={formData.pestAction}
                  onChange={handleChange}
                  placeholder="例: 該当株を抜き取り処分し、以後毎日観察"
                />
              </div>
              <p className="text-xs text-amber-800">
                発生を見つけたこと自体は不適合ではありません。見つけて対応した記録がある方が、
                管理が機能している証拠になります。
              </p>
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="notes">
            備考
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            placeholder="栽培条件や特記事項など"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="submit"
            disabled={loading}
          >
            {loading ? '送信中...' : isEditMode ? '更新する' : '登録する'}
          </button>
          <button
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="button"
            onClick={() => navigate('/seeds')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default SeedUseForm;
