/**
 * Version Management System for MVS
 * 
 * This file centralizes all version data, making it easy to:
 * - Add new versions by creating a new entry
 * - Display version history on changelog page
 * - Maintain download links and metadata
 * 
 * To add a new version (e.g., 1.1.9):
 * 1. Add new entry to `versionHistory` array at the TOP (most recent first)
 * 2. Update current version in package.json (build system will inject it)
 * 3. Add file size to `fileSizes` map
 * 4. Rebuild: npm run build
 */

export interface ReleaseEntry {
  version: string;
  date: string;
  title: string;
  features: string[];
  fixes: string[];
  isCurrentVersion?: boolean;
}

/**
 * Release history in reverse chronological order (newest first)
 * Add new versions to the top when releasing new builds
 */
export const versionHistory: ReleaseEntry[] = [
  {
    version: '1.1.8',
    date: '14 августа 2026',
    title: 'Обновление версии и подготовка системы',
    features: [
      'Система управления услугами',
      'First Run Wizard',
      'TOP-10 популярных услуг',
      'Улучшения производительности',
    ],
    fixes: [
      'Оптимизация работы приложения',
      'Исправления ошибок в сохранении данных',
      'Улучшена стабильность при работе с большим объёмом данных',
    ],
  },
  {
    version: '1.1.0',
    date: '12 августа 2026',
    title: 'Система управления услугами',
    features: [
      'Система управления услугами',
      'First Run Wizard',
      'TOP-10 популярных услуг',
      'Улучшения производительности',
    ],
    fixes: [
      'Оптимизация работы приложения',
      'Исправления ошибок в сохранении данных',
    ],
  },
  {
    version: '1.0.3',
    date: '10 июля 2026',
    title: 'Исправления и оптимизация',
    features: [
      'Улучшенный интерфейс управления сменами',
    ],
    fixes: [
      'Исправлены ошибки при работе с большим объёмом данных',
      'Улучшена стабильность приложения',
      'Оптимизирована работа с памятью',
    ],
  },
  {
    version: '1.0.2',
    date: '5 июля 2026',
    title: 'Раннее развёртывание',
    features: [
      'Первая публичная версия',
      'Базовое управление заказами и клиентами',
      'Финансовая аналитика',
    ],
    fixes: [],
  },
  {
    version: '1.0.1',
    date: '1 июля 2026',
    title: 'Начало проекта',
    features: [
      'Ядро приложения',
      'Базовая база данных',
    ],
    fixes: [],
  },
];

/**
 * File sizes for each version (in MB)
 * Update this when releasing a new version with different build size
 */
export const fileSizes: Record<string, number> = {
  '1.1.8': 84,
  '1.1.0': 84,
  '1.0.3': 82,
  '1.0.2': 81,
  '1.0.1': 80,
  '1.0.0': 79,
};

/**
 * Get current version from injected build variable
 * Falls back to latest version in history if variable is undefined
 */
export function getCurrentVersionInfo(appVersion: string, releaseDate: string) {
  const currentVersion = versionHistory.find(v => v.version === appVersion) || versionHistory[0];
  return {
    version: appVersion,
    date: releaseDate,
    // Keep downloadUrl pointing to release asset (internal mechanism may rely on GitHub releases),
    // but do not expose explicit GitHub labels in UI. The changelog link is internal.
    downloadUrl: `https://github.com/zonhor495-bit/mvs-app/releases/download/v${appVersion}/MVSSetup-${appVersion}.exe`,
    // Use internal changelog route so UI does not show external GitHub URLs
    fullChangesUrl: `/changelog?version=${appVersion}`,
    whatsNew: currentVersion.features,
    title: currentVersion.title,
  };
}

/**
 * Get a specific version's details
 */
export function getVersionDetails(version: string): ReleaseEntry | undefined {
  return versionHistory.find(v => v.version === version);
}

/**
 * Get file size for a version
 */
export function getFileSize(version: string): number {
  return fileSizes[version] || 84;
}

/**
 * Check if this is the current version (first in history)
 */
export function isCurrentVersion(version: string, currentAppVersion: string): boolean {
  return version === currentAppVersion;
}
