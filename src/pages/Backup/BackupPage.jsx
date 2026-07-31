// src/pages/Backup/BackupPage.jsx
// データのバックアップ（書き出し）と復元。
// 「誤って消してしまったときに戻せる」ことを目的にしている。
import React, { useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  createBackup,
  downloadBackup,
  parseBackupFile,
  countBackupDocs,
  restoreBackup
} from '../../services/backupService';
import { firestoreLogger } from '../../utils/logger';
import toast from 'react-hot-toast';

const BackupPage = () => {
  const { currentOrganization, isAdmin, isMember } = useOrganization();

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [lastBackup, setLastBackup] = useState(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [restoreMode, setRestoreMode] = useState('missing');
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);

  const handleExport = async () => {
    if (!currentOrganization) return;
    setExporting(true);
    setExportProgress({ name: '', done: 0, total: 1 });
    try {
      const backup = await createBackup(currentOrganization, (name, done, total) => {
        setExportProgress({ name, done, total });
      });
      downloadBackup(backup);
      setLastBackup(backup);
      toast.success(`${backup.totalDocs}件のデータを書き出しました`);
    } catch (err) {
      firestoreLogger.error('バックアップの作成に失敗しました', { organizationId: currentOrganization?.id }, err);
      toast.error('バックアップの作成中にエラーが発生しました');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const handleFileSelect = async (e) => {
    const f = e.target.files?.[0];
    setRestoreResult(null);
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    try {
      const backup = await parseBackupFile(f);
      setFile(f);
      setPreview({ backup, ...countBackupDocs(backup) });
    } catch (err) {
      toast.error(err.message);
      setFile(null);
      setPreview(null);
    }
  };

  const handleRestore = async () => {
    if (!preview || !currentOrganization) return;

    const differentOrg = preview.backup.organizationId !== currentOrganization.id;
    const confirmText = [
      `${preview.total}件のデータを「${currentOrganization.name}」に復元します。`,
      restoreMode === 'overwrite'
        ? '⚠️ 同じ記録が既にある場合、バックアップの内容で上書きされます（現在の内容は失われます）。'
        : '既にある記録はそのまま残し、無くなっている記録だけを戻します。',
      differentOrg
        ? `⚠️ このバックアップは別の組織（${preview.backup.organizationName || '不明'}）のものです。本当に取り込みますか？`
        : '',
      '実行してよろしいですか？'
    ].filter(Boolean).join('\n\n');

    if (!window.confirm(confirmText)) return;

    setRestoring(true);
    setRestoreResult(null);
    setRestoreProgress({ name: '', done: 0, total: 1 });
    try {
      const result = await restoreBackup(currentOrganization.id, preview.backup, {
        mode: restoreMode,
        onProgress: (name, done, total) => setRestoreProgress({ name, done, total })
      });
      setRestoreResult(result);
      toast.success(`${result.restored}件を復元しました`);
    } catch (err) {
      firestoreLogger.error('復元に失敗しました', { organizationId: currentOrganization?.id }, err);
      toast.error('復元中にエラーが発生しました');
    } finally {
      setRestoring(false);
      setRestoreProgress(null);
    }
  };

  const progressBar = (progress) => {
    if (!progress) return null;
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="mt-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">{progress.name}（{pct}%）</p>
      </div>
    );
  };

  if (!isMember) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">💾 バックアップ</h1>
        <p className="text-gray-500">この機能は管理者・メンバーのみ利用できます。</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl pb-24">
      <h1 className="text-2xl font-bold mb-1">💾 バックアップと復元</h1>
      <p className="text-sm text-gray-500 mb-4">
        記録をまとめてファイルに書き出し、万一のときに戻せるようにします。
        書き出したファイルはGoogleドライブなど、アプリの外に保管してください。
      </p>

      {/* 書き出し */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <h2 className="font-bold mb-2">1. バックアップを作る</h2>
        <p className="text-sm text-gray-600 mb-3">
          「{currentOrganization?.name}」のすべての記録（作業日誌・収穫・農薬・清掃・教育訓練など）を
          1つのファイルにまとめてダウンロードします。
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-6 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50"
        >
          {exporting ? '書き出し中...' : 'バックアップをダウンロード'}
        </button>
        {progressBar(exportProgress)}

        {lastBackup && !exporting && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
            ✓ {new Date(lastBackup.exportedAt).toLocaleString('ja-JP')} 時点のデータを
            {lastBackup.totalDocs}件書き出しました。
          </div>
        )}

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900">
          <p className="font-bold mb-1">運用のおすすめ</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>月に1回、または学期の終わりに実行する</li>
            <li>ファイルはGoogleドライブなど、別の場所に保管する</li>
            <li>古いバックアップも数世代残しておく（最新だけだと、間違いに気づく前の状態に戻せない）</li>
            <li>作業日誌の写真は含まれません（写真はStorageに保存されているため）</li>
          </ul>
        </div>
      </div>

      {/* 復元 */}
      <div className="bg-white shadow rounded-lg p-4">
        <h2 className="font-bold mb-2">2. バックアップから復元する</h2>
        {!isAdmin ? (
          <p className="text-sm text-gray-500">復元は管理者のみ実行できます。</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-3">
              書き出したファイルを選ぶと、内容を確認してから復元できます。
              記録は元のIDのまま戻すため、ロット番号や作付との紐づけは保たれます。
            </p>

            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelect}
              className="block w-full text-sm mb-3 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
            />

            {preview && (
              <>
                <div className="bg-gray-50 border rounded p-3 mb-3 text-sm">
                  <p className="font-bold mb-1">ファイルの内容</p>
                  <p className="text-gray-700">
                    組織: {preview.backup.organizationName || '不明'}
                    {preview.backup.organizationId !== currentOrganization?.id && (
                      <span className="ml-2 text-amber-700 font-bold">（現在の組織と異なります）</span>
                    )}
                  </p>
                  <p className="text-gray-700">
                    作成日時: {preview.backup.exportedAt
                      ? new Date(preview.backup.exportedAt).toLocaleString('ja-JP') : '不明'}
                  </p>
                  <p className="text-gray-700 mb-2">合計 {preview.total} 件</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(preview.counts).map(([name, n]) => (
                      <span key={name} className="text-xs bg-white border px-2 py-0.5 rounded">
                        {name}: {n}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-sm font-bold text-gray-700 mb-2">復元のしかた</p>
                  <label className="flex items-start gap-2 mb-2 text-sm">
                    <input
                      type="radio"
                      checked={restoreMode === 'missing'}
                      onChange={() => setRestoreMode('missing')}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-bold">無くなっている記録だけを戻す（推奨）</span>
                      <span className="block text-xs text-gray-500">
                        今ある記録には手を触れません。誤って削除した記録を戻したいときはこちら。
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      checked={restoreMode === 'overwrite'}
                      onChange={() => setRestoreMode('overwrite')}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-bold text-red-700">バックアップの内容で上書きする</span>
                      <span className="block text-xs text-gray-500">
                        バックアップ後に加えた変更は失われます。内容が壊れてしまった場合のみ使ってください。
                      </span>
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className={`px-6 py-3 font-bold rounded text-white disabled:opacity-50 ${
                    restoreMode === 'overwrite' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {restoring ? '復元中...' : '復元する'}
                </button>
                {progressBar(restoreProgress)}
              </>
            )}

            {restoreResult && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
                <p className="font-bold">復元が完了しました</p>
                <p>戻した記録: {restoreResult.restored}件</p>
                {restoreResult.skipped > 0 && <p>既にあったため触らなかった記録: {restoreResult.skipped}件</p>}
                {restoreResult.failed > 0 && (
                  <p className="text-red-700">戻せなかった記録: {restoreResult.failed}件</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BackupPage;
