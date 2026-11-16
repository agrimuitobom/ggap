// src/components/Auth/PrivateRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  
  if (!currentUser) {
    // 未ログインならログインページへ。ログイン後に元の画面へ戻れるよう行き先を渡す
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  
  // ユーザーがログインしている場合は子コンポーネントをレンダリング
  return children;
};

export default PrivateRoute;
