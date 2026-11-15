jest.mock('./firebase', () => ({ db: {}, firebaseConfig: {} }));

// eslint-disable-next-line import/first
import {
  validateViewerId,
  validateViewerPassword,
  viewerIdToEmail,
  isViewerEmail,
  loginIdToEmail,
  generateViewerPassword,
  VIEWER_EMAIL_DOMAIN
} from './viewerAccountService';

// jsdom には Web Crypto が無いため Node の実装を使う
beforeAll(() => {
  if (!window.crypto?.getRandomValues) {
    Object.defineProperty(window, 'crypto', { value: require('crypto').webcrypto, configurable: true });
  }
});

describe('閲覧用ID', () => {
  it('使える形式のIDを受け付ける', () => {
    expect(validateViewerId('audit-2026')).toBeNull();
    expect(validateViewerId('  Shinsa01 ')).toBeNull();
  });

  it('短すぎる・記号始まり・使えない文字を含むIDを拒否する', () => {
    expect(validateViewerId('')).not.toBeNull();
    expect(validateViewerId('ab')).not.toBeNull();
    expect(validateViewerId('-abc')).not.toBeNull();
    expect(validateViewerId('a@b.com')).not.toBeNull();
    expect(validateViewerId('監査用')).not.toBeNull();
    expect(validateViewerId('a'.repeat(31))).not.toBeNull();
  });

  it('パスワードは8文字以上を要求する', () => {
    expect(validateViewerPassword('1234567')).not.toBeNull();
    expect(validateViewerPassword('12345678')).toBeNull();
  });

  it('IDを小文字化して専用ドメインのアドレスに変換する', () => {
    expect(viewerIdToEmail(' Audit01 ')).toBe(`audit01@${VIEWER_EMAIL_DOMAIN}`);
    expect(isViewerEmail(viewerIdToEmail('audit01'))).toBe(true);
    expect(isViewerEmail('user@example.com')).toBe(false);
  });

  it('ログイン入力はメールアドレスならそのまま、それ以外は閲覧用IDとして扱う', () => {
    expect(loginIdToEmail(' user@example.com ')).toBe('user@example.com');
    expect(loginIdToEmail('Audit01')).toBe(`audit01@${VIEWER_EMAIL_DOMAIN}`);
  });

  it('指定した長さで紛らわしい文字を含まないパスワードを生成する', () => {
    const password = generateViewerPassword(16);
    expect(password).toHaveLength(16);
    expect(password).toMatch(/^[a-hjkmnp-zA-HJ-NP-Z2-9]+$/);
  });
});
