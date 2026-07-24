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
  windowControls: {
    minimize: () => ipcRenderer.invoke('window/minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window/toggle-maximize'),
    close: () => ipcRenderer.invoke('window/close'),
    isMaximized: () => ipcRenderer.invoke('window/is-maximized'),
  },
  exportReport: (data: { orders: Array<{ id: number; date: string; service: string; amount: number; paymentMethod: string; washer: string; licensePlate: string }>; from: string; to: string; fileName: string; }) => ipcRenderer.invoke('report/exportToExcel', data),
  // Updater API
  updater: {
    onCheckingForUpdate: (callback: (data: { source: 'startup' | 'manual' | 'scheduled' }) => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('updater/checking-for-update', listener);
      return () => ipcRenderer.removeListener('updater/checking-for-update', listener);
    },
    onUpdateAvailable: (callback: (data: { currentVersion: string; newVersion: string; releaseNotes: string[] }) => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('updater/update-available', listener);
      return () => ipcRenderer.removeListener('updater/update-available', listener);
    },
    onUpdateNotAvailable: (callback: (data: { version: string; source: 'startup' | 'manual' | 'scheduled' }) => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('updater/update-not-available', listener);
      return () => ipcRenderer.removeListener('updater/update-not-available', listener);
    },
    onDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number; remainingSeconds: number | null }) => void) => {
      const listener = (_event: any, progress: any) => callback(progress);
      ipcRenderer.on('updater/download-progress', listener);
      return () => ipcRenderer.removeListener('updater/download-progress', listener);
    },
    onUpdateDownloaded: (callback: (data: { version: string }) => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('updater/update-downloaded', listener);
      return () => ipcRenderer.removeListener('updater/update-downloaded', listener);
    },
    onError: (callback: (data: { message: string }) => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('updater/error', listener);
      return () => ipcRenderer.removeListener('updater/error', listener);
    },
    checkForUpdates: (source: 'manual' | 'startup' | 'scheduled' = 'manual') => ipcRenderer.invoke('updater/check-for-updates', source),
    downloadUpdate: () => ipcRenderer.invoke('updater/download-update'),
    installUpdate: () => ipcRenderer.invoke('updater/install-update'),
    dismissUpdate: () => ipcRenderer.invoke('updater/dismiss-update'),
  },
});
