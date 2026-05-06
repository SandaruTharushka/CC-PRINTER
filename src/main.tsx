import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { hydrateFromDisk } from './services/storageService';
import { useBarcodeStore, STORAGE_KEYS, DEFAULT_LABEL_SETTINGS, GeneratedLabel, LabelSettings } from './store/barcodeStore';

// After React mounts, pull fresher data from Electron file storage (if available).
// The store already loaded from localStorage — this upgrades it with persistent file data.
async function hydrateStore() {
  await hydrateFromDisk([...STORAGE_KEYS], (key, value) => {
    const { setLabelSettings, addToHistory, labelHistory } = useBarcodeStore.getState();
    if (key === 'gms_label_settings') {
      const parsed = value as Partial<LabelSettings>;
      setLabelSettings({ ...DEFAULT_LABEL_SETTINGS, ...parsed });
    } else if (key === 'gms_label_history') {
      const arr = value as GeneratedLabel[];
      if (Array.isArray(arr) && arr.length > labelHistory.length) {
        arr.forEach(h => addToHistory({ ...h, timestamp: new Date(h.timestamp) }));
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

hydrateStore().catch(() => { /* non-fatal */ });
