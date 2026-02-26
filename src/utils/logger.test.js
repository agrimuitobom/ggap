// src/utils/logger.test.js
// ロガーシステムのテスト用ファイル

import { 
  logger, 
  authLogger, 
  firestoreLogger, 
  businessLogger, 
  uiLogger,
  createLogger,
  log
} from './logger';

// テスト用のモック関数
const mockConsole = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// 元のconsoleオブジェクトを保存
const originalConsole = { ...console };

// テスト前後でconsoleをモック/復元
beforeEach(() => {
  Object.assign(console, mockConsole);
});

afterEach(() => {
  Object.assign(console, originalConsole);
  jest.clearAllMocks();
});

describe('Logger System', () => {
  describe('Basic Logging', () => {
    test('should log debug messages in development', () => {
      // NODE_ENVを一時的に設定
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      logger.debug('Test debug message', { test: 'data' });
      
      // デバッグログが出力されることを確認
      expect(mockConsole.debug).toHaveBeenCalled();
      
      // 元の環境を復元
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('should log error messages in production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const testError = new Error('Test error');
      logger.error('Test error message', { test: 'data' }, testError);
      
      expect(mockConsole.error).toHaveBeenCalled();
      
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Specialized Loggers', () => {
    test('should create auth logger with correct context', () => {
      authLogger.info('Test auth message', { userId: 'test123' });
      
      expect(mockConsole.info).toHaveBeenCalled();
      const callArgs = mockConsole.info.mock.calls[0];
      expect(callArgs[0]).toContain('[AUTH]');
    });

    test('should create firestore logger with correct context', () => {
      firestoreLogger.error('Test firestore error', { operation: 'read' });
      
      expect(mockConsole.error).toHaveBeenCalled();
      const callArgs = mockConsole.error.mock.calls[0];
      expect(callArgs[0]).toContain('[FIRESTORE]');
    });

    test('should create business logger with correct context', () => {
      businessLogger.info('Test business message', { action: 'calculation' });
      
      expect(mockConsole.info).toHaveBeenCalled();
      const callArgs = mockConsole.info.mock.calls[0];
      expect(callArgs[0]).toContain('[BUSINESS]');
    });

    test('should create UI logger with correct context', () => {
      uiLogger.debug('Test UI message', { component: 'Button' });
      
      expect(mockConsole.debug).toHaveBeenCalled();
      const callArgs = mockConsole.debug.mock.calls[0];
      expect(callArgs[0]).toContain('[UI]');
    });
  });

  describe('Data Sanitization', () => {
    test('should sanitize sensitive information', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const sensitiveData = {
        email: 'test@example.com',
        password: 'secretpassword',
        token: 'abc123token',
        normalData: 'this is fine'
      };
      
      logger.info('Test with sensitive data', sensitiveData);
      
      expect(mockConsole.info).toHaveBeenCalled();
      const callArgs = mockConsole.info.mock.calls[0];
      const loggedData = callArgs[1];
      
      // 機密データがサニタイズされていることを確認
      expect(loggedData.password).toBe('[REDACTED]');
      expect(loggedData.token).toBe('[REDACTED]');
      expect(loggedData.email).not.toBe('test@example.com'); // メールは部分的にマスク
      expect(loggedData.normalData).toBe('this is fine'); // 通常データは変更されない
      
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Custom Logger Creation', () => {
    test('should create custom logger with provided context', () => {
      const customLogger = createLogger('CustomComponent', { version: '1.0.0' });
      
      customLogger.info('Custom message', { action: 'test' });
      
      expect(mockConsole.info).toHaveBeenCalled();
      const callArgs = mockConsole.info.mock.calls[0];
      expect(callArgs[1]).toMatchObject({
        component: 'CustomComponent',
        version: '1.0.0',
        action: 'test'
      });
    });
  });

  describe('Utility Functions', () => {
    test('should provide utility log functions', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      log.debug('Debug message', { test: 'data' });
      log.info('Info message', { test: 'data' });
      log.warn('Warning message', { test: 'data' });
      log.error('Error message', { test: 'data' });
      
      expect(mockConsole.debug).toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
      
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Environment-based Behavior', () => {
    test('should not log debug messages in production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      logger.debug('Debug message that should not appear');
      
      expect(mockConsole.debug).not.toHaveBeenCalled();
      
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('should log error messages in all environments', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      
      // テスト: development環境
      process.env.NODE_ENV = 'development';
      logger.error('Error in development');
      expect(mockConsole.error).toHaveBeenCalled();
      
      mockConsole.error.mockClear();
      
      // テスト: production環境
      process.env.NODE_ENV = 'production';
      logger.error('Error in production');
      expect(mockConsole.error).toHaveBeenCalled();
      
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});