export {};

declare global {
  interface Window {
    electron: {
      versions: NodeJS.ProcessVersions;
      getVersion(): Promise<string>;
      getAppPath(): Promise<string>;
      getPath(name: string): Promise<string>;
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
        onUpdateAvailable(callback: (data: { currentVersion: string; newVersion: string }) => void): void;
        onDownloadProgress(callback: (progress: { percent: number }) => void): void;
        onUpdateDownloaded(callback: () => void): void;
        onError(callback: (error: Error) => void): void;
        checkForUpdates(): Promise<void>;
        downloadUpdate(): Promise<void>;
        installUpdate(): Promise<void>;
        dismissUpdate(): Promise<void>;
      };
    };
  }
}
