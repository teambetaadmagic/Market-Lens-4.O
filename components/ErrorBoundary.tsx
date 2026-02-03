import React, { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ERROR BOUNDARY CAUGHT:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex flex-col items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-red-200">
            <div className="bg-red-600 p-8 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <AlertCircle className="text-white" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Something Went Wrong</h1>
              <p className="text-red-100 text-sm">The application encountered an unexpected error</p>
            </div>

            <div className="p-6 space-y-4">
              {this.state.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 overflow-auto max-h-48">
                  <p className="text-xs text-red-600 font-mono font-bold mb-2">Error Details:</p>
                  <p className="text-xs text-red-700 font-mono whitespace-pre-wrap break-words">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer font-bold text-red-600 mb-2">Stack Trace</summary>
                      <pre className="text-red-700 font-mono whitespace-pre-wrap break-words text-[10px]">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 mb-3">
                  <strong>Try these steps:</strong>
                </p>
                <ol className="text-xs text-blue-800 space-y-2">
                  <li>1. <strong>Refresh the page</strong> (F5 or Cmd+R)</li>
                  <li>2. <strong>Clear browser cache</strong> and reload</li>
                  <li>3. <strong>Open DevTools</strong> (F12) to see console errors</li>
                  <li>4. <strong>Check your internet connection</strong></li>
                </ol>
              </div>

              <button
                onClick={() => window.location.reload()}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-red-700 transition"
              >
                Reload Application
              </button>

              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full bg-gray-200 text-gray-900 py-3 rounded-lg font-bold text-sm hover:bg-gray-300 transition"
              >
                Clear Data & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
