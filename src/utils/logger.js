// src/utils/logger.js
// 包括的なロギングシステム

/**
 * ログレベルの定義
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

/**
 * ログレベルの文字列表現
 */
const LOG_LEVEL_NAMES = {
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.ERROR]: 'ERROR',
  [LOG_LEVELS.FATAL]: 'FATAL'
};

/**
 * 環境設定の取得
 */
const getEnvironmentConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    isDevelopment,
    isProduction,
    logLevel: isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR,
    enableConsoleOutput: isDevelopment,
    enableRemoteLogging: isProduction
  };
};

/**
 * 機密情報のサニタイズ
 */
const sanitizeLogData = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'email',
    'phone',
    'address',
    'personalInfo',
    'creditCard',
    'ssn',
    'auth',
    'authorization'
  ];

  const sanitized = { ...data };
  
  const sanitizeValue = (obj, key) => {
    if (typeof obj[key] === 'string') {
      if (key.toLowerCase().includes('email')) {
        // メールアドレスの一部をマスク
        const email = obj[key];
        const [localPart, domain] = email.split('@');
        if (localPart && domain) {
          const maskedLocal = localPart.substring(0, 2) + '***';
          obj[key] = `${maskedLocal}@${domain}`;
        }
      } else {
        obj[key] = '[REDACTED]';
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      obj[key] = sanitizeLogData(obj[key]);
    }
  };

  const sanitizeObject = (obj) => {
    Object.keys(obj).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitizeValue(obj, key);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    });
  };

  sanitizeObject(sanitized);
  return sanitized;
};

/**
 * ログエントリの作成
 */
const createLogEntry = (level, message, context = {}, error = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: LOG_LEVEL_NAMES[level],
    message,
    context: sanitizeLogData(context),
    userAgent: navigator.userAgent,
    url: window.location.href,
    userId: context.userId || 'anonymous'
  };

  if (error) {
    logEntry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    };
  }

  return logEntry;
};

/**
 * コンソールへのログ出力
 */
const outputToConsole = (logEntry) => {
  const { level, message, context, error } = logEntry;
  const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
  const logMessage = `[${timestamp}] ${level}: ${message}`;

  switch (level) {
    case 'DEBUG':
      console.debug(logMessage, context);
      break;
    case 'INFO':
      console.info(logMessage, context);
      break;
    case 'WARN':
      console.warn(logMessage, context);
      break;
    case 'ERROR':
    case 'FATAL':
      console.error(logMessage, context, error);
      break;
    default:
      console.log(logMessage, context);
  }
};

/**
 * リモートログ送信（将来的な実装用）
 */
const sendToRemoteService = async (logEntry) => {
  try {
    // 将来的にSentry、CloudWatch、またはその他のログサービスに送信する予定
    // 現在はプレースホルダー
  } catch (error) {
    console.error('Failed to send log to remote service:', error);
  }
};

/**
 * ログの出力処理
 */
const outputLog = async (logEntry) => {
  const config = getEnvironmentConfig();
  
  // コンソール出力
  if (config.enableConsoleOutput) {
    outputToConsole(logEntry);
  }
  
  // リモートログ送信
  if (config.enableRemoteLogging && 
      (logEntry.level === 'ERROR' || logEntry.level === 'FATAL')) {
    await sendToRemoteService(logEntry);
  }
};

/**
 * ログレベルチェック
 */
const shouldLog = (level) => {
  const config = getEnvironmentConfig();
  return level >= config.logLevel;
};

/**
 * メインロガークラス
 */
class Logger {
  constructor(context = {}) {
    this.defaultContext = context;
  }

  /**
   * コンテキスト付きロガーの作成
   */
  withContext(context) {
    return new Logger({ ...this.defaultContext, ...context });
  }

  /**
   * デバッグログ
   */
  debug(message, context = {}) {
    if (!shouldLog(LOG_LEVELS.DEBUG)) return;
    
    const logEntry = createLogEntry(
      LOG_LEVELS.DEBUG, 
      message, 
      { ...this.defaultContext, ...context }
    );
    outputLog(logEntry);
  }

  /**
   * 情報ログ
   */
  info(message, context = {}) {
    if (!shouldLog(LOG_LEVELS.INFO)) return;
    
    const logEntry = createLogEntry(
      LOG_LEVELS.INFO, 
      message, 
      { ...this.defaultContext, ...context }
    );
    outputLog(logEntry);
  }

  /**
   * 警告ログ
   */
  warn(message, context = {}) {
    if (!shouldLog(LOG_LEVELS.WARN)) return;
    
    const logEntry = createLogEntry(
      LOG_LEVELS.WARN, 
      message, 
      { ...this.defaultContext, ...context }
    );
    outputLog(logEntry);
  }

  /**
   * エラーログ
   */
  error(message, context = {}, error = null) {
    if (!shouldLog(LOG_LEVELS.ERROR)) return;
    
    const logEntry = createLogEntry(
      LOG_LEVELS.ERROR, 
      message, 
      { ...this.defaultContext, ...context },
      error
    );
    outputLog(logEntry);
  }

  /**
   * 致命的エラーログ
   */
  fatal(message, context = {}, error = null) {
    if (!shouldLog(LOG_LEVELS.FATAL)) return;
    
    const logEntry = createLogEntry(
      LOG_LEVELS.FATAL, 
      message, 
      { ...this.defaultContext, ...context },
      error
    );
    outputLog(logEntry);
  }

  /**
   * 認証関連のログ
   */
  auth(message, context = {}) {
    this.info(`[AUTH] ${message}`, { ...context, component: 'auth' });
  }

  /**
   * Firestore操作のログ
   */
  firestore(message, context = {}) {
    this.info(`[FIRESTORE] ${message}`, { ...context, component: 'firestore' });
  }

  /**
   * ビジネスロジック関連のログ
   */
  business(message, context = {}) {
    this.info(`[BUSINESS] ${message}`, { ...context, component: 'business' });
  }

  /**
   * UI操作のログ
   */
  ui(message, context = {}) {
    this.debug(`[UI] ${message}`, { ...context, component: 'ui' });
  }

  /**
   * パフォーマンス測定のログ
   */
  performance(message, duration, context = {}) {
    this.info(`[PERF] ${message}`, { 
      ...context, 
      component: 'performance', 
      duration: `${duration}ms` 
    });
  }

  /**
   * セキュリティ関連のログ
   */
  security(message, context = {}) {
    this.warn(`[SECURITY] ${message}`, { ...context, component: 'security' });
  }
}

// デフォルトロガーインスタンス
const defaultLogger = new Logger();

// 特定のコンポーネント用のロガーファクトリー
export const createLogger = (component, context = {}) => {
  return new Logger({ component, ...context });
};

// 便利なエクスポート
export const logger = defaultLogger;
export const authLogger = createLogger('auth');
export const firestoreLogger = createLogger('firestore');
export const businessLogger = createLogger('business');
export const uiLogger = createLogger('ui');
export const performanceLogger = createLogger('performance');
export const securityLogger = createLogger('security');

// console.logの代替として使用するためのヘルパー関数
export const log = {
  debug: (message, data) => logger.debug(message, data),
  info: (message, data) => logger.info(message, data),
  warn: (message, data) => logger.warn(message, data),
  error: (message, data, error) => logger.error(message, data, error),
  fatal: (message, data, error) => logger.fatal(message, data, error)
};


export default logger;