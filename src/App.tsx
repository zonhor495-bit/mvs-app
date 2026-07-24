import { BrowserRouter } from 'react-router-dom';
import { useState, useEffect } from 'react';
import InternalApp from './app/InternalApp';
import WebsiteApp from './website/WebsiteApp';
import { InitSetup } from './components/InitSetup';
import { RoleLogin } from './components/RoleLogin';
import { isAppInitialized, saveAuthPasswords, setCurrentRole, verifyPassword } from './store';

type AppState = 'init-setup' | 'role-login' | 'app';

function App() {
  const isElectron = typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined';
  const isAppPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
  
  // Для внешнего приложения (не Electron и не /app) показываем WebsiteApp
  if (!isElectron && !isAppPath) {
    return (
      <BrowserRouter basename="/mvs-app">
        <WebsiteApp />
      </BrowserRouter>
    );
  }

  // Для внутреннего приложения (Electron или /app)
  return <InternalAppWithAuth />;
}

/**
 * Обёртка для InternalApp с управлением аутентификацией
 */
function InternalAppWithAuth() {
  const [appState, setAppState] = useState<AppState>('init-setup');
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Проверить был ли уже инициализирован
    const isInit = isAppInitialized();
    
    if (isInit) {
      // Уже инициализирован - показать экран входа
      setAppState('role-login');
    } else {
      // Первый запуск - показать экран настройки
      setAppState('init-setup');
    }
    
    setIsReady(true);
  }, []);

  const handleInitSetupComplete = (adminPassword: string, managerPassword: string) => {
    saveAuthPasswords({
      admin: adminPassword,
      manager: managerPassword,
    });

    // Автоматический вход под администратором
    handleRoleLogin('admin', adminPassword);
  };

  const handleRoleLogin = async (role: 'admin' | 'manager', password: string) => {
    setIsLoading(true);

    try {
      // Проверить пароль
      const isValid = verifyPassword(role, password);
      
      if (!isValid) {
        alert('Неверный пароль');
        setIsLoading(false);
        return;
      }

      // Пароль верный - сохранить роль и перейти в приложение
      setCurrentRole(role);
      setAppState('app');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setAppState('role-login');
  };

  if (!isReady) {
    return <div className="min-h-screen bg-slate-900" />;
  }

  // Экран начальной настройки
  if (appState === 'init-setup') {
    return <InitSetup onSetupComplete={handleInitSetupComplete} />;
  }

  // Экран выбора роли и входа
  if (appState === 'role-login') {
    return (
      <RoleLogin
        onLogin={handleRoleLogin}
        isLoading={isLoading}
      />
    );
  }

  // Основное приложение
  return <InternalApp onLogout={handleLogout} />;
}

export default App;
