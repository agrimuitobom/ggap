// src/utils/workLogDefaults.js
// 前回入力した圃場・担当者などを端末に記憶し、次回入力時の初期値に使う
const storageKey = (organizationId) => `workLogDefaults_${organizationId}`;

export const loadWorkLogDefaults = (organizationId) => {
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveWorkLogDefaults = (organizationId, defaults) => {
  try {
    localStorage.setItem(storageKey(organizationId), JSON.stringify(defaults));
  } catch {
    // ストレージが使えない環境（プライベートモード等）では記憶しないだけで続行
  }
};
