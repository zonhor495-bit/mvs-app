import { useState } from 'react';

interface PasswordSetupModalProps {
  onComplete: () => void;
  onLogout: () => void;
  onSavePasswords?: (admin: string, manager: string) => Promise<boolean>;
}

export function PasswordSetupModal({ onComplete, onLogout, onSavePasswords }: PasswordSetupModalProps) {
  const [step, setStep] = useState<'admin' | 'manager' | 'done'>('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [managerConfirm, setManagerConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAdminNext = async () => {
    setError('');
    if (!adminPassword.trim()) {
      setError('Введите пароль администратора');
      return;
    }
    if (adminPassword !== adminConfirm) {
      setError('Пароли не совпадают');
      return;
    }
    if (adminPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }
    if (!/[A-Za-z]/.test(adminPassword) || !/\d/.test(adminPassword)) {
      setError('Пароль должен содержать буквы и цифры');
      return;
    }
    
    setIsSaving(true);
    try {
      setStep('manager');
      setIsSaving(false);
    } catch (e) {
      setIsSaving(false);
      setError(String(e));
    }
  };

  const handleManagerComplete = async () => {
    setError('');
    if (!managerPassword.trim()) {
      setError('Введите пароль управляющего');
      return;
    }
    if (managerPassword !== managerConfirm) {
      setError('Пароли не совпадают');
      return;
    }
    if (managerPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }
    if (!/[A-Za-z]/.test(managerPassword) || !/\d/.test(managerPassword)) {
      setError('Пароль должен содержать буквы и цифры');
      return;
    }
    if (adminPassword === managerPassword) {
      setError('Пароли администратора и управляющего должны отличаться');
      return;
    }
    
    setIsSaving(true);
    try {
      let success = true;
      if (onSavePasswords) {
        success = await onSavePasswords(adminPassword, managerPassword);
      }
      if (success) {
        setStep('done');
        setTimeout(() => onComplete(), 800);
      } else {
        setIsSaving(false);
        setError('Не удалось сохранить пароли');
      }
    } catch (e) {
      setIsSaving(false);
      setError(String(e));
    }
  };

  if (step === 'done') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-cyan-500/20 p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">Пароли установлены</h2>
          <p className="text-slate-300 mb-6">Теперь вы можете продолжить работу с приложением</p>
          <div className="animate-spin inline-block w-4 h-4 border-2 border-cyan-400 border-r-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-cyan-500/20 p-8 max-w-sm w-full shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-2">
          {step === 'admin' ? '🛡️ Пароль администратора' : '👑 Пароль управляющего'}
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          {step === 'admin'
            ? 'Установите пароль для роли администратора'
            : 'Установите пароль для роли управляющего'}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Пароль</label>
            <input
              type="password"
              value={step === 'admin' ? adminPassword : managerPassword}
              onChange={(e) => (step === 'admin' ? setAdminPassword(e.target.value) : setManagerPassword(e.target.value))}
              placeholder="Минимум 6 символов, буквы и цифры"
              className="w-full input-neon rounded-lg px-3 py-2 text-sm"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Подтверждение</label>
            <input
              type="password"
              value={step === 'admin' ? adminConfirm : managerConfirm}
              onChange={(e) => (step === 'admin' ? setAdminConfirm(e.target.value) : setManagerConfirm(e.target.value))}
              placeholder="Повторите пароль"
              className="w-full input-neon rounded-lg px-3 py-2 text-sm"
              disabled={isSaving}
            />
          </div>

          {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</div>}

          <div className="text-xs text-slate-500 bg-slate-950/30 rounded-lg p-3 space-y-1">
            <p>✓ Минимум 6 символов</p>
            <p>✓ Буквы и цифры</p>
            <p>✓ Максимум 64 символа</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onLogout}
            className="flex-1 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            disabled={isSaving}
          >
            Выйти
          </button>
          <button
            onClick={step === 'admin' ? handleAdminNext : handleManagerComplete}
            disabled={isSaving}
            className="flex-1 btn-neon rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? '...' : step === 'admin' ? 'Далее' : 'Завершить'}
          </button>
        </div>

        {step === 'manager' && (
          <button
            onClick={() => {
              setStep('admin');
              setError('');
            }}
            className="w-full mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            disabled={isSaving}
          >
            ← Назад
          </button>
        )}
      </div>
    </div>
  );
}
