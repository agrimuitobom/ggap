// src/pages/Auth/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authLogger } from '../../utils/logger';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== passwordConfirm) {
      return setError('パスワードが一致していません');
    }
    
    // パスワードの長さチェック
    if (password.length < 6) {
      return setError('パスワードは6文字以上である必要があります');
    }
    
    try {
      setError('');
      setLoading(true);
      await signup(email, password, name);
      navigate('/');
    } catch (error) {
      authLogger.error("登録エラー", { email, name, errorCode: error.code }, error);
      
      // エラーコードに基づいたわかりやすいメッセージ
      if (error.code === 'auth/email-already-in-use') {
        setError('このメールアドレスは既に使用されています');
      } else if (error.code === 'auth/invalid-email') {
        setError('無効なメールアドレス形式です');
      } else if (error.code === 'auth/weak-password') {
        setError('パスワードが弱すぎます。より強力なパスワードを設定してください');
      } else if (error.code === 'auth/configuration-not-found') {
        setError('認証設定が見つかりません。管理者に連絡してください');
      } else {
        setError('アカウント作成に失敗しました: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            GAPTracker
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            アカウント登録
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="name" className="sr-only">
                氏名
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="氏名"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email-address" className="sr-only">
                メールアドレス
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="パスワード (6文字以上)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password-confirm" className="sr-only">
                パスワード(確認)
              </label>
              <input
                id="password-confirm"
                name="password-confirm"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="パスワード(確認)"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? '登録中...' : 'アカウント登録'}
            </button>
          </div>
          
          <div className="text-sm text-center">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              すでにアカウントをお持ちの方はこちら
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
