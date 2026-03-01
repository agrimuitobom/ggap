// src/pages/Visitors/VisitorsList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import CSVImporter from '../../components/Import/CSVImporter';

const VisitorsList = () => {
  const { currentUser } = useAuth();
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // CSVテンプレートの列定義
  const templateColumns = [
    { key: 'visitDate', label: '訪問日', required: true, type: 'date' },
    { key: 'visitorName', label: '訪問者名', required: true },
    { key: 'organization', label: '所属・会社名', required: false },
    { key: 'purpose', label: '訪問目的', required: true },
    { key: 'contactInfo', label: '連絡先', required: false },
    { key: 'vehicleNumber', label: '車両番号', required: false },
    { key: 'entryTime', label: '入場時間', required: false },
    { key: 'exitTime', label: '退場時間', required: false },
    { key: 'visitedAreas', label: '訪問エリア', required: false },
    { key: 'hygieneCompliance', label: '衛生管理', required: false, type: 'boolean', defaultValue: true },
    { key: 'notes', label: '備考', required: false }
  ];

  // サンプルデータ
  const sampleData = [
    {
      visitDate: '2025-04-01',
      visitorName: '山田太郎',
      organization: 'ABC商事',
      purpose: '商談',
      contactInfo: '090-1234-5678',
      vehicleNumber: '品川 300 あ 1234',
      entryTime: '10:00',
      exitTime: '12:00',
      visitedAreas: '事務所',
      hygieneCompliance: '適合',
      notes: ''
    },
    {
      visitDate: '2025-04-02',
      visitorName: '鈴木花子',
      organization: 'XYZ株式会社',
      purpose: '視察',
      contactInfo: '080-9876-5432',
      vehicleNumber: '',
      entryTime: '14:00',
      exitTime: '16:00',
      visitedAreas: '圃場A、倉庫',
      hygieneCompliance: '適合',
      notes: 'GAP認証の確認'
    }
  ];

  useEffect(() => {
    if (currentUser) {
      fetchVisitors();
    }
  }, [currentUser]);

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'visitors'),
        where('userId', '==', currentUser.uid),
        orderBy('visitDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const visitorsData = [];
      querySnapshot.forEach((doc) => {
        visitorsData.push({
          id: doc.id,
          ...doc.data(),
          visitDate: doc.data().visitDate?.toDate()
        });
      });
      setVisitors(visitorsData);
    } catch (err) {
      console.error('Error fetching visitors:', err);
      setError('訪問者記録の取得中にエラーが発生しました。');
      toast.error('訪問者記録の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    try {
      await deleteDoc(doc(db, 'visitors', id));
      setVisitors(visitors.filter(visitor => visitor.id !== id));
      setDeleteConfirm(null);
      toast.success('訪問者記録を削除しました');
    } catch (err) {
      console.error('Error deleting visitor:', err);
      setError('訪問者記録の削除中にエラーが発生しました。');
      toast.error('訪問者記録の削除中にエラーが発生しました');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  // CSVインポート処理
  const handleImport = async (data) => {
    const batch = [];

    for (const row of data) {
      const visitorData = {
        userId: currentUser.uid,
        visitDate: row.visitDate ? new Date(row.visitDate) : new Date(),
        visitorName: row.visitorName || '',
        organization: row.organization || '',
        purpose: row.purpose || '',
        contactInfo: row.contactInfo || '',
        vehicleNumber: row.vehicleNumber || '',
        entryTime: row.entryTime || '',
        exitTime: row.exitTime || '',
        visitedAreas: row.visitedAreas || '',
        hygieneCompliance: row.hygieneCompliance === true || row.hygieneCompliance === '適合' || row.hygieneCompliance === 'はい' || row.hygieneCompliance === '○',
        notes: row.notes || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.push(addDoc(collection(db, 'visitors'), visitorData));
    }

    await Promise.all(batch);
    await fetchVisitors(); // リストを再読み込み
  };

  // CSVエクスポート
  const handleExport = () => {
    if (visitors.length === 0) {
      toast.error('エクスポートするデータがありません');
      return;
    }

    const headers = templateColumns.map(col => col.label).join(',');
    const rows = visitors.map(visitor => {
      return templateColumns.map(col => {
        let value = '';
        if (col.key === 'visitDate' && visitor.visitDate) {
          value = format(visitor.visitDate, 'yyyy-MM-dd');
        } else if (col.key === 'hygieneCompliance') {
          value = visitor.hygieneCompliance ? '適合' : '不適合';
        } else {
          value = visitor[col.key] || '';
        }
        // カンマや改行を含む場合はダブルクォートで囲む
        if (value.toString().includes(',') || value.toString().includes('\n') || value.toString().includes('"')) {
          return `"${value.toString().replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    }).join('\n');

    const csvContent = '\uFEFF' + headers + '\n' + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `訪問者記録_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('CSVをエクスポートしました');
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">訪問者管理</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">訪問者管理</h1>
        <div className="flex flex-wrap gap-2">
          <CSVImporter
            templateColumns={templateColumns}
            templateFileName="訪問者インポートテンプレート.csv"
            onImport={handleImport}
            sampleData={sampleData}
            title="訪問者データのインポート"
          />
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 inline-flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSVエクスポート
          </button>
          <Link
            to="/visitors/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            新規登録
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
          {error}
        </div>
      )}

      {visitors.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left font-semibold">訪問日</th>
                <th className="py-3 px-4 text-left font-semibold">訪問者名</th>
                <th className="py-3 px-4 text-left font-semibold">所属</th>
                <th className="py-3 px-4 text-left font-semibold">訪問目的</th>
                <th className="py-3 px-4 text-left font-semibold hidden md:table-cell">連絡先</th>
                <th className="py-3 px-4 text-left font-semibold">衛生管理</th>
                <th className="py-3 px-4 text-left font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => (
                <tr key={visitor.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    {visitor.visitDate ? format(visitor.visitDate, 'yyyy年MM月dd日') : '-'}
                  </td>
                  <td className="py-3 px-4">{visitor.visitorName || '-'}</td>
                  <td className="py-3 px-4">{visitor.organization || '-'}</td>
                  <td className="py-3 px-4">{visitor.purpose || '-'}</td>
                  <td className="py-3 px-4 hidden md:table-cell">{visitor.contactInfo || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      visitor.hygieneCompliance
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {visitor.hygieneCompliance ? '適合' : '不適合'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {deleteConfirm === visitor.id ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDelete(visitor.id)}
                          className="text-red-700 hover:text-red-900"
                        >
                          確認
                        </button>
                        <button
                          onClick={handleCancelDelete}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <Link
                          to={`/visitors/edit/${visitor.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          編集
                        </Link>
                        <button
                          onClick={() => handleDelete(visitor.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-gray-50 px-4 py-2 border-t">
            <p className="text-sm text-gray-500">{visitors.length}件の訪問者記録</p>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-500 mb-4">訪問者記録がありません。</p>
          <div className="flex flex-col md:flex-row justify-center gap-3">
            <Link
              to="/visitors/new"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              訪問者を登録する
            </Link>
            <CSVImporter
              templateColumns={templateColumns}
              templateFileName="訪問者インポートテンプレート.csv"
              onImport={handleImport}
              sampleData={sampleData}
              title="訪問者データのインポート"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitorsList;
