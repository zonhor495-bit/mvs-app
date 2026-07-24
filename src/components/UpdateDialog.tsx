import { useEffect, useState } from 'react';

interface UpdateDialogProps {
  isOpen: boolean;
  currentVersion: string;
  newVersion: string;
  releaseNotes: string[];
  isDownloading: boolean;
  downloadProgress: {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
    remainingSeconds: number | null;
  };
  isReadyToInstall: boolean;
  errorMessage: string | null;
  isDark: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  onInstall: () => void;
}

export default function UpdateDialog({
  isOpen,
  currentVersion,
  newVersion,
  releaseNotes,
  isDownloading,
  downloadProgress,
  isReadyToInstall,
  errorMessage,
  isDark,
  onUpdate,
  onDismiss,
  onInstall,
}: UpdateDialogProps) {
  const [hasStartedDownload, setHasStartedDownload] = useState(false);

  useEffect(() => {
    if (isDownloading) setHasStartedDownload(true);
    if (!isOpen) setHasStartedDownload(false);
  }, [isDownloading, isOpen]);

  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '—';
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (!bytesPerSecond || bytesPerSecond <= 0) return '—';
    return `${formatSize(bytesPerSecond)}/с`;
  };

  const formatRemaining = (seconds: number | null) => {
    if (seconds === null || Number.isNaN(seconds)) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}с`;
    return `${mins}м ${secs}с`;
  };

  const bgClass = isDark ? 'bg-slate-950' : 'bg-white';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const borderClass = isDark ? 'border-slate-800' : 'border-slate-200';
  const inputBgClass = isDark ? 'bg-slate-900' : 'bg-slate-50';
  const labelClass = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-[2rem] border ${borderClass} ${bgClass} shadow-2xl ${isDark ? 'shadow-black/50' : 'shadow-slate-200/50'} overflow-hidden`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-sky-500 px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Доступна новая версия MVS</h1>
          <p className="mt-2 text-sky-100">Обновление будет установлено автоматически после загрузки.</p>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          {/* Version info */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-2xl ${inputBgClass} p-4 border ${borderClass}`}>
              <p className={`text-xs uppercase tracking-[0.35em] ${labelClass}`}>Текущая версия</p>
              <p className={`mt-3 text-xl font-semibold ${textClass}`}>{currentVersion}</p>
            </div>
            <div className={`rounded-2xl ${inputBgClass} p-4 border ${borderClass}`}>
              <p className={`text-xs uppercase tracking-[0.35em] ${labelClass}`}>Новая версия</p>
              <p className={`mt-3 text-xl font-semibold text-sky-600`}>{newVersion}</p>
            </div>
          </div>

          {releaseNotes.length > 0 && !hasStartedDownload && !isReadyToInstall && (
            <div className={`rounded-2xl ${inputBgClass} border ${borderClass} p-4`}>
              <p className={`text-sm font-semibold ${textClass}`}>Что нового</p>
              <ul className={`mt-3 space-y-2 text-sm ${labelClass}`}>
                {releaseNotes.slice(0, 6).map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Download progress */}
          {isDownloading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${textClass}`}>Скачивание обновления...</p>
                <p className="text-sm font-semibold text-sky-600">{Math.round(downloadProgress.percent)}%</p>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${inputBgClass} border ${borderClass}`}>
                <div
                  className="h-full bg-gradient-to-r from-sky-600 to-sky-500 transition-all duration-300"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className={`rounded-xl ${inputBgClass} border ${borderClass} p-3`}>
                  <p className={labelClass}>Скорость</p>
                  <p className={`mt-1 font-semibold ${textClass}`}>{formatSpeed(downloadProgress.bytesPerSecond)}</p>
                </div>
                <div className={`rounded-xl ${inputBgClass} border ${borderClass} p-3`}>
                  <p className={labelClass}>Осталось</p>
                  <p className={`mt-1 font-semibold ${textClass}`}>{formatRemaining(downloadProgress.remainingSeconds)}</p>
                </div>
                <div className={`col-span-2 rounded-xl ${inputBgClass} border ${borderClass} p-3`}>
                  <p className={labelClass}>Размер</p>
                  <p className={`mt-1 font-semibold ${textClass}`}>{formatSize(downloadProgress.transferred)} / {formatSize(downloadProgress.total)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Downloaded indicator */}
          {isReadyToInstall && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Обновление готово. Для завершения установки необходимо перезапустить приложение.</p>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
              <p className="text-sm text-rose-600 dark:text-rose-400">{errorMessage}</p>
            </div>
          )}

          {/* Description */}
          {!isDownloading && !isReadyToInstall && !errorMessage && (
            <p className={`text-sm leading-6 ${labelClass}`}>
              Приложение загрузит и установит обновление в фоновом режиме. Вам не нужно ничего скачивать вручную.
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            {isReadyToInstall ? (
              <>
                <button
                  onClick={onInstall}
                  className="w-full rounded-full bg-sky-600 hover:bg-sky-500 px-6 py-3 text-center font-semibold text-white transition shadow-lg shadow-sky-500/20"
                >
                  Перезапустить сейчас
                </button>
                <button
                  onClick={onDismiss}
                  className={`w-full rounded-full border ${borderClass} ${inputBgClass} hover:${isDark ? 'bg-slate-800' : 'bg-slate-100'} px-6 py-3 text-center font-semibold ${textClass} transition`}
                >
                  Позже
                </button>
              </>
            ) : isDownloading ? (
              <button
                disabled
                className="w-full rounded-full bg-sky-600/50 px-6 py-3 text-center font-semibold text-white cursor-not-allowed"
              >
                Загрузка в процессе...
              </button>
            ) : (
              <>
                <button
                  onClick={onUpdate}
                  className="w-full rounded-full bg-sky-600 hover:bg-sky-500 px-6 py-3 text-center font-semibold text-white transition shadow-lg shadow-sky-500/20"
                >
                  Обновить
                </button>
                <button
                  onClick={onDismiss}
                  className={`w-full rounded-full border ${borderClass} ${inputBgClass} hover:${isDark ? 'bg-slate-800' : 'bg-slate-100'} px-6 py-3 text-center font-semibold ${textClass} transition`}
                >
                  Позже
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className={`border-t ${borderClass} px-8 py-4`}>
          <p className={`text-xs ${labelClass} text-center`}>
            Обновления загружаются автоматически. Никакого вмешательства не требуется.
          </p>
        </div>
      </div>
    </div>
  );
}
