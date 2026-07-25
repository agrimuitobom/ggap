// src/pages/Compliance/Complaints.jsx
// 苦情処理記録と模擬回収（トレーサビリティ）テスト記録。
// GAP認証では、苦情を受けた際の記録・対応の仕組みと、
// 年1回程度の模擬回収テストの実施記録が求められる。
import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import VoiceInput from '../../components/common/VoiceInput';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const COMPLAINT_SOURCES = ['出荷先・取引先', '消費者', '学校内', 'その他'];
const COMPLAINT_TYPES = ['品質', '異物混入', '数量・納期', '表示', 'その他'];

const toDateString = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const chip = (active) =>
  `px-3 py-2 rounded-full border text-sm ${
    active ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'
  }`;

const Complaints = () => {
  const { userProfile } = useAuth();
  const { currentOrganization, isMember } = useOrganization();

  const [tab, setTab] = useState('complaints'); // complaints | recalls
  const [complaints, setComplaints] = useState([]);
  const [recalls, setRecalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 苦情フォーム
  const [cDate, setCDate] = useState(toDateString(new Date()));
  const [cSource, setCSource] = useState(COMPLAINT_SOURCES[0]);
  const [cType, setCType] = useState(COMPLAINT_TYPES[0]);
  const [cLot, setCLot] = useState('');
  const [cContent, setCContent] = useState('');
  const [cCause, setCCause] = useState('');
  const [cAction, setCAction] = useState('');

  // 模擬回収フォーム
  const [rDate, setRDate] = useState(toDateString(new Date()));
  const [rLot, setRLot] = useState('');
  const [rTraceTime, setRTraceTime] = useState('');
  const [rResult, setRResult] = useState('成功');
  const [rFindings, setRFindings] = useState('');

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const [cSnap, rSnap] = await Promise.all([
        getDocs(query(collection(db, 'complaints'), where('organizationId', '==', currentOrganization.id))),
        getDocs(query(collection(db, 'recallTests'), where('organizationId', '==', currentOrganization.id)))
      ]);
      const sortByDate = (list) => list.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      setComplaints(sortByDate(cSnap.docs.map((d) => ({
        id: d.id, ...d.data(), date: d.data().date?.toDate ? d.data().date.toDate() : null
      }))));
      setRecalls(sortByDate(rSnap.docs.map((d) => ({
        id: d.id, ...d.data(), date: d.data().date?.toDate ? d.data().date.toDate() : null
      }))));
    } catch (err) {
      firestoreLogger.error('苦情・回収記録の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  const handleSaveComplaint = async () => {
    if (!cContent.trim() || !currentOrganization) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'complaints'), {
        organizationId: currentOrganization.id,
        date: new Date(`${cDate}T00:00:00`),
        source: cSource,
        type: cType,
        lotNumber: cLot,
        content: cContent.trim(),
        cause: cCause,
        action: cAction,
        status: cAction ? '対応済み' : '対応中',
        recordedByName: userProfile?.name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('苦情記録を保存しました');
      setCLot(''); setCContent(''); setCCause(''); setCAction('');
      await load();
    } catch (err) {
      firestoreLogger.error('苦情記録の保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRecall = async () => {
    if (!rLot.trim() || !currentOrganization) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'recallTests'), {
        organizationId: currentOrganization.id,
        date: new Date(`${rDate}T00:00:00`),
        lotNumber: rLot.trim(),
        traceTimeMinutes: rTraceTime !== '' ? Number(rTraceTime) : null,
        result: rResult,
        findings: rFindings,
        recordedByName: userProfile?.name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('模擬回収テストを記録しました');
      setRLot(''); setRTraceTime(''); setRFindings(''); setRResult('成功');
      await load();
    } catch (err) {
      firestoreLogger.error('模擬回収テストの保存エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const markResolved = async (id) => {
    try {
      await updateDoc(doc(db, 'complaints', id), { status: '対応済み', updatedAt: serverTimestamp() });
      await load();
      toast.success('対応済みにしました');
    } catch (err) {
      firestoreLogger.error('苦情ステータスの更新エラー', { id }, err);
      toast.error('更新中にエラーが発生しました');
    }
  };

  const handleDelete = async (collectionName, id) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      await load();
      toast.success('削除しました');
    } catch (err) {
      firestoreLogger.error('記録の削除エラー', { collectionName, id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  // 直近の模擬回収テストからの経過（年1回程度の実施が望ましい）
  const lastRecall = recalls[0]?.date || null;
  const recallOverdue = !lastRecall ||
    (Date.now() - lastRecall.getTime()) > 365 * 24 * 60 * 60 * 1000;

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-24">
      <h1 className="text-2xl font-bold mb-1">📣 苦情・回収テスト記録</h1>
      <p className="text-sm text-gray-500 mb-4">
        苦情への対応記録と、トレーサビリティが機能するか確認する模擬回収テストを記録します。
      </p>

      {recallOverdue && (
        <div className="bg-amber-50 border-2 border-amber-300 text-amber-800 rounded-lg p-3 mb-4 text-sm">
          ⏰ {lastRecall
            ? `前回の模擬回収テストから1年以上経過しています（前回: ${lastRecall.toLocaleDateString('ja-JP')}）。`
            : 'まだ模擬回収テストの記録がありません。'}
          年1回程度の実施と記録が求められます。
        </div>
      )}

      <div className="flex rounded-lg overflow-hidden border border-gray-300 mb-4 w-fit">
        <button onClick={() => setTab('complaints')} className={`px-4 py-2 text-sm ${tab === 'complaints' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}>
          苦情記録
        </button>
        <button onClick={() => setTab('recalls')} className={`px-4 py-2 text-sm ${tab === 'recalls' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}>
          模擬回収テスト
        </button>
      </div>

      {tab === 'complaints' ? (
        <>
          {isMember && (
            <div className="bg-white shadow rounded-lg p-4 mb-6">
              <h2 className="font-bold mb-3">苦情を記録</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">受付日</label>
                  <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">対象ロット番号（分かれば）</label>
                  <input type="text" value={cLot} onChange={(e) => setCLot(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="例: 20260612-サラ-XXXX" />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">受付元</label>
                <div className="flex flex-wrap gap-2">
                  {COMPLAINT_SOURCES.map((s) => (
                    <button key={s} type="button" onClick={() => setCSource(s)} className={chip(cSource === s)}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">種類</label>
                <div className="flex flex-wrap gap-2">
                  {COMPLAINT_TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => setCType(t)} className={chip(cType === t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  苦情の内容 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input type="text" value={cContent} onChange={(e) => setCContent(e.target.value)} className="flex-1 border rounded px-3 py-2" placeholder="どのような苦情か" />
                  <VoiceInput value={cContent} onChange={setCContent} />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">原因の調査結果</label>
                <input type="text" value={cCause} onChange={(e) => setCCause(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="調査して分かった原因" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">対応・再発防止策</label>
                <div className="flex gap-2">
                  <input type="text" value={cAction} onChange={(e) => setCAction(e.target.value)} className="flex-1 border rounded px-3 py-2" placeholder="実施した対応と今後の防止策" />
                  <VoiceInput value={cAction} onChange={setCAction} />
                </div>
              </div>
              <button onClick={handleSaveComplaint} disabled={!cContent.trim() || saving} className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50">
                {saving ? '保存中...' : '記録する'}
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : complaints.length === 0 ? (
            <p className="text-sm text-gray-500">苦情の記録はありません。</p>
          ) : (
            <div className="bg-white shadow rounded-lg divide-y">
              {complaints.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="text-gray-500">{c.date?.toLocaleDateString('ja-JP')}</span>
                        <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{c.source}</span>
                        <span className="ml-1 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{c.type}</span>
                        <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                          c.status === '対応済み' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>{c.status}</span>
                      </p>
                      <p className="font-medium mt-1">{c.content}</p>
                      {c.lotNumber && <p className="text-xs text-gray-500 font-mono">ロット: {c.lotNumber}</p>}
                      {c.cause && <p className="text-xs text-gray-600 mt-1">原因: {c.cause}</p>}
                      {c.action && <p className="text-xs text-gray-600">対応: {c.action}</p>}
                    </div>
                    {isMember && (
                      <div className="shrink-0 ml-3 flex flex-col gap-1 items-end">
                        {c.status !== '対応済み' && (
                          <button onClick={() => markResolved(c.id)} className="text-green-700 hover:text-green-900 text-xs">対応済みにする</button>
                        )}
                        <button onClick={() => handleDelete('complaints', c.id)} className="text-red-600 hover:text-red-800 text-xs">削除</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {isMember && (
            <div className="bg-white shadow rounded-lg p-4 mb-6">
              <h2 className="font-bold mb-1">模擬回収テストを記録</h2>
              <p className="text-xs text-gray-500 mb-3">
                出荷済みのロットを1つ選び、「そのロットがどの圃場・いつの収穫で、どこへ出荷されたか」を
                実際にたどってみる訓練です。かかった時間と、たどれたかどうかを記録します。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">実施日</label>
                  <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    対象ロット番号 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={rLot} onChange={(e) => setRLot(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="追跡したロット番号" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">追跡にかかった時間（分）</label>
                  <input type="number" min="0" value={rTraceTime} onChange={(e) => setRTraceTime(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="例: 15" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">結果</label>
                  <div className="flex gap-2">
                    {['成功', '一部不十分', '失敗'].map((r) => (
                      <button key={r} type="button" onClick={() => setRResult(r)} className={chip(rResult === r)}>{r}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">気づいた点・改善事項</label>
                <div className="flex gap-2">
                  <input type="text" value={rFindings} onChange={(e) => setRFindings(e.target.value)} className="flex-1 border rounded px-3 py-2" placeholder="例: 出荷先の記録が一部空欄だった" />
                  <VoiceInput value={rFindings} onChange={setRFindings} />
                </div>
              </div>
              <button onClick={handleSaveRecall} disabled={!rLot.trim() || saving} className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50">
                {saving ? '保存中...' : '記録する'}
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : recalls.length === 0 ? (
            <p className="text-sm text-gray-500">模擬回収テストの記録はありません。</p>
          ) : (
            <div className="bg-white shadow rounded-lg divide-y">
              {recalls.map((r) => (
                <div key={r.id} className="p-4 flex items-start justify-between">
                  <div>
                    <p className="text-sm">
                      <span className="text-gray-500">{r.date?.toLocaleDateString('ja-JP')}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        r.result === '成功' ? 'bg-green-100 text-green-800'
                          : r.result === '失敗' ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>{r.result}</span>
                    </p>
                    <p className="font-mono text-xs mt-1">ロット: {r.lotNumber}</p>
                    {r.traceTimeMinutes != null && <p className="text-xs text-gray-600">追跡時間: {r.traceTimeMinutes}分</p>}
                    {r.findings && <p className="text-xs text-gray-600">気づき: {r.findings}</p>}
                  </div>
                  {isMember && (
                    <button onClick={() => handleDelete('recallTests', r.id)} className="text-red-600 hover:text-red-800 text-xs shrink-0 ml-3">削除</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Complaints;
