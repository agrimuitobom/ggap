// src/components/QuickActions/QuickTemplateBar.jsx
// クイック入力テンプレートバー。
// 保存済みのマイテンプレート（Firestore）があればそれを表示し、
// なければ既定のテンプレートを表示する。
import React, { useState } from 'react';

const defaultTemplates = [
  {
    name: '朝の作業',
    data: {
      workType: '除草',
      workHours: '2',
      details: '朝の定期除草作業'
    },
    icon: '🌅'
  },
  {
    name: '収穫作業',
    data: {
      workType: '収穫',
      workHours: '4',
      details: '収穫作業'
    },
    icon: '🌾'
  },
  {
    name: '施肥作業',
    data: {
      workType: '施肥',
      workHours: '1.5',
      details: '定期施肥作業'
    },
    icon: '🌱'
  },
  {
    name: '防除作業',
    data: {
      workType: '防除',
      workHours: '2',
      details: '病害虫防除作業'
    },
    icon: '🚿'
  },
  {
    name: '播種作業',
    data: {
      workType: '播種',
      workHours: '3',
      details: '播種作業'
    },
    icon: '🌿'
  }
];

const QuickTemplateBar = ({ onTemplateSelect, templates = [], onSaveCurrent, onDelete }) => {
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const hasSavedTemplates = templates.length > 0;
  const templateList = hasSavedTemplates ? templates : defaultTemplates;

  const handleSave = () => {
    const name = templateName.trim();
    if (!name) return;
    onSaveCurrent(name);
    setTemplateName('');
    setShowSaveInput(false);
  };

  return (
    <div className="mobile-form-section bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="mobile-form-label text-blue-800 font-semibold">
          🚀 {hasSavedTemplates ? 'マイテンプレート' : 'クイック入力テンプレート'}
        </h3>
        {onSaveCurrent && !showSaveInput && (
          <button
            type="button"
            onClick={() => setShowSaveInput(true)}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ★ 現在の入力を保存
          </button>
        )}
      </div>

      {showSaveInput && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="例：トマトA圃場の定期防除"
            className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!templateName.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            保存
          </button>
          <button
            type="button"
            onClick={() => { setShowSaveInput(false); setTemplateName(''); }}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {templateList.map((template, index) => (
          <div key={template.id || index} className="relative">
            <button
              type="button"
              onClick={() => onTemplateSelect(template.data)}
              className="mobile-btn mobile-btn-secondary w-full flex flex-col items-center p-3 bg-white hover:bg-blue-100 border-2 border-blue-300 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <span className="text-2xl mb-1">{template.icon || '📋'}</span>
              <span className="text-sm font-medium text-center break-all">{template.name}</span>
            </button>
            {hasSavedTemplates && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`テンプレート「${template.name}」を削除しますか？`)) {
                    onDelete(template.id);
                  }
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-gray-500 hover:bg-red-600 text-white rounded-full text-xs leading-none"
                title="テンプレートを削除"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-blue-600 mt-2 text-center">
        タップして項目を自動入力{!hasSavedTemplates && onSaveCurrent ? '。「★ 現在の入力を保存」で自分専用のテンプレートを作成できます' : ''}
      </p>
    </div>
  );
};

export default QuickTemplateBar;
