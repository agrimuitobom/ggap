// src/components/WorkLog/FertilizerSection.jsx
import React from 'react';

const FertilizerSection = React.memo(({ formData, handleChange, fertilizers }) => {
  return (
    <>
      <div className="mobile-form-section mb-4 border-t pt-4">
        <h3 className="mobile-form-header text-lg font-semibold mb-2 text-green-600">🌱 施肥詳細</h3>
      </div>
      
      {/* 使用肥料 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="fertilizerId">
          使用肥料 *
        </label>
        <select
          className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="fertilizerId"
          name="fertilizerId"
          value={formData.fertilizerId}
          onChange={handleChange}
          required
        >
          <option value="">肥料を選択してください</option>
          {fertilizers.map(fertilizer => (
            <option key={fertilizer.id} value={fertilizer.id}>{fertilizer.name}</option>
          ))}
        </select>
      </div>

      {/* 使用量 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="fertilizerAmount">
          使用量 *
        </label>
        <div className="flex items-center">
          <input
            className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="fertilizerAmount"
            type="number"
            name="fertilizerAmount"
            value={formData.fertilizerAmount}
            onChange={handleChange}
            step="0.1"
            min="0"
            required
          />
          <select
            className="mobile-select ml-2 shadow border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            name="fertilizerUnit"
            value={formData.fertilizerUnit}
            onChange={handleChange}
          >
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="L">L</option>
            <option value="ml">ml</option>
            <option value="袋">袋</option>
          </select>
        </div>
      </div>

      {/* 施肥方法 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="fertilizerMethod">
          施肥方法 *
        </label>
        <select
          className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="fertilizerMethod"
          name="fertilizerMethod"
          value={formData.fertilizerMethod}
          onChange={handleChange}
          required
        >
          <option value="">選択してください</option>
          <option value="全面散布">全面散布</option>
          <option value="条施肥">条施肥</option>
          <option value="点滴施肥">点滴施肥</option>
          <option value="葉面散布">葉面散布</option>
          <option value="土壌混和">土壌混和</option>
          <option value="灌水施肥">灌水施肥</option>
          <option value="その他">その他</option>
        </select>
      </div>
    </>
  );
});

FertilizerSection.displayName = 'FertilizerSection';

export default FertilizerSection;