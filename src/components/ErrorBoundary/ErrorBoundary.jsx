// src/components/ErrorBoundary/ErrorBoundary.jsx
import React, { Component } from 'react';
import { securityLogger } from '../../utils/logger';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // セキュリティログとしてエラーを記録
    securityLogger.error('アプリケーションエラーが発生しました', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }, error);
  }

  handleReload = () => {
    window.location.reload();
  }

  handleGoHome = () => {
    window.location.href = '/';
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.662-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h2 className="mt-6 text-2xl font-bold text-gray-900">
                  エラーが発生しました
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  申し訳ございません。予期しないエラーが発生しました。
                </p>
                
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="mt-4 text-left">
                    <details className="bg-gray-50 p-4 rounded-lg text-xs">
                      <summary className="font-medium text-gray-900 cursor-pointer">
                        エラー詳細
                      </summary>
                      <div className="mt-2 text-red-600">
                        <p><strong>エラー:</strong> {this.state.error.toString()}</p>
                        <pre className="mt-2 whitespace-pre-wrap">
                          {this.state.error.stack}
                        </pre>
                        {this.state.errorInfo.componentStack && (
                          <>
                            <p className="mt-2"><strong>コンポーネントスタック:</strong></p>
                            <pre className="whitespace-pre-wrap">
                              {this.state.errorInfo.componentStack}
                            </pre>
                          </>
                        )}
                      </div>
                    </details>
                  </div>
                )}
                
                <div className="mt-6 space-y-3">
                  <button
                    onClick={this.handleReload}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    ページを再読み込み
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    ホームに戻る
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;