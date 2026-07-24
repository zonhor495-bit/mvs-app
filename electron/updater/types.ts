export type UpdateCheckSource = 'startup' | 'manual' | 'scheduled';

export interface UpdateAvailablePayload {
  currentVersion: string;
  newVersion: string;
  releaseNotes: string[];
}

export interface UpdateProgressPayload {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
  remainingSeconds: number | null;
}

export interface UpdateDownloadedPayload {
  version: string;
}

export interface UpdateErrorPayload {
  message: string;
}

export interface UpdateNotAvailablePayload {
  version: string;
  source: UpdateCheckSource;
}
