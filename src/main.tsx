import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { hydrateFromDisk } from './services/storageService';
import { useBarcodeStore, STORAGE_KEYS, DEFAULT_LABEL_SETTINGS, GeneratedLabel, LabelSettings } from './store/barcodeStore';

// ── Error Boundary ────────────────────────────────────────────────────────────
interface EBState { error: Error | null }
class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[CC-PRINTER] Render crash:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 32, fontFamily: 'system-ui, sans-serif',
          background: '#fff1f2', minHeight: '100vh', color: '#991b1b',
        }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Application Error</h2>
          <p style={{ marginBottom: 8, fontSize: 14 }}>{this.state.error.message}</p>
          <pre style={{
            fontSize: 12, background: '#fff', padding: 12, borderRadius: 6,
            overflowX: 'auto', color: '#374151', maxHeight: 300, overflowY: 'auto',
          }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 16, padding: '8px 20px', background: '#dc2626',
              color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
            }}
          >
            Try to Recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Startup Hydration ─────────────────────────────────────────────────────────
// Pull fresher data from Electron file storage after the initial localStorage-based
// store is already live.  Uses direct setState for history to avoid calling
// addToHistory() in a loop (which would trigger N disk writes + N re-renders).
async function hydrateStore() {
  await hydrateFromDisk([...STORAGE_KEYS], (key, value) => {
    if (key === 'gms_label_settings') {
      const parsed = value as Partial<LabelSettings>;
      useBarcodeStore.getState().setLabelSettings({ ...DEFAULT_LABEL_SETTINGS, ...parsed });
    } else if (key === 'gms_label_history') {
      const arr = value as GeneratedLabel[];
      const { labelHistory } = useBarcodeStore.getState();
      if (Array.isArray(arr) && arr.length > labelHistory.length) {
        const hydrated = arr
          .slice(0, 100)
          .map(h => ({ ...h, timestamp: new Date(h.timestamp) }));
        // Set directly — avoids N storageWrite IPC calls and N React re-renders
        useBarcodeStore.setState({ labelHistory: hydrated });
      }
    }
  });
}

// ── Mount ─────────────────────────────────────────────────────────────────────
const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:24px;color:red">Fatal: #root element missing from HTML.</div>';
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>
  );

  hydrateStore().catch(err => {
    console.warn('[CC-PRINTER] hydrateStore non-fatal error:', err);
  });
}
