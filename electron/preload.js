const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: async () => {
    // Returns array of printer objects from Electron
    return await ipcRenderer.invoke('printers:list');
  },
  printLabel: async (html, printerName, options = {}) => {
    // Send label HTML and printer name to main process for silent printing
    return await ipcRenderer.invoke('label:print', { html, printerName, options });
  },
  getAppVersion: () => {
    return ipcRenderer.invoke('app:getVersion');
  },
});
