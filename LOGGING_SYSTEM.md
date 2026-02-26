# ロギングシステム実装ガイド

GAP Tracker アプリケーションでのロギングシステムの実装と使用方法について説明します。

## 📋 概要

このプロジェクトでは、従来の `console.log` を使用したロギングから、より管理しやすく本番環境に適した包括的なロギングシステムに移行しました。

## 🎯 主な特徴

### 1. 環境別ログ制御
- **開発環境**: 全てのログレベルを出力
- **本番環境**: エラーログのみ出力、デバッグ情報は非表示

### 2. 機密情報の自動サニタイズ
- パスワード、トークン、メールアドレスなどの機密情報を自動的にマスク
- ユーザーのプライバシーを保護

### 3. 構造化ログ
- 各ログエントリにタイムスタンプ、コンテキスト情報を自動付与
- 検索・分析が容易な形式で出力

### 4. 特化型ロガー
- 認証、Firestore、ビジネスロジック、UIなど、用途別のロガーを提供

## 📚 使用方法

### 基本的な使用方法

```javascript
import { logger } from '../utils/logger';

// 情報ログ
logger.info('ユーザーがログインしました', { userId: 'abc123' });

// エラーログ
logger.error('データの保存に失敗しました', { operation: 'save' }, error);

// デバッグログ（開発環境のみ）
logger.debug('デバッグ情報', { debugData: someData });
```

### 特化型ロガーの使用

```javascript
import { authLogger, firestoreLogger, businessLogger, uiLogger } from '../utils/logger';

// 認証関連
authLogger.info('ユーザーログイン', { email: 'user@example.com' });

// Firestore操作
firestoreLogger.error('データ取得エラー', { collection: 'users' }, error);

// ビジネスロジック
businessLogger.info('売上計算完了', { amount: 1000 });

// UI操作
uiLogger.debug('ボタンクリック', { component: 'SaveButton' });
```

### カスタムロガーの作成

```javascript
import { createLogger } from '../utils/logger';

const componentLogger = createLogger('MyComponent', { version: '1.0.0' });

componentLogger.info('コンポーネント初期化', { props: someProps });
```

## 🔧 設定

### 環境変数

`.env.example` ファイルを参考に、以下の環境変数を設定できます：

```env
# ロギング設定
REACT_APP_LOG_LEVEL=DEBUG
REACT_APP_ENABLE_CONSOLE_LOGGING=true
REACT_APP_ENABLE_REMOTE_LOGGING=false
```

### ログレベル

1. **DEBUG**: 開発時のデバッグ情報
2. **INFO**: 一般的な情報
3. **WARN**: 警告
4. **ERROR**: エラー
5. **FATAL**: 致命的エラー

## 🛡️ セキュリティ機能

### 機密情報の自動サニタイズ

以下の情報は自動的にマスクされます：
- パスワード
- トークン
- API キー
- メールアドレス（部分的）
- 電話番号
- 住所
- その他の個人情報

### 例

```javascript
const userData = {
  email: 'user@example.com',
  password: 'secret123',
  name: 'John Doe'
};

logger.info('ユーザーデータ', userData);
// 出力: { email: 'us***@example.com', password: '[REDACTED]', name: 'John Doe' }
```

## 📊 本番環境でのログ管理

### 現在の実装
- 本番環境では重要なエラーログのみ出力
- コンソールへの出力を制限

### 将来的な拡張予定
- Sentry などのエラートラッキングサービスとの統合
- CloudWatch Logs などのログ管理サービスへの送信
- ログの分析とアラート機能

## 🔄 マイグレーション状況

### 完了した項目
- ✅ `/utils/logger.js` - メインロガーシステム
- ✅ `/contexts/AuthContext.js` - 認証コンテキスト
- ✅ `/services/reportService.js` - レポートサービス
- ✅ `/utils/firestoreUtils.js` - Firestore ユーティリティ
- ✅ `/pages/Auth/` - 認証ページ
- ✅ `/pages/Dashboard/` - ダッシュボード
- ✅ `/components/Layout/MainLayout.jsx` - メインレイアウト
- ✅ `/pages/Reports/BusinessAnalytics.jsx` - ビジネス分析
- ✅ `/pages/Seeds/SeedUseForm.jsx` - 種子使用フォーム

### 一部のファイルでの残存
他のページコンポーネントの一部には、まだ `console.log` を使用している箇所があります。これらは段階的に移行予定です。

## 🧪 テスト

ロガーシステムのテストファイルが `/utils/logger.test.js` に含まれています。

```bash
npm test -- --testPathPattern=logger.test.js
```

## 🚀 本番環境への展開

### 1. 環境設定の確認
```bash
# 本番環境用の設定
NODE_ENV=production
REACT_APP_ENABLE_CONSOLE_LOGGING=false
REACT_APP_ENABLE_REMOTE_LOGGING=true
```

### 2. ビルドとデプロイ
```bash
npm run build
```

### 3. ログの監視
本番環境では、重要なエラーログのみが出力されるため、定期的な監視が重要です。

## 📝 実装の詳細

### ファイル構成
```
src/
├── utils/
│   ├── logger.js          # メインロガーシステム
│   └── logger.test.js     # テストファイル
├── contexts/
│   └── AuthContext.js     # 認証コンテキスト (更新済み)
├── services/
│   └── reportService.js   # レポートサービス (更新済み)
└── ...
```

### 主要なクラスと関数

#### `Logger` クラス
- メインのロガークラス
- 全てのログレベルをサポート
- コンテキスト情報の管理

#### 特化型ロガー
- `authLogger`: 認証関連
- `firestoreLogger`: Firestore操作
- `businessLogger`: ビジネスロジック
- `uiLogger`: UI操作

#### ユーティリティ関数
- `createLogger()`: カスタムロガー作成
- `log.*`: 簡単なログ出力
- `sanitizeLogData()`: 機密情報のサニタイズ

## 🔍 トラブルシューティング

### よくある問題

1. **ログが出力されない**
   - 環境変数の設定を確認
   - ログレベルの設定を確認

2. **本番環境でデバッグログが出力される**
   - `NODE_ENV=production` が設定されているか確認

3. **エラーログに機密情報が含まれている**
   - サニタイズ機能が正しく動作しているか確認
   - 必要に応じて追加の機密フィールドを設定

## 📞 サポート

このロギングシステムについて質問や問題がある場合は、開発チームまでお問い合わせください。

---

**注意**: このロギングシステムは継続的に改善されています。新しい機能や変更について、定期的にこのドキュメントを確認してください。