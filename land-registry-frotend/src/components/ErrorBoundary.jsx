import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ margin: 0 }}>Something went wrong</h1>
          <p style={{ margin: 0, color: '#94a3b8' }}>The interface hit an unexpected error.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
