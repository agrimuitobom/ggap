// src/components/WorkLog/SeedSection.jsx
import React from 'react';

const SeedSection = ({ formData, handleChange, seeds }) => {
  return (
    <>
      <div className="mobile-form-section mb-4 border-t pt-4">
        <h3 className="mobile-form-header text-lg font-semibold mb-2 text-blue-600">🌿 播種詳細</h3>
      </div>
      
      {/* 使用種子・苗 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="seedId">
          使用種子・苗 *
        </label>
        <select
          className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="seedId"
          name="seedId"
          value={formData.seedId}
          onChange={handleChange}
          required
        >
          <option value="">種子・苗を選択してください</option>
          {seeds.map(seed => (
            <option key={seed.id} value={seed.id}>{seed.name} ({seed.variety})</option>
          ))}
        </select>
      </div>

      {/* 使用量 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="seedAmount">
          使用量
        </label>
        <input
          className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="seedAmount"
          type="number"
          name="seedAmount"
          value={formData.seedAmount}
          onChange={handleChange}
          step="0.1"
          min="0"
          placeholder="数量を入力"
        />
        <p className="text-xs text-gray-500 mt-1">※種子の場合はg、苗の場合は本数</p>
      </div>

      {/* 播種方法 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="seedMethod">
          播種方法 *
        </label>
        <select
          className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="seedMethod"
          name="seedMethod"
          value={formData.seedMethod}
          onChange={handleChange}
          required
        >
          <option value="">選択してください</option>
          <option value="直播">直播</option>
          <option value="条播">条播</option>
          <option value="点播">点播</option>
          <option value="散播">散播</option>
          <option value="定植">定植</option>
          <option value="その他">その他</option>
        </select>
      </div>
    </>
  );
};

export default SeedSection;