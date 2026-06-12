// src/services/templateService.js
// 作業日誌のマイテンプレート（workLogTemplatesコレクション）を管理するサービス
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

// テンプレートに保存しない項目（日付は毎回変わるため除外）
const EXCLUDED_KEYS = ['date'];

/**
 * フォーム入力からテンプレート用データを抽出（空欄は除外）
 */
export const buildTemplateData = (formData) => {
  const data = {};
  Object.entries(formData).forEach(([key, value]) => {
    if (EXCLUDED_KEYS.includes(key)) return;
    if (value === '' || value === null || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    data[key] = value;
  });
  return data;
};

/**
 * 組織のマイテンプレート一覧を取得（名前順）
 */
export const getWorkLogTemplates = async (organizationId) => {
  const templatesQuery = query(
    collection(db, 'workLogTemplates'),
    where('organizationId', '==', organizationId)
  );
  const snapshot = await getDocs(templatesQuery);
  const templates = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return templates;
};

/**
 * マイテンプレートを保存
 */
export const saveWorkLogTemplate = async (organizationId, name, formData) => {
  const templateData = {
    organizationId,
    name,
    data: buildTemplateData(formData),
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, 'workLogTemplates'), templateData);
  return { id: ref.id, ...templateData };
};

/**
 * マイテンプレートを削除
 */
export const deleteWorkLogTemplate = async (templateId) => {
  await deleteDoc(doc(db, 'workLogTemplates', templateId));
};
