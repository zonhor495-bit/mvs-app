import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { User, Page, Organization, generateId } from '../types';
import { restoreSession, getOrganizations, setActiveOrgId, addOrganization, clearSession, updateUserProfile } from '../store';
import Login from '../components/Login';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';
import Dashboard from '../components/Dashboard';
import Pricing from '../components/Pricing';
import Cashier from '../components/Cashier';
import Settings from '../components/Settings';
import UpdateDialog from '../components/UpdateDialog';
// Lazy-load StressTestPanel so it is not bundled into production builds
// Lazy load heavy components
const Orders = lazy(() => import('../components/Orders'));
const Clients = lazy(() => import('../components/Clients'));
const Washers = lazy(() => import('../components/Washers'));
const Warehouse = lazy(() => import('../components/Warehouse'));
const Analytics = lazy(() => import('../components/Analytics'));
const Reports = lazy(() => import('../components/Reports'));
const FinanceIncome = lazy(() => import('../components/FinanceIncome'));
const FinanceExpenses = lazy(() => import('../components/FinanceExpenses'));
const FinanceProfit = lazy(() => import('../components/FinanceProfit'));
const FinancePayroll = lazy(() => import('../components/FinancePayroll'));
const FinanceCashFlow = lazy(() => import('../components/FinanceCashFlow'));
const FinanceAnalytics = lazy(() => import('../components/FinanceAnalytics'));
const DevStressTest = import.meta.env.DEV ? lazy(() => import('../components/StressTestPanel').then(m => ({ default: m.StressTestPanel }))) : null;

