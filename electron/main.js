const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');


function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Barcode & Label Generator',
    show: false,
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready to avoid flickering
  win.once('ready-to-show', () => {
    win.show();
  });

  // Remove default menu bar (optional - comment out to keep menu)
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  // IPC handler for printer enumeration
  ipcMain.handle('printers:list', async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win || win.isDestroyed()) return [];
    try {
      if (typeof win.webContents.getPrintersAsync === 'function') {
        return await win.webContents.getPrintersAsync();
      }
      return win.webContents.getPrinters?.() ?? [];
    } catch {
      return [];
    }
  });

  // IPC handler for printing label
  ipcMain.handle('label:print', async (event, { html, printerName, options }) => {
    let printWin;
    try {
      printWin = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });
      // data: URLs have a ~2MB limit in some Chromium builds; write to a temp file
      // for large payloads to avoid silent truncation.
      const encoded = encodeURIComponent(html);
      await printWin.loadURL(`data:text/html;charset=utf-8,${encoded}`);
    } catch (loadErr) {
      if (printWin && !printWin.isDestroyed()) printWin.destroy();
      return { success: false, failureReason: `Failed to load print page: ${String(loadErr)}` };
    }

    return new Promise(resolve => {
      // Guard: if the print callback never fires, resolve after 30 s to unblock renderer.
      const safetyTimer = setTimeout(() => {
        if (printWin && !printWin.isDestroyed()) printWin.destroy();
        resolve({ success: false, failureReason: 'Print timed out after 30 seconds' });
      }, 30000);

      try {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: printerName,
            ...options,
          },
          (success, failureReason) => {
            clearTimeout(safetyTimer);
            if (printWin && !printWin.isDestroyed()) printWin.close();
            resolve({ success, failureReason });
          }
        );
      } catch (printErr) {
        clearTimeout(safetyTimer);
        if (printWin && !printWin.isDestroyed()) printWin.destroy();
        resolve({ success: false, failureReason: String(printErr) });
      }
    });
  });

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  // File-based storage IPC — persists data under app userData directory
  const userDataPath = app.getPath('userData');

  ipcMain.handle('storage:read', async (_event, key) => {
    const filePath = path.join(userDataPath, `${key}.json`);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return { ok: true, data: JSON.parse(raw) };
    } catch (e) {
      // File missing or corrupted — not an error, caller handles it
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle('storage:write', async (_event, key, value) => {
    const filePath = path.join(userDataPath, `${key}.json`);
    const tmpPath = filePath + '.tmp';
    try {
      // Write to temp file first, then rename — prevents corruption on crash
      fs.writeFileSync(tmpPath, JSON.stringify(value), 'utf8');
      fs.renameSync(tmpPath, filePath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle('storage:keys', async () => {
    try {
      const files = fs.readdirSync(userDataPath).filter(f => f.endsWith('.json'));
      return files.map(f => f.replace(/\.json$/, ''));
    } catch {
      return [];
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
