import fs from 'fs';
import path from 'path';
import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import ExcelJS from 'exceljs';

// Using CommonJS build for Electron main: use Node's __dirname
const appDir = __dirname;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

// Configure electron-updater
autoUpdater.logger = {
  debug: (msg: string) => writeStartupLog('[updater-debug]', msg),
  info: (msg: string) => writeStartupLog('[updater-info]', msg),
  warn: (msg: string) => writeStartupLog('[updater-warn]', msg),
  error: (msg: string) => writeStartupLog('[updater-error]', msg),
};

// Initialize central logger for startup diagnostics
const logDir = path.join(app.getPath('appData'), 'MVS');
const logPath = path.join(logDir, 'startup.log');

function ensureLogDir() {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (e) {
    // ignore if can't create
  }
}

function writeStartupLog(...args: any[]) {
  ensureLogDir();
  try {
    const text = `[${new Date().toISOString()}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
    fs.appendFileSync(logPath, text);
  } catch (e) {
    // ignore logging errors
  }
  // eslint-disable-next-line no-console
  console.log(...args);
}

function readGoogleClientIdFromFile(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return '';
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as { VITE_GOOGLE_CLIENT_ID?: string; googleClientId?: string };
    return (parsed.VITE_GOOGLE_CLIENT_ID || parsed.googleClientId || '').trim();
  } catch (e) {
    writeStartupLog('Failed to read Google Client ID from file', filePath, String(e));
    return '';
  }
}

function resolveGoogleClientId(): string {
  const fromEnv = (process.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  if (fromEnv) return fromEnv;

  const userDataConfigPath = path.join(app.getPath('userData'), 'config.json');
  const fromUserData = readGoogleClientIdFromFile(userDataConfigPath);
  if (fromUserData) return fromUserData;

  const appDataConfigPath = path.join(app.getPath('appData'), 'MVS', 'config.json');
  const fromAppData = readGoogleClientIdFromFile(appDataConfigPath);
  if (fromAppData) return fromAppData;

  return '';
}

// Write startup header with versions and paths
function writeStartupHeader() {
  ensureLogDir();
  try {
    const timestamp = new Date().toISOString();
    const header = `\n${'='.repeat(80)}\nSTARTUP LOG - ${timestamp}\n${'='.repeat(80)}\n`;
    fs.appendFileSync(logPath, header);
    writeStartupLog('App Version:', app.getVersion());
    writeStartupLog('Electron Version:', process.versions.electron);
    writeStartupLog('Chrome Version:', process.versions.chrome);
    writeStartupLog('Node Version:', process.versions.node);
    writeStartupLog('App Dir:', appDir);
    writeStartupLog('App Path:', app.getAppPath());
    writeStartupLog('App Data Dir:', logDir);
    writeStartupLog('Is Packaged:', app.isPackaged);
    writeStartupLog('Is Dev:', isDev);
    writeStartupLog('Platform:', process.platform);
  } catch (e) {
    // ignore
  }
}

function createMainWindow() {
  writeStartupLog('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b1220',
    title: 'MVS — Car Management System',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(appDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: !isDev,
      devTools: isDev,
    },
  });

  mainWindow.once('ready-to-show', () => {
    writeStartupLog('Window ready-to-show');
    if (mainWindow) {
      try {
        mainWindow.setMenuBarVisibility(false);
      } catch (e) {
        writeStartupLog('setMenuBarVisibility failed', String(e));
      }
      mainWindow.show();
    }
  });

  // Setup 10-second timeout for window load
  let loadTimeout: NodeJS.Timeout | null = null;
  const setupLoadTimeout = () => {
    if (loadTimeout) clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
      writeStartupLog('ERROR: Window did not load within 10 seconds');
      if (mainWindow && !mainWindow.isDestroyed() && isDev) {
        try {
          mainWindow.webContents.openDevTools({ mode: 'right' });
        } catch (e) {
          writeStartupLog('Failed to open DevTools on timeout:', String(e));
        }
      }
    }, 10000);
  };

  // Attach webContents handlers to capture renderer errors, console messages and load failures
  const wc = mainWindow.webContents;
  
  wc.on('did-start-loading', () => {
    writeStartupLog('webContents did-start-loading');
    setupLoadTimeout();
  });

  wc.on('did-finish-load', () => {
    if (loadTimeout) clearTimeout(loadTimeout);
    loadTimeout = null;
    writeStartupLog('webContents did-finish-load', { url: wc.getURL() });
    if (isDev) {
      try {
        wc.openDevTools({ mode: 'right' });
        writeStartupLog('DevTools opened');
      } catch (e) {
        writeStartupLog('Failed to open DevTools', String(e));
      }
    }
  });

  wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (loadTimeout) clearTimeout(loadTimeout);
    loadTimeout = null;
    writeStartupLog('webContents did-fail-load', { errorCode, errorDescription, validatedURL, isMainFrame });
  });

  wc.on('console-message', (_event, level, message, line, sourceId) => {
    writeStartupLog('webContents console-message', { level, message, line, sourceId });
  });

  wc.on('render-process-gone', (_event, details) => {
    writeStartupLog('webContents render-process-gone', details);
  });

  wc.on('crashed', () => {
    writeStartupLog('webContents crashed');
  });

  // BrowserWindow events
  mainWindow.on('unresponsive', () => {
    writeStartupLog('BrowserWindow unresponsive');
  });

  // load the app
  const forceProd = process.env.FORCE_PROD === '1';
  if (isDev && !forceProd) {
    const devUrl = 'http://localhost:5173';
    writeStartupLog('Loading dev URL', devUrl);
    setupLoadTimeout();
    mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    writeStartupLog('Loading production file', indexPath, { isDev, forceProd });
    setupLoadTimeout();
    mainWindow.loadFile(indexPath).catch(err => {
      writeStartupLog('loadFile error', String(err));
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Global error handlers for main process
process.on('uncaughtException', (error) => {
  writeStartupLog('MAIN PROCESS: uncaughtException', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
});

process.on('unhandledRejection', (reason, promise) => {
  writeStartupLog('MAIN PROCESS: unhandledRejection', {
    reason: reason instanceof Error ? { name: reason.name, message: reason.message, stack: reason.stack } : reason,
    promise: String(promise),
  });
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  app.setAppUserModelId('com.mvs.management');
  writeStartupHeader();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  // Setup auto-updater event listeners
  setupAutoUpdater();
});

function setupAutoUpdater() {
  // Auto-check for updates on startup and periodically
  if (!isDev) {
    autoUpdater.checkForUpdates();
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000); // Check every hour
  }

  // Update available event
  autoUpdater.on('update-available', (info) => {
    writeStartupLog('[updater] Update available:', info);
    if (mainWindow) {
      mainWindow.webContents.send('updater/update-available', {
        currentVersion: app.getVersion(),
        newVersion: info.version,
      });
    }
  });

  // No update available
  autoUpdater.on('update-not-available', (info) => {
    writeStartupLog('[updater] No update available', info.version);
  });

  // Download started
  autoUpdater.on('download-progress', (progressObj) => {
    writeStartupLog('[updater] Download progress:', progressObj.percent);
    if (mainWindow) {
      mainWindow.webContents.send('updater/download-progress', progressObj.percent);
    }
  });

  // Download completed
  autoUpdater.on('update-downloaded', (info) => {
    writeStartupLog('[updater] Update downloaded:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('updater/update-downloaded', { version: info.version });
    }
  });

  // Error occurred
  autoUpdater.on('error', (error) => {
    writeStartupLog('[updater] Error:', error.message);
    if (mainWindow) {
      mainWindow.webContents.send('updater/error', { message: error.message });
    }
  });
}

ipcMain.handle('app/getVersion', () => app.getVersion());
ipcMain.handle('app/getAppPath', () => app.getAppPath());
ipcMain.handle('app/getPath', (_event: any, name: string) => app.getPath(name as any));
ipcMain.handle('config/getGoogleClientId', () => resolveGoogleClientId());

// Update-related IPC handlers
ipcMain.handle('updater/check-for-updates', async () => {
  return await autoUpdater.checkForUpdates();
});

ipcMain.handle('updater/download-update', async () => {
  return await autoUpdater.downloadUpdate();
});

ipcMain.handle('updater/install-update', async () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('updater/dismiss-update', () => {
  writeStartupLog('[updater] Update dismissed by user');
});

// Receive forwarded renderer logs/errors from preload and persist them
ipcMain.on('renderer/log', (_event: any, payload: any) => {
  try {
    ensureLogDir();
    const text = `[${new Date().toISOString()}] RENDERER ${JSON.stringify(payload)}\n`;
    fs.appendFileSync(logPath, text);
  } catch (e) {
    // ignore
  }
  // eslint-disable-next-line no-console
  console.log('RENDERER', payload);
});

ipcMain.handle('report/exportToExcel', async (_event: any, data: { orders: Array<{ id: number; date: string; service: string; amount: number; paymentMethod: string; washer: string; licensePlate: string; [key: string]: any }>; from: string; to: string; fileName: string; warehouse?: { items?: Array<Record<string, any>>; movements?: Array<Record<string, any>>; purchases?: Array<Record<string, any>>; expenses?: Array<Record<string, any>>; cost?: Array<Record<string, any>>; }; }) => {
  const hasWarehouse = Boolean(data.warehouse && (data.warehouse.items?.length || data.warehouse.movements?.length || data.warehouse.purchases?.length || data.warehouse.expenses?.length || data.warehouse.cost?.length));

  let workbook: ExcelJS.Workbook;
  if (hasWarehouse) {
    workbook = new ExcelJS.Workbook();
    const addSheet = (name: string, rows: Array<Record<string, any>>) => {
      const sheet = workbook.addWorksheet(name);
      if (rows.length === 0) {
        sheet.addRow(['No data']);
        return;
      }
      const keys = Object.keys(rows[0]);
      sheet.columns = keys.map(key => ({ header: key, key, width: 20 }));
      rows.forEach(row => sheet.addRow(row));
    };

    addSheet('Товары', data.warehouse?.items || []);
    addSheet('Движения', data.warehouse?.movements || []);
    addSheet('Закупки', data.warehouse?.purchases || []);
    addSheet('Расходы', data.warehouse?.expenses || []);
    addSheet('Себестоимость', data.warehouse?.cost || []);
    if (data.orders.length > 0) {
      addSheet('Заказы', data.orders);
    }
  } else {
    const templatePath = path.join(appDir, 'template.xlsx');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Excel template not found: ${templatePath}`);
    }

    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const sheet = workbook.worksheets[0];
    const startRow = 5;
    const endRow = 500;

    for (let row = startRow; row <= endRow; row += 1) {
      const excelRow = sheet.getRow(row);
      for (let col = 2; col <= 6; col += 1) {
        excelRow.getCell(col).value = null;
      }
    }

    if (sheet.model.merges) {
      const decodeColumn = (letters: string) => letters.split('').reduce((result, char) => result * 26 + (char.charCodeAt(0) - 64), 0);
      const mergedEntries = Object.entries(sheet.model.merges as Record<string, any>).filter(([range]) => {
        const start = range.split(':')[0];
        const match = start.match(/^([A-Z]+)(\d+)$/i);
        if (!match) return false;
        const col = decodeColumn(match[1].toUpperCase());
        const row = Number(match[2]);
        return row < startRow || col > 6;
      });
      sheet.model.merges = Object.fromEntries(mergedEntries) as any;
    }

    const rowsByDay = data.orders.reduce((acc: Record<string, Array<typeof data.orders[0]>>, order) => {
      const dateKey = new Date(order.date).toISOString().slice(0, 10);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(order);
      return acc;
    }, {} as Record<string, Array<typeof data.orders[0]>>);

    const sortedDates = Object.keys(rowsByDay).sort();
    let writeRow = startRow;

    for (const dateKey of sortedDates) {
      const orders = rowsByDay[dateKey];
      const dateLabel = formatDate(new Date(dateKey));
      const dateCell = sheet.getCell(writeRow, 2);
      dateCell.value = dateLabel;
      dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      dateCell.font = { bold: true };
      dateCell.alignment = { horizontal: 'left', vertical: 'middle' };

      for (let col = 3; col <= 6; col += 1) {
        sheet.getCell(writeRow, col).value = '';
      }
      sheet.mergeCells(writeRow, 2, writeRow, 6);
      writeRow += 1;

      orders.forEach(order => {
        const values = [order.id, order.service, order.amount, order.paymentMethod, order.washer];
        values.forEach((value, idx) => {
          const cell = sheet.getCell(writeRow, idx + 2);
          cell.value = value;
          if (idx === 2 && typeof value === 'number') {
            cell.numFmt = '0.00';
          }
        });
        writeRow += 1;
      });
    }
  }

  const saveResult = await dialog.showSaveDialog({
    title: 'Сохранить отчёт',
    defaultPath: path.join(app.getPath('documents'), data.fileName),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (saveResult.canceled || !saveResult.filePath) {
    return { canceled: true };
  }

  await workbook.xlsx.writeFile(saveResult.filePath);
  return { canceled: false, filePath: saveResult.filePath };
});

function formatDate(date: Date): string {
  return `${date.getDate()} ${date.toLocaleString('ru-RU', { month: 'long' })}`;
}
