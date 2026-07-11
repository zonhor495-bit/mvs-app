import React, { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }
      return (
        <div className="glass rounded-xl p-6 m-4 border border-red-500/20 bg-red-500/5">
          <h2 className="text-lg font-semibold text-red-400 mb-2">Произошла ошибка</h2>
          <p className="text-slate-400 text-sm mb-4">{this.state.error.message}</p>
          <button
            onClick={this.retry}
            className="btn-neon px-4 py-2 text-sm rounded-lg"
          >
            Повторить
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
