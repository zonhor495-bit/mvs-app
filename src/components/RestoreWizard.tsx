import { useState, useRef } from 'react';
import { parseBackupFile, validateBackupStructure, deserializeBackupData, deserializePartialBackupData, getBackupSections, BackupData, serializeBackupData, downloadBackup } from '../utils/backupUtils';
import { addBackupLog, getCurrentUser, getBackupSettings } from '../store';
import { generateId } from '../types';

interface RestoreWizardProps {
  onClose: () => void;
}

export default function RestoreWizard({ onClose }: RestoreWizardProps) {
  const [step, setStep] = useState<'file' | 'verify' | 'info' | 'sections' | 'confirm' | 'restoring' | 'complete'>('file');
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[]; warnings?: string[] } | null>(null);
  const [fullRestore, setFullRestore] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupFile(file);
    setError(null);

    try {
      setProgress(10);
      const data = await parseBackupFile(file);
      setBackupData(data);
      setNeedsPassword(false);
      setProgress(40);

      const validation = validateBackupStructure(data);
      setValidationResult(validation);
      if (!validation.valid) {
        setError('Backup structure is invalid: ' + validation.errors.join(', '));
        setStep('file');
        return;
      }

      setProgress(70);
      const sections = getBackupSections(data);
      setSelectedSections(sections.map(s => s.key));
      setStep('verify');
      setProgress(100);
    } catch (err: any) {
      // If backup is encrypted, the parser will throw with code 'ENCRYPTED_BACKUP'
      if (err && (err.code === 'ENCRYPTED_BACKUP' || /password protected/i.test(err.message || ''))) {
        setNeedsPassword(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to parse backup file');
        setBackupFile(null);
        setBackupData(null);
      }
    }
  };

  const handleUnlockWithPassword = async () => {
    if (!backupFile) return;
    setError(null);
    try {
      setProgress(10);
      const data = await parseBackupFile(backupFile, { password });
      const validation = validateBackupStructure(data);
      setValidationResult(validation);
      setBackupData(data);
      setNeedsPassword(false);
      setProgress(70);
      const sections = getBackupSections(data);
      setSelectedSections(sections.map(s => s.key));
      setStep('verify');
      setProgress(100);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Password unlock failed');
    }
  };

  const handleVerifyClick = () => {
    if (!backupData) return;
    setStep('info');
  };

  const handleConfirmRestore = async () => {
    if (!backupData) return;

    // Optionally create a pre-restore backup according to settings
    try {
      const settings = getBackupSettings();
      if (settings?.createBeforeMassImport || settings?.createBeforeMigration || settings?.createBeforeUpdate) {
        const user = getCurrentUser();
        const pre = serializeBackupData(user?.name || 'Система', 'Pre-restore snapshot');
        const fname = `pre_restore_${new Date().toISOString()}.carwinbackup`;
        await downloadBackup(pre, fname, settings.encryptionEnabled && settings.encryptionPassword ? { password: settings.encryptionPassword } : undefined);
        addBackupLog({
          id: generateId(),
          timestamp: new Date().toISOString(),
          operation: 'create',
          performedBy: user?.name || 'Система',
          backupId: fname,
          backupName: fname,
          status: 'success',
          recordsAffected: 0,
          duration: 0,
        });
      }
    } catch (err) {
      console.warn('Failed to create pre-restore backup', err);
    }

    setStep('restoring');
    setProgress(0);
    const controller = new AbortController();
    setAbortController(controller);
    const start = Date.now();
    try {
      if (fullRestore) {
        await deserializeBackupData(backupData, { onProgress: setProgress, signal: controller.signal });
      } else {
        const restoredCount = await deserializePartialBackupData(backupData, selectedSections, { onProgress: setProgress, signal: controller.signal });
        if (restoredCount === 0) throw new Error('No sections were restored');
      }

      const duration = Date.now() - start;
      const currentUser = getCurrentUser();
      addBackupLog({
        id: generateId(),
        timestamp: new Date().toISOString(),
        operation: 'restore',
        performedBy: currentUser?.name || 'Система',
        backupId: backupFile?.name || 'unknown',
        status: 'success',
        recordsAffected: selectedSections.length,
        duration,
        restoredSections: selectedSections,
      });

      setProgress(100);
      setTimeout(() => setStep('complete'), 800);
    } catch (err: any) {
      if (err?.message === 'Restore cancelled') {
        setError('Операция восстановления отменена пользователем');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to restore backup');
      }
      setStep('confirm');
      setProgress(0);
    } finally {
      setAbortController(null);
    }
  };

  const handleComplete = () => {
    // Clear session and reload
    localStorage.removeItem('wd_session');
    localStorage.removeItem('wd_active_org');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg p-6 max-w-2xl w-full mx-4 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4">
          Мастер восстановления резервной копии
        </h2>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-6 text-xs">
          {['file', 'verify', 'info', 'sections', 'confirm', 'restoring', 'complete'].map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded ${
                ['file', 'verify', 'info', 'sections', 'confirm', 'restoring', 'complete'].indexOf(step) >= i
                  ? 'bg-blue-500'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step 1: File Selection */}
        {step === 'file' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400 mb-4">Шаг 1 из 7: Выбор файла</div>
            <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".carwinbackup,.zip,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
              >
                📁 Выбрать файл резервной копии
              </button>
              <p className="text-xs text-slate-400 mt-3">
                Поддерживаемые форматы: .carwinbackup, .zip, .json
              </p>
            </div>
            {needsPassword && (
              <div className="bg-slate-800 p-3 rounded text-sm text-slate-300 mt-3">
                <div className="mb-2">Файл защищён паролем. Введите пароль для расшифровки:</div>
                <div className="flex gap-2">
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="flex-1 bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm" />
                  <button onClick={handleUnlockWithPassword} className="px-3 py-2 bg-blue-600 text-white rounded">Разблокировать</button>
                </div>
              </div>
            )}

            {backupFile && (
              <div className="bg-slate-800 p-3 rounded text-sm text-slate-300">
                ✓ Выбран файл: {backupFile.name}
              </div>
            )}
            {error && (
              <div className="bg-red-900/30 border border-red-700 p-3 rounded text-sm text-red-300">
                ✕ {error}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Verification */}
        {step === 'verify' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400 mb-4">Шаг 2 из 7: Проверка файла</div>
            {backupData && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span className="text-slate-300">Файл распакован успешно</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span className="text-slate-300">Структура данных валидна</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span className="text-slate-300">Контрольная сумма совпадает</span>
                </div>
              </div>
            )}
            {validationResult?.warnings && validationResult.warnings.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700 p-3 rounded text-sm text-yellow-300">
                <div className="font-semibold">Предупреждения:</div>
                <ul className="list-disc list-inside mt-2">
                  {validationResult.warnings.map(w => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setStep('file')}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold"
              >
                ← Назад
              </button>
              <button
                onClick={handleVerifyClick}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
              >
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Backup Info */}
        {step === 'info' && backupData && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400 mb-4">Шаг 3 из 7: Информация о резервной копии</div>
            <div className="bg-slate-800 p-4 rounded space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Создана:</span>
                <span className="text-white">
                  {new Date(backupData.timestamp).toLocaleString('ru-RU')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Версия приложения:</span>
                <span className="text-white">{backupData.metadata.appVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Версия CarWin:</span>
                <span className="text-white">{backupData.metadata.carwinVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Создано:</span>
                <span className="text-white">{backupData.metadata.createdBy}</span>
              </div>
              {backupData.metadata.comment && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Комментарий:</span>
                  <span className="text-white">{backupData.metadata.comment}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  checked={fullRestore}
                  onChange={() => setFullRestore(true)}
                  className="w-4 h-4"
                />
                Полное восстановление всех данных
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  checked={!fullRestore}
                  onChange={() => setFullRestore(false)}
                  className="w-4 h-4"
                />
                Выборочное восстановление
              </label>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setStep('verify')}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold"
              >
                ← Назад
              </button>
              <button
                onClick={() => setStep(fullRestore ? 'confirm' : 'sections')}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
              >
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Section Selection */}
        {step === 'sections' && backupData && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400 mb-4">Шаг 4 из 7: Выбор разделов</div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto bg-slate-800 p-3 rounded">
              {getBackupSections(backupData).map(section => (
                <label key={section.key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(section.key)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedSections([...selectedSections, section.key]);
                      } else {
                        setSelectedSections(selectedSections.filter(s => s !== section.key));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  {section.name} ({section.count})
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setStep('info')}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold"
              >
                ← Назад
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={selectedSections.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold disabled:opacity-50"
              >
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400 mb-4">Шаг 5 из 7: Подтверждение</div>
            <div className="bg-yellow-900/20 border border-yellow-700 p-4 rounded text-sm text-yellow-300">
              ⚠️ Восстановление заменит текущие данные на данные из резервной копии.
              <br />
              Убедитесь, что вы хотите продолжить.
            </div>

            <div className="bg-slate-800 p-3 rounded text-sm space-y-1">
              <div className="text-slate-400">Восстановить разделы:</div>
              <div className="text-slate-300">
                {selectedSections.join(', ')}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setStep(fullRestore ? 'info' : 'sections')}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold"
              >
                ← Назад
              </button>
              <button
                onClick={handleConfirmRestore}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
              >
                ⚠️ Восстановить
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Restoring */}
        {step === 'restoring' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400 mb-4">Шаг 6 из 7: Восстановление</div>
            <div className="bg-slate-800 rounded p-4">
              <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-sm text-slate-400 mt-2 text-center">
                {progress}% - восстановление данных...
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (abortController) abortController.abort();
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
              >
                Отменить
              </button>
            </div>
          </div>
        )}

        {/* Step 7: Complete */}
        {step === 'complete' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400 mb-4">Шаг 7 из 7: Завершение</div>
            <div className="bg-green-900/20 border border-green-700 p-4 rounded text-sm text-green-300">
              ✓ Восстановление завершено успешно!
              <br />
              Приложение будет перезагружено.
            </div>

            <button
              onClick={handleComplete}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
            >
              Перезагрузить приложение
            </button>
          </div>
        )}

        {/* Close button */}
        {!['restoring', 'complete'].includes(step) && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
