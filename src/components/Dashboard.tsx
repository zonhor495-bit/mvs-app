import { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { format, isToday, isThisWeek, isThisMonth, subDays, isSameDay, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Organization } from '../types';
import { getOrders, getWorkerTimelogs, getWarehouseForecast, getClients, getCRMOverview, getClientRecommendationsStructured, logCRMRecommendation, calculateCashSummary, getOpenCashShift, getWarehouseItems, getWarehouseMovements, getWorkerNotifications } from '../store';
import { exportDashboard, exportRecommendations } from '../utils/crmExport';

interface DashboardProps {
  activeOrg: Organization;
}

const COLORS = ['#00d4ff', '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

export default function Dashboard({ activeOrg }: DashboardProps) {
  const [, setRefreshTick] = useState(0);
  const [dismissedNotificationKeys, setDismissedNotificationKeys] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(`wd_crm_notifications_${activeOrg.id}`) || '[]');
    } catch {
      return [];
    }
  });
  const orders = useMemo(() => getOrders(activeOrg.id), [activeOrg.id]);
  const workerTimelogs = useMemo(() => getWorkerTimelogs(activeOrg.id), [activeOrg.id]);
  const warehouseForecast = useMemo(() => getWarehouseForecast(activeOrg.id), [activeOrg.id]);

  useEffect(() => {
    const handleStoreChanged = () => setRefreshTick(t => t + 1);
    window.addEventListener('wd-store-changed', handleStoreChanged);
    return () => window.removeEventListener('wd-store-changed', handleStoreChanged);
  }, []);

  const todayOrders = useMemo(() => orders.filter(o => isToday(new Date(o.createdAt))), [orders]);
  const weekOrders = useMemo(() => orders.filter(o => isThisWeek(new Date(o.createdAt), { weekStartsOn: 1 })), [orders]);
  const monthOrders = useMemo(() => orders.filter(o => isThisMonth(new Date(o.createdAt))), [orders]);

  const todayRevenue = orders.filter(o => o.status === 'completed' && o.completedAt && isToday(new Date(o.completedAt))).reduce((s, o) => s + o.totalAmount, 0);
  const weekRevenue = orders.filter(o => o.status === 'completed' && o.completedAt && isThisWeek(new Date(o.completedAt), { weekStartsOn: 1 })).reduce((s, o) => s + o.totalAmount, 0);
  const monthRevenue = orders.filter(o => o.status === 'completed' && o.completedAt && isThisMonth(new Date(o.completedAt))).reduce((s, o) => s + o.totalAmount, 0);
  const todayCash = useMemo(() => calculateCashSummary(activeOrg.id, new Date(new Date().setHours(0, 0, 0, 0)).toISOString(), new Date(new Date().setHours(23, 59, 59, 999)).toISOString()), [activeOrg.id, orders]);
  const openCashShift = useMemo(() => getOpenCashShift(activeOrg.id), [activeOrg.id, orders]);

  const todayPayouts = workerTimelogs.filter(t => isToday(new Date(t.date))).reduce((s, t) => s + t.washerShare, 0);
  const weekPayouts = workerTimelogs.filter(t => isThisWeek(new Date(t.date), { weekStartsOn: 1 })).reduce((s, t) => s + t.washerShare, 0);
  const monthPayouts = workerTimelogs.filter(t => isThisMonth(new Date(t.date))).reduce((s, t) => s + t.washerShare, 0);
  const todayProfit = todayRevenue - todayPayouts;
  const weekProfit = weekRevenue - weekPayouts;
  const monthProfit = monthRevenue - monthPayouts;

  const warehouseAlerts = useMemo(() => {
    return warehouseForecast
      .filter(item => item.level !== 'ok')
      .slice(0, 5)
      .map(item => ({
        name: item.itemName,
        quantity: item.quantity,
        unit: item.unit,
        level: item.level,
      }));
  }, [warehouseForecast]);

  const warehouseItems = useMemo(() => getWarehouseItems(activeOrg.id), [activeOrg.id]);
  const warehouseMovements = useMemo(() => getWarehouseMovements(activeOrg.id), [activeOrg.id]);
  const purchasesMonth = useMemo(() => {
    const from = new Date(); from.setDate(1); from.setHours(0,0,0,0);
    return warehouseMovements.filter(m => m.type === 'incoming' && new Date(m.createdAt) >= from).reduce((s,m)=>s+(m.totalCost||0),0);
  }, [activeOrg.id, warehouseMovements]);
  const consumptionMonth = useMemo(() => {
    const from = new Date(); from.setDate(1); from.setHours(0,0,0,0);
    return warehouseMovements.filter(m => (m.type === 'consumption' || m.type === 'writeoff') && new Date(m.createdAt) >= from).reduce((s,m)=>s+(m.totalCost||0),0);
  }, [activeOrg.id, warehouseMovements]);
  
  const totalItemsCount = warehouseItems.length;
  const stockValue = warehouseItems.reduce((s,i)=>s + (i.quantity * (i.purchasePrice || 0)), 0);
  const lowCount = warehouseItems.filter(i=>i.quantity>0 && i.quantity <= i.minQuantity).length;
  const outCount = warehouseItems.filter(i=>i.quantity <= 0).length;
  const warehouseNotifications = useMemo(() => getWorkerNotifications(activeOrg.id).filter(n => n.type === 'warehouse_alert' && !n.read), [activeOrg.id]);

  const activeOrders = orders.filter(o => o.status === 'waiting' || o.status === 'in_progress');
  const completedToday = orders.filter(o => o.status === 'completed' && o.completedAt && isToday(new Date(o.completedAt))).length;
  const cancelledToday = todayOrders.filter(o => o.status === 'cancelled').length;
  const completedOrdersCount = orders.filter(o => o.status === 'completed').length;
  const avgCheck = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.totalAmount, 0) / Math.max(1, completedOrdersCount);
  const clients = useMemo(() => getClients(activeOrg.id), [activeOrg.id]);
  const crmOverview = useMemo(() => getCRMOverview(activeOrg.id), [activeOrg.id]);
  const crmRecommendations = useMemo(() => {
    return clients.flatMap(client => {
      const recs = getClientRecommendationsStructured(activeOrg.id, client.id);
      return recs.map(rec => ({ clientName: client.fullName, ...rec }));
    }).sort((a, b) => b.priority - a.priority).slice(0, 5);
  }, [activeOrg.id, clients]);
  const avgClientCheck = clients.length ? Math.round(clients.reduce((s, c) => s + (c.averageCheck || 0), 0) / clients.length) : 0;
  const avgClientInterval = clients.length ? Math.round(clients.reduce((s, c) => s + (c.averageVisitIntervalDays || 0), 0) / clients.length) : 0;
  const topClientsByMoney = useMemo(() => clients.slice().sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)).slice(0, 5), [clients]);
  const topClientsByVisits = useMemo(() => clients.slice().sort((a, b) => (b.totalVisits || 0) - (a.totalVisits || 0)).slice(0, 5), [clients]);
  const crmNotifications = useMemo(() => {
    return clients.flatMap(client => {
      const recs = getClientRecommendationsStructured(activeOrg.id, client.id).slice(0, 2);
      return recs.map(rec => ({
        key: `${client.id}:${rec.type}:${rec.title}`,
        clientId: client.id,
        clientName: client.fullName,
        title: rec.title,
        description: rec.description || '',
        priority: rec.priority,
      }));
    }).filter(item => !dismissedNotificationKeys.includes(item.key)).sort((a, b) => b.priority - a.priority).slice(0, 5);
  }, [activeOrg.id, clients, dismissedNotificationKeys]);

  useEffect(() => {
    crmNotifications.forEach(notification => {
      const rec = getClientRecommendationsStructured(activeOrg.id, notification.clientId).find(item => item.title === notification.title);
      if (!rec) return;
      const logKey = `wd_crm_recommendation_log_${activeOrg.id}_${notification.key}`;
      if (localStorage.getItem(logKey)) return;
      logCRMRecommendation(activeOrg.id, notification.clientId, rec);
      localStorage.setItem(logKey, '1');
    });
  }, [activeOrg.id, crmNotifications]);

  const dismissNotification = (key: string) => {
    const next = [...dismissedNotificationKeys, key];
    setDismissedNotificationKeys(next);
    localStorage.setItem(`wd_crm_notifications_${activeOrg.id}`, JSON.stringify(next));
  };

  // Revenue by day (last 7 days)
  const revenueByDay = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const dayOrders = orders.filter(o => o.status === 'completed' && isSameDay(new Date(o.createdAt), day));
      days.push({
        name: format(day, 'EEE', { locale: ru }),
        revenue: dayOrders.reduce((s, o) => s + o.totalAmount, 0),
        count: dayOrders.length,
      });
    }
    return days;
  }, [orders]);

  // Orders by status
  const statusData = useMemo(() => [
    { name: 'Ожидание', value: orders.filter(o => o.status === 'waiting').length, color: '#f59e0b' },
    { name: 'В работе', value: orders.filter(o => o.status === 'in_progress').length, color: '#3b82f6' },
    { name: 'Завершён', value: orders.filter(o => o.status === 'completed').length, color: '#10b981' },
    { name: 'Отменён', value: orders.filter(o => o.status === 'cancelled').length, color: '#ef4444' },
  ].filter(d => d.value > 0), [orders]);

  // Revenue by service
  const serviceRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter(o => o.status === 'completed').forEach(o => {
      o.services.forEach(s => {
        map[s.serviceName] = (map[s.serviceName] || 0) + s.price;
      });
    });
    return Object.entries(map)
      .map(([name, revenue]) => ({ name: name.length > 15 ? name.slice(0, 15) + '…' : name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [orders]);

  // Top washers
  const topWashers = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    orders.filter(o => o.status === 'completed' && o.washerName).forEach(o => {
      if (!map[o.washerId!]) map[o.washerId!] = { name: o.washerName!, count: 0, revenue: 0 };
      map[o.washerId!].count++;
      map[o.washerId!].revenue += o.totalAmount;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ' + activeOrg.currency;

  const [cashPeriod, setCashPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year'>('today');
  const [crmPeriod, setCrmPeriod] = useState<'today' | 'week' | 'month' | 'year'>('today');
  const cashRange = (() => {
    const now = new Date();
    switch (cashPeriod) {
      case 'today': return { from: startOfDay(now), to: endOfDay(now) };
      case 'yesterday': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
      case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month': return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'quarter': return { from: startOfQuarter(now), to: endOfQuarter(now) };
      case 'year': return { from: startOfYear(now), to: endOfYear(now) };
    }
  })();
  const cashForPeriod = useMemo(() => calculateCashSummary(activeOrg.id, cashRange.from.toISOString(), cashRange.to.toISOString()), [activeOrg.id, cashPeriod, orders]);

  const crmPeriodRange = (() => {
    const now = new Date();
    switch (crmPeriod) {
      case 'today': return { from: startOfDay(now), to: endOfDay(now) };
      case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month': return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'year': return { from: startOfYear(now), to: endOfYear(now) };
    }
  })();
  const crmPeriodOrders = useMemo(() => orders.filter(o => o.status === 'completed' && o.completedAt && new Date(o.completedAt) >= crmPeriodRange.from && new Date(o.completedAt) <= crmPeriodRange.to), [orders, crmPeriod]);
  const crmPeriodRevenue = useMemo(() => crmPeriodOrders.reduce((sum, order) => sum + order.totalAmount, 0), [crmPeriodOrders]);
  const crmPeriodVisits = crmPeriodOrders.length;
  const crmPeriodClients = new Set(crmPeriodOrders.map(o => o.clientId).filter(Boolean)).size;
  const crmPeriodNewClients = useMemo(() => clients.filter(c => new Date(c.createdAt) >= crmPeriodRange.from && new Date(c.createdAt) <= crmPeriodRange.to).length, [clients, crmPeriod]);
  const crmPeriodAvgCheck = crmPeriodVisits ? Math.round(crmPeriodRevenue / crmPeriodVisits) : 0;

  const StatCard = ({ title, value, subtitle, icon, color }: { title: string; value: string; subtitle: string; icon: string; color: string }) => (
    <div className="glass rounded-xl p-5 card-hover animate-fadeIn">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{
          background: `linear-gradient(135deg, ${color === 'text-cyan-400' ? 'rgba(0,212,255,0.15)' : color === 'text-purple-400' ? 'rgba(124,58,237,0.15)' : color === 'text-green-400' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}, transparent)`,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Дашборд</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => exportDashboard(activeOrg, [
            { metric: 'Всего клиентов', value: clients.length },
            { metric: 'Новые', value: crmOverview.newClients.length },
            { metric: 'Потерянные', value: crmOverview.lostClients.length },
            { metric: 'VIP', value: crmOverview.vipClients.length },
            { metric: 'Средний чек', value: avgClientCheck },
            { metric: 'Средний интервал', value: avgClientInterval },
          ], 'csv')} className="btn-neon rounded-xl px-4 py-2 text-sm">CSV</button>
          <button type="button" onClick={() => exportDashboard(activeOrg, [
            { metric: 'Всего клиентов', value: clients.length },
            { metric: 'Новые', value: crmOverview.newClients.length },
            { metric: 'Потерянные', value: crmOverview.lostClients.length },
            { metric: 'VIP', value: crmOverview.vipClients.length },
            { metric: 'Средний чек', value: avgClientCheck },
            { metric: 'Средний интервал', value: avgClientInterval },
          ], 'xlsx')} className="btn-neon rounded-xl px-4 py-2 text-sm">Excel</button>
          <button type="button" onClick={() => exportDashboard(activeOrg, [
            { metric: 'Всего клиентов', value: clients.length },
            { metric: 'Новые', value: crmOverview.newClients.length },
            { metric: 'Потерянные', value: crmOverview.lostClients.length },
            { metric: 'VIP', value: crmOverview.vipClients.length },
            { metric: 'Средний чек', value: avgClientCheck },
            { metric: 'Средний интервал', value: avgClientInterval },
          ], 'pdf')} className="btn-neon rounded-xl px-4 py-2 text-sm">PDF</button>
          <button type="button" onClick={() => exportRecommendations(activeOrg, crmRecommendations, 'pdf')} className="btn-neon rounded-xl px-4 py-2 text-sm">Реком.</button>
          <div className="text-sm text-slate-400">{activeOrg.name}</div>
        </div>
      </div>

      <div className="glass rounded-xl p-5 animate-fadeIn">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">CRM уведомления</h3>
          <span className="text-xs text-slate-500">Текущая организация</span>
        </div>
        {crmNotifications.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {crmNotifications.map(item => (
              <div key={item.key} className="rounded-3xl bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white font-semibold">{item.clientName}</p>
                    <p className="text-xs text-cyan-300 mt-1">{item.title}</p>
                    <p className="text-sm text-slate-300 mt-2">{item.description}</p>
                  </div>
                  <button type="button" onClick={() => dismissNotification(item.key)} className="text-slate-400 hover:text-white text-xs">Скрыть</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Новых CRM уведомлений нет.</p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Доход сегодня" value={fmt(todayRevenue)} subtitle={`${todayOrders.length} заказов`} icon="💰" color="text-cyan-400" />
        <StatCard title="Доход за неделю" value={fmt(weekRevenue)} subtitle={`${weekOrders.length} заказов`} icon="📊" color="text-purple-400" />
        <StatCard title="Доход за месяц" value={fmt(monthRevenue)} subtitle={`${monthOrders.length} заказов`} icon="📈" color="text-green-400" />
        <StatCard title="Средний чек" value={fmt(Math.round(avgCheck))} subtitle={`${completedOrdersCount} завершённых`} icon="🧾" color="text-amber-400" />
      </div>

      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold text-white">Касса — период</h3>
          <div className="flex gap-2 ml-auto flex-wrap">
            {(['today','yesterday','week','month','quarter','year'] as const).map(p => (
              <button key={p} onClick={() => setCashPeriod(p)} className={`px-3 py-1 rounded-lg text-xs ${cashPeriod===p? 'btn-neon' : 'text-slate-400 hover:text-white'}`}>{p==='today'?'Сегодня':p==='yesterday'?'Вчера':p==='week'?'Неделя':p==='month'?'Месяц':p==='quarter'?'Квартал':'Год'}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">💵 Наличные</p><p className="text-white font-semibold">{fmt(cashForPeriod.cashIncome || 0)}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">🟢 Kaspi QR</p><p className="text-white font-semibold">{fmt(cashForPeriod.kaspiIncome || 0)}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">💳 Карты</p><p className="text-white font-semibold">{fmt(cashForPeriod.cardIncome || 0)}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">🏦 Переводы</p><p className="text-white font-semibold">{fmt(cashForPeriod.transferIncome || 0)}</p></div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Всего получено</p><p className="text-white font-semibold">{fmt(cashForPeriod.income || 0)}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Расходы</p><p className="text-white font-semibold">{fmt(cashForPeriod.expense || 0)}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Скидки</p><p className="text-white font-semibold">{fmt(cashForPeriod.discounts || 0)}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Возвраты</p><p className="text-white font-semibold">{fmt(cashForPeriod.refunds || 0)}</p></div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Бонусы</p><p className="text-white font-semibold">{fmt(cashForPeriod.bonusIncome || 0)}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Карты + QR</p><p className="text-white font-semibold">{fmt((cashForPeriod.cardIncome || 0) + (cashForPeriod.qrIncome || 0))}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Переводы</p><p className="text-white font-semibold">{fmt(cashForPeriod.transferIncome || 0)}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Итоговая чистая касса</p><p className="text-white font-semibold">{fmt(cashForPeriod.result || ((cashForPeriod.income || 0) - (cashForPeriod.expense || 0)))}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Заказов завершено" value={String(completedOrdersCount)} subtitle={`Сегодня: ${completedToday} | Отменено: ${cancelledToday}`} icon="✅" color="text-cyan-400" />
        <StatCard title="Выплаты сотрудникам" value={fmt(monthPayouts)} subtitle={`Сегодня: ${fmt(todayPayouts)} | Неделя: ${fmt(weekPayouts)}`} icon="👷" color="text-purple-400" />
        <StatCard title="Прибыль автомойки" value={fmt(monthProfit)} subtitle={`Сегодня: ${fmt(todayProfit)} | Неделя: ${fmt(weekProfit)}`} icon="💼" color="text-green-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Наличные сегодня" value={fmt(todayCash.cashIncome || 0)} subtitle={`Смена: ${openCashShift ? 'открыта' : 'закрыта'}`} icon="💵" color="text-cyan-400" />
        <StatCard title="Безнал сегодня" value={fmt((todayCash.cardIncome || 0) + (todayCash.qrIncome || 0) + (todayCash.transferIncome || 0))} subtitle={`Kaspi: ${fmt(todayCash.kaspiIncome || 0)}`} icon="💳" color="text-purple-400" />
        <StatCard title="Возвраты и расходы" value={fmt((todayCash.refunds || 0) + (todayCash.expense || 0))} subtitle={`Возвраты: ${fmt(todayCash.refunds || 0)}`} icon="↩️" color="text-amber-400" />
        <StatCard title="Чистая касса" value={fmt(todayCash.result || 0)} subtitle={`Открыта ли смена: ${openCashShift ? 'Да' : 'Нет'}`} icon="🏦" color="text-green-400" />
      </div>

      <div className="glass rounded-xl p-5 animate-fadeIn">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">CRM</h3>
          <span className="text-xs text-slate-500">Ключевые показатели клиентов</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Всего клиентов</p>
            <p className="text-2xl font-semibold text-white">{clients.length}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Новые</p>
            <p className="text-2xl font-semibold text-white">{crmOverview.newClients.length}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Потерянные</p>
            <p className="text-2xl font-semibold text-white">{crmOverview.lostClients.length}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">VIP</p>
            <p className="text-2xl font-semibold text-white">{crmOverview.vipClients.length}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">С бонусами</p>
            <p className="text-2xl font-semibold text-white">{crmOverview.clientsWithBonuses.length}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Со скидками</p>
            <p className="text-2xl font-semibold text-white">{crmOverview.clientsWithDiscounts.length}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Средний чек</p>
            <p className="text-2xl font-semibold text-white">{avgClientCheck.toLocaleString('ru-RU')} {activeOrg.currency}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Средний интервал</p>
            <p className="text-2xl font-semibold text-white">{avgClientInterval || 0} дн.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="glass rounded-3xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-3">Топ клиентов по сумме</p>
            <div className="space-y-3">
              {topClientsByMoney.length > 0 ? topClientsByMoney.map((clientItem, index) => (
                <div key={clientItem.id} className="flex items-center justify-between gap-3 rounded-3xl bg-white/5 p-3">
                  <div>
                    <p className="text-sm text-white">{index + 1}. {clientItem.fullName}</p>
                    <p className="text-xs text-slate-400">{(clientItem.totalSpent || 0).toLocaleString('ru-RU')} {activeOrg.currency}</p>
                  </div>
                  <span className="text-xs text-slate-500">{clientItem.totalVisits || 0} визитов</span>
                </div>
              )) : <p className="text-sm text-slate-500">Нет клиентов.</p>}
            </div>
          </div>
          <div className="glass rounded-3xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-3">Топ клиентов по визитам</p>
            <div className="space-y-3">
              {topClientsByVisits.length > 0 ? topClientsByVisits.map((clientItem, index) => (
                <div key={clientItem.id} className="flex items-center justify-between gap-3 rounded-3xl bg-white/5 p-3">
                  <div>
                    <p className="text-sm text-white">{index + 1}. {clientItem.fullName}</p>
                    <p className="text-xs text-slate-400">{(clientItem.totalSpent || 0).toLocaleString('ru-RU')} {activeOrg.currency}</p>
                  </div>
                  <span className="text-xs text-slate-500">{clientItem.totalVisits || 0} визитов</span>
                </div>
              )) : <p className="text-sm text-slate-500">Нет клиентов.</p>}
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5 animate-fadeIn">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">CRM аналитика по периоду</h3>
            <div className="flex gap-2 flex-wrap">
              {(['today','week','month','year'] as const).map(period => (
                <button key={period} onClick={() => setCrmPeriod(period)} className={`px-3 py-1 rounded-lg text-xs ${crmPeriod === period ? 'btn-neon' : 'text-slate-400 hover:text-white'}`}>
                  {period === 'today' ? 'Сегодня' : period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Год'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Доход</p>
              <p className="text-2xl font-semibold text-white">{fmt(crmPeriodRevenue)}</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Визиты</p>
              <p className="text-2xl font-semibold text-white">{crmPeriodVisits}</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Активных клиентов</p>
              <p className="text-2xl font-semibold text-white">{crmPeriodClients}</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Новых клиентов</p>
              <p className="text-2xl font-semibold text-white">{crmPeriodNewClients}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Средний чек</p>
              <p className="text-2xl font-semibold text-white">{fmt(crmPeriodAvgCheck)}</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Период</p>
              <p className="text-2xl font-semibold text-white">
                {crmPeriod === 'today' ? 'Сегодня' : crmPeriod === 'week' ? 'Текущая неделя' : crmPeriod === 'month' ? 'Текущий месяц' : 'Текущий год'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <h4 className="text-sm font-semibold text-white">Рекомендации</h4>
          {crmRecommendations.length > 0 ? (
            <div className="space-y-3">
              {crmRecommendations.map((rec, index) => (
                <div key={`${rec.clientName}-${index}`} className="rounded-3xl bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{rec.clientName}</p>
                      <p className="text-xs text-slate-400">{rec.title}</p>
                    </div>
                    <span className="text-xs text-slate-500">Приоритет {rec.priority}</span>
                  </div>
                  {rec.description && <p className="mt-2 text-sm text-slate-300">{rec.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Рекомендаций пока нет.</p>
          )}
        </div>
      </div>

      <div className="glass rounded-xl p-5 animate-fadeIn">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Склад</h3>
          <span className="text-xs text-slate-500">Предупреждения по остаткам</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <div className="glass rounded-xl p-3"><p className="text-xs text-slate-400">Всего товаров</p><p className="text-xl font-bold text-white">{totalItemsCount}</p></div>
          <div className="glass rounded-xl p-3"><p className="text-xs text-slate-400">Стоимость склада</p><p className="text-xl font-bold text-cyan-400">{Math.round(stockValue).toLocaleString('ru-RU')} {activeOrg.currency}</p></div>
          <div className="glass rounded-xl p-3"><p className="text-xs text-slate-400">Заканчиваются</p><p className="text-xl font-bold text-amber-400">{lowCount}</p></div>
          <div className="glass rounded-xl p-3"><p className="text-xs text-slate-400">Отсутствуют</p><p className="text-xl font-bold text-red-400">{outCount}</p></div>
          <div className="glass rounded-xl p-3"><p className="text-xs text-slate-400">Закупки (мес.)</p><p className="text-xl font-bold text-white">{Math.round(purchasesMonth).toLocaleString('ru-RU')} {activeOrg.currency}</p></div>
          <div className="glass rounded-xl p-3"><p className="text-xs text-slate-400">Расход (мес.)</p><p className="text-xl font-bold text-white">{Math.round(consumptionMonth).toLocaleString('ru-RU')} {activeOrg.currency}</p></div>
        </div>
        {warehouseAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {warehouseAlerts.map(item => (
              <div key={item.name} className={`rounded-lg border p-3 ${item.level === 'critical' ? 'border-red-500/20 bg-red-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white font-medium">{item.name}</span>
                  <span className={item.level === 'critical' ? 'text-red-400' : 'text-amber-400'}>{item.level === 'critical' ? '🔴' : '🟡'}</span>
                </div>
                <p className="text-xs text-slate-300 mt-2">Осталось: {item.quantity} {item.unit}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-green-400">Склад в норме, критичных остатков нет.</p>
        )}
        {warehouseNotifications.length > 0 && (
          <div className="mt-3">
            <h4 className="text-sm text-white">Уведомления склада</h4>
            <div className="space-y-2 mt-2">
              {warehouseNotifications.map(n => (
                <div key={n.id} className="rounded bg-white/5 p-3 text-sm text-amber-200">{n.message}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="lg:col-span-2 glass rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '200ms' }}>
          <h3 className="text-sm font-semibold text-white mb-4">Доход за 7 дней</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={revenueByDay}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(10,10,26,0.9)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px', color: '#e2e8f0' }}
                formatter={(value: any) => [Number(value).toLocaleString('ru-RU') + ' ' + activeOrg.currency, 'Доход']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#00d4ff" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status pie */}
        <div className="glass rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '300ms' }}>
          <h3 className="text-sm font-semibold text-white mb-4">Статусы заказов</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(10,10,26,0.9)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px', color: '#e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-slate-500 text-sm">Нет данных</div>
          )}
          <div className="flex flex-wrap gap-3 mt-2">
            {statusData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span className="text-slate-400">{d.name}</span>
                <span className="text-white font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Service revenue */}
        <div className="glass rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '400ms' }}>
          <h3 className="text-sm font-semibold text-white mb-4">Доход по услугам</h3>
          {serviceRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={serviceRevenue} layout="vertical">
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={{ background: 'rgba(10,10,26,0.9)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px', color: '#e2e8f0' }} formatter={(v: any) => [Number(v).toLocaleString('ru-RU') + ' ' + activeOrg.currency, '']} />
                <Bar dataKey="revenue" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-500 text-sm">Нет данных</div>
          )}
        </div>

        {/* Top washers + active orders */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '500ms' }}>
            <h3 className="text-sm font-semibold text-white mb-4">Топ мойщики</h3>
            {topWashers.length > 0 ? (
              <div className="space-y-3">
                {topWashers.map((w, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{
                        background: `linear-gradient(135deg, ${COLORS[i]}33, ${COLORS[i]}11)`,
                        color: COLORS[i],
                        border: `1px solid ${COLORS[i]}44`
                      }}>
                        {i + 1}
                      </div>
                      <span className="text-sm text-slate-300">{w.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-cyan-400 font-medium">{fmt(w.revenue)}</p>
                      <p className="text-[10px] text-slate-500">{w.count} заказов</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 text-sm py-8">Нет данных</div>
            )}
          </div>

          {/* Active orders */}
          <div className="glass rounded-xl p-5 animate-fadeIn" style={{ animationDelay: '600ms' }}>
            <h3 className="text-sm font-semibold text-white mb-4">Активные заказы</h3>
            {activeOrders.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeOrders.slice(0, 5).map(o => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${o.status === 'waiting' ? 'status-waiting' : 'status-in_progress'}`}>
                        {o.status === 'waiting' ? 'Ожидание' : 'В работе'}
                      </span>
                      <span className="text-xs text-slate-300">{o.licensePlate}</span>
                    </div>
                    <span className="text-xs text-slate-400">{o.carTypeName}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 text-sm py-4">Нет активных заказов</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
