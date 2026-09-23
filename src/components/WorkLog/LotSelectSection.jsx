// src/components/WorkLog/LotSelectSection.jsx
// 作業日誌で「定植」を選んだときに、どの播種ロットを定植したのかを選ぶ。
// 播種 → 定植 → 収穫 をロットIDでつなぐため、定植では新しく採番せず
// 既存の播種ロットを指す。
import React from 'react';
import SeedLotPicker, { RECENT_LOT_COUNT } from '../common/SeedLotPicker';

const LotSelectSection = ({ formData, setFormData, seedUses = [] }) => (
  <SeedLotPicker
    className="mobile-form-group mb-4"
    label="定植するロット"
    description={
      'どの播種ロットを定植したのかを選びます。選んでおくと、収穫・出荷から' +
      `播種までさかのぼれるようになります。新しい順に直近${RECENT_LOT_COUNT}件を表示します。`
    }
    value={formData.lotNumber || ''}
    onChange={(lot) => setFormData({ ...formData, lotNumber: lot })}
    seedUses={seedUses}
  />
);

export default LotSelectSection;
