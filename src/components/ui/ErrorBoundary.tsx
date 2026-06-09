import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * App-level error boundary — the last-resort net so an unexpected render throw
 * degrades to a recoverable message instead of a blank white screen.
 *
 * The most realistic trigger is a corrupted/tampered URL hash producing data
 * the layout can't handle. Since the tree lives entirely in the URL, we offer
 * "Reload" (retry the same link) and "Open a fresh tree" (drop the hash) so the
 * victim of a bad link can always get back to a working app.
 *
 * Kept dependency-free and language-neutral on purpose: it must render even if
 * the i18n/theme layers themselves failed.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Roots] Unhandled render error:', error, info.componentStack);
  }

  private openFresh = () => {
    // Strip the hash (the tree data) and reload to a clean state.
    window.location.href = window.location.pathname;
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#041107',
          color: '#dfeae1',
          fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <h1
            style={{
              fontFamily: '"Spectral", Georgia, serif',
              fontWeight: 600,
              fontSize: '1.5rem',
              margin: '0 0 0.5rem',
            }}
          >
            Something went wrong
          </h1>
          <p style={{ color: '#9fb6a5', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            Roots hit an unexpected error. Your data is only in this link — try
            reloading, or open a fresh tree if a shared link looks corrupted.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #8bbf93',
                background: 'transparent',
                color: '#8bbf93',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.openFresh}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #24382a',
                background: 'transparent',
                color: '#9fb6a5',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Open a fresh tree
            </button>
          </div>
        </div>
      </div>
    );
  }
}
