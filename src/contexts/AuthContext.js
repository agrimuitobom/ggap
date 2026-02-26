// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { authLogger } from '../utils/logger';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password, name) {
    try {
      authLogger.info('サインアップ開始', { email, name });
      
      // Firebase Authenticationでユーザー作成
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      authLogger.info('認証ユーザー作成成功', { uid: userCredential.user.uid });
      
      try {
        // ユーザープロフィールを更新
        await updateProfile(userCredential.user, {
          displayName: name
        });
        authLogger.info('ユーザープロフィール更新成功');
        
        // Firestoreにユーザー情報を保存
        const userData = {
          name,
          email,
          role: 'user',
          createdAt: serverTimestamp()
        };
        
        authLogger.info('Firestoreにユーザーデータを保存', userData);
        await setDoc(doc(db, 'users', userCredential.user.uid), userData);
        authLogger.info('Firestoreへのユーザーデータ保存成功');
        
        // ユーザープロフィールをセット
        setUserProfile(userData);
        
        return userCredential;
      } catch (profileError) {
        authLogger.error('ユーザープロフィールまたはFirestore保存エラー', {}, profileError);
        // エラーが発生しても認証自体は成功しているので、ユーザークレデンシャルを返す
        return userCredential;
      }
    } catch (error) {
      authLogger.error('サインアップエラー', {}, error);
      throw error;
    }
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  async function fetchUserProfile(user) {
    if (!user) return null;
    
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        authLogger.info('ユーザープロフィール取得成功', docSnap.data());
        return docSnap.data();
      } else {
        authLogger.info('ユーザープロフィールが見つかりません。自動作成を試みます', { uid: user.uid });
        // ユーザープロフィールが見つからない場合、自動的に作成
        try {
          const newUserData = {
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: 'user',
            createdAt: serverTimestamp(),
            autoCreated: true
          };
          
          await setDoc(docRef, newUserData);
          authLogger.info('ユーザープロフィールを自動作成しました', { uid: user.uid });
          return newUserData;
        } catch (createError) {
          authLogger.error('ユーザープロフィール自動作成エラー', { uid: user.uid }, createError);
          return null;
        }
      }
    } catch (error) {
      authLogger.error('ユーザープロフィール取得エラー', {}, error);
      return null;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      authLogger.info('認証状態変更', { status: user ? 'ログイン' : 'ログアウト', email: user?.email });
      setCurrentUser(user);
      
      if (user) {
        const profile = await fetchUserProfile(user);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
