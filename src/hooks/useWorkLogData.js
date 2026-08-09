// src/hooks/useWorkLogData.js
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { getWorkers } from '../services/workerService';
import { firestoreLogger } from '../utils/logger';

export const useWorkLogData = (editId = null) => {
  const { currentUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const [fields, setFields] = useState([]);
  const [users, setUsers] = useState([]);
  const [fertilizers, setFertilizers] = useState([]);
  const [seeds, setSeeds] = useState([]);
  // ロットIDの採番・選択に使う既存の播種・定植記録
  const [seedUses, setSeedUses] = useState([]);
  const [pesticides, setPesticides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser || !currentOrganization) return;

      try {
        setLoading(true);

        const orgId = currentOrganization.id;

        // 並行してデータを取得
        const [
          fieldsSnapshot,
          workersList,
          fertilizersSnapshot,
          seedsSnapshot,
          pesticidesSnapshot,
          seedUsesSnapshot
        ] = await Promise.all([
          getDocs(query(collection(db, 'fields'), where('organizationId', '==', orgId))),
          getWorkers(orgId, currentUser.uid),
          getDocs(query(collection(db, 'fertilizers'), where('organizationId', '==', orgId))),
          getDocs(query(collection(db, 'seeds'), where('organizationId', '==', orgId))),
          getDocs(query(collection(db, 'pesticides'), where('organizationId', '==', orgId))),
          getDocs(query(collection(db, 'seedUses'), where('organizationId', '==', orgId)))
        ]);

        // データを配列に変換
        const fieldsList = fieldsSnapshot.docs.map(doc => ({
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
        setUsers(workersList);
        setFertilizers(fertilizersList);
        setSeeds(seedsList);
        setPesticides(pesticidesList);
        setSeedUses(seedUsesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (err) {
        firestoreLogger.error('作業日誌フォームデータの取得エラー', { organizationId: currentOrganization?.id }, err);
        setError('データの取得中にエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, currentOrganization]);

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
          lotNumber: data.lotNumber || '',
          fertilizerMethod: data.fertilizerMethod || '',
          // 播種関連
          seedId: data.seedId || '',
          seedAmount: data.seedAmount?.toString() || '',
          seedUnit: data.seedUnit || '粒',
          seedMethod: data.seedMethod || '',
          // 防除関連
          pesticideId: data.pesticideId || '',
          targetPest: data.targetPest || '',
          dilutionRate: data.dilutionRate?.toString() || '',
          pesticideAmount: data.pesticideAmount?.toString() || '',
          pesticideUnit: data.pesticideUnit || 'L',
          treatedArea: data.treatedArea?.toString() || '',
          pesticideMethod: data.pesticideMethod || '',
          weather: data.weather || '',
          temperature: data.temperature?.toString() || '',
          windSpeed: data.windSpeed?.toString() || '',
          photoUrls: data.photoUrls || [],
          plantingId: data.plantingId || ''
        };
      } else {
        throw new Error('指定された作業日誌データが見つかりません。');
      }
    } catch (err) {
      firestoreLogger.error('作業日誌の既存データ取得エラー', { workLogId: id }, err);
      throw err;
    }
  };

  return {
    fields,
    users,
    fertilizers,
    seeds,
    seedUses,
    pesticides,
    loading,
    error,
    fetchExistingData
  };
};