import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '12px',
            fontFamily: 'sans-serif',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <p style={{ margin: 0, color: '#666' }}>
            An unexpected error occurred. Try refreshing the page.
          </p>
          <details>
            <summary>Error details</summary>
            <pre style={{ margin: '8px 0 0', textAlign: 'left', whiteSpace: 'pre-wrap' }}>
              {this.state.error.message}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '8px', padding: '8px 20px', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
