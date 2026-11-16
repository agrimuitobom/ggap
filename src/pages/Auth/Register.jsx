// src/pages/Auth/Register.jsx
import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authLogger } from '../../utils/logger';
import {
  AuthLayout,
  TextField,
  PasswordField,
  PrimaryButton,
  Divider,
  GoogleButton,
  googleErrorMessage
} from '../../components/Auth/AuthLayout';

const signupErrorMessage = (error) => {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'このメールアドレスは既に使用されています';
    case 'auth/invalid-email':
      return '無効なメールアドレス形式です';
    case 'auth/weak-password':
      return 'パスワードが弱すぎます。より強力なパスワードを設定してください';
    case 'auth/network-request-failed':
      return '通信できませんでした。電波状況を確認してください';
    case 'auth/configuration-not-found':
      return '認証設定が見つかりません。管理者に連絡してください';
    default:
      return 'アカウント作成に失敗しました: ' + error.message;
  }
};

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser, signup, loginWithGoogle } = useAuth();

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/', { replace: true });
    } catch (error) {
      authLogger.error('Googleログインエラー', { errorCode: error.code }, error);
      setError(googleErrorMessage(error));
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      return setError('パスワードは6文字以上である必要があります');
    }

    if (password !== passwordConfirm) {
      return setError('パスワードが一致していません');
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password, name);
      navigate('/', { replace: true });
    } catch (error) {
      authLogger.error('登録エラー', { email, name, errorCode: error.code }, error);
      setError(signupErrorMessage(error));
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="アカウント登録" error={error}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <TextField
          id="name"
          label="氏名"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          id="email-address"
          label="メールアドレス"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          id="password"
          label="パスワード"
          name="password"
          autoComplete="new-password"
          hint="6文字以上"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          id="password-confirm"
          label="パスワード（確認）"
          name="password-confirm"
          autoComplete="new-password"
          required
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
        />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? '登録中…' : 'アカウント登録'}
        </PrimaryButton>
      </form>

      <Divider />

      <GoogleButton onClick={handleGoogleLogin} disabled={loading}>
        Googleで登録
      </GoogleButton>

      <p className="mt-6 text-center text-sm text-gray-600">
        すでにアカウントをお持ちの方は
        <Link to="/login" className="ml-1 font-semibold text-green-700 hover:text-green-900">
          ログイン
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
