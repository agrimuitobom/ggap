// src/hooks/useOnlineStatus.js
import { useEffect, useState } from 'react';

/** ブラウザのオンライン状態を返す（圏外の圃場で使われることを想定） */
const useOnlineStatus = () => {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
};

export default useOnlineStatus;
