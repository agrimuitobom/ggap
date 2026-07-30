// src/pages/Biodiversity/BiodiversitySurveyForm.jsx
// 生物多様性の定期観察（観察日誌）の入力。
// 見つけた生きものを1件ずつ追加していく形にし、生徒でも記録しやすくする。
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  SURVEY_AREAS,
  SPECIES_CATEGORIES,
  ABUNDANCE_LEVELS,
  WEATHER_OPTIONS,
  getBiodiversitySurvey,
  getBiodiversitySurveys,
  saveBiodiversitySurvey,
  collectSpeciesNames
} from '../../services/biodiversityService';
import VoiceInput from '../../components/common/VoiceInput';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const chip = (active) =>
  `px-4 py-2 rounded-full border text-sm ${
    active ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
  }`;

const BiodiversitySurveyForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { currentOrganization } = useOrganization();
  const isEditMode = !!id;

  const [surveyDate, setSurveyDate] = useState(toDateString(new Date()));
  const [area, setArea] = useState(SURVEY_AREAS[1]); // 温室周辺を初期値に
  const [weather, setWeather] = useState('晴れ');
  const [surveyorNames, setSurveyorNames] = useState('');
  const [notes, setNotes] = useState('');
  const [observations, setObservations] = useState([]);
  const [knownSpecies, setKnownSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 追加中の1件
  const [category, setCategory] = useState('植物');
  const [speciesName, setSpeciesName] = useState('');
  const [count, setCount] = useState('');
  const [abundance, setAbundance] = useState('');
  const [obsNote, setObsNote] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!currentOrganization) return;
      try {
        setLoading(true);
        // 過去の記録から種名の候補を作る（表記ゆれを防ぐ）
        const all = await getBiodiversitySurveys(currentOrganization.id);
        setKnownSpecies(collectSpeciesNames(all));

        if (isEditMode) {
          const s = await getBiodiversitySurvey(id);
          if (!s) {
            toast.error('指定された調査記録が見つかりません');
            navigate('/biodiversity');
            return;
          }
          setSurveyDate(s.surveyDate ? toDateString(s.surveyDate) : toDateString(new Date()));
          setArea(s.area || SURVEY_AREAS[1]);
          setWeather(s.weather || '');
          setSurveyorNames(s.surveyorNames || '');
          setNotes(s.notes || '');
          setObservations(s.observations || []);
        }
      } catch (err) {
        firestoreLogger.error('生物多様性調査の読み込みエラー', { surveyId: id }, err);
        toast.error('データの取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentOrganization, id, isEditMode, navigate]);

  const addObservation = () => {
    if (!speciesName.trim()) {
      toast.error('種名を入力してください');
      return;
    }
    setObservations((prev) => [
      ...prev,
      {
        category,
        speciesName: speciesName.trim(),
        count: count !== '' ? Number(count) : null,
        abundance,
        note: obsNote
      }
    ]);
    setSpeciesName('');
    setCount('');
    setAbundance('');
    setObsNote('');
  };

  const removeObservation = (index) => {
    setObservations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!currentOrganization) return;
    if (observations.length === 0 &&
      !window.confirm('観察した生きものが1件も記録されていません。このまま保存しますか？')) {
      return;
    }
    setSaving(true);
    try {
      await saveBiodiversitySurvey(currentOrganization.id, id, {
        surveyDate, area, weather, surveyorNames, observations, notes,
        recordedByName: userProfile?.name || ''
      });
      toast.success(isEditMode ? '調査記録を更新しました' : '調査記録を保存しました');
      navigate('/biodiversity');
    } catch (err) {
      firestoreLogger.error('生物多様性調査の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">生物多様性の観察</h1>
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl pb-24">
      <h1 className="text-2xl font-bold mb-1">🦋 {isEditMode ? '観察記録の編集' : '生物多様性の観察'}</h1>
      <p className="text-sm text-gray-500 mb-4">
        温室周辺や学校敷地内で見つけた植物・昆虫・鳥などを記録します（年2回の定期観察）。
      </p>

      {/* 調査の基本情報 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">観察日</label>
            <input
              type="date"
              value={surveyDate}
              max={toDateString(new Date())}
              onChange={(e) => setSurveyDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">天気</label>
            <div className="flex gap-2">
              {WEATHER_OPTIONS.map((w) => (
                <button key={w} type="button" onClick={() => setWeather(w)} className={chip(weather === w)}>
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">観察した場所</label>
          <div className="flex flex-wrap gap-2">
            {SURVEY_AREAS.map((a) => (
              <button key={a} type="button" onClick={() => setArea(a)} className={chip(area === a)}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">観察した人</label>
          <input
            type="text"
            value={surveyorNames}
            onChange={(e) => setSurveyorNames(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="例: 3年A組 生物部（4名）"
          />
        </div>
      </div>

      {/* 生きものの追加 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="font-bold mb-3">見つけた生きものを追加</h2>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">分類</label>
          <div className="flex flex-wrap gap-2">
            {SPECIES_CATEGORIES.map((c) => (
              <button key={c.key} type="button" onClick={() => setCategory(c.key)} className={chip(category === c.key)}>
                {c.icon} {c.key}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">
            種名 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              list="known-species"
              value={speciesName}
              onChange={(e) => setSpeciesName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addObservation(); } }}
              className="flex-1 border rounded px-3 py-2"
              placeholder="例: ナナホシテントウ、スズメ、タンポポ"
            />
            <VoiceInput value={speciesName} onChange={setSpeciesName} />
          </div>
          <datalist id="known-species">
            {knownSpecies.map((n) => <option key={n} value={n} />)}
          </datalist>
          <p className="text-xs text-gray-500 mt-1">
            種名が分からない場合は「テントウムシの仲間」のように分かる範囲で記入します。
            過去に記録した種名は候補に出るので、同じ書き方を選んでください。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">個体数（数えられた場合）</label>
            <input
              type="number"
              min="0"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="例: 3"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">多さの目安</label>
            <div className="flex gap-2">
              {ABUNDANCE_LEVELS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAbundance(abundance === a ? '' : a)}
                  className={chip(abundance === a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">気づいたこと</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={obsNote}
              onChange={(e) => setObsNote(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
              placeholder="例: 花壇のマリーゴールドに集まっていた"
            />
            <VoiceInput value={obsNote} onChange={setObsNote} />
          </div>
        </div>

        <button
          type="button"
          onClick={addObservation}
          className="w-full py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700"
        >
          ＋ この生きものを記録に追加
        </button>
      </div>

      {/* 追加済みの一覧 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="font-bold mb-3">
          今回の観察記録
          <span className="ml-2 text-sm font-normal text-gray-500">{observations.length}件</span>
        </h2>
        {observations.length === 0 ? (
          <p className="text-sm text-gray-500">まだ追加されていません。上のフォームから追加してください。</p>
        ) : (
          <ul className="divide-y">
            {observations.map((o, i) => {
              const cat = SPECIES_CATEGORIES.find((c) => c.key === o.category);
              return (
                <li key={i} className="py-2 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {cat?.icon} {o.speciesName}
                      {o.count != null && <span className="ml-2 text-gray-600">{o.count}個体</span>}
                      {o.abundance && <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{o.abundance}</span>}
                    </p>
                    {o.note && <p className="text-xs text-gray-500">{o.note}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeObservation(i)}
                    className="text-red-600 hover:text-red-800 text-sm shrink-0 ml-3"
                  >
                    削除
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 全体の所感 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-1">全体の気づき・所感</label>
        <div className="flex gap-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="3"
            className="flex-1 border rounded px-3 py-2"
            placeholder="例: 前回よりチョウの種類が増えていた。花壇の整備が効いているかもしれない。"
          />
          <VoiceInput value={notes} onChange={setNotes} />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-4 rounded-lg font-bold text-white text-lg bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? '保存中...' : isEditMode ? '更新する' : '記録を保存する'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/biodiversity')}
          className="px-6 py-4 rounded-lg font-bold bg-gray-200 text-gray-700 hover:bg-gray-300"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
};

export default BiodiversitySurveyForm;
