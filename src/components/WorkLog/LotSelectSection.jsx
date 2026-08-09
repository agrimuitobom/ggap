// src/components/WorkLog/LotSelectSection.jsx
// 作業日誌で「定植」を選んだときに、どの播種ロットを定植したのかを選ぶ。
//
// 播種 → 定植 → 収穫 をロットIDでつなぐため、定植では新しく採番せず
// 既存の播種ロットを指す。ロットが増えても選びやすいよう、新しい順に
// 直近だけを出し、それ以前は「その他」からたどる。
import React, { useState } from 'react';
import { collectSelectableLots } from '../../services/lotNumberService';

const RECENT_LOT_COUNT = 10;
const OLDER_LOTS = '__older__';

const LotSelectSection = ({ formData, setFormData, seedUses = [] }) => {
  const [showOlder, setShowOlder] = useState(false);

  const sowingLots = collectSelectableLots(seedUses);

  const recentLots = sowingLots.slice(0, RECENT_LOT_COUNT);
  const olderLots = sowingLots.slice(RECENT_LOT_COUNT);
  const selectedIsOlder = olderLots.some((u) => u.lotNumber === formData.lotNumber);
  const olderOpen = showOlder || selectedIsOlder;

  const lotLabel = (u) => {
    const d = u.date?.toDate ? u.date.toDate().toLocaleDateString('ja-JP') : '';
    return `${u.lotNumber}${d ? `（${d} 播種）` : ''}${u.seedName ? ` ${u.seedName}` : ''}`;
  };

  return (
    <div className="mobile-form-group bg-blue-50 border border-blue-200 rounded p-4 mb-4">
      <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2">
        定植するロット
      </label>
      <p className="text-xs text-gray-600 mb-2">
        どの播種ロットを定植したのかを選びます。選んでおくと、収穫・出荷から
        播種までさかのぼれるようになります。新しい順に直近{RECENT_LOT_COUNT}件を表示します。
      </p>

      <select
        className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-2"
        value={
          olderOpen
            ? OLDER_LOTS
            : recentLots.some((u) => u.lotNumber === formData.lotNumber)
            ? formData.lotNumber
            : ''
        }
        onChange={(e) => {
          if (e.target.value === OLDER_LOTS) {
            setShowOlder(true);
            return;
          }
          setShowOlder(false);
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
            className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
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
            onClick={() => { setShowOlder(false); setFormData({ ...formData, lotNumber: '' }); }}
            className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
          >
            直近のロットから選び直す
          </button>
        </div>
      )}

      <input
        className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
        type="text"
        name="lotNumber"
        value={formData.lotNumber || ''}
        onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
        placeholder="一覧にない場合は直接入力（例: R8.01）"
      />

      {sowingLots.length === 0 && (
        <p className="text-xs text-amber-700 mt-1">
          ロットIDの付いた記録がまだありません。直接入力するか、
          先に播種の記録へロットIDを登録してください。
        </p>
      )}
    </div>
  );
};

export default LotSelectSection;
