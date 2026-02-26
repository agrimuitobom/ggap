// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebaseの設定
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// Firestore初期化と設定（QUIC protocol error対策）
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Force long polling to avoid QUIC errors
  ignoreUndefinedProperties: true,
});

export const auth = getAuth(app);
export const storage = getStorage(app);
