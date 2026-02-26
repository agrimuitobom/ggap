// src/components/WorkLog/PesticideSection.jsx
import React from 'react';

const PesticideSection = ({ formData, handleChange, pesticides }) => {
  return (
    <>
      <div className="mobile-form-section mb-4 border-t pt-4">
        <h3 className="mobile-form-header text-lg font-semibold mb-2 text-red-600">🚿 防除詳細</h3>
      </div>
      
      {/* 使用農薬 */}
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="pesticideId">
          使用農薬 *
        </label>
        <select
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="pesticideId"
          name="pesticideId"
          value={formData.pesticideId}
          onChange={handleChange}
          required
        >
          <option value="">農薬を選択してください</option>
          {pesticides.map(pesticide => (
            <option key={pesticide.id} value={pesticide.id}>{pesticide.name} ({pesticide.type})</option>
          ))}
        </select>
      </div>

      {/* 対象病害虫 */}
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="targetPest">
          対象病害虫 *
        </label>
        <input
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="targetPest"
          type="text"
          name="targetPest"
          value={formData.targetPest}
          onChange={handleChange}
          required
          placeholder="例: アブラムシ、うどんこ病、雑草 など"
        />
      </div>

      {/* 希釈倍率 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="dilutionRate">
          希釈倍率 *
        </label>
        <input
          className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="dilutionRate"
          type="number"
          name="dilutionRate"
          value={formData.dilutionRate}
          onChange={handleChange}
          step="1"
          min="1"
          required
          placeholder="例: 1000"
        />
        <p className="text-xs text-gray-500 mt-1">倍数で入力（例: 1000倍なら「1000」）</p>
      </div>

      {/* 散布量 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="pesticideAmount">
          散布量 *
        </label>
        <div className="flex items-center">
          <input
            className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="pesticideAmount"
            type="number"
            name="pesticideAmount"
            value={formData.pesticideAmount}
            onChange={handleChange}
            step="0.1"
            min="0"
            required
          />
          <select
            className="mobile-select ml-2 shadow border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            name="pesticideUnit"
            value={formData.pesticideUnit}
            onChange={handleChange}
          >
            <option value="L">L</option>
            <option value="ml">ml</option>
            <option value="kg">kg</option>
            <option value="g">g</option>
          </select>
        </div>
      </div>

      {/* 散布方法 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="pesticideMethod">
          散布方法 *
        </label>
        <select
          className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="pesticideMethod"
          name="pesticideMethod"
          value={formData.pesticideMethod}
          onChange={handleChange}
          required
        >
          <option value="">選択してください</option>
          <option value="噴霧器散布">噴霧器散布</option>
          <option value="動力噴霧器">動力噴霧器</option>
          <option value="ブームスプレーヤー">ブームスプレーヤー</option>
          <option value="スピードスプレーヤー">スピードスプレーヤー</option>
          <option value="粉剤散布機">粉剤散布機</option>
          <option value="土壌処理">土壌処理</option>
          <option value="その他">その他</option>
        </select>
      </div>

      {/* 天候 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="weather">
          天候 *
        </label>
        <select
          className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="weather"
          name="weather"
          value={formData.weather}
          onChange={handleChange}
          required
        >
          <option value="">選択してください</option>
          <option value="晴れ">晴れ</option>
          <option value="曇り">曇り</option>
          <option value="薄曇り">薄曇り</option>
          <option value="雨">雨</option>
          <option value="霧">霧</option>
        </select>
      </div>

      {/* 気温・風速 */}
      <div className="mobile-form-field mb-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="temperature">
              気温 (℃)
            </label>
            <input
              className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="temperature"
              type="number"
              name="temperature"
              value={formData.temperature}
              onChange={handleChange}
              step="0.1"
              placeholder="例: 25.5"
            />
          </div>
          <div className="flex-1">
            <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="windSpeed">
              風速 (m/s)
            </label>
            <input
              className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="windSpeed"
              type="number"
              name="windSpeed"
              value={formData.windSpeed}
              onChange={handleChange}
              step="0.1"
              min="0"
              placeholder="例: 2.0"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default PesticideSection;