import { useMemo, useState } from 'react';
import { User } from '../types';
import { authenticateLocalUser, getActiveOrgId, getOrganizationsForUser, getUserByUsername, hasUsers, registerLocalUser, setActiveOrgId, startSession } from '../store';

interface LoginProps {
  onLogin: (user: User, orgId?: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const hasAnyUsers = useMemo(() => hasUsers(), []);
  const [mode, setMode] = useState<'login' | 'register'>(hasAnyUsers ? 'login' : 'register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const toHex = (bytes: Uint8Array): string => Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');

  const hashPassword = async (plainPassword: string, salt: string): Promise<string> => {
    const data = new TextEncoder().encode(`${salt}:${plainPassword}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return toHex(new Uint8Array(digest));
  };

  const createSalt = (): string => {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return toHex(arr);
  };

  const completeLogin = (user: User) => {
    const organizations = getOrganizationsForUser(user.id || '');
    const activeId = getActiveOrgId();
    const org = activeId ? organizations.find(item => item.id === activeId) : organizations[0];
    if (org) {
      setActiveOrgId(org.id);
    }
    startSession(user, org?.id);
    onLogin(user, org?.id);
  };

  const handleSubmit = async () => {
    setError('');

    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername) {
      setError('Введите логин');
      return;
    }
    if (!password) {
      setError('Введите пароль');
      return;
    }

    setIsBusy(true);
    try {
      if (mode === 'register') {
        if (password.length < 6) {
          setError('Пароль должен содержать минимум 6 символов');
          return;
        }
        if (password !== repeatPassword) {
          setError('Пароли не совпадают');
          return;
        }

        const salt = createSalt();
        const passwordHash = await hashPassword(password, salt);
        const created = registerLocalUser({
          username: normalizedUsername,
          passwordHash,
          passwordSalt: salt,
          name: displayName.trim() || normalizedUsername,
        });
        if (!created.ok || !created.user) {
          setError(created.error || 'Не удалось создать аккаунт');
          return;
        }
        completeLogin(created.user);
        return;
      }

      const existing = getUserByUsername(normalizedUsername);
      if (!existing?.passwordSalt) {
        setError('Неверный логин или пароль');
        return;
      }
      const passwordHash = await hashPassword(password, existing.passwordSalt);
      const authUser = authenticateLocalUser({ username: normalizedUsername, passwordHash });
      if (!authUser) {
        setError('Неверный логин или пароль');
        return;
      }

      completeLogin(authUser);
    } catch {
      setError('Ошибка авторизации');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center grid-bg bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 animate-fadeIn">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-strong neon-glow-strong mb-6">
            <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold neon-text text-cyan-400 mb-2">Wash&Drive</h1>
          <p className="text-sm text-slate-400">Management System</p>
        </div>

        {/* Login Card */}
        <div className="glass-strong rounded-2xl p-8 neon-glow">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {mode === 'register' ? 'Создание аккаунта' : 'Вход в систему'}
          </h2>

          <div className="mb-6 text-center text-sm text-slate-300">
            {mode === 'register'
              ? 'Создайте локальный аккаунт администратора. Данные хранятся только в приложении.'
              : 'Введите логин и пароль для входа в локальный аккаунт.'}
          </div>

          <div className="space-y-3 mb-6">
            {mode === 'register' && (
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full input-neon rounded-lg px-4 py-3 text-sm"
                placeholder="Имя (необязательно)"
              />
            )}
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full input-neon rounded-lg px-4 py-3 text-sm"
              placeholder="Логин"
            />
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              type="password"
              className="w-full input-neon rounded-lg px-4 py-3 text-sm"
              placeholder="Пароль"
            />
            {mode === 'register' && (
              <input
                value={repeatPassword}
                onChange={e => setRepeatPassword(e.target.value)}
                autoComplete="new-password"
                type="password"
                className="w-full input-neon rounded-lg px-4 py-3 text-sm"
                placeholder="Повторите пароль"
              />
            )}
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-400 text-center animate-fadeIn">
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={isBusy}
              className="w-full rounded-lg bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 py-3 text-sm font-medium hover:bg-cyan-500/30 disabled:opacity-50"
            >
              {isBusy ? 'Обработка...' : mode === 'register' ? 'Создать аккаунт и войти' : 'Войти'}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-300">Локальная авторизация • без внешних сервисов</p>
            <button
              onClick={() => {
                setError('');
                setMode(mode === 'register' ? 'login' : 'register');
              }}
              className="text-xs text-cyan-300 hover:text-cyan-200 mt-2"
            >
              {mode === 'register' ? 'Уже есть аккаунт? Войти' : 'Создать новый аккаунт'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-300 mt-6">v1.0 • Offline Mode</p>
      </div>
    </div>
  );
}
