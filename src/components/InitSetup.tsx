import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

interface InitSetupProps {
  onSetupComplete: (
    adminPassword: string,
    managerPassword: string
  ) => void;
}

export const InitSetup: React.FC<InitSetupProps> = ({ onSetupComplete }) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [managerPasswordConfirm, setManagerPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePasswords = (): boolean => {
    setError('');

    if (!adminPassword.trim()) {
      setError('Пожалуйста, введите пароль администратора');
      return false;
    }

    if (!managerPassword.trim()) {
      setError('Пожалуйста, введите пароль управляющего');
      return false;
    }

    if (adminPassword.length < 4) {
      setError('Пароль администратора должен быть не менее 4 символов');
      return false;
    }

    if (managerPassword.length < 4) {
      setError('Пароль управляющего должен быть не менее 4 символов');
      return false;
    }

    if (adminPassword !== adminPasswordConfirm) {
      setError('Пароли администратора не совпадают');
      return false;
    }

    if (managerPassword !== managerPasswordConfirm) {
      setError('Пароли управляющего не совпадают');
      return false;
    }

    if (adminPassword === managerPassword) {
      setError('Пароли администратора и управляющего должны быть разными');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswords()) {
      return;
    }

    setLoading(true);
    try {
      // Небольшая задержка для UX
      await new Promise(resolve => setTimeout(resolve, 500));
      onSetupComplete(adminPassword, managerPassword);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-4 rounded-lg">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Первоначальная настройка
          </h1>
          <p className="text-slate-400">
            Установите пароли для входа в приложение
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-6"
        >
          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Admin Password Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              👤 Пароль администратора
            </h2>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Придумайте пароль
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                placeholder="Минимум 4 символа"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Подтвердите пароль
              </label>
              <input
                type="password"
                value={adminPasswordConfirm}
                onChange={e => setAdminPasswordConfirm(e.target.value)}
                placeholder="Повторите пароль"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700" />

          {/* Manager Password Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              👑 Пароль управляющего
            </h2>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Придумайте пароль
              </label>
              <input
                type="password"
                value={managerPassword}
                onChange={e => setManagerPassword(e.target.value)}
                placeholder="Минимум 4 символа"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Подтвердите пароль
              </label>
              <input
                type="password"
                value={managerPasswordConfirm}
                onChange={e => setManagerPasswordConfirm(e.target.value)}
                placeholder="Повторите пароль"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Сохранение...' : 'Сохранить пароли'}
          </button>

          {/* Info */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              💡 Советы по выбору пароля:
            </p>
            <ul className="text-blue-300 text-sm mt-2 space-y-1 list-disc list-inside">
              <li>Используйте комбинацию букв и цифр</li>
              <li>Используйте разные пароли для каждой роли</li>
              <li>Запомните пароли или запишите их в безопасном месте</li>
            </ul>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center mt-6 text-slate-500 text-sm">
          <p>После сохранения пароли больше не смогут быть изменены</p>
          <p className="mt-1">без переустановки приложения</p>
        </div>
      </div>
    </div>
  );
};
