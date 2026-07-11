import { ReactNode } from 'react';
import { User, Page, Organization } from '../types';
import { getOrganizations } from '../store';

interface LayoutProps {
  user: User;
  activeOrg: Organization;
  currentPage: Page;
  onPageChange: (page: Page) => void;
  onLogout: () => void;
  onOrgChange: (orgId: string) => void;
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

export default function Layout({ user, activeOrg, currentPage, onPageChange, onLogout, onOrgChange, children }: LayoutProps) {
  const orgs = getOrganizations();
  const isManager = user.role === 'manager';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 glass-strong flex flex-col no-print" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl glass neon-glow flex items-center justify-center">
              <span className="text-lg">🚗</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-cyan-400 neon-text">Wash&Drive</h1>
              <p className="text-[10px] text-slate-500">Management System</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item, i) => {
            const isDisabled =
              (item.page === 'settings' && !isManager) ||
              (item.page === 'warehouse' && !isManager && activeOrg.warehouseAdminView === false) ||
              (item.page === 'analytics' && !isManager && activeOrg.analyticsAdminView === false);
            return (
              <button
                key={item.page}
                onClick={() => !isDisabled && onPageChange(item.page)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 animate-slideIn ${
                  currentPage === item.page
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 neon-glow'
                    : isDisabled
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
                {isDisabled && <span className="ml-auto text-[10px] text-slate-600">🔒</span>}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm" style={{
              background: isManager ? 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.3))' : 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(59,130,246,0.3))',
              border: `1px solid ${isManager ? 'rgba(124,58,237,0.4)' : 'rgba(0,212,255,0.4)'}`
            }}>
              {isManager ? '👑' : '👤'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{isManager ? 'Управляющий' : 'Администратор'}</p>
              <p className="text-[10px] text-slate-500">{isManager ? 'Полный доступ' : 'Ограниченный'}</p>
            </div>
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
            <span className="text-xs text-slate-500">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Система работает" />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6 grid-bg">
          {children}
        </div>
      </main>
    </div>
  );
}
