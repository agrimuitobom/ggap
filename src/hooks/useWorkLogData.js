// src/hooks/useWorkLogData.js
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

export const useWorkLogData = (editId = null) => {
  const { currentUser } = useAuth();
  const [fields, setFields] = useState([]);
  const [users, setUsers] = useState([]);
  const [fertilizers, setFertilizers] = useState([]);
  const [seeds, setSeeds] = useState([]);
  const [pesticides, setPesticides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        
        // 並行してデータを取得
        const [
          fieldsSnapshot,
          usersSnapshot,
          fertilizersSnapshot,
          seedsSnapshot,
          pesticidesSnapshot
        ] = await Promise.all([
          getDocs(query(collection(db, 'fields'), where('userId', '==', currentUser.uid))),
          getDocs(query(collection(db, 'users'))),
          getDocs(query(collection(db, 'fertilizers'), where('userId', '==', currentUser.uid))),
          getDocs(query(collection(db, 'seeds'), where('userId', '==', currentUser.uid))),
          getDocs(query(collection(db, 'pesticides'), where('userId', '==', currentUser.uid)))
        ]);

        // データを配列に変換
        const fieldsList = fieldsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const usersList = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const fertilizersList = fertilizersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const seedsList = seedsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const pesticidesList = pesticidesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // 状態を更新
        setFields(fieldsList);
        setUsers(usersList);
        setFertilizers(fertilizersList);
        setSeeds(seedsList);
        setPesticides(pesticidesList);

      } catch (err) {
        console.error('Error fetching form data:', err);
        setError('データの取得中にエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  // 既存データを取得する関数
  const fetchExistingData = async (id) => {
    try {
      const docRef = doc(db, 'workLogs', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          date: data.date?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          fieldId: data.fieldId || '',
          workType: data.workType || '',
          workers: data.workers || [],
          details: data.details || '',
          workHours: data.workHours?.toString() || '',
          harvestAmount: data.harvestAmount?.toString() || '',
          wasteAmount: data.wasteAmount?.toString() || '',
          // 施肥関連
          fertilizerId: data.fertilizerId || '',
          fertilizerAmount: data.fertilizerAmount?.toString() || '',
          fertilizerUnit: data.fertilizerUnit || 'kg',
          fertilizerMethod: data.fertilizerMethod || '',
          // 播種関連
          seedId: data.seedId || '',
          seedAmount: data.seedAmount?.toString() || '',
          seedMethod: data.seedMethod || '',
          // 防除関連
          pesticideId: data.pesticideId || '',
          targetPest: data.targetPest || '',
          dilutionRate: data.dilutionRate?.toString() || '',
          pesticideAmount: data.pesticideAmount?.toString() || '',
          pesticideUnit: data.pesticideUnit || 'L',
          pesticideMethod: data.pesticideMethod || '',
          weather: data.weather || '',
          temperature: data.temperature?.toString() || '',
          windSpeed: data.windSpeed?.toString() || ''
        };
      } else {
        throw new Error('指定された作業日誌データが見つかりません。');
      }
    } catch (err) {
      console.error('Error fetching existing data:', err);
      throw err;
    }
  };

  return {
    fields,
    users,
    fertilizers,
    seeds,
    pesticides,
    loading,
    error,
    fetchExistingData
  };
};