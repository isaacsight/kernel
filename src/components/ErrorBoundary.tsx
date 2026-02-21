import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { t } = useTranslation('common');
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-6 opacity-20">!</div>
        <h2 className="text-2xl mb-4">{t('errorTitle')}</h2>
        <p className="opacity-60 italic mb-6">
          {error?.message || t('errorDefault')}
        </p>
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-[--rubin-slate] text-[--rubin-ivory] rounded-full mono text-sm hover:opacity-90 transition-opacity"
        >
          {t('tryAgain')}
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
