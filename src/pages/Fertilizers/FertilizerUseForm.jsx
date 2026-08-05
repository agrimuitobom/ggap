// src/pages/Fertilizers/FertilizerUseForm.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { addDoc, updateDoc, doc, getDoc, collection, query, getDocs, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { getLastFertilizerUse } from '../../services/lastUseService';
import { firestoreLogger } from '../../utils/logger';
import { AMOUNT_BASES } from '../../services/fertilizerCalc';
import { getStockSolutions, stockSolutionLabel, findActiveSolution } from '../../services/stockSolutionService';
import toast from 'react-hot-toast';

const FertilizerUseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrganization } = useOrganization();
  const [fertilizers, setFertilizers] = useState([]);
  const [stockSolutions, setStockSolutions] = useState([]);
  // 編集画面で「元は何を記録したのか」を見失わないよう、読み込んだ内容を残す
  const [originalRecord, setOriginalRecord] = useState(null);
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    fertilizerId: '',
    fieldId: '',
    amount: '',
    unit: 'kg',
    amountBasis: '原液',
    dilutionRatio: '',
    sourceType: '肥料',
    stockSolutionId: '',
    method: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isEditMode = !!id;

  // URLクエリパラメータから肥料IDを取得
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const fertilizerIdParam = queryParams.get('fertilizerId');
    
    if (fertilizerIdParam) {
      setFormData(prev => ({
        ...prev,
        fertilizerId: fertilizerIdParam
      }));
    }
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentOrganization) return;

      try {
        // 肥料データを取得
        const fertilizersQuery = query(
          collection(db, 'fertilizers'),
          where('organizationId', '==', currentOrganization.id)
        );
        const fertilizersSnapshot = await getDocs(fertilizersQuery);
        const fertilizersList = [];
        fertilizersSnapshot.forEach((doc) => {
          fertilizersList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setFertilizers(fertilizersList);

        // 母液（原液タンク）の調製記録
        setStockSolutions(await getStockSolutions(currentOrganization.id));

        // 圃場データを取得
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
          const docRef = doc(db, 'fertilizerUses', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setOriginalRecord(data);
            setFormData({
              date: data.date?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              fertilizerId: data.fertilizerId || '',
              fieldId: data.fieldId || '',
              amount: data.amount?.toString() || '',
              unit: data.unit || 'kg',
              amountBasis: data.amountBasis || '原液',
              dilutionRatio: data.dilutionRatio?.toString() || '',
              sourceType: data.sourceType || '肥料',
              stockSolutionId: data.stockSolutionId || '',
              method: data.method || '',
              notes: data.notes || ''
            });
          } else {
            setError('指定された肥料使用記録が見つかりません。');
            navigate('/fertilizer-uses');
          }
        }
      } catch (err) {
        firestoreLogger.error('肥料使用記録フォームのデータ取得に失敗しました', {
          organizationId: currentOrganization.id,
          fertilizerUseId: id || null,
          isEditMode
        }, err);
        setError('データの取得中にエラーが発生しました。');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchData();
  }, [id, isEditMode, navigate, currentOrganization]);

  // その日に使用中のはずの母液（調製日がその日以前で最も新しいもの）
  const activeSolution = findActiveSolution(stockSolutions, formData.date);

  // 母液モードに切り替えたとき、使用中の母液を自動で選んでおく
  useEffect(() => {
    if (formData.sourceType !== '母液' || formData.stockSolutionId || !activeSolution) return;
    setFormData(prev => ({
      ...prev,
      stockSolutionId: activeSolution.id,
      unit: prev.unit === 'ml' ? 'ml' : 'L'
    }));
  }, [formData.sourceType, formData.stockSolutionId, activeSolution]);

  const selectedSolution = stockSolutions.find(s => s.id === formData.stockSolutionId);
  const selectedFertilizer = fertilizers.find(f => f.id === formData.fertilizerId);
  const remainingText = selectedSolution
    ? `この母液の調製量は ${selectedSolution.totalVolume}L です。残量は母液（原液）調製記録の画面で確認できます。`
    : '';

  // 記録では母液を指しているのに、その母液が見つからない場合
  const missingSolution =
    formData.sourceType === '母液' && formData.stockSolutionId && !selectedSolution;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // 肥料を選んだら前回使用時の値を空欄に自動補完（新規登録時のみ）
    if (name === 'fertilizerId' && value && !isEditMode) {
      autoFillFromLastUse(value);
    }
  };

  const autoFillFromLastUse = async (fertilizerId) => {
    const last = await getLastFertilizerUse(currentOrganization.id, fertilizerId);
    if (!last) return;
    setFormData((prev) => ({
      ...prev,
      amount: prev.amount || last.amount,
      unit: prev.unit && prev.unit !== 'kg' ? prev.unit : last.unit || 'kg',
      method: prev.method || last.method
    }));
    toast.success('前回の使用内容を自動入力しました');
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
      // 選択された肥料と圃場の名前を取得
      const fertilizerForSave = fertilizers.find(fertilizer => fertilizer.id === formData.fertilizerId);
      const selectedField = fields.find(field => field.id === formData.fieldId);
      
      const fertilizerUseData = {
        date: new Date(formData.date),
        fertilizerId: formData.fertilizerId,
        fertilizerName: fertilizerForSave ? fertilizerForSave.name : '',
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        organizationId: currentOrganization.id,
        amount: formData.amount ? Number(formData.amount) : null,
        unit: formData.unit,
        // 液肥を希釈して使う場合、入力した量が原液か希釈後かで成分量が変わる
        amountBasis: formData.amountBasis || '原液',
        // 母液をそのまま投入した場合は倍率を持たせない（＝1倍として計算される）
        dilutionRatio:
          formData.amountBasis === '希釈後' && formData.dilutionRatio
            ? Number(formData.dilutionRatio)
            : null,
        // 母液を希釈して施用した場合、成分量は母液の調製記録からさかのぼって計算する
        sourceType: formData.sourceType || '肥料',
        stockSolutionId: formData.sourceType === '母液' ? formData.stockSolutionId : '',
        method: formData.method,
        notes: formData.notes,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode) {
        // 既存のドキュメントを更新
        await updateDoc(doc(db, 'fertilizerUses', id), fertilizerUseData);
        setMessage('肥料使用記録が正常に更新されました');
      } else {
        // 新規ドキュメントを作成
        fertilizerUseData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'fertilizerUses'), fertilizerUseData);
        setMessage('肥料使用記録が正常に登録されました');
      }

      // 成功後、一覧画面に遷移
      setTimeout(() => {
        navigate('/fertilizer-uses');
      }, 1000);
    } catch (err) {
      firestoreLogger.error('肥料使用記録の保存に失敗しました', {
        organizationId: currentOrganization.id,
        fertilizerUseId: id || null,
        fertilizerId: formData.fertilizerId,
        fieldId: formData.fieldId,
        isEditMode
      }, err);
      setError('肥料使用記録の保存中にエラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '肥料使用記録編集' : '肥料使用記録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto mobile-container max-w-2xl pb-20 md:pb-4">
      <h1 className="mobile-form-header">{isEditMode ? '肥料使用記録編集' : '肥料使用記録'}</h1>
      
      {error && (
        <div className="mobile-alert mobile-alert-error">
          {error}
        </div>
      )}
      
      {message && (
        <div className="mobile-alert mobile-alert-success">
          {message}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="mobile-form-section">
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="date">
            作業日 *
          </label>
          <input
            className="mobile-input w-full"
            id="date"
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>
        
        {/* 編集中に「元は何を記録したのか」が分かるようにする */}
        {isEditMode && originalRecord && (
          <div className="mobile-form-field bg-gray-50 border border-gray-200 rounded p-3">
            <p className="text-xs text-gray-500 mb-1">この記録に保存されている内容</p>
            <p className="text-sm text-gray-800">
              {originalRecord.date?.toDate
                ? originalRecord.date.toDate().toLocaleDateString('ja-JP')
                : ''}
              　{originalRecord.fieldName || '圃場なし'}
            </p>
            <p className="text-sm font-bold text-gray-900">
              {originalRecord.sourceType === '母液'
                ? `母液：${stockSolutions.find(s => s.id === originalRecord.stockSolutionId)?.name || '（記録された母液が見つかりません）'}`
                : `肥料：${originalRecord.fertilizerName || '（記録なし）'}`}
              {originalRecord.amount != null && ` ／ ${originalRecord.amount}${originalRecord.unit || ''}`}
              {originalRecord.dilutionRatio ? ` ／ ${originalRecord.dilutionRatio}倍希釈` : ''}
            </p>
            {originalRecord.method && (
              <p className="text-sm text-gray-600">{originalRecord.method}</p>
            )}
          </div>
        )}

        {/* 母液（原液タンク）を希釈して使う場合は、肥料ではなく母液を選ぶ */}
        <div className="mobile-form-field">
          <label className="mobile-form-label">施用したもの *</label>
          <div className="flex gap-2">
            {['肥料', '母液'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, sourceType: type }))}
                className={`flex-1 py-3 rounded border-2 text-sm font-medium ${
                  formData.sourceType === type
                    ? 'border-green-600 bg-green-50 text-green-800'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {type === '肥料' ? '肥料を直接施用' : '母液を希釈して施用'}
              </button>
            ))}
          </div>
        </div>

        {formData.sourceType === '母液' ? (
          <div className="mobile-form-field">
            <label className="mobile-form-label" htmlFor="stockSolutionId">
              母液 *
            </label>
            <select
              className="mobile-select w-full"
              id="stockSolutionId"
              name="stockSolutionId"
              value={formData.stockSolutionId}
              onChange={(e) => {
                const sol = stockSolutions.find(s => s.id === e.target.value);
                setFormData(prev => ({
                  ...prev,
                  stockSolutionId: e.target.value,
                  unit: prev.unit === 'ml' ? 'ml' : 'L',
                  dilutionRatio: prev.dilutionRatio || (sol?.defaultDilutionRatio?.toString() || '')
                }));
              }}
              required
            >
              <option value="">母液を選択してください</option>
              {stockSolutions.map(s => (
                <option key={s.id} value={s.id}>{stockSolutionLabel(s)}</option>
              ))}
            </select>
            {activeSolution && formData.stockSolutionId === activeSolution.id && (
              <p className="text-xs text-green-700 mt-1">
                この日に使用中の母液を自動で選びました。違う場合は変更してください。
              </p>
            )}

            {missingSolution && (
              <p className="text-xs text-red-700 mt-1">
                この記録が指している母液が見つかりません（削除された可能性があります）。
                正しい母液を選び直してください。
              </p>
            )}

            {/* 「この母液って何が入ってるんだっけ？」に答える */}
            {selectedSolution && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-700">
                <p className="font-bold mb-1">
                  {selectedSolution.preparedDate} 調製 ／ 全量 {selectedSolution.totalVolume}L
                </p>
                <ul>
                  {(selectedSolution.ingredients || []).map((ing, i) => (
                    <li key={i}>・{ing.fertilizerName} {ing.amount}{ing.unit}</li>
                  ))}
                </ul>
              </div>
            )}
            {stockSolutions.length === 0 ? (
              <p className="text-red-500 text-xs mt-1">
                母液の調製記録がありません。先に
                <Link to="/stock-solutions" className="underline mx-1">母液の調製記録</Link>
                を登録してください。
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                使用量には<strong>希釈後に散布した量</strong>を入力してください。
                母液の調製記録から、肥料製品の使用量と成分量を計算します。
              </p>
            )}
          </div>
        ) : (
          <div className="mobile-form-field">
            <label className="mobile-form-label" htmlFor="fertilizerId">
              肥料 *
            </label>
            <select
              className="mobile-select w-full"
              id="fertilizerId"
              name="fertilizerId"
              value={formData.fertilizerId}
              onChange={handleChange}
              required
            >
              <option value="">肥料を選択してください</option>
              {fertilizers.map(fertilizer => (
                <option key={fertilizer.id} value={fertilizer.id}>{fertilizer.name}</option>
              ))}
            </select>
            {fertilizers.length === 0 && (
              <p className="text-red-500 text-xs mt-1">
                肥料が登録されていません。先に肥料を登録してください。
              </p>
            )}

            {/* 「この肥料って何だっけ？」に答える */}
            {selectedFertilizer && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-700">
                <p>
                  {selectedFertilizer.manufacturer && `${selectedFertilizer.manufacturer}　`}
                  {selectedFertilizer.type || '区分なし'}
                  {selectedFertilizer.formType && `／${selectedFertilizer.formType}`}
                </p>
                <p>
                  成分 N{selectedFertilizer.nitrogenContent ?? 0}
                  －P{selectedFertilizer.phosphorusContent ?? 0}
                  －K{selectedFertilizer.potassiumContent ?? 0}
                  {selectedFertilizer.density ? `　比重 ${selectedFertilizer.density}kg/L` : ''}
                </p>
                {selectedFertilizer.notes && <p className="text-gray-500">{selectedFertilizer.notes}</p>}
              </div>
            )}
          </div>
        )}
        
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="fieldId">
            圃場 *
          </label>
          <select
            className="mobile-select w-full"
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
        
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="amount">
            使用量 *
          </label>
          <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-2">
            <input
              className="mobile-input flex-1"
              id="amount"
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.1"
              min="0"
              required
              placeholder="数量を入力"
            />
            <select
              className="mobile-select w-full md:w-24"
              id="unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="袋">袋</option>
              <option value="その他">その他</option>
            </select>
          </div>

          {/* 液肥を希釈して使う場合、入力した数値が何を指すかで成分量が変わる */}
          {formData.sourceType === '母液' ? (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm font-bold text-blue-900 mb-2">入力した量は？</p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="amountBasis"
                    value="原液"
                    checked={formData.amountBasis !== '希釈後'}
                    onChange={() => setFormData(prev => ({ ...prev, amountBasis: '原液', dilutionRatio: '' }))}
                    className="h-4 w-4 mt-1"
                  />
                  <span>
                    <strong>母液そのものの量</strong>（タンクに入れた母液が◯L）
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="amountBasis"
                    value="希釈後"
                    checked={formData.amountBasis === '希釈後'}
                    onChange={() => setFormData(prev => ({ ...prev, amountBasis: '希釈後' }))}
                    className="h-4 w-4 mt-1"
                  />
                  <span>
                    <strong>希釈後の液の量</strong>（薄めた液を◯L散布した）
                  </span>
                </label>
              </div>

              {formData.amountBasis === '希釈後' && (
                <div className="mt-3">
                  <label className="block text-sm font-bold text-blue-900 mb-1" htmlFor="dilutionRatioStock">
                    希釈倍率 *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      className="mobile-input w-32"
                      id="dilutionRatioStock"
                      type="number"
                      name="dilutionRatio"
                      value={formData.dilutionRatio}
                      onChange={handleChange}
                      step="1"
                      min="1"
                      placeholder="例: 100"
                      required
                    />
                    <span className="text-sm text-blue-900">倍</span>
                  </div>
                </div>
              )}

              {remainingText && (
                <p className="text-xs text-blue-800 mt-2">{remainingText}</p>
              )}
            </div>
          ) : (formData.unit === 'L' || formData.unit === 'ml') && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm font-bold text-blue-900 mb-2">入力した量は？</p>
              <div className="space-y-2">
                {AMOUNT_BASES.map((basis) => (
                  <label key={basis.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="amountBasis"
                      value={basis.value}
                      checked={formData.amountBasis === basis.value}
                      onChange={handleChange}
                      className="h-4 w-4"
                    />
                    {basis.label}
                  </label>
                ))}
              </div>

              {formData.amountBasis === '希釈後' && (
                <div className="mt-3">
                  <label className="block text-sm text-blue-900 mb-1" htmlFor="dilutionRatio">
                    希釈倍率 *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      className="mobile-input w-32"
                      id="dilutionRatio"
                      type="number"
                      name="dilutionRatio"
                      value={formData.dilutionRatio}
                      onChange={handleChange}
                      step="1"
                      min="1"
                      placeholder="例: 100"
                    />
                    <span className="text-sm text-blue-900">倍</span>
                  </div>
                  <p className="text-xs text-blue-800 mt-1">
                    成分量は「原液量 × 比重 × 保証成分%」で計算します。
                    希釈後の量で入力する場合は、倍率で割って原液量を求めます。
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="method">
            施肥方法 *
          </label>
          <select
            className="mobile-select w-full"
            id="method"
            name="method"
            value={formData.method}
            onChange={handleChange}
            required
          >
            <option value="">選択してください</option>
            <option value="全面散布">全面散布</option>
            <option value="条施肥">条施肥</option>
            <option value="点滴施肥">点滴施肥</option>
            <option value="葉面散布">葉面散布</option>
            <option value="土壌混和">土壌混和</option>
            <option value="灌水施肥">灌水施肥</option>
            <option value="その他">その他</option>
          </select>
        </div>
        
        <div className="mobile-form-field">
          <label className="mobile-form-label" htmlFor="notes">
            備考
          </label>
          <textarea
            className="mobile-textarea w-full"
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            placeholder="特記事項があれば記入"
          />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
          <button
            className="mobile-btn mobile-btn-success w-full md:w-auto order-2 md:order-1"
            type="submit"
            disabled={loading}
          >
            {loading ? '送信中...' : isEditMode ? '更新する' : '登録する'}
          </button>
          <button
            className="mobile-btn mobile-btn-secondary w-full md:w-auto order-1 md:order-2"
            type="button"
            onClick={() => navigate('/fertilizer-uses')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default FertilizerUseForm;
