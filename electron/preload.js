const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: async () => {
    return await ipcRenderer.invoke('printers:list');
  },
  printLabel: async (html, printerName, options = {}) => {
    return await ipcRenderer.invoke('label:print', { html, printerName, options });
  },
  getAppVersion: () => {
    return ipcRenderer.invoke('app:getVersion');
  },
  // File-based persistent storage (userData directory)
  storage: {
    read: (key) => ipcRenderer.invoke('storage:read', key),
    write: (key, value) => ipcRenderer.invoke('storage:write', key, value),
    keys: () => ipcRenderer.invoke('storage:keys'),
  },
});
