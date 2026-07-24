import { ReactNode, useState } from 'react';
import { User, UserRole, Page, Organization } from '../types';
import { getOrganizations, verifyPassword } from '../store';

interface LayoutProps {
  user: User;
  activeOrg: Organization;
  currentPage: Page;
  onPageChange: (page: Page) => void;
  onLogout: () => void;
  onOrgChange: (orgId: string) => void;
  onRoleChange: (role: UserRole) => void;
  children: ReactNode;
}

const navItems: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Дашборд', icon: '📊' },
  { page: 'orders', label: 'Заказы', icon: '📋' },
  { page: 'clients', label: 'Клиенты', icon: '🧑‍🤝‍🧑' },
  { page: 'pricing', label: 'Прайс и услуги', icon: '💰' },
  { page: 'washers', label: 'Сотрудники', icon: '👷' },
  { page: 'warehouse', label: 'Склад', icon: '📦' },
  { page: 'analytics', label: 'Аналитика', icon: '📊' },
  { page: 'cashier', label: 'Касса', icon: '💵' },
  { page: 'finance_income', label: '💳 Доходы', icon: '📈' },
  { page: 'finance_expenses', label: '💳 Расходы', icon: '📉' },
  { page: 'finance_profit', label: '💳 Прибыль', icon: '🎯' },
  { page: 'finance_payroll', label: '💳 Зарплаты', icon: '💸' },
  { page: 'finance_cashflow', label: '💳 Движение денег', icon: '💱' },
  { page: 'finance_analytics', label: '💳 Финаналитика', icon: '📊' },
  { page: 'reports', label: 'Отчёты', icon: '📈' },
  { page: 'settings', label: 'Настройки', icon: '⚙️' },
];

export default function Layout({ user, activeOrg, currentPage, onPageChange, onLogout, onOrgChange, onRoleChange, children }: LayoutProps) {
  const orgs = getOrganizations();
  const isManager = user.role === 'manager';
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const [rolePromptOpen, setRolePromptOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [rolePassword, setRolePassword] = useState('');
  const [roleError, setRoleError] = useState('');

  const roleLabel = user.role === 'manager' ? 'Управляющий' : 'Администратор';
  const roleIcon = user.role === 'manager' ? '👑' : '🛡️';

  const handleRoleSelect = (role: UserRole) => {
    setIsRoleMenuOpen(false);
    if (role === user.role) return;
    setPendingRole(role);
    setRolePromptOpen(true);
    setRolePassword('');
    setRoleError('');
  };

  const confirmRoleSwitch = () => {
    if (!pendingRole) return;
    if (!verifyPassword(pendingRole, rolePassword)) {
      setRoleError('Неверный пароль');
      return;
    }
    onRoleChange(pendingRole);
    setRolePromptOpen(false);
    setPendingRole(null);
    setRolePassword('');
    setRoleError('');
  };

  const handleManualUpdateCheck = async () => {
    setIsHelpMenuOpen(false);
    if (!window.electron?.updater) return;
    try {
      await window.electron.updater.checkForUpdates('manual');
    } catch (error) {
      alert('Не удалось проверить обновления. Попробуйте позже.');
    }
  };

  return (
    <div className="flex h-full min-h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 glass-strong flex flex-col no-print" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl glass neon-glow flex items-center justify-center">
              <span className="text-lg">🚗</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-cyan-400 neon-text">MVS</h1>
              <p className="text-[10px] text-slate-500">Car Management System</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item, i) => {
            // Администратор может видеть только: dashboard, orders, clients, pricing, cashier, analytics, reports
            const adminCanAccess = ['dashboard', 'orders', 'clients', 'pricing', 'cashier', 'analytics', 'reports'].includes(item.page);
            const isDisabled = !isManager && !adminCanAccess;
            
            return (
              <button
                key={item.page}
                onClick={() => !isDisabled && onPageChange(item.page)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 animate-slideIn ${
                  currentPage === item.page
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 neon-glow'
                    : isDisabled
                    ? 'hidden'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-white/5">
          <div className="relative">
            <button
              onClick={() => setIsRoleMenuOpen(prev => !prev)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 transition"
            >
              <p className="text-sm font-medium text-white truncate">{user.name || user.username || 'Пользователь'}</p>
              <p className="text-xs text-slate-300 mt-1">{roleIcon} {roleLabel}</p>
            </button>
            {isRoleMenuOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
                <button onClick={() => handleRoleSelect('manager')} className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10">👑 Управляющий</button>
                <button onClick={() => handleRoleSelect('admin')} className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/10">🛡️ Администратор</button>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            className="w-full mt-3 text-xs text-slate-500 hover:text-red-400 transition-colors py-2"
          >
            Выйти из системы
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-16 glass flex items-center justify-between px-6 no-print" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setIsRoleMenuOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition text-sm"
                title="Переключить роль"
              >
                <span className="text-lg">{roleIcon}</span>
                <span className="text-slate-300">{roleLabel}</span>
              </button>
              {isRoleMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 rounded-xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden z-50">
                  <button 
                    onClick={() => handleRoleSelect('admin')} 
                    className={`w-full px-4 py-3 text-left text-sm transition ${user.role === 'admin' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-100 hover:bg-white/10'}`}
                  >
                    👤 Администратор
                  </button>
                  <button 
                    onClick={() => handleRoleSelect('manager')} 
                    className={`w-full px-4 py-3 text-left text-sm transition ${user.role === 'manager' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-100 hover:bg-white/10'}`}
                  >
                    👑 Управляющий
                  </button>
                  <div className="border-t border-white/5" />
                  <button 
                    onClick={() => { setIsRoleMenuOpen(false); onLogout(); }} 
                    className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition"
                  >
                    🚪 Выйти из аккаунта
                  </button>
                </div>
              )}
            </div>
            <h2 className="text-lg font-semibold text-white">{activeOrg.name}</h2>
            {orgs.length > 1 && (
              <select
                value={activeOrg.id}
                onChange={e => onOrgChange(e.target.value)}
                className="input-neon rounded-lg px-3 py-1.5 text-xs"
              >
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setIsHelpMenuOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition text-sm text-slate-300"
                title="Справка"
              >
                ❓ Справка
              </button>
              {isHelpMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                  <button
                    onClick={handleManualUpdateCheck}
                    className="w-full px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/10"
                  >
                    Проверить обновления
                  </button>
                </div>
              )}
            </div>
            <span className="text-xs text-slate-500">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Система работает" />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6 grid-bg">
          {children}
        </div>
      </main>

      {rolePromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={() => { setRolePromptOpen(false); setPendingRole(null); }}>
          <div className="modal-panel rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white">Введите пароль {pendingRole === 'manager' ? 'управляющего' : 'администратора'}</h3>
            <input
              autoFocus
              type="password"
              value={rolePassword}
              onChange={e => { setRolePassword(e.target.value); setRoleError(''); }}
              className="mt-4 w-full input-neon rounded-lg px-4 py-3 text-sm"
              placeholder="Пароль"
              onKeyDown={e => e.key === 'Enter' && confirmRoleSwitch()}
            />
            {roleError && <p className="text-sm text-red-400 mt-3">{roleError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setRolePromptOpen(false); setPendingRole(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Отмена</button>
              <button onClick={confirmRoleSwitch} className="btn-neon rounded-lg px-5 py-2 text-sm">Подтвердить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
