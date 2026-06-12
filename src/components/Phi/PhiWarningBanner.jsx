// src/components/Phi/PhiWarningBanner.jsx
// PHI（収穫前日数）チェック結果の警告バナー
import React from 'react';

const formatDate = (date) => date.toLocaleDateString('ja-JP');

const PhiWarningBanner = ({ phiResult }) => {
  if (!phiResult) return null;
  const { violations = [], unchecked = [] } = phiResult;
  if (violations.length === 0 && unchecked.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {violations.length > 0 && (
        <div className="bg-red-50 border-2 border-red-400 text-red-800 px-4 py-3 rounded-lg">
          <p className="font-bold mb-1">⚠️ 収穫前日数（PHI）違反の可能性があります</p>
          <ul className="text-sm space-y-1">
            {violations.map((v, i) => (
              <li key={i}>
                ・{formatDate(v.useDate)}に散布した
                <span className="font-semibold">「{v.pesticideName}」</span>
                はPHI {v.phi}日のため、収穫できるのは
                <span className="font-semibold">{formatDate(v.okFrom)}以降</span>です
              </li>
            ))}
          </ul>
          <p className="text-xs mt-2">
            ※ この日付より前に収穫した農産物は出荷できません。記録は保存できますが、収穫日を見直してください。
          </p>
        </div>
      )}
      {unchecked.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg text-sm">
          <p>
            ℹ️ 直近に散布した
            {unchecked.map((u) => `「${u.pesticideName}」`).join('、')}
            は収穫前日数（PHI）が未登録のためチェックできません。
            農薬管理画面でPHIを登録すると自動チェックされます。
          </p>
        </div>
      )}
    </div>
  );
};

export default PhiWarningBanner;