export default function App() {
  const isDev = import.meta.env.DEV;

  const [user, setUser] = useState<User | null>(null);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isBootReady, setIsBootReady] = useState(false);
  const [_profileRerender, setProfileRerender] = useState(0);
  
  // Update dialog state
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [newVersion, setNewVersion] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const restored = restoreSession();
    if (restored) {
      setUser(restored.user);
      const orgs = getOrganizations();
      const org = restored.activeOrgId ? orgs.find(item => item.id === restored.activeOrgId) : orgs[0];
      if (org) setActiveOrg(org);
    }
    setIsBootReady(true);
  }, []);

  // Detect dark theme
  useEffect(() => {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkTheme(isDark);
  }, []);

  // Setup auto-update listeners
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron?.updater) return;

    const updater = window.electron.updater;

    // Listen for update available
    updater.onUpdateAvailable((data: { currentVersion: string; newVersion: string }) => {
      setCurrentVersion(data.currentVersion);
      setNewVersion(data.newVersion);
      setIsUpdateDialogOpen(true);
      setIsDownloading(false);
      setDownloadProgress(0);
    });

    // Listen for download progress
    updater.onDownloadProgress((progress: { percent: number }) => {
      setDownloadProgress(Math.round(progress.percent));
    });

    // Listen for update downloaded
    updater.onUpdateDownloaded(() => {
      setIsDownloading(false);
      setDownloadProgress(100);
    });

    // Listen for errors
    updater.onError((error: Error) => {
      console.error('Update error:', error);
      setIsDownloading(false);
    });

    return () => {
      // Cleanup listeners if needed
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get('profile')) return;
    const id = window.setTimeout(() => setProfileRerender(prev => prev + 1), 600);
    return () => window.clearTimeout(id);
  }, []);

  const handleLogin = useCallback((loggedInUser: User, orgId?: string) => {
    setUser(loggedInUser);
    const orgs = getOrganizations();
    const org = orgId ? orgs.find(o => o.id === orgId) : orgs[0];
    setActiveOrg(org || null);
    setCurrentPage('dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setUser(null);
    setActiveOrg(null);
    setCurrentPage('dashboard');
  }, []);

  const handleOrgChange = useCallback((orgId: string) => {
    setActiveOrgId(orgId);
    const orgs = getOrganizations();
    const org = orgs.find(o => o.id === orgId);
    if (org) setActiveOrg(org);
  }, []);

  const handleUpdateClick = useCallback(() => {
    if (window.electron?.updater) {
      setIsDownloading(true);
      setDownloadProgress(0);
      window.electron.updater.downloadUpdate();
    }
  }, []);

  const handleDismissUpdate = useCallback(() => {
    setIsUpdateDialogOpen(false);
  }, []);

  const handleInstallUpdate = useCallback(() => {
    if (window.electron?.updater) {
      window.electron.updater.installUpdate();
    }
  }, []);

  const handleSetupComplete = useCallback((payload: { washName: string; ownerName: string; timezone: string; currency: string; language: string }) => {
    if (!user) return;

    const updatedUser = updateUserProfile(user.id || '', {
      name: payload.ownerName.trim() || user.name,
    });
    if (updatedUser) setUser(updatedUser);

    const organization: Organization = {
      id: generateId(),
      ownerId: user.id,
      name: payload.washName.trim(),
      currency: payload.currency.trim() || 'тг',
      timezone: payload.timezone,
      language: payload.language,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warehouseAdminView: true,
      analyticsAdminView: true,
      washerPercent: 45,
      financialSettings: {
        calculationMode: 'percent',
        employeePercent: 45,
        organizationPercent: 55,
        salaryAmount: 0,
        fixedOrderAmount: 0,
      },
    };

    addOrganization(organization);
    setActiveOrgId(organization.id);
    setActiveOrg(organization);
    setCurrentPage('dashboard');
  }, [user]);

  const renderPage = () => {
    if (!user || !activeOrg) return null;
    const key = activeOrg.id;

    const content = (() => {
      switch (currentPage) {
        case 'dashboard':
          return <Dashboard key={key} activeOrg={activeOrg} />;
        case 'orders':
          return <Orders key={key} activeOrg={activeOrg} userRole={user.role} />;
        case 'clients':
          return <Clients key={key} activeOrg={activeOrg} userRole={user.role} />;
        case 'pricing':
          return <Pricing key={key} activeOrg={activeOrg} userRole={user.role} />;
        case 'washers':
          return <Washers key={key} activeOrg={activeOrg} userRole={user.role} />;
        case 'warehouse':
          return <Warehouse key={key} activeOrg={activeOrg} userRole={user.role} />;
        case 'analytics':
          return <Analytics key={key} activeOrg={activeOrg} userRole={user.role} />;
        case 'reports':
          return <Reports key={key} activeOrg={activeOrg} />;
        case 'cashier':
          return <Cashier key={key} activeOrg={activeOrg} userRole={user.role} />;
        case 'settings':
          return <Settings key={key} activeOrg={activeOrg} userRole={user.role} onOrgChange={handleOrgChange} />;
        case 'finance_income':
          return <FinanceIncome key={key} activeOrg={activeOrg} />;
        case 'finance_expenses':
          return <FinanceExpenses key={key} activeOrg={activeOrg} />;
        case 'finance_profit':
          return <FinanceProfit key={key} activeOrg={activeOrg} />;
        case 'finance_payroll':
          return <FinancePayroll key={key} activeOrg={activeOrg} />;
        case 'finance_cashflow':
          return <FinanceCashFlow key={key} activeOrg={activeOrg} />;
        case 'finance_analytics':
          return <FinanceAnalytics key={key} activeOrg={activeOrg} />;
        default:
          return <Dashboard key={key} activeOrg={activeOrg} />;
      }
    })();

    // Wrap lazy components in Suspense
    const isLazy = ['orders', 'clients', 'washers', 'warehouse', 'analytics', 'reports', 'finance_income', 'finance_expenses', 'finance_profit', 'finance_payroll', 'finance_cashflow', 'finance_analytics'].includes(currentPage);
    
    return isLazy ? (
      <Suspense fallback={<div className="flex items-center justify-center h-96 text-slate-400">Загрузка...</div>}>
        {content}
      </Suspense>
    ) : content;
  };

  if (!isBootReady) {
    return null;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (!activeOrg) {
    return <FirstRunSetup user={user} onLogout={handleLogout} onComplete={handleSetupComplete} />;
  }

  return (
    <ErrorBoundary>
      <Layout
        user={user}
        activeOrg={activeOrg}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
        onOrgChange={handleOrgChange}
      >
        {renderPage()}
      </Layout>
      {isDev && DevStressTest && (
        <Suspense fallback={null}>
          <DevStressTest />
        </Suspense>
      )}
      <UpdateDialog
        isOpen={isUpdateDialogOpen}
        currentVersion={currentVersion}
        newVersion={newVersion}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        isDark={isDarkTheme}
        onUpdate={handleUpdateClick}
        onDismiss={handleDismissUpdate}
        onInstall={handleInstallUpdate}
      />
    </ErrorBoundary>
  );
}

function FirstRunSetup({ user, onLogout, onComplete }: {
  user: User;
  onLogout: () => void;
  onComplete: (payload: { washName: string; ownerName: string; timezone: string; currency: string; language: string }) => void;
}) {
  const [washName, setWashName] = useState('');
  const [ownerName, setOwnerName] = useState(user.name || '');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Almaty');
  const [currency, setCurrency] = useState('тг');
  const [language, setLanguage] = useState('ru');

  const handleSubmit = () => {
    if (!washName.trim()) return;
    onComplete({ washName, ownerName, timezone, currency, language });
  };

  return (
    <div className="min-h-screen flex items-center justify-center grid-bg relative overflow-hidden">
      <div className="relative z-10 w-full max-w-2xl px-6 animate-fadeIn">
        <div className="glass-strong rounded-2xl p-8 neon-glow">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Первоначальная настройка</h1>
              <p className="text-sm text-slate-400 mt-1">Создайте первую автомойку. Приложение стартует полностью пустым, без демо-данных.</p>
            </div>
            <button onClick={onLogout} className="text-xs text-slate-500 hover:text-red-400">Выйти</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-2">Название автомойки</label>
              <input value={washName} onChange={e => setWashName(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" placeholder="Например, Aqua Drive" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Владелец</label>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" placeholder="Имя владельца" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Часовой пояс</label>
              <input value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Валюта</label>
              <input value={currency} onChange={e => setCurrency(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Язык</label>
              <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm">
                <option value="ru">Русский</option>
                <option value="kk">Қазақша</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button onClick={handleSubmit} className="btn-neon rounded-lg px-6 py-3 text-sm font-semibold">Создать автомойку</button>
          </div>
        </div>
      </div>
    </div>
  );
}
