import type { BrowserWindow } from 'electron';
import type {
  UpdateAvailablePayload,
  UpdateDownloadedPayload,
  UpdateErrorPayload,
  UpdateNotAvailablePayload,
  UpdateProgressPayload,
} from './types';

export class UpdateWindow {
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window;
  }

  private send(channel: string, payload?: unknown) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.webContents.send(channel, payload);
  }

  emitChecking(source: string) {
    this.send('updater/checking-for-update', { source });
  }

  emitAvailable(payload: UpdateAvailablePayload) {
    this.send('updater/update-available', payload);
  }

  emitNotAvailable(payload: UpdateNotAvailablePayload) {
    this.send('updater/update-not-available', payload);
  }

  emitProgress(payload: UpdateProgressPayload) {
    this.send('updater/download-progress', payload);
  }

  emitDownloaded(payload: UpdateDownloadedPayload) {
    this.send('updater/update-downloaded', payload);
  }

  emitError(payload: UpdateErrorPayload) {
    this.send('updater/error', payload);
  }
}
