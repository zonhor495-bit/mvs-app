import { useEffect, useRef, useState } from 'react';
import { User } from '../types';
import { getOrganizationsForUser, getActiveOrgId, setActiveOrgId, startSession, upsertGoogleUser } from '../store';

interface LoginProps {
  onLogin: (user: User, orgId?: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    if (!clientId) {
      setError('Не задан Google Client ID. Укажите VITE_GOOGLE_CLIENT_ID.');
      return;
    }

    const existingScript = document.querySelector('script[data-google-identity="true"]') as HTMLScriptElement | null;
    const initGoogle = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !buttonRef.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential?: string }) => handleCredential(response.credential),
      });
      buttonRef.current.innerHTML = '';
      google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 320,
        text: 'continue_with',
      });
      setIsReady(true);
    };

    if (existingScript) {
      if ((window as any).google) initGoogle();
      else existingScript.addEventListener('load', initGoogle, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = initGoogle;
    script.onerror = () => setError('Не удалось загрузить Google авторизацию');
    document.head.appendChild(script);
  }, [clientId]);

  const handleCredential = (credential?: string) => {
    if (!credential) {
      setError('Google не вернул данные авторизации');
      return;
    }

    try {
      const payload = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const user = upsertGoogleUser({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        photoUrl: payload.picture,
      });
      const organizations = getOrganizationsForUser(user.id || '');
      const activeId = getActiveOrgId();
      const org = activeId ? organizations.find(item => item.id === activeId) : organizations[0];
      if (org) {
        setActiveOrgId(org.id);
      }
      startSession(user, org?.id);
      onLogin(user, org?.id);
    } catch {
      setError('Ошибка обработки Google-авторизации');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center grid-bg relative overflow-hidden">
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
          <h2 className="text-xl font-semibold text-white mb-6 text-center">Вход в систему</h2>

          <div className="mb-6 text-center text-sm text-slate-400">
            Доступ в приложение выполняется только через Google-аккаунт. После входа новый пользователь попадает в пустое рабочее пространство и проходит мастер первоначальной настройки.
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-400 text-center animate-fadeIn">
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <div ref={buttonRef} className="min-h-[44px]" />
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">Google Session • User-isolated workspace</p>
            {!isReady && !error && <p className="text-xs text-slate-600 mt-2">Подготавливается кнопка входа…</p>}
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">v1.0 • Offline Mode</p>
      </div>
    </div>
  );
}
