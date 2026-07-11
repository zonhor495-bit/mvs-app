import { useState, useEffect } from 'react';

interface UpdateDialogProps {
  isOpen: boolean;
  currentVersion: string;
  newVersion: string;
  isDownloading: boolean;
  downloadProgress: number;
  isDark: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  onInstall: () => void;
}

export default function UpdateDialog({
  isOpen,
  currentVersion,
  newVersion,
  isDownloading,
  downloadProgress,
  isDark,
  onUpdate,
  onDismiss,
  onInstall,
}: UpdateDialogProps) {
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    if (!isDownloading && downloadProgress === 100 && currentVersion !== newVersion) {
      setShowInstall(true);
    }
  }, [isDownloading, downloadProgress, currentVersion, newVersion]);

  if (!isOpen) return null;

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
        <div className={`bg-gradient-to-r from-sky-600 to-sky-500 px-8 py-6`}>
          <h1 className="text-2xl font-bold text-white">🎉 Обновление доступно</h1>
          <p className={`mt-2 text-sky-100`}>Получите новые возможности MVS</p>
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

          {/* Download progress */}
          {isDownloading && downloadProgress < 100 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${textClass}`}>Загрузка обновления</p>
                <p className={`text-sm font-semibold text-sky-600`}>{Math.round(downloadProgress)}%</p>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${inputBgClass} border ${borderClass}`}>
                <div
                  className="h-full bg-gradient-to-r from-sky-600 to-sky-500 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Downloaded indicator */}
          {showInstall && (
            <div className={`rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3`}>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">✓ Обновление загружено и готово к установке</p>
            </div>
          )}

          {/* Description */}
          {!isDownloading && !showInstall && (
            <p className={`text-sm leading-6 ${labelClass}`}>
              Приложение загрузит и установит обновление в фоновом режиме. Вам не нужно ничего скачивать вручную.
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            {showInstall ? (
              <>
                <button
                  onClick={onInstall}
                  className="w-full rounded-full bg-sky-600 hover:bg-sky-500 px-6 py-3 text-center font-semibold text-white transition shadow-lg shadow-sky-500/20"
                >
                  Перезапустить и установить
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
                  Обновить сейчас
                </button>
                <button
                  onClick={onDismiss}
                  className={`w-full rounded-full border ${borderClass} ${inputBgClass} hover:${isDark ? 'bg-slate-800' : 'bg-slate-100'} px-6 py-3 text-center font-semibold ${textClass} transition`}
                >
                  Напомнить позже
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
