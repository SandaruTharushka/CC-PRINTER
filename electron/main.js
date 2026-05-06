const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');


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
