// src/pages/WorkLogs/WorkLogForm.jsx
import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import QuickTemplateBar from '../../components/QuickActions/QuickTemplateBar';

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
  const { currentUser } = useAuth();
  const isEditMode = !!id;

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


  // 編集モードの場合、既存データを取得
  useEffect(() => {
    let isCancelled = false;

    const loadExistingData = async () => {
      if (isEditMode && id) {
        try {
          const existingData = await fetchExistingData(id);
          if (!isCancelled) {
            setFormData(existingData);
          }
        } catch (err) {
          if (!isCancelled) {
            setFormErrors('指定された作業日誌データが見つかりません。');
            navigate('/work-logs');
          }
        }
      }
    };

    loadExistingData();

    return () => {
      isCancelled = true;
    };
  }, [id, isEditMode]); // 最小限の依存関係のみ

  // 関連資材レコードを作成する関数
  const createRelatedRecords = async (workLogRef, selectedField) => {
    const promises = [];

    // 施肥記録作成
    if (formData.workType === '施肥' && formData.fertilizerId) {
      const selectedFertilizer = fertilizers.find(fertilizer => fertilizer.id === formData.fertilizerId);

      // デバッグログ: 選択された肥料のNPK成分を確認
      console.log('DEBUG: Selected fertilizer data:', {
        id: selectedFertilizer?.id,
        name: selectedFertilizer?.name,
        nitrogenContent: selectedFertilizer?.nitrogenContent,
        phosphorusContent: selectedFertilizer?.phosphorusContent,
        potassiumContent: selectedFertilizer?.potassiumContent,
        fullData: selectedFertilizer
      });
      const fertilizerUseData = {
        date: new Date(formData.date),
        fertilizerId: formData.fertilizerId,
        fertilizerName: selectedFertilizer ? selectedFertilizer.name : '',
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        appliedBy: currentUser.uid,
        appliedByName: currentUser.displayName || currentUser.email,
        userId: currentUser.uid,
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
      console.log('DEBUG: fertilizerUseData to be saved:', {
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
        plantedBy: currentUser.uid,
        plantedByName: currentUser.displayName || currentUser.email,
        userId: currentUser.uid,
        amount: formData.seedAmount ? Number(formData.seedAmount) : null,
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
        appliedBy: currentUser.uid,
        appliedByName: currentUser.displayName || currentUser.email,
        userId: currentUser.uid,
        dilutionRate: formData.dilutionRate ? Number(formData.dilutionRate) : null,
        amount: formData.pesticideAmount ? Number(formData.pesticideAmount) : null,
        unit: formData.pesticideUnit,
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
  const deleteRelatedRecords = async (workLogId) => {
    const promises = [];

    // 肥料使用記録の削除
    const fertilizerQuery = query(collection(db, 'fertilizerUses'), where('workLogId', '==', workLogId));
    const fertilizerSnapshot = await getDocs(fertilizerQuery);
    fertilizerSnapshot.forEach(doc => {
      promises.push(deleteDoc(doc.ref));
    });

    // 播種記録の削除
    const seedQuery = query(collection(db, 'seedUses'), where('workLogId', '==', workLogId));
    const seedSnapshot = await getDocs(seedQuery);
    seedSnapshot.forEach(doc => {
      promises.push(deleteDoc(doc.ref));
    });

    // 防除記録の削除
    const pesticideQuery = query(collection(db, 'pesticideUses'), where('workLogId', '==', workLogId));
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
      if (!currentUser) {
        setFormErrors('ユーザー認証が確認できません。');
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
        userId: currentUser.uid,
        date: new Date(formData.date),
        fieldId: formData.fieldId,
        fieldName: selectedField?.name || '',
        workType: formData.workType,
        workers: formData.workers,
        workerNames: selectedWorkers.map(worker => worker.name),
        details: formData.details,
        workHours: formData.workHours ? Number(formData.workHours) : null,
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
        seedMethod: formData.workType === '播種' ? formData.seedMethod : null,
        // 防除関連
        pesticideId: formData.workType === '防除' ? formData.pesticideId : null,
        targetPest: formData.workType === '防除' ? formData.targetPest : null,
        dilutionRate: formData.workType === '防除' && formData.dilutionRate ? Number(formData.dilutionRate) : null,
        pesticideAmount: formData.workType === '防除' && formData.pesticideAmount ? Number(formData.pesticideAmount) : null,
        pesticideUnit: formData.workType === '防除' ? formData.pesticideUnit : null,
        pesticideMethod: formData.workType === '防除' ? formData.pesticideMethod : null,
        weather: formData.workType === '防除' ? formData.weather : null,
        temperature: formData.workType === '防除' && formData.temperature ? Number(formData.temperature) : null,
        windSpeed: formData.workType === '防除' && formData.windSpeed ? Number(formData.windSpeed) : null,
        updatedAt: serverTimestamp()
      };

      if (isEditMode) {
        await updateDoc(doc(db, 'workLogs', id), workLogData);

        // 関連レコードを一度削除して再作成（整合性を保つため）
        await deleteRelatedRecords(id);
        await createRelatedRecords(doc(db, 'workLogs', id), selectedField);

        setFormMessage('作業日誌が正常に更新されました');
      } else {
        workLogData.createdAt = serverTimestamp();
        const workLogRef = await addDoc(collection(db, 'workLogs'), workLogData);

        // 関連資材記録を作成
        await createRelatedRecords(workLogRef, selectedField);

        setFormMessage('作業日誌が正常に登録されました');
        resetForm();
      }

      // 成功メッセージを表示後、一覧画面に戻る
      setTimeout(() => {
        navigate('/work-logs');
      }, 2000);
    } catch (err) {
      console.error('Error saving work log:', err);
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

      {/* クイックテンプレートバー */}
      <QuickTemplateBar onTemplateSelect={handleTemplateSelect} />

      <form onSubmit={handleSubmit} className="mobile-form-section bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">

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
          />
        )}

        {/* 防除の場合の追加項目 */}
        {formData.workType === '防除' && (
          <PesticideSection
            formData={formData}
            handleChange={handleChange}
            pesticides={pesticides}
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
