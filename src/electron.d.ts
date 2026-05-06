export interface ElectronStorage {
  read: (key: string) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  write: (key: string, value: unknown) => Promise<{ ok: boolean; error?: string }>;
  keys: () => Promise<string[]>;
}

export interface ElectronAPI {
  getPrinters: () => Promise<unknown[]>;
  printLabel: (html: string, printerName: string, options?: Record<string, unknown>) => Promise<{ success: boolean; failureReason?: string }>;
  getAppVersion: () => Promise<string>;
  storage: ElectronStorage;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
