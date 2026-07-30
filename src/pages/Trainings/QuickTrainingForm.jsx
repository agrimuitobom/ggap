// src/pages/Trainings/QuickTrainingForm.jsx
// 教育訓練の実施記録をワンタップで残す画面。
//
// 紙では「名簿に一人ずつハンコ」だったものを、
// 「項目をタップ → 受講者（学年・班）をタップ → 記録」の3手で終わるようにする。
// 実施者はログイン中のアカウントを自動で記録するため、押印の代わりになる。
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  DEFAULT_AUDIENCES,
  getTrainingItems,
  seedDefaultTrainingItems
} from '../../services/trainingItemService';
import { getWorkers } from '../../services/workerService';
import VoiceInput from '../../components/common/VoiceInput';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

// 実施内容の定型文（毎回入力しなくて済むように）
const CONTENT_PRESETS = [
  '実習前に本時の作業手順・注意点・危険性・対処法を説明した',
  '健康チェック（体調・手指の傷の有無）を実施した',
  '身だしなみ・服装の確認を行った',
  '実習記録簿を確認し、感想をもとに話し合いを行った'
];

const chip = (active) =>
  `px-4 py-2 rounded-full border text-sm ${
    active ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
  }`;

const QuickTrainingForm = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { currentOrganization } = useOrganization();

  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const [dateStr, setDateStr] = useState(toDateString(new Date()));
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [audiences, setAudiences] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [absentIds, setAbsentIds] = useState([]);
  const [content, setContent] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [showRoster, setShowRoster] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [itemList, groupSnap, workerList] = await Promise.all([
        getTrainingItems(currentOrganization.id),
        getDocs(query(collection(db, 'groups'), where('organizationId', '==', currentOrganization.id))),
        getWorkers(currentOrganization.id, currentUser?.uid)
      ]);
      setItems(itemList.filter((i) => i.active !== false));
      setGroups(groupSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setWorkers(workerList);
    } catch (err) {
      firestoreLogger.error('教育訓練データの取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, currentUser]);

  useEffect(() => { load(); }, [load]);

  const handleSeed = async () => {
    if (!currentOrganization) return;
    setSeeding(true);
    try {
      await seedDefaultTrainingItems(currentOrganization.id);
      await load();
      toast.success('教育訓練計画の項目①〜⑩を読み込みました');
    } catch (err) {
      firestoreLogger.error('訓練項目の登録エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('登録中にエラーが発生しました');
    } finally {
      setSeeding(false);
    }
  };

  const toggle = (list, setList, value) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  // 班（グループ）を選ぶと、その名簿から欠席者だけを外す方式にする
  const selectedGroup = groups.find((g) => g.id === groupId);
  const rosterIds = selectedGroup?.members || [];
  const rosterWorkers = workers.filter((w) => rosterIds.includes(w.id));
  const attendeeWorkers = rosterWorkers.filter((w) => !absentIds.includes(w.id));

  const selectedItems = items.filter((i) => selectedItemIds.includes(i.id));
  const canSave = selectedItemIds.length > 0 && (audiences.length > 0 || groupId) && !saving;

  const resetForNext = () => {
    setSelectedItemIds([]);
    setContent('');
    setNotes('');
    setDuration('');
    setAbsentIds([]);
  };

  const handleSave = async (continueAfter) => {
    if (!canSave || !currentOrganization) return;
    setSaving(true);
    try {
      // 受講者の表示名: 班を選んでいれば出席者名、そうでなければ学年区分
      const audienceLabel = [
        ...audiences,
        ...(selectedGroup ? [selectedGroup.name] : [])
      ].join('・');

      await addDoc(collection(db, 'trainings'), {
        organizationId: currentOrganization.id,
        trainingDate: new Date(`${dateStr}T00:00:00`),
        // 計画の項目との紐づけ（実施状況の集計に使う）
        itemIds: selectedItemIds,
        itemTitles: selectedItems.map((i) => `${i.code || ''}${i.title}`),
        // 一覧での見出し
        title: selectedItems.map((i) => `${i.code || ''}${i.title}`).join('、'),
        category: selectedItems[0]?.title || '',
        // 受講者（学年区分と、班を使う場合は個人名も）
        audiences,
        groupId: groupId || null,
        groupName: selectedGroup?.name || '',
        audienceLabel,
        attendeeIds: attendeeWorkers.map((w) => w.id),
        attendeeNames: attendeeWorkers.map((w) => w.name),
        participants: attendeeWorkers.map((w) => w.name), // 既存の一覧表示との互換
        absentIds,
        absentNames: rosterWorkers.filter((w) => absentIds.includes(w.id)).map((w) => w.name),
        absentFollowUpNote: '',
        absentFollowUpAt: null,
        // 実施内容と実施者（押印の代わりになる記録）
        description: content,
        duration: duration !== '' ? Number(duration) : null,
        notes,
        instructor: userProfile?.name || '',
        instructorType: 'internal',
        status: '実施済み',
        recordedByUid: currentUser?.uid || null,
        recordedByName: userProfile?.name || '',
        // 責任者による確認（紙の「責任者確認印」に相当）
        approvedByUid: null,
        approvedByName: '',
        approvedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('教育訓練を記録しました');
      if (continueAfter) {
        setSavedCount((c) => c + 1);
        resetForNext();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/trainings');
      }
    } catch (err) {
      firestoreLogger.error('教育訓練記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">⚡ 教育訓練の記録</h1>
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  // 訓練項目が未登録の場合は、まず計画の読み込みを促す
  if (items.length === 0) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">⚡ 教育訓練の記録</h1>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-5xl mb-3">📚</div>
          <p className="text-gray-600 mb-2">教育訓練の項目がまだ登録されていません。</p>
          <p className="text-sm text-gray-500 mb-6">
            教育訓練計画の項目①〜⑩をすぐに読み込めます。あとから自由に追加・編集できます。
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-6 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50"
            >
              {seeding ? '読み込み中...' : '計画の項目①〜⑩を読み込む'}
            </button>
            <Link to="/trainings/items" className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded hover:bg-gray-300">
              自分で項目を作る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl pb-24">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">⚡ 教育訓練の記録</h1>
        <Link to="/trainings/items" className="text-sm text-blue-600 hover:text-blue-800 underline">
          項目を編集
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        実施した項目と受講者を選ぶだけで記録できます。実施者はログイン中のあなたが自動で記録されます。
      </p>

      {savedCount > 0 && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-green-800">✓ {savedCount}件記録しました。続けて記録できます。</span>
          <Link to="/trainings" className="shrink-0 ml-3 px-3 py-2 text-sm bg-white border border-green-400 text-green-700 rounded hover:bg-green-100">
            一覧へ
          </Link>
        </div>
      )}

      {/* 日付 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">実施日</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDateStr(toDateString(new Date()))}
            className={chip(dateStr === toDateString(new Date()))}
          >
            今日
          </button>
          <input
            type="date"
            value={dateStr}
            max={toDateString(new Date())}
            onChange={(e) => setDateStr(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* 1. 実施項目 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-1">
          1. 何を指導した？ <span className="text-red-500">*</span>
        </h2>
        <p className="text-xs text-gray-500 mb-3">複数選べます（{selectedItemIds.length}件選択中）</p>
        <div className="space-y-2">
          {items.map((item) => {
            const active = selectedItemIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(selectedItemIds, setSelectedItemIds, item.id)}
                className={`w-full flex items-center p-3 rounded-lg border-2 text-left transition-colors ${
                  active ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <span className={`shrink-0 w-7 h-7 rounded-md border-2 flex items-center justify-center mr-3 text-sm ${
                  active ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'
                }`}>
                  {active ? '✓' : ''}
                </span>
                <span className="flex-1">
                  <span className="text-sm font-medium">
                    {item.code && <span className="text-gray-500 mr-1">{item.code}</span>}
                    {item.title}
                  </span>
                  {item.frequency && (
                    <span className="block text-xs text-gray-500">{item.frequency}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 受講者 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-1">
          2. だれに？ <span className="text-red-500">*</span>
        </h2>
        <p className="text-xs text-gray-500 mb-3">学年・区分をタップします（複数選択可）</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {DEFAULT_AUDIENCES.map((a) => (
            <button key={a} type="button" onClick={() => toggle(audiences, setAudiences, a)} className={chip(audiences.includes(a))}>
              {a}
            </button>
          ))}
        </div>

        {groups.length > 0 && (
          <>
            <p className="text-xs text-gray-500 mb-2">
              班（グループ）で記録する場合は選択してください。名簿の全員が出席として扱われます。
            </p>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    const next = groupId === g.id ? '' : g.id;
                    setGroupId(next);
                    setAbsentIds([]);
                    setShowRoster(!!next);
                  }}
                  className={chip(groupId === g.id)}
                >
                  {g.name}（{g.memberCount || g.members?.length || 0}名）
                </button>
              ))}
            </div>
          </>
        )}

        {/* 欠席者だけを外す（全員出席が基本） */}
        {selectedGroup && rosterWorkers.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <button
              type="button"
              onClick={() => setShowRoster(!showRoster)}
              className="w-full flex items-center justify-between text-sm font-bold text-gray-700"
            >
              <span>
                出席 {attendeeWorkers.length}名 / {rosterWorkers.length}名
                {absentIds.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full">
                    欠席 {absentIds.length}名
                  </span>
                )}
              </span>
              <span className="text-gray-400">{showRoster ? '▲' : '▼'}</span>
            </button>
            {showRoster && (
              <>
                <p className="text-xs text-gray-500 mt-2 mb-2">
                  欠席した人だけをタップしてください（タップすると欠席になります）
                </p>
                <div className="flex flex-wrap gap-2">
                  {rosterWorkers.map((w) => {
                    const absent = absentIds.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggle(absentIds, setAbsentIds, w.id)}
                        className={`px-3 py-2 rounded-full border text-sm ${
                          absent
                            ? 'border-amber-500 bg-amber-100 text-amber-800 line-through'
                            : 'border-green-600 bg-green-50 text-green-800'
                        }`}
                      >
                        {absent ? '欠 ' : '✓ '}{w.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. 実施内容 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">3. どのように指導した？（任意）</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {CONTENT_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setContent(content ? `${content} / ${p}` : p)}
              className="px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-700 text-xs hover:bg-gray-50"
            >
              ＋ {p.length > 18 ? `${p.slice(0, 18)}…` : p}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mb-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows="2"
            className="flex-1 border rounded px-3 py-2"
            placeholder="上のボタンから定型文を入れるか、自由に記入できます"
          />
          <VoiceInput value={content} onChange={setContent} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">所要時間</label>
          <input
            type="number"
            min="0"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-24 border rounded px-3 py-2"
            placeholder="10"
          />
          <span className="text-sm text-gray-500">分</span>
        </div>
      </div>

      {/* 特記事項 */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">特記事項・気づき（任意）</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
            placeholder="例: 生徒から体調不良の申し出があり、休憩を取らせた"
          />
          <VoiceInput value={notes} onChange={setNotes} />
        </div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => handleSave(false)}
          className={`w-full py-4 rounded-lg font-bold text-white text-lg ${
            canSave ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {saving ? '記録中...' : '記録する'}
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => handleSave(true)}
          className="w-full py-3 rounded-lg font-bold border-2 border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50"
        >
          記録して続けて入力
        </button>
      </div>
    </div>
  );
};

export default QuickTrainingForm;
