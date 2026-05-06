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
    if (win && win.webContents.getPrintersAsync) {
      const printers = await win.webContents.getPrintersAsync();
      return printers;
    }
    // Fallback to sync version if async not available
    return win?.webContents.getPrinters?.() ?? [];
  });

  // IPC handler for printing label
  ipcMain.handle('label:print', async (event, { html, printerName, options }) => {
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return new Promise(resolve => {
      printWin.webContents.print({
        silent: true,
        printBackground: true,
        deviceName: printerName,
        ...options,
      }, (success, failureReason) => {
        resolve({ success, failureReason });
        printWin.close();
      });
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
