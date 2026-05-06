export interface ElectronAPI {
  getPrinters: () => Promise<any[]>;
  printLabel: (html: string, printerName: string, options?: any) => Promise<{ success: boolean; failureReason?: string }>;
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
