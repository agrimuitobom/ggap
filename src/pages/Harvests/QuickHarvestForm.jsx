// src/pages/Harvests/QuickHarvestForm.jsx
// 収穫のクイック記録。毎日多い収穫入力を最短で。
// - 圃場を選ぶと作物名を自動入力（圃場の栽培中作物）
// - 数量はプリセットボタン＋手入力、単位は前回値を記憶
// - ロット番号は自動生成、PHI（収穫前日数）違反を自動チェック
// - 保存後に画面に留まり連続記録できる
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { checkPreHarvestInterval } from '../../services/phiService';
import PhiWarningBanner from '../../components/Phi/PhiWarningBanner';
import VoiceInput from '../../components/common/VoiceInput';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const QUANTITY_PRESETS = ['1', '3', '5', '10', '20'];
const UNITS = ['kg', 'g', '個', '箱', '袋', 'ケース'];
const QUALITIES = ['優', '良', '可'];

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const unitStorageKey = (orgId) => `harvestUnit_${orgId}`;

const generateLotNumber = (fieldName, cropName, dateStr) => {
  const ds = dateStr.replace(/-/g, '');
  const fieldCode = fieldName ? fieldName.substring(0, 2).toUpperCase() : 'XX';
  const cropCode = cropName ? cropName.substring(0, 2).toUpperCase() : 'XX';
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${ds}-${fieldCode}-${cropCode}-${random}`;
};

const QuickHarvestForm = () => {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { currentUser, userProfile } = useAuth();

  const [fields, setFields] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fieldId, setFieldId] = useState('');
  const [cropName, setCropName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [quality, setQuality] = useState('良');
  const [notes, setNotes] = useState('');
  const [dateOption, setDateOption] = useState('today'); // today | yesterday | custom
  const [customDate, setCustomDate] = useState(toDateString(new Date()));
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [phiResult, setPhiResult] = useState(null);

  const dateChips = [
    { key: 'today', label: '今日', date: new Date() },
    { key: 'yesterday', label: '昨日', date: new Date(Date.now() - 86400000) }
  ];
  const selectedDate = dateOption === 'custom'
    ? new Date(`${customDate}T00:00:00`)
    : dateChips.find((c) => c.key === dateOption)?.date || new Date();

  useEffect(() => {
    const fetchFields = async () => {
      if (!currentOrganization) return;
      try {
        setFetchLoading(true);
        const snapshot = await getDocs(query(
          collection(db, 'fields'),
          where('organizationId', '==', currentOrganization.id)
        ));
        setFields(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        const savedUnit = localStorage.getItem(unitStorageKey(currentOrganization.id));
        if (savedUnit) setUnit(savedUnit);
      } catch (err) {
        firestoreLogger.error('圃場データの取得エラー', { organizationId: currentOrganization?.id }, err);
        toast.error('圃場データの取得中にエラーが発生しました');
      } finally {
        setFetchLoading(false);
      }
    };
    fetchFields();
  }, [currentOrganization]);

  // 圃場・収穫日が決まったらPHIチェック
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!fieldId || !currentOrganization) {
        setPhiResult(null);
        return;
      }
      const result = await checkPreHarvestInterval(currentOrganization.id, fieldId, selectedDate);
      if (!cancelled) setPhiResult(result);
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, dateOption, customDate, currentOrganization]);

  const selectField = (field) => {
    setFieldId(field.id);
    if (field.currentCrop && !cropName) {
      setCropName(field.currentCrop);
    }
  };

  const canSave = fieldId && cropName && quantity && !saving;

  const resetForNext = () => {
    setQuantity('');
    setNotes('');
    setQuality('良');
  };

  const handleSave = async (continueAfter) => {
    if (!canSave || !currentOrganization) return;
    setSaving(true);
    try {
      const selectedField = fields.find((f) => f.id === fieldId);
      const fieldName = selectedField?.name || '';
      const dateStr = toDateString(selectedDate);
      const lotNumber = generateLotNumber(fieldName, cropName, dateStr);

      await addDoc(collection(db, 'harvests'), {
        organizationId: currentOrganization.id,
        cropName,
        harvestDate: selectedDate,
        fieldId,
        fieldName,
        quantity: Number(quantity),
        unit,
        quality,
        lotNumber,
        disposalAmount: 0,
        disposalReason: '',
        disposalRate: 0,
        totalAmount: Number(quantity),
        notes,
        createdByUid: currentUser?.uid || null,
        createdByName: userProfile?.name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      localStorage.setItem(unitStorageKey(currentOrganization.id), unit);
      toast.success('収穫を記録しました');

      if (continueAfter) {
        setSavedCount((c) => c + 1);
        resetForNext();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/harvests');
      }
    } catch (err) {
      firestoreLogger.error('収穫クイック記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">⚡ 収穫クイック記録</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container container mx-auto p-4 max-w-2xl pb-24">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">⚡ 収穫クイック記録</h1>
        <button
          type="button"
          onClick={() => navigate('/harvests/new')}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          通常フォーム
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">圃場・数量を選ぶだけで収穫を記録できます。</p>

      {savedCount > 0 && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-green-800">✓ {savedCount}件記録しました。続けて記録できます。</span>
          <Link to="/harvests" className="shrink-0 ml-3 px-3 py-2 text-sm bg-white border border-green-400 text-green-700 rounded hover:bg-green-100">
            一覧へ
          </Link>
        </div>
      )}

      {/* 日付 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-3">いつ？</h2>
        <div className="flex flex-wrap gap-2">
          {dateChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setDateOption(chip.key)}
              className={`px-4 py-2 rounded-full border text-sm ${
                dateOption === chip.key ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
              }`}
            >
              {chip.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDateOption('custom')}
            className={`px-4 py-2 rounded-full border text-sm ${
              dateOption === 'custom' ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
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
            className="mt-3 border rounded px-3 py-2 text-sm"
          />
        )}
      </div>

      {/* 圃場 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-3">どの圃場？ <span className="text-red-500">*</span></h2>
        {fields.length === 0 ? (
          <p className="text-sm text-gray-500">圃場が登録されていません。先に圃場管理から登録してください。</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {fields.map((field) => (
              <button
                key={field.id}
                type="button"
                onClick={() => selectField(field)}
                className={`touch-target p-3 rounded-lg border-2 text-sm ${
                  fieldId === field.id ? 'border-green-600 bg-green-50 text-green-800 font-bold' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {field.name}
                {field.currentCrop && <span className="block text-xs text-gray-500">{field.currentCrop}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <PhiWarningBanner phiResult={phiResult} />

      {/* 作物名 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">作物名 <span className="text-red-500">*</span></h2>
        <input
          type="text"
          value={cropName}
          onChange={(e) => setCropName(e.target.value)}
          placeholder="例: サラダ菜"
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* 数量 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">収穫量 <span className="text-red-500">*</span></h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {QUANTITY_PRESETS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuantity(q)}
              className={`px-4 py-2 rounded-full border text-sm ${
                quantity === q ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="数量を入力"
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* 品質 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">品質等級</h2>
        <div className="flex gap-2">
          {QUALITIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuality(q)}
              className={`px-6 py-2 rounded-full border text-sm ${
                quality === q ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 備考 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">備考（任意）</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="メモ"
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <VoiceInput value={notes} onChange={setNotes} />
        </div>
      </div>

      {/* 保存 */}
      <div className="space-y-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => handleSave(false)}
          className={`w-full py-4 rounded-lg font-bold text-white text-lg ${
            canSave ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {saving ? '保存中...' : '保存する'}
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => handleSave(true)}
          className="w-full py-3 rounded-lg font-bold border-2 border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50"
        >
          保存して続けて記録
        </button>
      </div>
    </div>
  );
};

export default QuickHarvestForm;
