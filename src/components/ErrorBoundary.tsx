import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, Button } from '@grafana/ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[neon-city-panel] 3D rendering error', error, info.componentStack);
  }

  // Transient failures (e.g. WebGL context loss) are recoverable: remounting
  // the children rebuilds the whole Three.js engine from scratch.
  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      return (
        <div style={{ padding: 16 }}>
          <Alert title="3D rendering error" severity="error">
            <p>The Neon City panel encountered an error and could not render.</p>
            {error && (
              <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', fontSize: 12 }}>
                {error.message}
              </pre>
            )}
            <Button size="sm" variant="secondary" onClick={this.handleRetry} style={{ marginTop: 8 }}>
              Retry
            </Button>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
