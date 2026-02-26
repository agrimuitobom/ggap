// src/utils/securityUtils.js
import DOMPurify from 'dompurify';

/**
 * XSS攻撃を防ぐためのHTMLサニタイズ
 * @param {string} html - サニタイズするHTML文字列
 * @returns {string} - サニタイズされたHTML文字列
 */
export const sanitizeHtml = (html) => {
  if (typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
};

/**
 * SQLインジェクション対策のための文字列エスケープ
 * @param {string} str - エスケープする文字列
 * @returns {string} - エスケープされた文字列
 */
export const escapeSqlString = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
    switch (char) {
      case '\0':
        return '\\0';
      case '\x08':
        return '\\b';
      case '\x09':
        return '\\t';
      case '\x1a':
        return '\\z';
      case '\n':
        return '\\n';
      case '\r':
        return '\\r';
      case '"':
      case "'":
      case '\\':
      case '%':
        return '\\' + char;
      default:
        return char;
    }
  });
};

/**
 * ファイル名の検証とサニタイズ
 * @param {string} filename - 検証するファイル名
 * @returns {string} - サニタイズされたファイル名
 */
export const sanitizeFilename = (filename) => {
  if (typeof filename !== 'string') return '';
  
  // 危険な文字を除去
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Windows/Unix危険文字
    .replace(/^\.+/, '') // 先頭のドット除去
    .replace(/\.+$/, '') // 末尾のドット除去
    .trim()
    .substring(0, 255); // ファイル名長制限
};

/**
 * 数値の範囲検証
 * @param {number} value - 検証する値
 * @param {number} min - 最小値
 * @param {number} max - 最大値
 * @returns {boolean} - 有効な範囲内かどうか
 */
export const validateNumberRange = (value, min = -Infinity, max = Infinity) => {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
};

/**
 * 日付の妥当性検証
 * @param {string|Date} date - 検証する日付
 * @returns {boolean} - 有効な日付かどうか
 */
export const validateDate = (date) => {
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj.getTime());
};

/**
 * メールアドレスの形式検証
 * @param {string} email - 検証するメールアドレス
 * @returns {boolean} - 有効なメールアドレスかどうか
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
};

/**
 * 文字列長の検証
 * @param {string} str - 検証する文字列
 * @param {number} minLength - 最小長
 * @param {number} maxLength - 最大長
 * @returns {boolean} - 有効な長さかどうか
 */
export const validateStringLength = (str, minLength = 0, maxLength = Infinity) => {
  if (typeof str !== 'string') return false;
  return str.length >= minLength && str.length <= maxLength;
};

/**
 * CSRFトークンの生成
 * @returns {string} - CSRFトークン
 */
export const generateCSRFToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * セキュアなランダム文字列の生成
 * @param {number} length - 文字列長
 * @returns {string} - ランダム文字列
 */
export const generateSecureRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
};

/**
 * ユーザー入力の包括的検証
 * @param {Object} input - 検証するデータオブジェクト
 * @param {Object} rules - 検証ルール
 * @returns {Object} - 検証結果 { isValid: boolean, errors: string[] }
 */
export const validateUserInput = (input, rules) => {
  const errors = [];
  
  for (const [field, rule] of Object.entries(rules)) {
    const value = input[field];
    
    // 必須フィールドチェック
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field}は必須です`);
      continue;
    }
    
    // 値が存在しない場合はスキップ
    if (value === undefined || value === null || value === '') {
      continue;
    }
    
    // 型チェック
    if (rule.type && typeof value !== rule.type) {
      errors.push(`${field}は${rule.type}型である必要があります`);
      continue;
    }
    
    // 文字列長チェック
    if (rule.minLength !== undefined || rule.maxLength !== undefined) {
      if (!validateStringLength(value, rule.minLength, rule.maxLength)) {
        errors.push(`${field}は${rule.minLength || 0}文字以上${rule.maxLength || '無制限'}文字以下である必要があります`);
      }
    }
    
    // 数値範囲チェック
    if (rule.min !== undefined || rule.max !== undefined) {
      if (!validateNumberRange(value, rule.min, rule.max)) {
        errors.push(`${field}は${rule.min || '無制限'}以上${rule.max || '無制限'}以下である必要があります`);
      }
    }
    
    // カスタムバリデーターチェック
    if (rule.validator && !rule.validator(value)) {
      errors.push(rule.message || `${field}の形式が正しくありません`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};