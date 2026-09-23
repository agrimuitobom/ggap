// src/components/common/SeedLotPicker.jsx
// 播種ロットを選ぶ部品（定植・収穫で使う）。
//
// ロットが増えても選びやすいよう、新しい順に直近だけを出し、それ以前は
// 「その他」を選ぶと二段目の一覧でたどれる。一覧にないロットは直接入力もできる。
import React, { useState } from 'react';
import { collectSelectableLots } from '../../services/lotNumberService';

export const RECENT_LOT_COUNT = 10;
const OLDER_LOTS = '__older__';

const SeedLotPicker = ({
  value = '',
  onChange,
  seedUses = [],
  label = '播種ロット',
  description = '',
  suggestion = '',
  className = ''
}) => {
  const [showOlder, setShowOlder] = useState(false);

  const lots = collectSelectableLots(seedUses);
  const recentLots = lots.slice(0, RECENT_LOT_COUNT);
  const olderLots = lots.slice(RECENT_LOT_COUNT);
  const selectedIsOlder = olderLots.some((u) => u.lotNumber === value);
  const olderOpen = showOlder || selectedIsOlder;

  const lotLabel = (u) => {
    const d = u.date?.toDate ? u.date.toDate().toLocaleDateString('ja-JP') : '';
    const kind = u.method === '定植' ? '定植' : '播種';
    return `${u.lotNumber}${d ? `（${d} ${kind}）` : ''}${u.seedName ? ` ${u.seedName}` : ''}`;
  };

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded p-4 ${className}`}>
      <label className="block text-gray-700 text-sm font-bold mb-2">{label}</label>
      {description && <p className="text-xs text-gray-600 mb-2">{description}</p>}

      {suggestion && suggestion !== value && (
        <button
          type="button"
          onClick={() => { setShowOlder(false); onChange(suggestion); }}
          className="mb-2 px-3 py-1.5 rounded border border-blue-400 bg-white text-blue-700 text-sm hover:bg-blue-100"
        >
          この圃場の直近のロット「{suggestion}」を使う
        </button>
      )}

      <select
        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-2 bg-white"
        value={
          olderOpen
            ? OLDER_LOTS
            : recentLots.some((u) => u.lotNumber === value)
            ? value
            : ''
        }
        onChange={(e) => {
          if (e.target.value === OLDER_LOTS) {
            setShowOlder(true);
            return;
          }
          setShowOlder(false);
          onChange(e.target.value);
        }}
      >
        <option value="">選択してください</option>
        {recentLots.map((u) => (
          <option key={u.id} value={u.lotNumber}>{lotLabel(u)}</option>
        ))}
        {olderLots.length > 0 && (
          <option value={OLDER_LOTS}>その他（それ以前のロット {olderLots.length}件）…</option>
        )}
      </select>

      {olderOpen && olderLots.length > 0 && (
        <div className="mb-2">
          <label className="block text-xs text-gray-600 mb-1">それ以前のロット（新しい順）</label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 bg-white"
            value={selectedIsOlder ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">選択してください</option>
            {olderLots.map((u) => (
              <option key={u.id} value={u.lotNumber}>{lotLabel(u)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { setShowOlder(false); onChange(''); }}
            className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
          >
            直近のロットから選び直す
          </button>
        </div>
      )}

      <input
        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="一覧にない場合は直接入力（例: R8.01）"
      />

      {lots.length === 0 && (
        <p className="text-xs text-amber-700 mt-1">
          ロットIDの付いた記録がまだありません。直接入力するか、
          先に播種の記録へロットIDを登録してください。
        </p>
      )}
    </div>
  );
};

export default SeedLotPicker;
