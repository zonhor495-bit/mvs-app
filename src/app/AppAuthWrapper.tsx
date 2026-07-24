import React, { useState, useEffect } from 'react';
import { isAppInitialized, getCurrentRole } from '../store';
import { InitSetup } from '../components/InitSetup';
import { RoleLogin } from '../components/RoleLogin';
import InternalApp from './InternalApp';

type AuthState = 'init-setup' | 'role-login' | 'authenticated';

/**
 * Компонент, управляющий экранами аутентификации
 */
export const AppAuthWrapper: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>('init-setup');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Проверить был ли уже инициализирован
    const isInit = isAppInitialized();
    
    if (isInit) {
      // Уже инициализирован - показать экран входа
      setAuthState('role-login');
    } else {
      // Первый запуск - показать экран настройки
      setAuthState('init-setup');
    }
    
    setIsReady(true);
  }, []);

  if (!isReady) {
    return <div className="min-h-screen bg-slate-900" />;
  }

  // Экран начальной настройки
  if (authState === 'init-setup') {
    return (
      <InitSetup
        onSetupComplete={() => {
          setAuthState('authenticated');
        }}
      />
    );
  }

  // Экран выбора роли и входа
  if (authState === 'role-login') {
    return (
      <RoleLogin
        onLogin={() => {
          setAuthState('authenticated');
        }}
      />
    );
  }

  // Основное приложение
  return <InternalApp onLogoutRequest={() => setAuthState('role-login')} />;
};

export default AppAuthWrapper;
