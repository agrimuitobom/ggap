// src/pages/Water/WaterManagement.jsx
// 水源の登録と水質検査記録。
// GAP認証では「灌水・養液に使う水」と「収穫物や器具の洗浄に使う水」について、
// 水源の特定・リスク評価・水質検査結果の保管が求められる。
import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const SOURCE_TYPES = ['水道水', '井戸水', '雨水', '河川・用水路', 'ため池', 'その他'];
const USAGES = ['養液・灌水', '収穫物の洗浄', '器具の洗浄', '手洗い'];
const RISK_LEVELS = ['低', '中', '高'];
// 一般的な検査項目（用途に応じて選択）
const TEST_ITEMS = ['一般細菌', '大腸菌群', '大腸菌', 'pH', '硝酸態窒素', '重金属', 'その他'];

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const WaterManagement = () => {
  const { userProfile } = useAuth();
  const { currentOrganization, isMember } = useOrganization();

  const [sources, setSources] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tests'); // tests | sources
  const [saving, setSaving] = useState(false);

  // 水源フォーム
  const [srcName, setSrcName] = useState('');
  const [srcType, setSrcType] = useState('水道水');
  const [srcUsages, setSrcUsages] = useState([]);
  const [srcRisk, setSrcRisk] = useState('低');
  const [srcRiskNote, setSrcRiskNote] = useState('');

  // 検査フォーム
  const [testSourceId, setTestSourceId] = useState('');
  const [testDate, setTestDate] = useState(toDateString(new Date()));
  const [testItems, setTestItems] = useState([]);
  const [testResult, setTestResult] = useState('');
  const [testJudgement, setTestJudgement] = useState('適合');
  const [testAgency, setTestAgency] = useState('');
  const [nextTestDate, setNextTestDate] = useState('');

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [srcSnap, testSnap] = await Promise.all([
        getDocs(query(collection(db, 'waterSources'), where('organizationId', '==', currentOrganization.id))),
        getDocs(query(collection(db, 'waterTests'), where('organizationId', '==', currentOrganization.id)))
      ]);
      setSources(srcSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const testList = testSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        testDate: d.data().testDate?.toDate ? d.data().testDate.toDate() : null
      }));
      testList.sort((a, b) => (b.testDate?.getTime() || 0) - (a.testDate?.getTime() || 0));
      setTests(testList);
    } catch (err) {
      firestoreLogger.error('水管理データの取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  const toggleIn = (list, setList, value) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleSaveSource = async () => {
    if (!srcName.trim() || !currentOrganization) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'waterSources'), {
        organizationId: currentOrganization.id,
        name: srcName.trim(),
        type: srcType,
        usages: srcUsages,
        riskLevel: srcRisk,
        riskNote: srcRiskNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('水源を登録しました');
      setSrcName(''); setSrcUsages([]); setSrcRiskNote(''); setSrcRisk('低');
      await load();
    } catch (err) {
      firestoreLogger.error('水源の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTest = async () => {
    if (!testSourceId || !currentOrganization) return;
    setSaving(true);
    try {
      const source = sources.find((s) => s.id === testSourceId);
      await addDoc(collection(db, 'waterTests'), {
        organizationId: currentOrganization.id,
        waterSourceId: testSourceId,
        waterSourceName: source?.name || '',
        testDate: new Date(`${testDate}T00:00:00`),
        testItems,
        result: testResult,
        judgement: testJudgement,
        agency: testAgency,
        nextTestDate: nextTestDate ? new Date(`${nextTestDate}T00:00:00`) : null,
        recordedByName: userProfile?.name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('水質検査結果を記録しました');
      setTestItems([]); setTestResult(''); setTestAgency(''); setNextTestDate(''); setTestJudgement('適合');
      await load();
    } catch (err) {
      firestoreLogger.error('水質検査の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (collectionName, id) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast.success('削除しました');
      await load();
    } catch (err) {
      firestoreLogger.error('水管理データの削除エラー', { collectionName, id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  // 次回検査が近い/超過している水源を警告
  const today = new Date();
  const overdueTests = tests.filter((t) => {
    const next = t.nextTestDate?.toDate ? t.nextTestDate.toDate() : null;
    return next && next < today;
  });

  const chip = (active) =>
    `px-3 py-2 rounded-full border text-sm ${
      active ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
    }`;

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-24">
      <h1 className="text-2xl font-bold mb-1">🚰 水源・水質管理</h1>
      <p className="text-sm text-gray-500 mb-4">
        灌水・養液や洗浄に使う水の水源を登録し、水質検査の結果を記録します。
      </p>

      {overdueTests.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 text-red-800 rounded-lg p-3 mb-4 text-sm">
          ⚠️ 次回検査予定日を過ぎている水源があります（
          {[...new Set(overdueTests.map((t) => t.waterSourceName))].join('、')}）。
          検査を実施し、結果を記録してください。
        </div>
      )}

      <div className="flex rounded-lg overflow-hidden border border-gray-300 mb-4 w-fit">
        <button
          onClick={() => setTab('tests')}
          className={`px-4 py-2 text-sm ${tab === 'tests' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
        >
          水質検査記録
        </button>
        <button
          onClick={() => setTab('sources')}
          className={`px-4 py-2 text-sm ${tab === 'sources' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
        >
          水源の登録
        </button>
      </div>

      {tab === 'sources' ? (
        <>
          {isMember && (
            <div className="bg-white shadow rounded-lg p-4 mb-6">
              <h2 className="font-bold mb-3">水源を登録</h2>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  水源の名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={srcName}
                  onChange={(e) => setSrcName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="例: 水耕ハウス給水栓"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">種類</label>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => setSrcType(t)} className={chip(srcType === t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">用途（複数選択可）</label>
                <div className="flex flex-wrap gap-2">
                  {USAGES.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => toggleIn(srcUsages, setSrcUsages, u)}
                      className={chip(srcUsages.includes(u))}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">リスク評価</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {RISK_LEVELS.map((r) => (
                    <button key={r} type="button" onClick={() => setSrcRisk(r)} className={chip(srcRisk === r)}>
                      リスク{r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={srcRiskNote}
                  onChange={(e) => setSrcRiskNote(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="例: 上水道のため汚染リスクは低い。年1回の水質検査で確認。"
                />
              </div>
              <button
                onClick={handleSaveSource}
                disabled={!srcName.trim() || saving}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '登録する'}
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : sources.length === 0 ? (
            <p className="text-sm text-gray-500">水源がまだ登録されていません。</p>
          ) : (
            <div className="bg-white shadow rounded-lg divide-y">
              {sources.map((s) => (
                <div key={s.id} className="p-4 flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      {s.name}
                      <span className="ml-2 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{s.type}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        s.riskLevel === '高' ? 'bg-red-100 text-red-800'
                          : s.riskLevel === '中' ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        リスク{s.riskLevel || '低'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      用途: {s.usages?.length ? s.usages.join('、') : '未設定'}
                    </p>
                    {s.riskNote && <p className="text-xs text-gray-500">{s.riskNote}</p>}
                  </div>
                  {isMember && (
                    <button onClick={() => handleDelete('waterSources', s.id)} className="text-red-600 hover:text-red-800 text-sm shrink-0 ml-3">
                      削除
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {isMember && (
            <div className="bg-white shadow rounded-lg p-4 mb-6">
              <h2 className="font-bold mb-3">水質検査結果を記録</h2>
              {sources.length === 0 ? (
                <p className="text-sm text-gray-500">
                  先に「水源の登録」タブから水源を登録してください。
                </p>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      対象の水源 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {sources.map((s) => (
                        <button key={s.id} type="button" onClick={() => setTestSourceId(s.id)} className={chip(testSourceId === s.id)}>
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">検査日</label>
                      <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">次回検査予定日</label>
                      <input type="date" value={nextTestDate} onChange={(e) => setNextTestDate(e.target.value)} className="w-full border rounded px-3 py-2" />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-bold text-gray-700 mb-1">検査項目（複数選択可）</label>
                    <div className="flex flex-wrap gap-2">
                      {TEST_ITEMS.map((t) => (
                        <button key={t} type="button" onClick={() => toggleIn(testItems, setTestItems, t)} className={chip(testItems.includes(t))}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-bold text-gray-700 mb-1">検査結果</label>
                    <input
                      type="text"
                      value={testResult}
                      onChange={(e) => setTestResult(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      placeholder="例: 大腸菌 不検出、一般細菌 30 CFU/mL"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">判定</label>
                      <div className="flex gap-2">
                        {['適合', '不適合'].map((j) => (
                          <button key={j} type="button" onClick={() => setTestJudgement(j)} className={chip(testJudgement === j)}>
                            {j}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">検査機関</label>
                      <input
                        type="text"
                        value={testAgency}
                        onChange={(e) => setTestAgency(e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        placeholder="例: ○○検査センター"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveTest}
                    disabled={!testSourceId || saving}
                    className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '記録する'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    ※ 検査成績書（紙・PDF）は原本を保管してください。ここでは結果の要点を記録します。
                  </p>
                </>
              )}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : tests.length === 0 ? (
            <p className="text-sm text-gray-500">まだ水質検査の記録がありません。</p>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-3 text-left whitespace-nowrap">検査日</th>
                    <th className="py-2 px-3 text-left whitespace-nowrap">水源</th>
                    <th className="py-2 px-3 text-left whitespace-nowrap">項目</th>
                    <th className="py-2 px-3 text-left">結果</th>
                    <th className="py-2 px-3 text-left whitespace-nowrap">判定</th>
                    <th className="py-2 px-3 text-left whitespace-nowrap">次回予定</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((t) => {
                    const next = t.nextTestDate?.toDate ? t.nextTestDate.toDate() : null;
                    return (
                      <tr key={t.id} className={`border-t ${t.judgement === '不適合' ? 'bg-red-50' : ''}`}>
                        <td className="py-2 px-3 whitespace-nowrap">{t.testDate?.toLocaleDateString('ja-JP') || '-'}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{t.waterSourceName || '-'}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{t.testItems?.join('、') || '-'}</td>
                        <td className="py-2 px-3 max-w-xs truncate" title={t.result}>{t.result || '-'}</td>
                        <td className={`py-2 px-3 whitespace-nowrap ${t.judgement === '不適合' ? 'text-red-600 font-bold' : 'text-green-700'}`}>
                          {t.judgement || '-'}
                        </td>
                        <td className={`py-2 px-3 whitespace-nowrap ${next && next < today ? 'text-red-600 font-bold' : ''}`}>
                          {next ? next.toLocaleDateString('ja-JP') : '-'}
                        </td>
                        <td className="py-2 px-3">
                          {isMember && (
                            <button onClick={() => handleDelete('waterTests', t.id)} className="text-red-600 hover:text-red-800 text-xs">
                              削除
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WaterManagement;
