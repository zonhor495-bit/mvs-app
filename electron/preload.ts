const { contextBridge, ipcRenderer } = require('electron');

// Forward console and global errors from renderer to main for postmortem
function safeSend(channel: string, payload: any) {
  try {
    ipcRenderer.send(channel, payload);
  } catch (e) {
    // ignore
  }
}

// Capture uncaught errors and unhandled promise rejections
try {
  window.addEventListener('error', (ev) => {
    safeSend('renderer/log', { type: 'window-error', message: ev.message, filename: ev.filename, lineno: ev.lineno, colno: ev.colno, error: ev.error && ev.error.stack ? ev.error.stack : null });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason instanceof Error ? ev.reason.stack || ev.reason.message : ev.reason;
    safeSend('renderer/log', { type: 'unhandledrejection', reason });
  });

  // Monkeypatch only error and warning console methods to avoid noisy IPC traffic
  const consoleMethods = ['error', 'warn'] as const;
  consoleMethods.forEach((method) => {
    // @ts-ignore
    const orig = console[method];
    // @ts-ignore
    console[method] = function (...args: any[]) {
      try {
        safeSend('renderer/log', { type: 'console', level: method, args });
      } catch (e) {
        // ignore
      }
      orig.apply(console, args);
    };
  });
} catch (e) {
  // ignore
}

contextBridge.exposeInMainWorld('electron', {
  versions: process.versions,
  getVersion: () => ipcRenderer.invoke('app/getVersion'),
  getAppPath: () => ipcRenderer.invoke('app/getAppPath'),
  getPath: (name: string) => ipcRenderer.invoke('app/getPath', name),
  getGoogleClientId: () => ipcRenderer.invoke('config/getGoogleClientId'),
  exportReport: (data: { orders: Array<{ id: number; date: string; service: string; amount: number; paymentMethod: string; washer: string; licensePlate: string }>; from: string; to: string; fileName: string; }) => ipcRenderer.invoke('report/exportToExcel', data),
  // Updater API
  updater: {
    onUpdateAvailable: (callback: (data: { currentVersion: string; newVersion: string }) => void) => {
      ipcRenderer.on('updater/update-available', (_event: any, data: any) => callback(data));
    },
    onDownloadProgress: (callback: (progress: number) => void) => {
      ipcRenderer.on('updater/download-progress', (_event: any, progress: any) => callback(progress));
    },
    onUpdateDownloaded: (callback: (data: { version: string }) => void) => {
      ipcRenderer.on('updater/update-downloaded', (_event: any, data: any) => callback(data));
    },
    onError: (callback: (data: { message: string }) => void) => {
      ipcRenderer.on('updater/error', (_event: any, data: any) => callback(data));
    },
    checkForUpdates: () => ipcRenderer.invoke('updater/check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('updater/download-update'),
    installUpdate: () => ipcRenderer.invoke('updater/install-update'),
    dismissUpdate: () => ipcRenderer.invoke('updater/dismiss-update'),
  },
});
