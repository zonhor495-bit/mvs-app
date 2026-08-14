import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { User, UserRole, Page, Organization, generateId } from '../types';
import {
  restoreSession,
  restoreRemoteSession,
  getOrganizations,
  setActiveOrgId,
  addOrganization,
  clearSession,
  updateUserProfile,
} from '../store';
import { addServiceToOrganization } from '../store';
import FirstRunWizard from '../components/FirstRunWizard';
import Login from '../components/Login';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';
import Dashboard from '../components/Dashboard';
import Pricing from '../components/Pricing';
import Cashier from '../components/Cashier';
import Settings from '../components/Settings';
import UpdateDialog from '../components/UpdateDialog';
import WindowTitleBar from '../components/WindowTitleBar';
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

export default function App({ onLogout: externalOnLogout }: { onLogout?: () => void }) {
  const isDev = import.meta.env.DEV;
  const isElectron = typeof window !== 'undefined' && typeof window.electron !== 'undefined';

  const [user, setUser] = useState<User | null>(null);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isBootReady, setIsBootReady] = useState(false);
  const [_profileRerender, setProfileRerender] = useState(0);
  
  // Update dialog state
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [newVersion, setNewVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({
    percent: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
    remainingSeconds: null as number | null,
  });
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    if (!isElectron || typeof document === 'undefined') return;
    const prevBg = document.body.style.background;
    const prevColor = document.body.style.color;
    document.body.style.background = '#020617';
    document.body.style.color = '#e2e8f0';
    return () => {
      document.body.style.background = prevBg;
      document.body.style.color = prevColor;
    };
  }, [isElectron]);

  useEffect(() => {
    const initSession = async () => {
      // Try remote session first (if token exists)
      const remoteSession = await restoreRemoteSession();
      if (remoteSession) {
        setUser(remoteSession.user);
        const orgs = getOrganizations();
        const org = remoteSession.activeOrgId ? orgs.find(item => item.id === remoteSession.activeOrgId) : orgs[0];
        if (org) setActiveOrg(org);
        setIsBootReady(true);
        return;
      }
      
      // Fall back to local session
      const restored = restoreSession();
      if (restored) {
        setUser(restored.user);
        const orgs = getOrganizations();
        const org = restored.activeOrgId ? orgs.find(item => item.id === restored.activeOrgId) : orgs[0];
        if (org) setActiveOrg(org);
      }
      setIsBootReady(true);
    };
    
    initSession();
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
    const cleanupCallbacks: Array<() => void> = [];

    // Listen for update available
    cleanupCallbacks.push(updater.onUpdateAvailable((data: { currentVersion: string; newVersion: string; releaseNotes: string[] }) => {
      setCurrentVersion(data.currentVersion);
      setNewVersion(data.newVersion);
      setReleaseNotes(data.releaseNotes || []);
      setIsUpdateDialogOpen(true);
      setIsDownloading(false);
      setIsReadyToInstall(false);
      setUpdateErrorMessage(null);
      setDownloadProgress({ percent: 0, bytesPerSecond: 0, transferred: 0, total: 0, remainingSeconds: null });
    }));

    // Listen for download progress
    cleanupCallbacks.push(updater.onDownloadProgress((progress) => {
      setDownloadProgress({
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
        remainingSeconds: progress.remainingSeconds,
      });
    }));

    // Listen for update downloaded
    cleanupCallbacks.push(updater.onUpdateDownloaded(() => {
      setIsDownloading(false);
      setIsReadyToInstall(true);
      setUpdateErrorMessage(null);
      setDownloadProgress((prev) => ({ ...prev, percent: 100 }));
    }));

    // Listen for errors
    cleanupCallbacks.push(updater.onError((error: { message: string }) => {
      console.error('Update error:', error);
      setUpdateErrorMessage(error.message || 'Ошибка обновления');
      setIsDownloading(false);
    }));

    return () => {
      cleanupCallbacks.forEach((dispose) => dispose());
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
    const selectedOrg = orgId ? orgs.find(o => o.id === orgId) : orgs[0];

    if (selectedOrg) {
      setActiveOrg(selectedOrg);
      setCurrentPage('dashboard');
      return;
    }

    const defaultOrg: Organization = {
      id: generateId(),
      ownerId: loggedInUser.id,
      name: 'MVS',
      currency: 'тг',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Almaty',
      language: 'ru',
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
    addOrganization(defaultOrg);
    setActiveOrgId(defaultOrg.id);
    setActiveOrg(defaultOrg);
    setCurrentPage('dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setUser(null);
    setActiveOrg(null);
    setCurrentPage('dashboard');
    
    // Вызвать внешний callback если он есть (для переключения на экран входа)
    if (externalOnLogout) {
      externalOnLogout();
    }
  }, [externalOnLogout]);

  const handleOrgChange = useCallback((orgId: string) => {
    setActiveOrgId(orgId);
    const orgs = getOrganizations();
    const org = orgs.find(o => o.id === orgId);
    if (org) setActiveOrg(org);
  }, []);

  const handleRoleChange = useCallback((nextRole: UserRole) => {
    if (!user?.id) return;
    if (user.role === nextRole) return;
    const updated = updateUserProfile(user.id, { role: nextRole });
    if (updated) setUser(updated);
    // Если администратор пытался переключиться, перенаправить на dashboard
    if (nextRole === 'admin') {
      const adminCanAccess = ['dashboard', 'orders', 'clients', 'pricing', 'cashier', 'analytics', 'reports'];
      if (!adminCanAccess.includes(currentPage)) {
        setCurrentPage('dashboard');
      }
    }
  }, [user, currentPage]);

  const handleUpdateClick = useCallback(() => {
    if (window.electron?.updater) {
      setIsDownloading(true);
      setIsReadyToInstall(false);
      setUpdateErrorMessage(null);
      setDownloadProgress({ percent: 0, bytesPerSecond: 0, transferred: 0, total: 0, remainingSeconds: null });
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

  const handleSetupComplete = useCallback((payload: { washName: string; ownerName: string; timezone: string; currency: string; language: string; services?: any[] }) => {
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
    // Добавить услуги если они были переданы
    if (payload.services && payload.services.length > 0) {
      payload.services.forEach(service => {
        addServiceToOrganization(organization.id, {
          ...service,
          organizationId: organization.id,
        });
      });
    }

    setActiveOrgId(organization.id);
    setActiveOrg(organization);
    setCurrentPage('dashboard');
  }, [user]);

  const renderPage = () => {
    if (!user || !activeOrg) return null;
    const key = activeOrg.id;

    // Администратор может видеть только: dashboard, orders, clients, pricing, cashier, analytics, reports
    const adminCanAccess = ['dashboard', 'orders', 'clients', 'pricing', 'cashier', 'analytics', 'reports'].includes(currentPage);
    const isPageRestricted = user.role === 'admin' && !adminCanAccess;

    if (isPageRestricted) {
      return (
        <div className="max-w-3xl mx-auto glass rounded-xl p-6 text-slate-200">
          <h3 className="text-lg font-semibold text-white mb-2">Недостаточно прав доступа.</h3>
          <p className="text-sm text-slate-400">Этот раздел доступен только управляющему. Переключитесь на роль управляющего с правильным паролем.</p>
        </div>
      );
    }

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

  const content = !user
    ? <Login onLogin={handleLogin} />
    : !activeOrg
    ? <FirstRunWizard user={user} onLogout={handleLogout} onComplete={handleSetupComplete} />
    : (
      <ErrorBoundary>
        <Layout
          user={user}
          activeOrg={activeOrg}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onLogout={handleLogout}
          onOrgChange={handleOrgChange}
          onRoleChange={handleRoleChange}
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
          releaseNotes={releaseNotes}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          isReadyToInstall={isReadyToInstall}
          errorMessage={updateErrorMessage}
          isDark={isDarkTheme}
          onUpdate={handleUpdateClick}
          onDismiss={handleDismissUpdate}
          onInstall={handleInstallUpdate}
        />
      </ErrorBoundary>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {isElectron && <WindowTitleBar />}
      <div className={isElectron ? 'h-[calc(100vh-44px)]' : 'min-h-screen'}>
        {content}
      </div>
    </div>
  );
}
