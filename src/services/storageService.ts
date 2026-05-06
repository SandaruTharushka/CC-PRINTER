/**
 * Persistent storage service.
 *
 * Priority: Electron file storage (userData directory) → localStorage fallback
 *
 * Electron file storage is written atomically (tmp → rename) so it survives
 * crashes. localStorage stays in sync as a hot-cache / non-Electron fallback.
 *
 * Corrupted JSON is detected and replaced with the supplied default value —
 * existing data is never silently erased without a backup attempt.
 */

function hasElectronStorage(): boolean {
  return !!(window.electronAPI?.storage);
}

/**
 * Read a value. Returns `defaultValue` if the key is missing or corrupted.
 */
export async function storageRead<T>(key: string, defaultValue: T): Promise<T> {
  // 1. Electron file storage
  if (hasElectronStorage()) {
    try {
      const result = await window.electronAPI!.storage.read(key);
      if (result.ok && result.data !== undefined) {
        return result.data as T;
      }
    } catch {
      // fall through to localStorage
    }
  }

  // 2. localStorage fallback / cache
  let lsRaw: string | null = null;
  try {
    lsRaw = localStorage.getItem(key);
    if (lsRaw !== null) {
      return JSON.parse(lsRaw) as T;
    }
  } catch {
    // corrupted localStorage entry — back up before removing
    if (lsRaw !== null) {
      try { localStorage.setItem(`${key}__corrupted_${Date.now()}`, lsRaw); } catch { /* ignore */ }
    }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  return defaultValue;
}

/**
 * Write a value to both Electron file storage and localStorage.
 */
export async function storageWrite<T>(key: string, value: T): Promise<void> {
  // Always write localStorage first (synchronous, fast hot-cache)
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage quota or security error — non-fatal
  }

  // Electron file storage (persistent across Chromium data clears)
  if (hasElectronStorage()) {
    try {
      await window.electronAPI!.storage.write(key, value);
    } catch {
      // non-fatal — localStorage copy still exists
    }
  }
}

/**
 * Synchronous read for store initialisation (localStorage only).
 * Call `hydrateFromDisk()` after store init to upgrade from Electron files.
 *
 * If the stored JSON is corrupted, the raw bytes are backed up under
 * `<key>__corrupted_<timestamp>` before the broken entry is removed,
 * so user data is never silently destroyed.
 */
export function storageReadSync<T>(key: string, defaultValue: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // Backup the corrupted bytes before removing them
    if (raw !== null) {
      try {
        const backupKey = `${key}__corrupted_${Date.now()}`;
        localStorage.setItem(backupKey, raw);
        console.warn(`[storage] Corrupted entry backed up as "${backupKey}". Resetting "${key}" to default.`);
      } catch { /* ignore – storage full or access denied */ }
    }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
  return defaultValue;
}

/**
 * After store initialisation, pull fresher data from Electron file storage
 * and call `onUpdate` for each key that has data on disk.
 *
 * This lets synchronous init work immediately while file I/O catches up.
 */
export async function hydrateFromDisk(
  keys: string[],
  onUpdate: (key: string, value: unknown) => void
): Promise<void> {
  if (!hasElectronStorage()) return;
  for (const key of keys) {
    try {
      const result = await window.electronAPI!.storage.read(key);
      if (result.ok && result.data !== undefined) {
        // Write back to localStorage so future sync reads are current
        try { localStorage.setItem(key, JSON.stringify(result.data)); } catch { /* ignore */ }
        onUpdate(key, result.data);
      }
    } catch {
      // key not on disk yet — skip
    }
  }
}
