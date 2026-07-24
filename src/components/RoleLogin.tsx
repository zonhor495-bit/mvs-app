import React, { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { verifyPassword } from '../store';

interface RoleLoginProps {
  onLogin: (role: 'admin' | 'manager', password: string) => void;
  isLoading?: boolean;
}

type LoginStep = 'selectRole' | 'enterPassword';

export const RoleLogin: React.FC<RoleLoginProps> = ({
  onLogin,
  isLoading = false,
}) => {
  const [step, setStep] = useState<LoginStep>('selectRole');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager' | null>(
    null
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleRoleSelect = (role: 'admin' | 'manager') => {
    setSelectedRole(role);
    setPassword('');
    setError('');
    setStep('enterPassword');
  };

  const handleBackToRoleSelect = () => {
    setStep('selectRole');
    setSelectedRole(null);
    setPassword('');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError('Пожалуйста, введите пароль');
      return;
    }

    if (!selectedRole) {
      setError('Пожалуйста, выберите роль');
      return;
    }

    setIsChecking(true);
    setError('');

    try {
      // Проверить пароль
      const isValid = verifyPassword(selectedRole, password);

      if (!isValid) {
        setError('Неверный пароль');
        setIsChecking(false);
        return;
      }

      // Пароль верный - вызвать onLogin
      onLogin(selectedRole, password);
    } finally {
      setIsChecking(false);
    }
  };

  const getRoleLabel = (role: 'admin' | 'manager') => {
    return role === 'admin' ? '👤 Администратор' : '👑 Управляющий';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-4 rounded-lg">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {step === 'selectRole' ? 'Выберите роль' : 'Введите пароль'}
          </h1>
          {step === 'enterPassword' && selectedRole && (
            <p className="text-slate-400">для {getRoleLabel(selectedRole)}</p>
          )}
        </div>

        {/* Select Role Step */}
        {step === 'selectRole' && (
          <div className="space-y-4">
            {/* Admin Role */}
            <button
              onClick={() => handleRoleSelect('admin')}
              disabled={isLoading || isChecking}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 border-2 border-slate-700 hover:border-blue-500 disabled:border-slate-600 rounded-lg p-6 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl">👤</div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
                    Администратор
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Сотрудник на автомойке
                  </p>
                </div>
              </div>
            </button>

            {/* Manager Role */}
            <button
              onClick={() => handleRoleSelect('manager')}
              disabled={isLoading || isChecking}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 border-2 border-slate-700 hover:border-blue-500 disabled:border-slate-600 rounded-lg p-6 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl">👑</div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
                    Управляющий
                  </h2>
                  <p className="text-slate-400 text-sm">Полный контроль</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Enter Password Step */}
        {step === 'enterPassword' && selectedRole && (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Selected Role Display */}
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
              <p className="text-blue-300 text-sm">Выбрана роль:</p>
              <p className="text-blue-100 text-lg font-semibold">
                {getRoleLabel(selectedRole)}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Введите пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setError('');
                }}
                onKeyPress={e => {
                  if (e.key === 'Enter' && !isChecking) {
                    handleLogin(e as any);
                  }
                }}
                placeholder="Ваш пароль"
                autoFocus
                disabled={isLoading || isChecking}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isChecking}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              {isChecking ? 'Проверка...' : 'Войти'}
            </button>

            {/* Back Button */}
            <button
              type="button"
              onClick={handleBackToRoleSelect}
              disabled={isLoading || isChecking}
              className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 text-slate-300 hover:text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Выбрать другую роль
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-slate-500 text-sm">
          <p>MVS System</p>
          <p>Система управления автомойкой</p>
        </div>
      </div>
    </div>
  );
};
