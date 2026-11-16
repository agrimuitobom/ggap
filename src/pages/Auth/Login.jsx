// src/pages/Auth/Login.jsx
import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authLogger } from '../../utils/logger';
import { loginIdToEmail } from '../../services/viewerAccountService';
import {
  AuthLayout,
  TextField,
  PasswordField,
  PrimaryButton,
  Divider,
  GoogleButton,
  googleErrorMessage
} from '../../components/Auth/AuthLayout';

const loginErrorMessage = (error) => {
  switch (error.code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'メールアドレス（または閲覧用ID）かパスワードが正しくありません';
    case 'auth/invalid-email':
      return 'メールアドレスまたは閲覧用IDの形式が正しくありません';
    case 'auth/user-disabled':
      return 'このアカウントは無効になっています。管理者に連絡してください';
    case 'auth/too-many-requests':
      return 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください';
    case 'auth/network-request-failed':
      return '通信できませんでした。電波状況を確認してください';
    case 'auth/configuration-not-found':
      return '認証設定が見つかりません。管理者に連絡してください';
    default:
      return 'ログインに失敗しました: ' + error.message;
  }
};

const Login = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, login, loginWithGoogle, resetPassword } = useAuth();

  // ログイン前に開こうとしていた画面があればそこへ戻る
  const from = location.state?.from;
  const destination = from ? `${from.pathname}${from.search || ''}` : '/';

  if (currentUser) {
    return <Navigate to={destination} replace />;
  }

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setNotice('');
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate(destination, { replace: true });
    } catch (error) {
      authLogger.error('Googleログインエラー', { errorCode: error.code }, error);
      setError(googleErrorMessage(error));
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      await login(loginIdToEmail(email), password);
      navigate(destination, { replace: true });
    } catch (error) {
      authLogger.error('ログインエラー', { errorCode: error.code }, error);
      setError(loginErrorMessage(error));
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();

    try {
      setError('');
      setNotice('');
      setLoading(true);
      await resetPassword(email);
    } catch (error) {
      authLogger.error('パスワード再設定メール送信エラー', { errorCode: error.code }, error);
      if (error.code === 'auth/invalid-email') {
        setError('無効なメールアドレス形式です');
        setLoading(false);
        return;
      }
      if (error.code === 'auth/network-request-failed' || error.code === 'auth/too-many-requests') {
        setError('送信できませんでした。しばらく待ってから再試行してください');
        setLoading(false);
        return;
      }
      // 未登録のアドレスかどうかは画面に出さない（登録有無を第三者に知らせないため）
    }
    setLoading(false);
    setMode('login');
    setNotice('登録済みのアドレスであれば、パスワード再設定用のメールを送信しました。メールをご確認ください。');
  };

  if (mode === 'reset') {
    return (
      <AuthLayout title="パスワードの再設定" error={error}>
        <form className="space-y-4" onSubmit={handleReset}>
          <p className="text-sm text-gray-600">
            登録したメールアドレスを入力してください。再設定用のリンクをお送りします。
            閲覧用IDのパスワードは、発行した管理者にお問い合わせください。
          </p>
          <TextField
            id="reset-email"
            label="メールアドレス"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? '送信中…' : '再設定メールを送信'}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="block w-full py-2 text-center text-sm font-medium text-green-700 hover:text-green-900"
          >
            ログイン画面へ戻る
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="ログイン" error={error} notice={notice}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <TextField
          id="email-address"
          label="メールアドレス または 閲覧用ID"
          name="email"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          id="password"
          label="パスワード"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="text-right">
          <button
            type="button"
            onClick={() => switchMode('reset')}
            className="text-sm font-medium text-green-700 hover:text-green-900"
          >
            パスワードをお忘れですか？
          </button>
        </div>
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'ログイン中…' : 'ログイン'}
        </PrimaryButton>
      </form>

      <Divider />

      <GoogleButton onClick={handleGoogleLogin} disabled={loading}>
        Googleでログイン
      </GoogleButton>

      <p className="mt-6 text-center text-sm text-gray-600">
        アカウントをお持ちでない方は
        <Link to="/register" className="ml-1 font-semibold text-green-700 hover:text-green-900">
          新規登録
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
