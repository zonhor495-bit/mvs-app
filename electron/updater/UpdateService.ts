import { app, dialog } from 'electron';
import { autoUpdater, type AppUpdater, type UpdateInfo } from 'electron-updater';
import type { UpdateWindow } from './UpdateWindow';
import type { UpdateCheckSource } from './types';

interface UpdateServiceDeps {
  isDev: boolean;
  logger: (...args: any[]) => void;
  updateWindow: UpdateWindow;
}

function normalizeReleaseNotes(raw: UpdateInfo['releaseNotes']): string[] {
  if (!raw) return [];

  if (typeof raw === 'string') {
    return raw
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
  }

  if (Array.isArray(raw)) {
    return raw
      .flatMap((note) => String(note.note ?? '').split('\n'))
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
  }

  return [];
}

export class UpdateService {
  private readonly updater: AppUpdater;
  private readonly isDev: boolean;
  private readonly log: (...args: any[]) => void;
  private readonly updateWindow: UpdateWindow;

  private checkTimer: NodeJS.Timeout | null = null;
  private pendingManualDialog = false;
  private initialized = false;

  constructor({ isDev, logger, updateWindow }: UpdateServiceDeps) {
    this.isDev = isDev;
    this.log = logger;
    this.updateWindow = updateWindow;
    this.updater = autoUpdater;
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;

    this.updater.logger = {
      debug: (msg: string) => this.log('[updater-debug]', msg),
      info: (msg: string) => this.log('[updater-info]', msg),
      warn: (msg: string) => this.log('[updater-warn]', msg),
      error: (msg: string) => this.log('[updater-error]', msg),
    } as any;

    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = true;
    this.updater.allowPrerelease = false;

    this.registerEvents();

    if (!this.isDev) {
      this.checkForUpdates('startup').catch((error) => {
        this.log('[updater] startup check failed', String(error));
      });

      this.checkTimer = setInterval(() => {
        this.checkForUpdates('scheduled').catch((error) => {
          this.log('[updater] scheduled check failed', String(error));
        });
      }, 60 * 60 * 1000);
    }
  }

  dispose() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  async checkForUpdates(source: UpdateCheckSource = 'manual') {
    if (this.isDev) {
      if (source === 'manual') {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Обновления',
          message: 'Проверка обновлений доступна только в собранной версии приложения.',
        });
      }
      return null;
    }

    this.pendingManualDialog = source === 'manual';
    this.updateWindow.emitChecking(source);
    this.log('[updater] checkForUpdates', { source });

    return this.updater.checkForUpdates();
  }

  async downloadUpdate() {
    if (this.isDev) return null;
    this.log('[updater] downloadUpdate started');
    return this.updater.downloadUpdate();
  }

  installUpdateNow() {
    if (this.isDev) return;
    this.log('[updater] quitAndInstall');
    this.updater.quitAndInstall(true, true);
  }

  private registerEvents() {
    this.updater.on('update-available', (info) => {
      const releaseNotes = normalizeReleaseNotes(info.releaseNotes);
      this.log('[updater] update-available', { version: info.version, releaseNotesCount: releaseNotes.length });
      this.updateWindow.emitAvailable({
        currentVersion: app.getVersion(),
        newVersion: info.version,
        releaseNotes,
      });
    });

    this.updater.on('update-not-available', (info) => {
      this.log('[updater] update-not-available', { version: info.version });
      this.updateWindow.emitNotAvailable({
        version: info.version,
        source: this.pendingManualDialog ? 'manual' : 'scheduled',
      });

      if (this.pendingManualDialog) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Обновления',
          message: 'У вас установлена последняя версия.',
        }).catch((error) => this.log('[updater] not-available dialog error', String(error)));
      }

      this.pendingManualDialog = false;
    });

    this.updater.on('download-progress', (progress) => {
      const remainingSeconds = progress.bytesPerSecond > 0
        ? Math.max(0, Math.round((progress.total - progress.transferred) / progress.bytesPerSecond))
        : null;

      this.updateWindow.emitProgress({
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
        remainingSeconds,
      });
    });

    this.updater.on('update-downloaded', (info) => {
      this.log('[updater] update-downloaded', { version: info.version });
      this.updateWindow.emitDownloaded({ version: info.version });
      this.pendingManualDialog = false;
    });

    this.updater.on('error', (error) => {
      const message = error?.message || 'Неизвестная ошибка обновления';
      this.log('[updater] error', message);
      this.updateWindow.emitError({ message });
      this.pendingManualDialog = false;
    });
  }
}
