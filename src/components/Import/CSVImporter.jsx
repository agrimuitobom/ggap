// src/components/Import/CSVImporter.jsx
import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';

const CSVImporter = ({
  templateColumns,
  templateFileName,
  onImport,
  sampleData = [],
  title = 'CSVインポート'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  // CSVテンプレートをダウンロード
  const downloadTemplate = () => {
    const headers = templateColumns.map(col => col.label).join(',');
    const sampleRows = sampleData.map(row =>
      templateColumns.map(col => {
        const value = row[col.key] || '';
        // カンマや改行を含む場合はダブルクォートで囲む
        if (value.toString().includes(',') || value.toString().includes('\n') || value.toString().includes('"')) {
          return `"${value.toString().replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ).join('\n');

    const csvContent = '\uFEFF' + headers + '\n' + sampleRows; // BOM付きUTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = templateFileName;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('テンプレートをダウンロードしました');
  };

  // CSVファイルをパース
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('データが見つかりません。ヘッダー行とデータ行が必要です。');
    }

    // ヘッダー行をパース
    const headers = parseCSVLine(lines[0]);

    // ヘッダーのマッピングを確認
    const columnMapping = {};
    const missingColumns = [];

    templateColumns.forEach(col => {
      const index = headers.findIndex(h =>
        h.trim() === col.label || h.trim() === col.key
      );
      if (index !== -1) {
        columnMapping[col.key] = index;
      } else if (col.required) {
        missingColumns.push(col.label);
      }
    });

    if (missingColumns.length > 0) {
      throw new Error(`必須列が見つかりません: ${missingColumns.join(', ')}`);
    }

    // データ行をパース
    const data = [];
    const parseErrors = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      try {
        const values = parseCSVLine(lines[i]);
        const row = {};

        templateColumns.forEach(col => {
          const index = columnMapping[col.key];
          if (index !== undefined && index < values.length) {
            let value = values[index]?.trim() || '';

            // 型変換
            if (col.type === 'boolean') {
              value = value === 'true' || value === 'はい' || value === '○' || value === '1' || value === '適合';
            } else if (col.type === 'date' && value) {
              // 日付パース (YYYY-MM-DD, YYYY/MM/DD など)
              const dateMatch = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
              if (dateMatch) {
                value = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
              }
            }

            row[col.key] = value;
          } else {
            row[col.key] = col.defaultValue || '';
          }
        });

        // 必須フィールドの検証
        const missingRequired = templateColumns
          .filter(col => col.required && !row[col.key])
          .map(col => col.label);

        if (missingRequired.length > 0) {
          parseErrors.push(`行${i + 1}: 必須項目が空です (${missingRequired.join(', ')})`);
        } else {
          data.push(row);
        }
      } catch (e) {
        parseErrors.push(`行${i + 1}: パースエラー - ${e.message}`);
      }
    }

    return { data, errors: parseErrors };
  };

  // CSV行をパース（カンマ区切り、ダブルクォート対応）
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current);
    return result;
  };

  // ファイル選択ハンドラ
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイル形式チェック
    if (!file.name.endsWith('.csv')) {
      toast.error('CSVファイルを選択してください');
      return;
    }

    try {
      const text = await file.text();
      const { data, errors: parseErrors } = parseCSV(text);

      setPreviewData(data);
      setErrors(parseErrors);

      if (data.length === 0 && parseErrors.length > 0) {
        toast.error('有効なデータがありません');
      } else {
        toast.success(`${data.length}件のデータを読み込みました`);
      }
    } catch (err) {
      toast.error(err.message || 'ファイルの読み込みに失敗しました');
      setPreviewData(null);
      setErrors([err.message]);
    }

    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // インポート実行
  const handleImport = async () => {
    if (!previewData || previewData.length === 0) {
      toast.error('インポートするデータがありません');
      return;
    }

    setImporting(true);
    try {
      await onImport(previewData);
      toast.success(`${previewData.length}件のデータをインポートしました`);
      setPreviewData(null);
      setErrors([]);
      setIsOpen(false);
    } catch (err) {
      toast.error('インポート中にエラーが発生しました: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 inline-flex items-center"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        CSVインポート
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold">{title}</h2>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setPreviewData(null);
                  setErrors([]);
                }}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* コンテンツ */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* ステップ1: テンプレートダウンロード */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">ステップ1: テンプレートをダウンロード</h3>
                <p className="text-sm text-gray-600 mb-3">
                  下のボタンからCSVテンプレートをダウンロードし、データを入力してください。
                </p>
                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  テンプレートをダウンロード
                </button>

                {/* 列の説明 */}
                <div className="mt-4 bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">テンプレートの列:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    {templateColumns.map(col => (
                      <div key={col.key} className="flex items-center">
                        <span className={col.required ? 'text-red-600' : 'text-gray-600'}>
                          {col.label}
                          {col.required && ' *'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">* は必須項目です</p>
                </div>
              </div>

              {/* ステップ2: ファイルアップロード */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">ステップ2: CSVファイルをアップロード</h3>
                <p className="text-sm text-gray-600 mb-3">
                  データを入力したCSVファイルを選択してください。
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded file:border-0
                    file:text-sm file:font-semibold
                    file:bg-green-50 file:text-green-700
                    hover:file:bg-green-100"
                />
              </div>

              {/* エラー表示 */}
              {errors.length > 0 && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-800 mb-2">エラー:</p>
                  <ul className="list-disc list-inside text-sm text-red-700 max-h-32 overflow-y-auto">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* プレビュー */}
              {previewData && previewData.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">
                    プレビュー ({previewData.length}件)
                  </h3>
                  <div className="overflow-x-auto border rounded-lg max-h-64">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          {templateColumns.slice(0, 5).map(col => (
                            <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-700">
                              {col.label}
                            </th>
                          ))}
                          {templateColumns.length > 5 && (
                            <th className="px-3 py-2 text-left font-medium text-gray-500">...</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-t">
                            {templateColumns.slice(0, 5).map(col => (
                              <td key={col.key} className="px-3 py-2 text-gray-700">
                                {col.type === 'boolean'
                                  ? (row[col.key] ? '○' : '×')
                                  : (row[col.key]?.toString() || '-')}
                              </td>
                            ))}
                            {templateColumns.length > 5 && (
                              <td className="px-3 py-2 text-gray-500">...</td>
                            )}
                          </tr>
                        ))}
                        {previewData.length > 10 && (
                          <tr className="border-t bg-gray-50">
                            <td colSpan={6} className="px-3 py-2 text-center text-gray-500">
                              ... 他 {previewData.length - 10} 件
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* フッター */}
            <div className="p-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setPreviewData(null);
                  setErrors([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleImport}
                disabled={!previewData || previewData.length === 0 || importing}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {importing ? 'インポート中...' : `${previewData?.length || 0}件をインポート`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CSVImporter;
