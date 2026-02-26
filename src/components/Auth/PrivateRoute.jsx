// src/components/Auth/PrivateRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    // ユーザーがログインしていない場合はログインページにリダイレクト
    return <Navigate to="/login" />;
  }
  
  // ユーザーがログインしている場合は子コンポーネントをレンダリング
  return children;
};

export default PrivateRoute;
