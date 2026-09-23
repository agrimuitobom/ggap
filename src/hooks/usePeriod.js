// src/hooks/usePeriod.js
// 一覧画面の表示期間を、画面ごとに覚えておく（端末ごと）。
// 保存できない環境（プライベートブラウズ等）でも既定値で動くようにする。
import { useState, useCallback } from 'react';
import { DEFAULT_PERIOD, PERIOD_OPTIONS } from '../utils/period';

const storageKey = (name) => `period:${name}`;

export const usePeriod = (name) => {
  const [period, setPeriodState] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey(name));
      return PERIOD_OPTIONS.some((o) => o.key === saved) ? saved : DEFAULT_PERIOD;
    } catch (e) {
      return DEFAULT_PERIOD;
    }
  });

  const setPeriod = useCallback((next) => {
    setPeriodState(next);
    try {
      localStorage.setItem(storageKey(name), next);
    } catch (e) {
      // 保存できなくても表示は切り替わる
    }
  }, [name]);

  return [period, setPeriod];
};
