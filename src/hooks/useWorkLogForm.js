// src/hooks/useWorkLogForm.js
import { useState, useCallback } from 'react';

const initialFormData = {
  date: new Date().toISOString().split('T')[0],
  fieldId: '',
  workType: '',
  workers: [],
  details: '',
  workHours: '',
  harvestAmount: '',
  wasteAmount: '',
  // 施肥関連
  fertilizerId: '',
  fertilizerAmount: '',
  fertilizerUnit: 'kg',
  fertilizerMethod: '',
  // 播種関連
  seedId: '',
  seedAmount: '',
  seedMethod: '',
  // 防除関連
  pesticideId: '',
  targetPest: '',
  dilutionRate: '',
  pesticideAmount: '',
  pesticideUnit: 'L',
  pesticideMethod: '',
  weather: '',
  temperature: '',
  windSpeed: ''
};

export const useWorkLogForm = (existingData = null) => {
  const [formData, setFormData] = useState(existingData || initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleWorkerChange = useCallback((e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData(prev => ({
      ...prev,
      workers: selectedOptions
    }));
  }, []);

  const handleTemplateSelect = useCallback((templateData) => {
    setFormData(prev => ({
      ...prev,
      ...templateData
    }));
  }, []);

  const resetForm = () => {
    setFormData(initialFormData);
    setError('');
    setMessage('');
  };

  const setFormErrors = (errorMessage) => {
    setError(errorMessage);
  };

  const setFormMessage = (successMessage) => {
    setMessage(successMessage);
  };

  const setFormLoading = (isLoading) => {
    setLoading(isLoading);
  };

  // バリデーション関数
  const validateForm = (fields, users) => {
    const errors = [];
    
    if (!formData.date) {
      errors.push('作業日は必須です');
    }
    
    if (!formData.fieldId) {
      errors.push('圃場の選択は必須です');
    }
    
    if (!formData.workType) {
      errors.push('作業内容の選択は必須です');
    }
    
    if (!formData.workers.length) {
      errors.push('担当者の選択は必須です');
    }
    
    if (!formData.workHours || Number(formData.workHours) <= 0) {
      errors.push('作業時間は必須です（0より大きい値）');
    }
    
    // 作業種別別のバリデーション
    if (formData.workType === '施肥') {
      if (!formData.fertilizerId) {
        errors.push('施肥作業では使用肥料の選択は必須です');
      }
      if (!formData.fertilizerAmount || Number(formData.fertilizerAmount) <= 0) {
        errors.push('施肥作業では肥料使用量は必須です');
      }
      if (!formData.fertilizerMethod) {
        errors.push('施肥作業では施肥方法の選択は必須です');
      }
    }
    
    if (formData.workType === '播種') {
      if (!formData.seedId) {
        errors.push('播種作業では種子・苗の選択は必須です');
      }
      if (!formData.seedMethod) {
        errors.push('播種作業では播種方法の選択は必須です');
      }
    }
    
    if (formData.workType === '防除') {
      if (!formData.pesticideId) {
        errors.push('防除作業では使用農薬の選択は必須です');
      }
      if (!formData.targetPest) {
        errors.push('防除作業では対象病害虫の入力は必須です');
      }
      if (!formData.dilutionRate || Number(formData.dilutionRate) <= 0) {
        errors.push('防除作業では希釈倍率は必須です');
      }
      if (!formData.pesticideAmount || Number(formData.pesticideAmount) <= 0) {
        errors.push('防除作業では散布量は必須です');
      }
      if (!formData.pesticideMethod) {
        errors.push('防除作業では散布方法の選択は必須です');
      }
      if (!formData.weather) {
        errors.push('防除作業では天候の選択は必須です');
      }
    }
    
    return errors;
  };

  const stableSetFormData = useCallback((data) => {
    if (typeof data === 'function') {
      setFormData(data);
    } else {
      setFormData(data);
    }
  }, []);

  return {
    formData,
    setFormData: stableSetFormData,
    loading,
    error,
    message,
    handleChange,
    handleWorkerChange,
    handleTemplateSelect,
    resetForm,
    setFormErrors,
    setFormMessage,
    setFormLoading,
    validateForm
  };
};