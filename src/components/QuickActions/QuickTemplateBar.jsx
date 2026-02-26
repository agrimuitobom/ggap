// src/components/QuickActions/QuickTemplateBar.jsx
import React from 'react';

const QuickTemplateBar = ({ onTemplateSelect, templates = [] }) => {
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

  const templateList = templates.length > 0 ? templates : defaultTemplates;

  return (
    <div className="mobile-form-section bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
      <h3 className="mobile-form-label text-blue-800 font-semibold mb-3 text-center">
        🚀 クイック入力テンプレート
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {templateList.map((template, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onTemplateSelect(template.data)}
            className="mobile-btn mobile-btn-secondary flex flex-col items-center p-3 bg-white hover:bg-blue-100 border-2 border-blue-300 rounded-lg transition-all duration-200 hover:scale-105"
          >
            <span className="text-2xl mb-1">{template.icon}</span>
            <span className="text-sm font-medium text-center">{template.name}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-blue-600 mt-2 text-center">
        タップして項目を自動入力
      </p>
    </div>
  );
};

export default QuickTemplateBar;