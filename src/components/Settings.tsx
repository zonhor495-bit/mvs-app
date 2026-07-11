import { useState, useMemo, useEffect } from 'react';
import { Organization, Box, Washer, FinanceCalculationMode, generateId } from '../types';
import { getOrganizations, updateOrganization, deleteOrganization, addOrganization, setActiveOrgId, getBoxes, addBox, updateBox, deleteBox, getWashers, updateWasher, getWorkerTimelogs, getFinancialSettings, saveFinancialSettings } from '../store';
import LoyaltySettings from './LoyaltySettings';
import BackupManager from './BackupManager';

interface SettingsProps {
  activeOrg: Organization;
  userRole: 'admin' | 'manager';
  onOrgChange: (orgId: string) => void;
}

export default function Settings({ activeOrg, userRole, onOrgChange }: SettingsProps) {
  const [orgs, setOrgs] = useState(() => getOrganizations());
  const [boxes, setBoxes] = useState<Box[]>(() => getBoxes(activeOrg.id));
  const [newBoxName, setNewBoxName] = useState('');
  const [tab, setTab] = useState<'org' | 'boxes' | 'finance' | 'backup' | 'system' | 'loyalty'>('org');
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCurrency, setNewOrgCurrency] = useState('тг');
  const [newOrgContacts, setNewOrgContacts] = useState('');

  const refresh = () => setOrgs(getOrganizations());
  const refreshBoxes = () => setBoxes(getBoxes(activeOrg.id));

  useEffect(() => {
    const handleStoreChanged = () => {
      setOrgs(getOrganizations());
      setBoxes(getBoxes(activeOrg.id));
    };
    window.addEventListener('wd-store-changed', handleStoreChanged);
    return () => window.removeEventListener('wd-store-changed', handleStoreChanged);
  }, [activeOrg.id]);

  const handleAddBox = () => {
    if (!newBoxName.trim()) return;
    addBox({ id: generateId(), name: newBoxName.trim(), organizationId: activeOrg.id, isActive: true });
    setNewBoxName('');
    refreshBoxes();
  };

  const handleToggleBox = (box: Box) => {
    updateBox({ ...box, isActive: !box.isActive });
    refreshBoxes();
  };

  const handleDeleteBox = (id: string) => {
    if (!confirm('Удалить бокс?')) return;
    deleteBox(id);
    refreshBoxes();
  };

  const handleUpdateOrg = (org: Organization) => {
    updateOrganization(org);
    setEditOrg(null);
    refresh();
  };

  const handleDeleteOrg = (id: string) => {
    if (orgs.length <= 1) {
      alert('Нельзя удалить последнюю организацию');
      return;
    }
    if (!confirm('Удалить организацию и все связанные данные?')) return;
    deleteOrganization(id);
    if (activeOrg.id === id) {
      const remaining = getOrganizations();
      if (remaining.length > 0) {
        setActiveOrgId(remaining[0].id);
        onOrgChange(remaining[0].id);
      }
    }
    refresh();
  };

  const handleCreateOrg = () => {
    if (!newOrgName.trim()) return;
    const org: Organization = {
      id: generateId(),
      name: newOrgName.trim(),
      currency: newOrgCurrency.trim() || 'тг',
      contacts: newOrgContacts.trim() || undefined,
      createdAt: new Date().toISOString(),
      warehouseAdminView: true,
      analyticsAdminView: true,
    };
    addOrganization(org);
    setShowNewOrg(false);
    setNewOrgName('');
    setNewOrgCurrency('тг');
    setNewOrgContacts('');
    refresh();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Настройки</h1>

      <div className="flex gap-2">
        {(['org', 'boxes', 'finance', 'backup', 'system', 'loyalty'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${tab === t ? 'btn-neon' : 'text-slate-400 hover:text-white'}`}
          >
            {t === 'org' ? '🏢 Организации' : t === 'boxes' ? '🏗 Боксы' : t === 'finance' ? '💸 Финансы' : t === 'backup' ? '💾 Бэкапы' : t === 'system' ? '⚙️ Система' : '🎁 Лояльность'}
          </button>
        ))}
      </div>

      {tab === 'org' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Current org */}
          <div className="glass rounded-xl p-6 neon-glow">
            <h2 className="text-lg font-semibold text-white mb-4">Текущая организация</h2>
            {editOrg && editOrg.id === activeOrg.id ? (
              <EditOrgForm org={editOrg} onSave={handleUpdateOrg} onCancel={() => setEditOrg(null)} />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))',
                    border: '1px solid rgba(0,212,255,0.2)'
                  }}>
                    🏢
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{activeOrg.name}</h3>
                    {activeOrg.contacts && <p className="text-sm text-slate-400">{activeOrg.contacts}</p>}
                    <p className="text-xs text-slate-500">Валюта: {activeOrg.currency} • Создана: {new Date(activeOrg.createdAt).toLocaleDateString('ru-RU')}</p>
                  </div>
                </div>
                <button onClick={() => setEditOrg({ ...activeOrg })} className="btn-neon rounded-lg px-4 py-2 text-sm">Редактировать</button>
              </div>
            )}
          </div>

          {/* All orgs */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Все организации</h2>
              <button onClick={() => setShowNewOrg(true)} className="btn-neon rounded-lg px-4 py-2 text-xs">+ Новая организация</button>
            </div>
            <div className="space-y-3">
              {orgs.map(o => (
                <div key={o.id} className={`flex items-center justify-between p-4 rounded-xl transition-all ${o.id === activeOrg.id ? 'bg-cyan-500/5 border border-cyan-500/20 neon-glow' : 'bg-white/2 hover:bg-white/4'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm" style={{
                      background: o.id === activeOrg.id ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${o.id === activeOrg.id ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`
                    }}>
                      🏢
                    </div>
                    <div>
                      <p className="text-white font-medium">{o.name}</p>
                      <p className="text-xs text-slate-500">{o.currency} {o.contacts ? `• ${o.contacts}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {o.id !== activeOrg.id && (
                      <button
                        onClick={() => { setActiveOrgId(o.id); onOrgChange(o.id); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                      >
                        Переключить
                      </button>
                    )}
                    {o.id === activeOrg.id && (
                      <span className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400">Активна</span>
                    )}
                    <button onClick={() => setEditOrg({ ...o })} className="text-xs px-2 py-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors">✎</button>
                    <button onClick={() => handleDeleteOrg(o.id)} className="text-xs px-2 py-1.5 rounded-lg bg-red-500/5 text-red-400/50 hover:text-red-400 transition-colors">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New org form */}
          {showNewOrg && (
            <div className="glass rounded-xl p-6 neon-glow animate-fadeIn">
              <h2 className="text-lg font-semibold text-white mb-4">Новая организация</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Название *</label>
                  <input type="text" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} className="w-full input-neon rounded-lg px-4 py-2 text-sm" autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Валюта</label>
                    <input type="text" value={newOrgCurrency} onChange={e => setNewOrgCurrency(e.target.value)} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Контакты</label>
                    <input type="text" value={newOrgContacts} onChange={e => setNewOrgContacts(e.target.value)} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowNewOrg(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Отмена</button>
                  <button onClick={handleCreateOrg} className="btn-neon rounded-lg px-6 py-2 text-sm font-medium">Создать</button>
                </div>
              </div>
            </div>
          )}

          {/* Edit org modal (for non-active orgs) */}
          {editOrg && editOrg.id !== activeOrg.id && (
            <div className="glass rounded-xl p-6 neon-glow animate-fadeIn">
              <h2 className="text-lg font-semibold text-white mb-4">Редактировать: {editOrg.name}</h2>
              <EditOrgForm org={editOrg} onSave={handleUpdateOrg} onCancel={() => setEditOrg(null)} />
            </div>
          )}
        </div>
      )}

      {tab === 'boxes' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="glass rounded-xl p-6 neon-glow">
            <h2 className="text-lg font-semibold text-white mb-2">🏗 Управление боксами</h2>
            <p className="text-xs text-slate-400 mb-4">Боксы отображаются при создании заказа. Назовите и настройте количество боксов под свою автомойку.</p>
            <div className="space-y-2 mb-4">
              {boxes.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-6">Боксы не добавлены. Добавьте первый бокс ниже.</p>
              )}
              {boxes.map((b, idx) => (
                <div
                  key={b.id}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                    b.isActive
                      ? 'bg-white/3 border border-white/5'
                      : 'bg-white/1 border border-white/3 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600 text-xs w-5 text-center">{idx + 1}</span>
                    <span className={`text-sm font-medium ${b.isActive ? 'text-white' : 'text-slate-500'}`}>{b.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      b.isActive ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-500'
                    }`}>
                      {b.isActive ? 'Активен' : 'Отключён'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleBox(b)}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                        b.isActive
                          ? 'bg-slate-500/10 text-slate-400 hover:text-white'
                          : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                      }`}
                    >
                      {b.isActive ? 'Откл.' : 'Вкл.'}
                    </button>
                    <button
                      onClick={() => handleDeleteBox(b.id)}
                      className="text-xs px-2 py-1 rounded-lg bg-red-500/5 text-red-400/50 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBoxName}
                onChange={e => setNewBoxName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddBox()}
                placeholder="Название бокса (напр.: Бокс 4)"
                className="flex-1 input-neon rounded-lg px-4 py-2 text-sm"
              />
              <button onClick={handleAddBox} className="btn-neon rounded-lg px-4 py-2 text-sm font-medium">
                + Добавить
              </button>
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">💰 Процент мойщиков</h2>
            <p className="text-xs text-slate-400 mb-4">Доля выручки, которая распределяется между мойщиками при завершении заказа. Остаток идёт автомойке.</p>
            <EditOrgPercent
              activeOrg={activeOrg}
              onSave={(org) => { updateOrganization(org); refresh(); }}
            />
          </div>
        </div>
      )}

      {tab === 'finance' && (
        <div className="space-y-4 animate-fadeIn">
          <FinancePanel activeOrg={activeOrg} onSave={handleUpdateOrg} />
        </div>
      )}

      {tab === 'backup' && (
        <div className="space-y-4 animate-fadeIn">
          <BackupManager activeOrg={activeOrg} />
        </div>
      )}

      {tab === 'loyalty' && (
        <div className="space-y-4 animate-fadeIn">
          <LoyaltySettings activeOrg={activeOrg} userRole={userRole} />
        </div>
      )}

      {tab === 'system' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">⚙️ Информация о системе</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Версия</span>
                <span className="text-white">1.0.0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Режим</span>
                <span className="text-green-400">Оффлайн</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Хранилище</span>
                <span className="text-white">localStorage</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Организаций</span>
                <span className="text-white">{orgs.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Ваша роль</span>
                <span className={userRole === 'manager' ? 'text-purple-400' : 'text-cyan-400'}>{userRole === 'manager' ? 'Управляющий' : 'Администратор'}</span>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">🔑 Роли доступа</h2>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                <p className="text-sm font-medium text-cyan-400">Администратор (пароль: 0000)</p>
                <p className="text-xs text-slate-400 mt-1">Просмотр заказов, создание заказов, изменение статусов, просмотр отчётов</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <p className="text-sm font-medium text-purple-400">Управляющий (пароль: 235792)</p>
                <p className="text-xs text-slate-400 mt-1">Полный доступ: все настройки, управление прайсом, сотрудники, зарплаты, бэкапы</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-red-400 mb-4">⚠️ Опасная зона</h2>
            <button
              onClick={() => {
                if (confirm('Удалить ВСЕ данные? Это действие необратимо!')) {
                  if (confirm('Вы уверены? Все организации, заказы, сотрудники будут удалены.')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }
              }}
              className="btn-danger rounded-lg px-6 py-3 text-sm font-medium"
            >
              🗑 Очистить все данные
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditOrgPercent({ activeOrg, onSave }: { activeOrg: Organization; onSave: (org: Organization) => void }) {
  const financialSettings = activeOrg.financialSettings || getFinancialSettings(activeOrg.id);
  const [washerPercent, setWasherPercent] = useState(financialSettings.employeePercent);
  const carwashPercent = 100 - washerPercent;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-2">
          Доля мойщиков: <span className="text-cyan-400 font-semibold">{washerPercent}%</span>
          <span className="ml-2 text-slate-600">Автомойке: {carwashPercent}%</span>
        </label>
        <input
          type="range"
          min={10}
          max={90}
          step={5}
          value={washerPercent}
          onChange={e => setWasherPercent(Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-center">
          <p className="text-xs text-slate-400 mb-1">Мойщикам</p>
          <p className="text-2xl font-bold text-cyan-400">{washerPercent}%</p>
        </div>
        <div className="flex-1 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 text-center">
          <p className="text-xs text-slate-400 mb-1">Автомойке</p>
          <p className="text-2xl font-bold text-purple-400">{carwashPercent}%</p>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Например: заказ 10 000 ₸ → мойщикам {Math.round(10000 * washerPercent / 100).toLocaleString('ru-RU')} ₸, автомойке {Math.round(10000 * carwashPercent / 100).toLocaleString('ru-RU')} ₸
      </p>
      <button
        onClick={() => onSave({ ...activeOrg, washerPercent })}
        className="btn-neon rounded-lg px-4 py-2 text-sm font-medium"
      >
        Сохранить
      </button>
    </div>
  );
}

function FinancePanel({ activeOrg, onSave }: { activeOrg: Organization; onSave: (org: Organization) => void }) {
  const washers = useMemo(() => getWashers(activeOrg.id), [activeOrg.id]);
  const timelogs = useMemo(() => getWorkerTimelogs(activeOrg.id), [activeOrg.id]);
  const [settings, setSettings] = useState(() => getFinancialSettings(activeOrg.id));
  const [selectedWasherId, setSelectedWasherId] = useState(washers[0]?.id || '');

  useEffect(() => {
    setSettings(getFinancialSettings(activeOrg.id));
  }, [activeOrg.id, activeOrg.financialSettings]);

  useEffect(() => {
    if (washers.length === 0) {
      setSelectedWasherId('');
      return;
    }
    if (!selectedWasherId || !washers.some(w => w.id === selectedWasherId)) {
      setSelectedWasherId(washers[0].id);
    }
  }, [washers, selectedWasherId]);

  const recentLogs = timelogs.slice().sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`)).slice(0, 40);

  const saveSettings = () => {
    const normalized = {
      ...settings,
      employeePercent: Math.max(0, Math.min(100, settings.employeePercent)),
      organizationPercent: Math.max(0, Math.min(100, settings.organizationPercent)),
      salaryAmount: Math.max(0, Math.round(settings.salaryAmount)),
      fixedOrderAmount: Math.max(0, Math.round(settings.fixedOrderAmount)),
    };
    saveFinancialSettings(activeOrg.id, normalized);
    onSave({
      ...activeOrg,
      washerPercent: normalized.employeePercent,
      financialSettings: normalized,
    });
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-6 neon-glow">
        <h2 className="text-lg font-semibold text-white mb-2">💸 Финансовые настройки автомойки</h2>
        <p className="text-xs text-slate-400 mb-4">Настройте общий сценарий расчёта выплат. Все значения сохраняются в организации.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Система оплаты</label>
            <select
              value={settings.calculationMode}
              onChange={e => setSettings(prev => ({ ...prev, calculationMode: e.target.value as FinanceCalculationMode }))}
              className="w-full input-neon rounded-lg px-4 py-2 text-sm"
            >
              <option value="percent">Процент</option>
              <option value="salary">Оклад</option>
              <option value="mixed">Оклад + процент</option>
              <option value="fixed">Фиксированная сумма за заказ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Доля сотрудников (%)</label>
            <input
              type="number"
              value={settings.employeePercent}
              onChange={e => setSettings(prev => ({ ...prev, employeePercent: Number(e.target.value) }))}
              className="w-full input-neon rounded-lg px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Доля автомойки (%)</label>
            <input
              type="number"
              value={settings.organizationPercent}
              onChange={e => setSettings(prev => ({ ...prev, organizationPercent: Number(e.target.value) }))}
              className="w-full input-neon rounded-lg px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Оклад за заказ</label>
            <input
              type="number"
              value={settings.salaryAmount}
              onChange={e => setSettings(prev => ({ ...prev, salaryAmount: Number(e.target.value) }))}
              className="w-full input-neon rounded-lg px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Фиксированная выплата за заказ</label>
            <input
              type="number"
              value={settings.fixedOrderAmount}
              onChange={e => setSettings(prev => ({ ...prev, fixedOrderAmount: Number(e.target.value) }))}
              className="w-full input-neon rounded-lg px-4 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mt-5 flex-wrap">
          <div className="text-xs text-slate-400">
            Пример при заказе 10 000: сотрудники {Math.round(10000 * settings.employeePercent / 100).toLocaleString('ru-RU')} / автомойка {Math.round(10000 * settings.organizationPercent / 100).toLocaleString('ru-RU')}
          </div>
          <button onClick={saveSettings} className="btn-neon rounded-lg px-4 py-2 text-sm font-medium">Сохранить настройки</button>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">👷 Индивидуальные условия оплаты сотрудников</h3>
        <div className="space-y-3">
          {washers.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Сотрудников нет</p>
          ) : (
            washers.map(w => (
              <WasherFinanceRow key={w.id} washer={w} activeOrg={activeOrg} onSaved={() => onSave({ ...activeOrg })} />
            ))
          )}
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-white">📜 История начислений</h3>
            <p className="text-xs text-slate-500 mt-1">Показываются начисления по завершённым заказам и корректировки</p>
          </div>
          <div className="text-xs text-slate-500">Всего записей: {recentLogs.length}</div>
        </div>

        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Дата</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Заказ</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Сотрудник</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Сумма заказа</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Выплата сотруднику</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Доля автомойки</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Метод</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Тип</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">Пока нет начислений</td>
                </tr>
              ) : recentLogs.map(log => (
                <tr key={log.id} className="border-b border-white/3">
                  <td className="px-4 py-3 text-slate-300">{log.date}</td>
                  <td className="px-4 py-3 text-white">{log.orderNumber || log.orderId}</td>
                  <td className="px-4 py-3 text-white">{log.washerName}</td>
                  <td className="px-4 py-3 text-slate-300">{log.orderAmount.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-cyan-400 font-medium">{log.washerShare.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-slate-300">{log.organizationShare.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-slate-300">{log.calculationMode}</td>
                  <td className="px-4 py-3 text-slate-400">{log.recordType === 'adjustment' ? 'Корректировка' : 'Начисление'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function WasherFinanceRow({ washer, activeOrg, onSaved }: { washer: Washer; activeOrg: Organization; onSaved: () => void }) {
  const orgSettings = getFinancialSettings(activeOrg.id);
  const [payMode, setPayMode] = useState<FinanceCalculationMode>(washer.payMode || orgSettings.calculationMode);
  const [payPercent, setPayPercent] = useState(washer.payPercent ?? orgSettings.employeePercent);
  const [paySalaryAmount, setPaySalaryAmount] = useState(washer.paySalaryAmount ?? orgSettings.salaryAmount);
  const [payFixedAmount, setPayFixedAmount] = useState(washer.payFixedAmount ?? orgSettings.fixedOrderAmount);

  useEffect(() => {
    setPayMode(washer.payMode || orgSettings.calculationMode);
    setPayPercent(washer.payPercent ?? orgSettings.employeePercent);
    setPaySalaryAmount(washer.paySalaryAmount ?? orgSettings.salaryAmount);
    setPayFixedAmount(washer.payFixedAmount ?? orgSettings.fixedOrderAmount);
  }, [washer, orgSettings]);

  const save = () => {
    updateWasher({
      ...washer,
      payMode,
      payPercent: Number(payPercent),
      paySalaryAmount: Number(paySalaryAmount),
      payFixedAmount: Number(payFixedAmount),
    });
    onSaved();
  };

  return (
    <div className="rounded-xl border border-white/5 bg-white/3 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="text-sm font-medium text-white">{washer.name}</p>
          <p className="text-xs text-slate-500">Основной бокс: {washer.primaryBoxId || 'не назначен'}</p>
        </div>
        <button onClick={save} className="btn-neon rounded-lg px-4 py-2 text-xs font-medium">Сохранить</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Система</label>
          <select value={payMode} onChange={e => setPayMode(e.target.value as FinanceCalculationMode)} className="w-full input-neon rounded-lg px-3 py-2 text-sm">
            <option value="percent">Процент</option>
            <option value="salary">Оклад</option>
            <option value="mixed">Оклад + процент</option>
            <option value="fixed">Фиксированная сумма</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Процент</label>
          <input type="number" value={payPercent} onChange={e => setPayPercent(Number(e.target.value))} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Оклад</label>
          <input type="number" value={paySalaryAmount} onChange={e => setPaySalaryAmount(Number(e.target.value))} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Фикс.</label>
          <input type="number" value={payFixedAmount} onChange={e => setPayFixedAmount(Number(e.target.value))} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
    </div>
  );
}

function EditOrgForm({ org, onSave, onCancel }: { org: Organization; onSave: (org: Organization) => void; onCancel: () => void }) {
  const [name, setName] = useState(org.name);
  const [currency, setCurrency] = useState(org.currency);
  const [contacts, setContacts] = useState(org.contacts || '');
  const [warehouseAdminView, setWarehouseAdminView] = useState(org.warehouseAdminView !== false);
  const [analyticsAdminView, setAnalyticsAdminView] = useState(org.analyticsAdminView !== false);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Название *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full input-neon rounded-lg px-4 py-2 text-sm" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Валюта</label>
          <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Контакты</label>
          <input type="text" value={contacts} onChange={e => setContacts(e.target.value)} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={warehouseAdminView} onChange={e => setWarehouseAdminView(e.target.checked)} />
        Разрешить администратору просмотр раздела «Склад»
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={analyticsAdminView} onChange={e => setAnalyticsAdminView(e.target.checked)} />
        Разрешить администратору просмотр раздела «Аналитика»
      </label>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Отмена</button>
        <button onClick={() => { if (name.trim()) onSave({ ...org, name: name.trim(), currency, contacts: contacts || undefined, warehouseAdminView, analyticsAdminView }); }} className="btn-neon rounded-lg px-6 py-2 text-sm font-medium">Сохранить</button>
      </div>
    </div>
  );
}
