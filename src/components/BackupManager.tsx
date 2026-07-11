import { useEffect, useMemo, useState } from 'react';
import { Organization } from '../types';
import { getBackups, createBackup, deleteBackup, getBackupSettings, updateBackupSettings, checkBackupIntegrity, addBackupLog, getBackupLogs, getCurrentUser } from '../store';
import { generateId } from '../types';
import { serializeBackupData, downloadBackup, calculateBackupSize } from '../utils/backupUtils';
import RestoreWizard from './RestoreWizard';

export default function BackupManager({ activeOrg }: { activeOrg: Organization }) {
  const [backups, setBackups] = useState(getBackups());
  const [settings, setSettings] = useState(getBackupSettings());
  const [tab, setTab] = useState<'backups' | 'settings' | 'logs'>('backups');
  const [creating, setCreating] = useState(false);
  const [comment, setComment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [showRestore, setShowRestore] = useState(false);

  useEffect(() => {
    setBackups(getBackups());
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const currentUser = getCurrentUser();
      const backupData = serializeBackupData(currentUser?.name || 'Система', comment);
      const fileSize = calculateBackupSize(backupData);
      
      // Create backup metadata record
      const backup = createBackup(activeOrg.id, comment);
      backup.fileSize = fileSize;
      setBackups([...backups, backup]);
      
      // Download the file
      const fileName = `backup_${activeOrg.id}_${new Date().getTime()}.carwinbackup`;
      const settings = getBackupSettings();
      await downloadBackup(backupData, fileName, settings.encryptionEnabled && settings.encryptionPassword ? { password: settings.encryptionPassword } : undefined);
      // Enforce retention
      const maxCount = settings?.maxBackupCount || 10;
      const all = getBackups().slice().sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      while (all.length > maxCount) {
        const oldest = all.shift();
        if (oldest) deleteBackup(oldest.id);
      }
      
      setComment('');
      addBackupLog({
        id: generateId(),
        timestamp: new Date().toISOString(),
        operation: 'create',
        performedBy: currentUser?.name || 'Система',
        backupId: backup.id,
        backupName: fileName,
        status: 'success',
        recordsAffected: Object.values(backupData.data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
        duration: 0,
      });
    } catch (error) {
      console.error('Ошибка при создании резервной копии:', error);
      alert('Ошибка при создании резервной копии: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
    setCreating(false);
  };

  // Auto-backup scheduling and on-close handling
  useEffect(() => {
    if (!settings?.autoBackupEnabled) return;

    let intervalId: number | undefined;
    const schedule = settings.autoBackupSchedule;
    if (schedule === 'daily') {
      intervalId = window.setInterval(() => handleCreateBackup(), 24 * 60 * 60 * 1000);
    } else if (schedule === 'weekly') {
      intervalId = window.setInterval(() => handleCreateBackup(), 7 * 24 * 60 * 60 * 1000);
    }

    // on-close attempt
    const onBeforeUnload = () => {
      if (settings.autoBackupEnabled) {
        try { handleCreateBackup(); } catch {}
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [settings]);

  const handleDeleteBackup = (backupId: string) => {
    if (confirm('Вы уверены, что хотите удалить эту резервную копию?')) {
      deleteBackup(backupId);
      setBackups(backups.filter(b => b.id !== backupId));
    }
  };

  const handleVerifyBackup = async (backupId: string) => {
    setVerifying(backupId);
    try {
      const result = checkBackupIntegrity(backupId);
      addBackupLog({
        id: generateId(),
        timestamp: new Date().toISOString(),
        operation: 'verify',
        performedBy: 'Пользователь',
        backupId,
        status: result.isValid ? 'success' : 'failed',
        recordsAffected: result.recordsChecked,
        duration: 0,
      });
      setBackups(getBackups());
    } catch (error) {
      console.error('Ошибка при проверке резервной копии:', error);
    }
    setVerifying(null);
  };

  const filteredBackups = useMemo(() => {
    return backups.filter(b =>
      b.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.comment?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [backups, searchTerm]);

  const totalBackupSize = useMemo(() => {
    return backups.reduce((sum, b) => sum + b.fileSize, 0);
  }, [backups]);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {(['backups', 'settings', 'logs'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 border-b-2 transition ${
              tab === t
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t === 'backups' && '💾 Резервные копии'}
            {t === 'settings' && '⚙️ Настройки'}
            {t === 'logs' && '📋 Журнал'}
          </button>
        ))}
      </div>

      {/* Backups Tab */}
      {tab === 'backups' && (
        <div className="space-y-6">
          {/* Create Backup Section */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Создать резервную копию</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Комментарий (опционально)"
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
              />
              <button
                onClick={handleCreateBackup}
                disabled={creating}
                className={`px-4 py-2 rounded font-semibold transition ${
                  creating
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {creating ? '⏳ Создание...' : '✚ Создать'}
              </button>
              <button
                onClick={() => setShowRestore(true)}
                className="px-4 py-2 rounded font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                ↩️ Восстановить из файла
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Всего копий</div>
              <div className="text-2xl font-bold text-white">{backups.length}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Общий размер</div>
              <div className="text-2xl font-bold text-blue-400">
                {(totalBackupSize / 1024 / 1024).toFixed(2)} МБ
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Последняя копия</div>
              <div className="text-sm font-semibold text-white">
                {backups.length > 0
                  ? new Date(backups[backups.length - 1].createdAt).toLocaleString('ru-RU')
                  : 'Нет копий'}
              </div>
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="🔍 Поиск по имени, организации или комментарию..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
          />

          {/* Backups List */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Список резервных копий</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-2 px-2 text-slate-400">Дата</th>
                    <th className="text-left py-2 px-2 text-slate-400">Имя файла</th>
                    <th className="text-left py-2 px-2 text-slate-400">Организация</th>
                    <th className="text-left py-2 px-2 text-slate-400">Размер</th>
                    <th className="text-left py-2 px-2 text-slate-400">Раздел</th>
                    <th className="text-left py-2 px-2 text-slate-400">Автор</th>
                    <th className="text-center py-2 px-2 text-slate-400">Статус</th>
                    <th className="text-center py-2 px-2 text-slate-400">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBackups.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 px-2 text-center text-slate-400">
                        Нет резервных копий
                      </td>
                    </tr>
                  ) : (
                    filteredBackups.map(backup => (
                      <tr key={backup.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="py-2 px-2 text-slate-300">
                          {new Date(backup.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td className="py-2 px-2 text-slate-300 text-xs font-mono">{backup.fileName}</td>
                        <td className="py-2 px-2 text-slate-300">{backup.organizationName || '—'}</td>
                        <td className="py-2 px-2 text-slate-300">
                          {backup.fileSize > 0 ? `${(backup.fileSize / 1024 / 1024).toFixed(2)} МБ` : '—'}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          <span className="bg-slate-700 text-slate-200 px-2 py-1 rounded">
                            {backup.sections.filter(s => s.status === 'included').length} разд.
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-300">{backup.createdBy}</td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              backup.integrityStatus === 'valid'
                                ? 'bg-green-700 text-green-200'
                                : backup.integrityStatus === 'invalid'
                                ? 'bg-red-700 text-red-200'
                                : 'bg-yellow-700 text-yellow-200'
                            }`}
                          >
                            {backup.integrityStatus === 'valid' && '✓ OK'}
                            {backup.integrityStatus === 'invalid' && '✗ Ошибка'}
                            {backup.integrityStatus === 'unchecked' && '? Не проверена'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center space-x-1">
                          <button
                            onClick={() => handleVerifyBackup(backup.id)}
                            disabled={verifying === backup.id}
                            className="text-blue-400 hover:text-blue-300 text-xs font-semibold disabled:text-slate-500"
                            title="Проверить целостность"
                          >
                            {verifying === backup.id ? '⏳' : '✓'}
                          </button>
                          <button
                            onClick={() => setShowRestore(true)}
                            className="text-green-400 hover:text-green-300 text-xs font-semibold"
                            title="Восстановить"
                          >
                            ⤺
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(backup.id)}
                            className="text-red-400 hover:text-red-300 text-xs font-semibold"
                            title="Удалить"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Параметры резервного копирования</h3>

            <div className="space-y-4">
              {/* Auto Backup */}
              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
                <div>
                  <div className="font-semibold text-white">Автоматические резервные копии</div>
            {showRestore && <RestoreWizard onClose={() => setShowRestore(false)} />}
                  <div className="text-xs text-slate-400">Создавать копии по расписанию</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoBackupEnabled}
                  onChange={e => {
                    const newSettings = { ...settings, autoBackupEnabled: e.target.checked };
                    setSettings(newSettings);
                    updateBackupSettings(newSettings);
                  }}
                  className="w-5 h-5"
                />
              </div>

              {/* Schedule */}
              {settings.autoBackupEnabled && (
                <div className="flex gap-4 p-3 bg-slate-700/50 rounded">
                  <div className="flex-1">
                    <label className="text-sm text-slate-400 block mb-1">Расписание</label>
                    <select
                      value={settings.autoBackupSchedule}
                      onChange={e => {
                        const newSettings = {
                          ...settings,
                          autoBackupSchedule: e.target.value as 'daily' | 'weekly' | 'manual',
                        };
                        setSettings(newSettings);
                        updateBackupSettings(newSettings);
                      }}
                      className="w-full bg-slate-600 text-white rounded px-3 py-2 border border-slate-500 text-sm"
                    >
                      <option value="daily">Каждый день</option>
                      <option value="weekly">Каждую неделю</option>
                      <option value="manual">Вручную</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="text-sm text-slate-400 block mb-1">Макс. копий</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxBackupCount}
                      onChange={e => {
                        const newSettings = { ...settings, maxBackupCount: parseInt(e.target.value) };
                        setSettings(newSettings);
                        updateBackupSettings(newSettings);
                      }}
                      className="w-full bg-slate-600 text-white rounded px-3 py-2 border border-slate-500 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Encryption */}
              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
                <div>
                  <div className="font-semibold text-white">Шифрование (AES-256)</div>
                  <div className="text-xs text-slate-400">Защитить копии паролем</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.encryptionEnabled}
                  onChange={e => {
                    const newSettings = { ...settings, encryptionEnabled: e.target.checked };
                    setSettings(newSettings);
                    updateBackupSettings(newSettings);
                  }}
                  className="w-5 h-5"
                />
              </div>

              {/* Encryption Password */}
              {settings.encryptionEnabled && (
                <div className="p-3 bg-slate-700/50 rounded">
                  <label className="text-sm text-slate-400 block mb-2">Пароль для шифрования</label>
                  <input
                    type="password"
                    placeholder="Введите пароль"
                    value={settings.encryptionPassword || ''}
                    onChange={e => {
                      const newSettings = { ...settings, encryptionPassword: e.target.value };
                      setSettings(newSettings);
                      updateBackupSettings(newSettings);
                    }}
                    className="w-full bg-slate-600 text-white rounded px-3 py-2 border border-slate-500 text-sm"
                  />
                </div>
              )}

              {/* Auto Backup Before Actions */}
              <div className="space-y-2 p-3 bg-slate-700/50 rounded">
                <div className="font-semibold text-white mb-3">Автоматические копии перед:</div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Обновлением программы</span>
                  <input
                    type="checkbox"
                    checked={settings.createBeforeUpdate}
                    onChange={e => {
                      const newSettings = { ...settings, createBeforeUpdate: e.target.checked };
                      setSettings(newSettings);
                      updateBackupSettings(newSettings);
                    }}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Миграцией данных</span>
                  <input
                    type="checkbox"
                    checked={settings.createBeforeMigration}
                    onChange={e => {
                      const newSettings = { ...settings, createBeforeMigration: e.target.checked };
                      setSettings(newSettings);
                      updateBackupSettings(newSettings);
                    }}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Массовым импортом</span>
                  <input
                    type="checkbox"
                    checked={settings.createBeforeMassImport}
                    onChange={e => {
                      const newSettings = { ...settings, createBeforeMassImport: e.target.checked };
                      setSettings(newSettings);
                      updateBackupSettings(newSettings);
                    }}
                    className="w-4 h-4"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {tab === 'logs' && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Журнал резервного копирования</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-2 px-2 text-slate-400">Дата и время</th>
                  <th className="text-left py-2 px-2 text-slate-400">Операция</th>
                  <th className="text-left py-2 px-2 text-slate-400">Пользователь</th>
                  <th className="text-right py-2 px-2 text-slate-400">Записей</th>
                  <th className="text-center py-2 px-2 text-slate-400">Статус</th>
                </tr>
              </thead>
              <tbody>
                {getBackupLogs().length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 px-2 text-center text-slate-400">
                      Нет записей в журнале
                    </td>
                  </tr>
                ) : (
                  getBackupLogs()
                    .slice(-50)
                    .reverse()
                    .map(log => (
                      <tr key={log.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="py-2 px-2 text-slate-300">
                          {new Date(log.timestamp).toLocaleString('ru-RU')}
                        </td>
                        <td className="py-2 px-2 text-slate-300">
                          {log.operation === 'create' && '💾 Создание'}
                          {log.operation === 'restore' && '↩️ Восстановление'}
                          {log.operation === 'delete' && '🗑️ Удаление'}
                          {log.operation === 'verify' && '✓ Проверка'}
                        </td>
                        <td className="py-2 px-2 text-slate-300">{log.performedBy}</td>
                        <td className="py-2 px-2 text-right text-slate-300">{log.recordsAffected}</td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              log.status === 'success'
                                ? 'bg-green-700 text-green-200'
                                : 'bg-red-700 text-red-200'
                            }`}
                          >
                            {log.status === 'success' && '✓ OK'}
                            {log.status === 'failed' && '✗ Ошибка'}
                            {log.status === 'partial' && '⚠ Частично'}
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restore Wizard Modal */}
      {showRestore && <RestoreWizard onClose={() => setShowRestore(false)} />}
    </div>
  );
}
