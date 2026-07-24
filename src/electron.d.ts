export {};

declare global {
  interface Window {
    electron: {
      versions: NodeJS.ProcessVersions;
      getVersion(): Promise<string>;
      getAppPath(): Promise<string>;
      getPath(name: string): Promise<string>;
      windowControls: {
        minimize(): Promise<void>;
        toggleMaximize(): Promise<boolean>;
        close(): Promise<void>;
        isMaximized(): Promise<boolean>;
      };
      exportReport(data: {
        orders: Array<{ id: number; date: string; service: string; amount: number; paymentMethod: string; washer: string; licensePlate: string; [key: string]: any }>;
        from: string;
        to: string;
        fileName: string;
        warehouse?: {
          items?: Array<Record<string, any>>;
          movements?: Array<Record<string, any>>;
          purchases?: Array<Record<string, any>>;
          expenses?: Array<Record<string, any>>;
          cost?: Array<Record<string, any>>;
        };
      }): Promise<{ canceled: boolean; filePath?: string }>;
      updater: {
        onCheckingForUpdate(callback: (data: { source: 'startup' | 'manual' | 'scheduled' }) => void): () => void;
        onUpdateAvailable(callback: (data: { currentVersion: string; newVersion: string; releaseNotes: string[] }) => void): () => void;
        onUpdateNotAvailable(callback: (data: { version: string; source: 'startup' | 'manual' | 'scheduled' }) => void): () => void;
        onDownloadProgress(callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number; remainingSeconds: number | null }) => void): () => void;
        onUpdateDownloaded(callback: (data: { version: string }) => void): () => void;
        onError(callback: (error: { message: string }) => void): () => void;
        checkForUpdates(source?: 'manual' | 'startup' | 'scheduled'): Promise<void>;
        downloadUpdate(): Promise<void>;
        installUpdate(): Promise<void>;
        dismissUpdate(): Promise<void>;
      };
    };
  }
}
