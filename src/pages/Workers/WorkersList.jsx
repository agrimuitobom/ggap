// src/pages/Workers/WorkersList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, getDocs, deleteDoc, doc, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import CSVImporter from '../../components/Import/CSVImporter';

const WorkersList = () => {
  const { currentUser } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const roles = [
    '農場主',
    '農場管理者',
    '正社員',
    'パート・アルバイト',
    '研修生',
    '季節労働者',
    'その他'
  ];

  // CSVテンプレートの列定義
  const templateColumns = [
    { key: 'name', label: '名前', required: true },
    { key: 'role', label: '役職', required: true },
    { key: 'email', label: 'メールアドレス', required: false },
    { key: 'phone', label: '電話番号', required: false },
    { key: 'department', label: '部署・担当', required: false },
    { key: 'hireDate', label: '入社日', required: false, type: 'date' },
    { key: 'status', label: '在籍状態', required: false, defaultValue: '在籍' },
    { key: 'certifications', label: '保有資格', required: false },
    { key: 'skills', label: 'スキル', required: false },
    { key: 'notes', label: '備考', required: false }
  ];

  // サンプルデータ
  const sampleData = [
    {
      name: '山田太郎',
      role: '正社員',
      email: 'yamada@example.com',
      phone: '090-1234-5678',
      department: '生産部門',
      hireDate: '2024-04-01',
      status: '在籍',
      certifications: '農薬管理指導士',
      skills: 'トラクター操作、剪定',
      notes: ''
    },
    {
      name: '鈴木花子',
      role: '研修生',
      email: 'suzuki@example.com',
      phone: '080-9876-5432',
      department: '',
      hireDate: '2025-04-01',
      status: '在籍',
      certifications: '',
      skills: '',
      notes: '令和7年度入学'
    }
  ];

  useEffect(() => {
    fetchWorkers();
  }, [currentUser]);

  const fetchWorkers = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const workersQuery = query(
        collection(db, 'users'),
        where('organizationId', '==', currentUser.uid)
      );
      const workersSnapshot = await getDocs(workersQuery);
      const workersList = [];
      workersSnapshot.forEach((doc) => {
        workersList.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // 名前でソート
      workersList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setWorkers(workersList);
    } catch (err) {
      console.error('Error fetching workers:', err);
      toast.error('従業員データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (workerId, workerName) => {
    if (!window.confirm(`「${workerName}」を削除してもよろしいですか？\n\n※この操作は取り消せません。`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', workerId));
      setWorkers(workers.filter(worker => worker.id !== workerId));
      toast.success('従業員を削除しました');
    } catch (err) {
      console.error('Error deleting worker:', err);
      toast.error('従業員の削除中にエラーが発生しました');
    }
  };

  // CSVインポート処理
  const handleImport = async (data) => {
    const batch = [];

    for (const row of data) {
      const workerData = {
        organizationId: currentUser.uid,
        name: row.name || '',
        role: row.role || '',
        email: row.email || '',
        phone: row.phone || '',
        department: row.department || '',
        hireDate: row.hireDate ? new Date(row.hireDate) : null,
        status: row.status || '在籍',
        certifications: row.certifications || '',
        skills: row.skills || '',
        notes: row.notes || '',
        emergencyContact: '',
        emergencyPhone: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.push(addDoc(collection(db, 'users'), workerData));
    }

    await Promise.all(batch);
    await fetchWorkers(); // リストを再読み込み
  };

  // CSVエクスポート
  const handleExport = () => {
    if (workers.length === 0) {
      toast.error('エクスポートするデータがありません');
      return;
    }

    const headers = templateColumns.map(col => col.label).join(',');
    const rows = workers.map(worker => {
      return templateColumns.map(col => {
        let value = '';
        if (col.key === 'hireDate' && worker.hireDate) {
          const date = worker.hireDate.toDate ? worker.hireDate.toDate() : new Date(worker.hireDate);
          value = date.toISOString().split('T')[0];
        } else {
          value = worker[col.key] || '';
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
    link.download = `従業員一覧_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('CSVをエクスポートしました');
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch =
      (worker.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (worker.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || worker.role === filterRole;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">従業員管理</h1>
        <div className="flex justify-center items-center h-64">
          <span className="text-gray-500">読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">従業員管理</h1>
        <div className="flex flex-wrap gap-2">
          <CSVImporter
            templateColumns={templateColumns}
            templateFileName="従業員インポートテンプレート.csv"
            onImport={handleImport}
            sampleData={sampleData}
            title="従業員データのインポート"
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
            to="/workers/new"
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            従業員を追加
          </Link>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">検索</label>
            <input
              type="text"
              placeholder="名前またはメールで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">役職で絞り込み</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">すべての役職</option>
              {roles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 従業員リスト */}
      {filteredWorkers.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">従業員が登録されていません</h3>
          <p className="mt-1 text-sm text-gray-500">
            従業員を追加して、教育訓練記録の参加者として選択できるようにしましょう。
          </p>
          <div className="mt-6 flex flex-col md:flex-row justify-center gap-3">
            <Link
              to="/workers/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              従業員を追加
            </Link>
            <CSVImporter
              templateColumns={templateColumns}
              templateFileName="従業員インポートテンプレート.csv"
              onImport={handleImport}
              sampleData={sampleData}
              title="従業員データのインポート"
            />
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    名前
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    役職
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    連絡先
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    入社日
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-green-600 font-medium text-sm">
                              {(worker.name || '?').charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{worker.name}</div>
                          <div className="text-sm text-gray-500">{worker.email || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{worker.role || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-900">{worker.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                      <span className="text-sm text-gray-900">
                        {worker.hireDate
                          ? (worker.hireDate.toDate
                            ? worker.hireDate.toDate().toLocaleDateString('ja-JP')
                            : new Date(worker.hireDate).toLocaleDateString('ja-JP'))
                          : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        worker.status === '在籍'
                          ? 'bg-green-100 text-green-800'
                          : worker.status === '休職中'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {worker.status || '在籍'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/workers/edit/${worker.id}`}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        編集
                      </Link>
                      <button
                        onClick={() => handleDelete(worker.id, worker.name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-6 py-3 border-t">
            <p className="text-sm text-gray-500">
              {filteredWorkers.length}件の従業員
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkersList;
