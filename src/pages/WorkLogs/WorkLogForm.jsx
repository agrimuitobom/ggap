// src/pages/WorkLogs/WorkLogForm.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { firestoreLogger } from '../../utils/logger';
import { loadWorkLogDefaults, saveWorkLogDefaults } from '../../utils/workLogDefaults';
import { getWorkLogTemplates, saveWorkLogTemplate, deleteWorkLogTemplate } from '../../services/templateService';
import { getCurrentPosition, fetchWeatherForDate } from '../../services/weatherService';
import { getPlantings, plantingLabel } from '../../services/plantingService';
import { syncHarvestFromWorkLog } from '../../services/harvestSyncService';
import QuickTemplateBar from '../../components/QuickActions/QuickTemplateBar';
import toast from 'react-hot-toast';

// カスタムフック
import { useWorkLogForm } from '../../hooks/useWorkLogForm';
import { useWorkLogData } from '../../hooks/useWorkLogData';

// コンポーネント
import BasicInfoSection from '../../components/WorkLog/BasicInfoSection';
import FertilizerSection from '../../components/WorkLog/FertilizerSection';
import SeedSection from '../../components/WorkLog/SeedSection';
import PesticideSection from '../../components/WorkLog/PesticideSection';

const WorkLogForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get('copyFrom');
  const { currentOrganization, selfWorkerId } = useOrganization();
  const { currentUser, userProfile } = useAuth();
  const isEditMode = !!id;
  const [templates, setTemplates] = useState([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [plantings, setPlantings] = useState([]);
  const [plantingId, setPlantingId] = useState('');
  const defaultsAppliedRef = useRef(false);

  // カスタムフックの使用
  const { fields, users, fertilizers, seeds, pesticides, loading: fetchLoading, error: dataError, fetchExistingData } = useWorkLogData();
  const {
    formData,
    setFormData,
    loading,
    error,
    message,
    handleChange,
    handleWorkerChange,
    handleTemplateSelect,
    resetForm,
    setFormErrors,
    setFormMessage,
    setFormLoading,
    validateForm
  } = useWorkLogForm();


  // 編集モードの場合は既存データを、複製時はコピー元データ（日付は今日に変更）を取得
  useEffect(() => {
    let isCancelled = false;

    const loadExistingData = async () => {
      if (isEditMode && id) {
        try {
          const existingData = await fetchExistingData(id);
          if (!isCancelled) {
            setFormData(existingData);
            setPlantingId(existingData.plantingId || '');
          }
        } catch (err) {
          if (!isCancelled) {
            setFormErrors('指定された作業日誌データが見つかりません。');
            navigate('/work-logs');
          }
        }
      } else if (copyFromId) {
        try {
          const sourceData = await fetchExistingData(copyFromId);
          if (!isCancelled) {
            setFormData({
              ...sourceData,
              date: new Date().toISOString().split('T')[0]
            });
            setFormMessage('前回の記録を複製しました。内容を確認して登録してください。');
          }
        } catch (err) {
          if (!isCancelled) {
            setFormErrors('複製元の作業日誌データが見つかりません。');
          }
        }
      }
    };

    loadExistingData();

    return () => {
      isCancelled = true;
    };
  }, [id, isEditMode, copyFromId]); // 最小限の依存関係のみ

  // 新規入力時、前回使用した圃場・担当者を初期値として反映
  useEffect(() => {
    if (isEditMode || copyFromId || fetchLoading || defaultsAppliedRef.current) return;
    if (!currentOrganization) return;

    const defaults = loadWorkLogDefaults(currentOrganization.id);
    setFormData(prev => {
      // ユーザーが既に入力を始めていたら上書きしない
      if (prev.fieldId || prev.workers.length > 0) return prev;
      const validFieldId = defaults?.fieldId && fields.some(f => f.id === defaults.fieldId)
        ? defaults.fieldId : '';
      // 担当者は「自分（ログインアカウント）」を自動選択。なければ前回の担当者
      let workers = [];
      if (selfWorkerId && users.some(u => u.id === selfWorkerId)) {
        workers = [selfWorkerId];
      } else if (Array.isArray(defaults?.workers)) {
        workers = defaults.workers.filter(workerId => users.some(u => u.id === workerId));
      }
      return { ...prev, fieldId: validFieldId, workers };
    });
    defaultsAppliedRef.current = true;
  }, [isEditMode, copyFromId, fetchLoading, currentOrganization, fields, users, setFormData, selfWorkerId]);

  // 栽培中の作付を読み込む
  useEffect(() => {
    const loadPlantings = async () => {
      if (!currentOrganization) return;
      try {
        const list = await getPlantings(currentOrganization.id);
        setPlantings(list.filter((p) => p.status === '栽培中'));
      } catch (err) {
        firestoreLogger.error('作付の取得エラー', { organizationId: currentOrganization?.id }, err);
      }
    };
    loadPlantings();
  }, [currentOrganization]);

  // 選択中の圃場に属する作付（処理区）
  const plantingsForField = plantings.filter((p) => p.fieldId === formData.fieldId);
  const selectedPlanting = plantingsForField.find((p) => p.id === plantingId) || null;

  // マイテンプレートを読み込み
  useEffect(() => {
    const loadTemplates = async () => {
      if (!currentOrganization) return;
      try {
        const list = await getWorkLogTemplates(currentOrganization.id);
        setTemplates(list);
      } catch (err) {
        firestoreLogger.error('テンプレートの取得エラー', { organizationId: currentOrganization?.id }, err);
      }
    };
    loadTemplates();
  }, [currentOrganization]);

  // 現在の入力内容をマイテンプレートとして保存
  const handleSaveTemplate = async (name) => {
    if (!currentOrganization) return;
    try {
      const saved = await saveWorkLogTemplate(currentOrganization.id, name, formData);
      setTemplates(prev => [...prev, saved].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      toast.success(`テンプレート「${name}」を保存しました`);
    } catch (err) {
      firestoreLogger.error('テンプレートの保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('テンプレートの保存中にエラーが発生しました');
    }
  };

  // マイテンプレートを削除
  const handleDeleteTemplate = async (templateId) => {
    try {
      await deleteWorkLogTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success('テンプレートを削除しました');
    } catch (err) {
      firestoreLogger.error('テンプレートの削除エラー', { templateId }, err);
      toast.error('テンプレートの削除中にエラーが発生しました');
    }
  };

  // 現在地と作業日から天候・気温・風速を自動入力
  const handleAutoFillWeather = async () => {
    setWeatherLoading(true);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      const weather = await fetchWeatherForDate(latitude, longitude, formData.date);
      if (!weather) {
        toast.error('この日付の天気データが見つかりませんでした');
        return;
      }
      setFormData(prev => ({
        ...prev,
        weather: weather.weather,
        temperature: weather.temperature,
        windSpeed: weather.windSpeed
      }));
      toast.success(`天気を自動入力しました（${weather.weather} ${weather.temperature}℃）`);
    } catch (err) {
      if (err?.code === 1) {
        // GeolocationPositionError.PERMISSION_DENIED
        toast.error('位置情報の利用が許可されていません。ブラウザの設定を確認してください');
      } else {
        toast.error('天気の取得に失敗しました。通信環境を確認してください');
      }
    } finally {
      setWeatherLoading(false);
    }
  };

  // 関連資材レコードを作成する関数
  const createRelatedRecords = async (workLogRef, selectedField) => {
    const promises = [];

    // 施用者は組織名ではなく、実際に作業した担当者。審査では
    // 「誰が施用したか」を必ず問われるため、作業日誌の担当者を引き継ぐ。
    // 担当者が未入力の場合は、記録した人を残す。
    const applierNames = users
      .filter((user) => formData.workers.includes(user.id))
      .map((user) => user.name);
    const appliedByName = applierNames.length > 0
      ? applierNames.join('、')
      : (userProfile?.name || '');

    // 施肥記録作成
    if (formData.workType === '施肥' && formData.fertilizerId) {
      const selectedFertilizer = fertilizers.find(fertilizer => fertilizer.id === formData.fertilizerId);

      // デバッグログ: 選択された肥料のNPK成分を確認
      firestoreLogger.debug('選択された肥料データを確認', {
        fertilizerId: selectedFertilizer?.id,
        fertilizerName: selectedFertilizer?.name,
        nitrogenContent: selectedFertilizer?.nitrogenContent,
        phosphorusContent: selectedFertilizer?.phosphorusContent,
        potassiumContent: selectedFertilizer?.potassiumContent
      });
      const fertilizerUseData = {
        date: new Date(formData.date),
        fertilizerId: formData.fertilizerId,
        fertilizerName: selectedFertilizer ? selectedFertilizer.name : '',
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        appliedBy: currentUser?.uid || '',
        appliedByName,
        organizationId: currentOrganization.id,
        amount: formData.fertilizerAmount ? Number(formData.fertilizerAmount) : null,
        unit: formData.fertilizerUnit,
        method: formData.fertilizerMethod,
        // NPK成分情報を追加
        nitrogen: selectedFertilizer?.nitrogenContent || 0,
        phosphorus: selectedFertilizer?.phosphorusContent || 0,
        potassium: selectedFertilizer?.potassiumContent || 0,
        notes: `作業日誌より自動作成 (作業ID: ${workLogRef.id})`,
        workLogId: workLogRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // デバッグログ: fertilizerUsesコレクションに保存するデータを確認
      firestoreLogger.debug('施肥記録の保存データを確認', {
        fertilizerId: fertilizerUseData.fertilizerId,
        fertilizerName: fertilizerUseData.fertilizerName,
        nitrogen: fertilizerUseData.nitrogen,
        phosphorus: fertilizerUseData.phosphorus,
        potassium: fertilizerUseData.potassium,
        amount: fertilizerUseData.amount,
        unit: fertilizerUseData.unit
      });

      promises.push(addDoc(collection(db, 'fertilizerUses'), fertilizerUseData));
    }

    // 播種記録作成
    if (formData.workType === '播種' && formData.seedId) {
      const selectedSeed = seeds.find(seed => seed.id === formData.seedId);
      const seedUseData = {
        date: new Date(formData.date),
        seedId: formData.seedId,
        seedName: selectedSeed ? `${selectedSeed.name} (${selectedSeed.variety})` : '',
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        plantedBy: currentOrganization.id,
        plantedByName: currentOrganization.name || '',
        organizationId: currentOrganization.id,
        amount: formData.seedAmount ? Number(formData.seedAmount) : null,
        unit: formData.seedUnit || '粒',
        method: formData.seedMethod,
        notes: `作業日誌より自動作成 (作業ID: ${workLogRef.id})`,
        workLogId: workLogRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      promises.push(addDoc(collection(db, 'seedUses'), seedUseData));
    }

    // 防除記録作成
    if (formData.workType === '防除' && formData.pesticideId) {
      const selectedPesticide = pesticides.find(pesticide => pesticide.id === formData.pesticideId);
      const pesticideUseData = {
        date: new Date(formData.date),
        pesticideId: formData.pesticideId,
        pesticideName: selectedPesticide ? selectedPesticide.name : '',
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        targetPest: formData.targetPest,
        appliedBy: currentUser?.uid || '',
        appliedByName,
        organizationId: currentOrganization.id,
        dilutionRate: formData.dilutionRate ? Number(formData.dilutionRate) : null,
        amount: formData.pesticideAmount ? Number(formData.pesticideAmount) : null,
        unit: formData.pesticideUnit,
        treatedArea: formData.treatedArea ? Number(formData.treatedArea) : null,
        method: formData.pesticideMethod,
        weather: formData.weather,
        temperature: formData.temperature ? Number(formData.temperature) : null,
        windSpeed: formData.windSpeed ? Number(formData.windSpeed) : null,
        notes: `作業日誌より自動作成 (作業ID: ${workLogRef.id})`,
        workLogId: workLogRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      promises.push(addDoc(collection(db, 'pesticideUses'), pesticideUseData));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  };

  // 関連資材レコードを削除する関数
  // セキュリティルールがドキュメントの組織所属を要求するため、
  // クエリにも organizationId 条件を含める（workLogId 単独だと権限エラーになる）
  const deleteRelatedRecords = async (workLogId) => {
    if (!currentOrganization) return;
    const orgId = currentOrganization.id;
    const promises = [];

    // 肥料使用記録の削除
    const fertilizerQuery = query(
      collection(db, 'fertilizerUses'),
      where('organizationId', '==', orgId),
      where('workLogId', '==', workLogId)
    );
    const fertilizerSnapshot = await getDocs(fertilizerQuery);
    fertilizerSnapshot.forEach(doc => {
      promises.push(deleteDoc(doc.ref));
    });

    // 播種記録の削除
    const seedQuery = query(
      collection(db, 'seedUses'),
      where('organizationId', '==', orgId),
      where('workLogId', '==', workLogId)
    );
    const seedSnapshot = await getDocs(seedQuery);
    seedSnapshot.forEach(doc => {
      promises.push(deleteDoc(doc.ref));
    });

    // 防除記録の削除
    const pesticideQuery = query(
      collection(db, 'pesticideUses'),
      where('organizationId', '==', orgId),
      where('workLogId', '==', workLogId)
    );
    const pesticideSnapshot = await getDocs(pesticideQuery);
    pesticideSnapshot.forEach(doc => {
      promises.push(deleteDoc(doc.ref));
    });

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormErrors('');
    setFormMessage('');

    try {
      if (!currentOrganization) {
        setFormErrors('組織情報が確認できません。');
        return;
      }

      // バリデーション
      const validationErrors = validateForm(fields, users);
      if (validationErrors.length > 0) {
        setFormErrors(validationErrors.join(', '));
        return;
      }

      // 選択された圃場名を取得
      const selectedField = fields.find(field => field.id === formData.fieldId);
      const selectedWorkers = users.filter(user => formData.workers.includes(user.id));

      const workLogData = {
        organizationId: currentOrganization.id,
        date: new Date(formData.date),
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        workType: formData.workType,
        workers: formData.workers,
        workerNames: selectedWorkers.map(worker => worker.name),
        details: formData.details,
        workHours: formData.workHours ? Number(formData.workHours) : null,
        // 労働時間の比較には延べ人時（作業時間 × 人数）を使う
        workerCount: formData.workers.length || null,
        laborHours: formData.workHours && formData.workers.length
          ? Number(formData.workHours) * formData.workers.length
          : null,
        // 作付（処理区）への紐づけ
        plantingId: selectedPlanting ? selectedPlanting.id : null,
        plantingLabel: selectedPlanting ? plantingLabel(selectedPlanting) : '',
        harvestAmount: formData.harvestAmount ? Number(formData.harvestAmount) : null,
        wasteAmount: formData.wasteAmount ? Number(formData.wasteAmount) : null,
        // 施肥関連
        fertilizerId: formData.workType === '施肥' ? formData.fertilizerId : null,
        fertilizerAmount: formData.workType === '施肥' && formData.fertilizerAmount ? Number(formData.fertilizerAmount) : null,
        fertilizerUnit: formData.workType === '施肥' ? formData.fertilizerUnit : null,
        fertilizerMethod: formData.workType === '施肥' ? formData.fertilizerMethod : null,
        // 播種関連
        seedId: formData.workType === '播種' ? formData.seedId : null,
        seedAmount: formData.workType === '播種' && formData.seedAmount ? Number(formData.seedAmount) : null,
        seedUnit: formData.workType === '播種' ? (formData.seedUnit || '粒') : null,
        seedMethod: formData.workType === '播種' ? formData.seedMethod : null,
        // 防除関連
        pesticideId: formData.workType === '防除' ? formData.pesticideId : null,
        targetPest: formData.workType === '防除' ? formData.targetPest : null,
        dilutionRate: formData.workType === '防除' && formData.dilutionRate ? Number(formData.dilutionRate) : null,
        pesticideAmount: formData.workType === '防除' && formData.pesticideAmount ? Number(formData.pesticideAmount) : null,
        pesticideUnit: formData.workType === '防除' ? formData.pesticideUnit : null,
        treatedArea: formData.workType === '防除' && formData.treatedArea ? Number(formData.treatedArea) : null,
        pesticideMethod: formData.workType === '防除' ? formData.pesticideMethod : null,
        weather: formData.workType === '防除' ? formData.weather : null,
        temperature: formData.workType === '防除' && formData.temperature ? Number(formData.temperature) : null,
        windSpeed: formData.workType === '防除' && formData.windSpeed ? Number(formData.windSpeed) : null,
        // 通常フォームのバリデーションを通過した記録は完成扱い（クイック記録の「要追記」を解除）
        isDraft: false,
        updatedAt: serverTimestamp()
      };

      // 収穫記録に反映するための作物名（作付 → 圃場の栽培中作物 の順に採用）
      const harvestCropName = selectedPlanting?.cropName || selectedField?.currentCrop || '';

      if (isEditMode) {
        await updateDoc(doc(db, 'workLogs', id), workLogData);

        // 関連レコードを一度削除して再作成（整合性を保つため）
        await deleteRelatedRecords(id);
        await createRelatedRecords(doc(db, 'workLogs', id), selectedField);

        // 収穫は harvests に反映する（作り直しではなく更新するのでロット番号は保たれる）
        await syncHarvestFromWorkLog(currentOrganization.id, id, workLogData, {
          cropName: harvestCropName
        });

        setFormMessage('作業日誌が正常に更新されました');
      } else {
        workLogData.createdByUid = currentUser?.uid || null;
        workLogData.createdByName = userProfile?.name || '';
        workLogData.createdAt = serverTimestamp();
        const workLogRef = await addDoc(collection(db, 'workLogs'), workLogData);

        // 関連資材記録を作成
        await createRelatedRecords(workLogRef, selectedField);

        await syncHarvestFromWorkLog(currentOrganization.id, workLogRef.id, workLogData, {
          cropName: harvestCropName
        });

        setFormMessage('作業日誌が正常に登録されました');
        resetForm();
      }

      // 次回入力用に圃場・担当者を記憶
      saveWorkLogDefaults(currentOrganization.id, {
        fieldId: formData.fieldId,
        workers: formData.workers
      });

      // 成功メッセージを表示後、一覧画面に戻る
      setTimeout(() => {
        navigate('/work-logs');
      }, 2000);
    } catch (err) {
      firestoreLogger.error('作業日誌の保存に失敗しました', {
        organizationId: currentOrganization?.id,
        workLogId: id,
        isEditMode
      }, err);
      setFormErrors('作業日誌の保存中にエラーが発生しました: ' + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? '作業日誌編集' : '作業日誌登録'}</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container container mx-auto p-4 max-w-2xl">
      <h1 className="mobile-form-header text-2xl font-bold mb-4 field-text-high-contrast">
        {isEditMode ? '作業日誌編集' : '作業日誌登録'}
      </h1>

      {(error || dataError) && (
        <div className="mobile-alert mobile-alert-error bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error || dataError}
        </div>
      )}

      {message && (
        <div className="mobile-alert mobile-alert-success bg-green-100 border border-green-400 text-green-700 px-4 py-3 mb-4 rounded">
          {message}
        </div>
      )}

      {/* クイックテンプレートバー（マイテンプレート対応） */}
      <QuickTemplateBar
        onTemplateSelect={handleTemplateSelect}
        templates={templates}
        onSaveCurrent={handleSaveTemplate}
        onDelete={handleDeleteTemplate}
      />

      <form onSubmit={handleSubmit} className="mobile-form-section bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">

        {/* クイック記録で添付された写真 */}
        {formData.photoUrls?.length > 0 && (
          <div className="mb-6">
            <p className="block text-gray-700 text-sm font-bold mb-2">添付写真</p>
            <div className="flex flex-wrap gap-2">
              {formData.photoUrls.map((url, index) => (
                <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`添付写真${index + 1}`}
                    className="w-24 h-24 object-cover rounded-lg border hover:opacity-80"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 作付（処理区）への紐づけ */}
        {plantingsForField.length > 0 && (
          <div className="mobile-form-field mb-4">
            <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2">
              作付（処理区）
            </label>
            <select
              className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={plantingId}
              onChange={(e) => setPlantingId(e.target.value)}
            >
              <option value="">紐づけない</option>
              {plantingsForField.map((p) => (
                <option key={p.id} value={p.id}>{plantingLabel(p)}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              紐づけると、処理区ごとの作業時間を集計できます。
            </p>
          </div>
        )}

        {/* 基本情報セクション */}
        <BasicInfoSection
          formData={formData}
          handleChange={handleChange}
          handleWorkerChange={handleWorkerChange}
          fields={fields}
          users={users}
          error={error}
        />

        {/* 施肥の場合の追加項目 */}
        {formData.workType === '施肥' && (
          <FertilizerSection
            formData={formData}
            handleChange={handleChange}
            fertilizers={fertilizers}
          />
        )}

        {/* 播種の場合の追加項目 */}
        {formData.workType === '播種' && (
          <SeedSection
            formData={formData}
            handleChange={handleChange}
            seeds={seeds}
            setFormData={setFormData}
          />
        )}

        {/* 防除の場合の追加項目 */}
        {formData.workType === '防除' && (
          <PesticideSection
            formData={formData}
            handleChange={handleChange}
            pesticides={pesticides}
            fields={fields}
            onAutoFillWeather={handleAutoFillWeather}
            weatherLoading={weatherLoading}
          />
        )}

        <div className="mobile-form-group flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
          <button
            className="mobile-btn mobile-btn-primary w-full md:w-auto bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="submit"
            disabled={loading}
          >
            {loading ? '送信中...' : isEditMode ? '更新する' : '登録する'}
          </button>
          <button
            className="mobile-btn mobile-btn-secondary w-full md:w-auto bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="button"
            onClick={() => navigate('/work-logs')}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default WorkLogForm;
