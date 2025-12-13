import { Component, ReactNode } from 'react';

import { FeatureFlag, logError } from '@/utils';

import { ErrorView } from './ErrorView';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logError(error, {
      flag: FeatureFlag.ui,
      message: 'React render error',
      stack: info.componentStack ?? undefined,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorView
          errorMessage={this.state.errorMessage}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
