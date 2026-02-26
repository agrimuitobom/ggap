// src/components/WorkLog/BasicInfoSection.jsx
import React, { memo } from 'react';

const BasicInfoSection = ({
  formData,
  handleChange,
  handleWorkerChange,
  fields,
  users,
  error
}) => {
  return (
    <>
      {/* 作業日 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="date">
          作業日 *
        </label>
        <input
          className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="date"
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          required
        />
      </div>
      
      {/* 圃場選択 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="fieldId">
          圃場 *
        </label>
        <select
          className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="fieldId"
          name="fieldId"
          value={formData.fieldId}
          onChange={handleChange}
          required
        >
          <option value="">圃場を選択してください</option>
          {fields.map(field => (
            <option key={field.id} value={field.id}>{field.name}</option>
          ))}
        </select>
        {fields.length === 0 && (
          <p className="text-red-500 text-lg mt-2">
            圃場が登録されていません。先に圃場を登録してください。
          </p>
        )}
      </div>
      
      {/* 作業内容 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="workType">
          作業内容 *
        </label>
        <select
          className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="workType"
          name="workType"
          value={formData.workType}
          onChange={handleChange}
          required
        >
          <option value="">作業内容を選択してください</option>
          <option value="播種">播種</option>
          <option value="定植">定植</option>
          <option value="除草">除草</option>
          <option value="施肥">施肥</option>
          <option value="潅水">潅水</option>
          <option value="収穫">収穫</option>
          <option value="防除">防除</option>
          <option value="清掃">清掃</option>
          <option value="その他">その他</option>
        </select>
      </div>
      
      {/* 担当者 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="workers">
          担当者
        </label>
        <select
          className="mobile-select shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="workers"
          name="workers"
          multiple
          value={formData.workers}
          onChange={handleWorkerChange}
          required
          size="3"
        >
          {users.map(user => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">※Ctrlキーを押しながら複数選択できます</p>
        {users.length === 0 && (
          <p className="text-red-500 text-xs mt-1">
            ユーザーが登録されていません。先にユーザーを登録してください。
          </p>
        )}
      </div>
      
      {/* 詳細内容 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="details">
          詳細内容
        </label>
        <textarea
          className="mobile-textarea shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="details"
          name="details"
          value={formData.details}
          onChange={handleChange}
          rows="3"
        />
      </div>
      
      {/* 作業時間 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="workHours">
          作業時間 (時間)
        </label>
        <input
          className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="workHours"
          type="number"
          name="workHours"
          value={formData.workHours}
          onChange={handleChange}
          step="0.5"
          min="0"
          required
        />
      </div>
      
      {/* 収穫量 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="harvestAmount">
          収穫量 (kg)
        </label>
        <input
          className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="harvestAmount"
          type="number"
          name="harvestAmount"
          value={formData.harvestAmount}
          onChange={handleChange}
          step="0.1"
          min="0"
        />
        <p className="text-xs text-gray-500 mt-1">※収穫作業の場合のみ</p>
      </div>
      
      {/* 廃棄量 */}
      <div className="mobile-form-field mb-4">
        <label className="mobile-form-label block text-gray-700 text-sm font-bold mb-2" htmlFor="wasteAmount">
          廃棄量 (kg)
        </label>
        <input
          className="mobile-input shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="wasteAmount"
          type="number"
          name="wasteAmount"
          value={formData.wasteAmount}
          onChange={handleChange}
          step="0.1"
          min="0"
        />
        <p className="text-xs text-gray-500 mt-1">※廃棄物がある場合のみ</p>
      </div>
    </>
  );
};

export default memo(BasicInfoSection);