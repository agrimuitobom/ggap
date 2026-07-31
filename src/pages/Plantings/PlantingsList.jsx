// src/pages/Plantings/PlantingsList.jsx
// 作付（栽培サイクル・処理区）の一覧。
// 作物×作次でまとめて表示し、処理区と反復の構成が一目で分かるようにする。
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { getPlantings, deletePlanting } from '../../services/plantingService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const STATUS_STYLE = {
  '栽培中': 'bg-green-100 text-green-800',
  '収穫完了': 'bg-gray-200 text-gray-700',
  '中止': 'bg-red-100 text-red-800'
};

const TREATMENT_STYLE = {
  '慣行区': 'bg-blue-100 text-blue-800',
  '減肥区': 'bg-purple-100 text-purple-800',
  'その他': 'bg-gray-100 text-gray-700'
};

const PlantingsList = () => {
  const navigate = useNavigate();
  const { currentOrganization, isMember } = useOrganization();
  const { userProfile } = useAuth();
  const [plantings, setPlantings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      setPlantings(await getPlantings(currentOrganization.id));
    } catch (err) {
      firestoreLogger.error('作付一覧の取得エラー', { organizationId: currentOrganization?.id }, err);
      toast.error('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (e, p) => {
    e.stopPropagation();
    if (!window.confirm(`「${p.cropName} 第${p.cropCycle || '-'}作 ${p.treatment || ''}${p.replicate ? `-${p.replicate}` : ''}」を削除しますか？`)) return;
    try {
      await deletePlanting(p.id, currentOrganization.id, userProfile?.name);
      setPlantings((prev) => prev.filter((x) => x.id !== p.id));
      toast.success('削除しました');
    } catch (err) {
      firestoreLogger.error('作付の削除エラー', { plantingId: p.id }, err);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const visible = showCompleted ? plantings : plantings.filter((p) => p.status === '栽培中');

  // 作物 × 作次 × 圃場 でグループ化して実験の構成を見せる
  const groups = [];
  visible.forEach((p) => {
    const key = `${p.cropName}|${p.cropCycle || ''}|${p.fieldName || ''}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, cropName: p.cropName, cropCycle: p.cropCycle, fieldName: p.fieldName, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  });

  return (
    <div className="container mx-auto p-4 max-w-4xl pb-24">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
        <h1 className="text-2xl font-bold">🌱 作付・処理区</h1>
        {isMember && (
          <Link to="/plantings/new" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-center">
            ＋ 作付を登録
          </Link>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">
        作付ごとに収穫・作業の記録を紐づけることで、第1作/第2作や処理区どうしを比較できます。
      </p>

      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="h-4 w-4" />
        収穫完了・中止も表示する
      </label>

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-5xl mb-3">🌱</div>
          <p className="text-gray-600 mb-1">
            {plantings.length === 0 ? 'まだ作付が登録されていません。' : '表示する作付がありません。'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            比較実験をする場合は、登録画面で「処理区と反復をまとめて作成」を使うと便利です。
          </p>
          {isMember && (
            <Link to="/plantings/new" className="inline-block px-6 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700">
              最初の作付を登録する
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            // グループ内の処理区の構成を集計
            const byTreatment = {};
            g.items.forEach((p) => {
              const t = p.treatment || '未設定';
              byTreatment[t] = (byTreatment[t] || 0) + 1;
            });
            const totalPlants = g.items.reduce((s, p) => s + (p.plantCount || 0), 0);

            return (
              <div key={g.key} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-3">
                  <h2 className="font-bold">
                    {g.cropName}
                    {g.cropCycle ? ` 第${g.cropCycle}作` : ''}
                    <span className="ml-2 text-sm font-normal text-gray-600">@ {g.fieldName || '-'}</span>
                  </h2>
                  <p className="text-xs text-gray-600 mt-1">
                    {Object.entries(byTreatment).map(([t, n]) => `${t}×${n}`).join(' ・ ')}
                    {totalPlants > 0 && ` ・ 合計 ${totalPlants} 株`}
                  </p>
                </div>
                <div className="divide-y">
                  {g.items.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/plantings/edit/${p.id}`)}
                      className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${TREATMENT_STYLE[p.treatment] || 'bg-gray-100 text-gray-700'}`}>
                            {p.treatment || '処理区未設定'}
                          </span>
                          {p.replicate && <span className="ml-2 text-gray-600">反復{p.replicate}</span>}
                          {p.block && <span className="ml-1 text-gray-400 text-xs">(ブロック{p.block})</span>}
                          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${STATUS_STYLE[p.status] || ''}`}>
                            {p.status}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {p.plantingDate ? `定植 ${p.plantingDate.toLocaleDateString('ja-JP')}` :
                            p.sowingDate ? `播種 ${p.sowingDate.toLocaleDateString('ja-JP')}` : '日付未設定'}
                          {p.plotArea ? ` ・ ${p.plotArea}m²` : ''}
                          {p.plantCount ? ` ・ ${p.plantCount}株` : ''}
                          {p.targetEc ? ` ・ 目標EC ${p.targetEc}` : ''}
                          {p.targetNitrogen ? ` ・ 目標N ${p.targetNitrogen}g/m²` : ''}
                        </p>
                        {p.treatmentDetail && (
                          <p className="text-xs text-gray-500">{p.treatmentDetail}</p>
                        )}
                      </div>
                      {isMember && (
                        <button
                          onClick={(e) => handleDelete(e, p)}
                          className="text-red-600 hover:text-red-800 text-sm shrink-0 ml-3"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlantingsList;
