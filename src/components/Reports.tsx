import { useState, useMemo, memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subDays, subMonths, subQuarters, eachDayOfInterval, isSameDay } from 'date-fns';
import { Organization } from '../types';
import { getOrders, getWarehouseMovements, calculateOrderCostBreakdown, getWashers, calculateCashSummary, getClients, getVehicles } from '../store';
import { exportCashJournalExcel, exportCashSummaryExcel, exportCashPdf, exportEmployeeReportExcel, exportServiceReportExcel, exportEmployeeReportPdf, exportServiceReportPdf, exportClientsList, exportClientHistory } from '../utils/crmExport';

interface ReportsProps {
  activeOrg: Organization;
}

export default memo(function Reports({ activeOrg }: ReportsProps) {
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportType, setReportType] = useState<'revenue' | 'services' | 'washers' | 'cars'>('revenue');

  const orders = useMemo(() => getOrders(activeOrg.id), [activeOrg.id]);
  const clients = useMemo(() => getClients(activeOrg.id), [activeOrg.id]);
  const vehicles = useMemo(() => getVehicles(activeOrg.id), [activeOrg.id]);

  const exportClientList = (formatType: 'csv' | 'xlsx' | 'pdf') => {
    exportClientsList(activeOrg, clients, vehicles, formatType);
    alert(`Список клиентов экспортирован (${formatType.toUpperCase()})`);
  };

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today': return { from: startOfDay(now), to: endOfDay(now) };
      case 'yesterday': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
      case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month': return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'quarter': return { from: startOfQuarter(now), to: endOfQuarter(now) };
      case 'year': return { from: startOfYear(now), to: endOfYear(now) };
      default: return { from: startOfDay(new Date(dateFrom)), to: endOfDay(new Date(dateTo)) };
    }
  }, [period, dateFrom, dateTo]);

  const getPreviousRange = (currentPeriod: typeof period) => {
    const now = new Date();
    switch (currentPeriod) {
      case 'today': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
      case 'yesterday': return { from: startOfDay(subDays(now, 2)), to: endOfDay(subDays(now, 2)) };
      case 'week': return { from: startOfWeek(subDays(now, 7), { weekStartsOn: 1 }), to: endOfWeek(subDays(now, 7), { weekStartsOn: 1 }) };
      case 'month': return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
      case 'quarter': return { from: startOfQuarter(subQuarters(now, 1)), to: endOfQuarter(subQuarters(now, 1)) };
      case 'year': return { from: startOfYear(subMonths(now, 12)), to: endOfYear(subMonths(now, 12)) };
      default: {
        const duration = dateRange.to.getTime() - dateRange.from.getTime();
        return { from: startOfDay(new Date(dateFrom).getTime() - duration - 86400000), to: endOfDay(new Date(dateTo).getTime() - duration - 86400000) };
      }
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= dateRange.from && d <= dateRange.to;
    });
  }, [orders, dateRange]);

  const exportClientHistoryReport = (formatType: 'csv' | 'xlsx' | 'pdf') => {
    exportClientHistory(activeOrg, clients, filteredOrders, formatType);
    alert(`История клиентов экспортирована (${formatType.toUpperCase()})`);
  };

  const completedOrders = filteredOrders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((s, o) => s + o.totalAmount, 0);
  const avgCheck = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
  const cashSummary = useMemo(() => calculateCashSummary(activeOrg.id, dateRange.from.toISOString(), dateRange.to.toISOString()), [activeOrg.id, dateRange]);
  const previousDateRange = getPreviousRange(period);
  const prevCashSummary = useMemo(
    () => calculateCashSummary(activeOrg.id, previousDateRange.from.toISOString(), previousDateRange.to.toISOString()),
    [activeOrg.id, previousDateRange.from.toISOString(), previousDateRange.to.toISOString()]
  );
  const revenueDelta = totalRevenue - prevCashSummary.income;
  const washers = useMemo(() => getWashers(activeOrg.id), [activeOrg.id]);
  const warehouseMovements = useMemo(() => getWarehouseMovements(activeOrg.id), [activeOrg.id]);
  const orderCostBreakdowns = useMemo(() => completedOrders.map(order => ({ order, cost: calculateOrderCostBreakdown(order, activeOrg.id, washers) })), [completedOrders, activeOrg.id, washers]);
  const totalMaterialsCost = orderCostBreakdowns.reduce((s, item) => s + item.cost.materialsCost, 0);
  const totalWorkersCost = orderCostBreakdowns.reduce((s, item) => s + item.cost.workersCost, 0);
  const profitAfterMaterials = totalRevenue - totalMaterialsCost - totalWorkersCost;

  // Revenue by day chart
  const revenueByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    return days.map(day => {
      const dayOrders = completedOrders.filter(o => isSameDay(new Date(o.createdAt), day));
      return {
        name: format(day, 'dd.MM'),
        revenue: dayOrders.reduce((s, o) => s + o.totalAmount, 0),
        count: dayOrders.length,
      };
    });
  }, [completedOrders, dateRange]);

  // Services report
  const serviceReport = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    completedOrders.forEach(o => {
      o.services.forEach(s => {
        if (!map[s.serviceId]) map[s.serviceId] = { name: s.serviceName, count: 0, revenue: 0 };
        map[s.serviceId].count++;
        map[s.serviceId].revenue += s.price;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [completedOrders]);

  // Washers report
  const washerReport = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    completedOrders.forEach(o => {
      if (o.washerId && o.washerName) {
        if (!map[o.washerId]) map[o.washerId] = { name: o.washerName, count: 0, revenue: 0 };
        map[o.washerId].count++;
        map[o.washerId].revenue += o.totalAmount;
      }
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [completedOrders]);

  // Car type report
  const carReport = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    completedOrders.forEach(o => {
      if (!map[o.carTypeId]) map[o.carTypeId] = { name: o.carTypeName, count: 0, revenue: 0 };
      map[o.carTypeId].count++;
      map[o.carTypeId].revenue += o.totalAmount;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [completedOrders]);

  const materialsConsumption = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; cost: number }> = {};
    warehouseMovements
      .filter(m => m.type === 'consumption' || m.type === 'writeoff')
      .forEach(m => {
        if (!map[m.itemId]) map[m.itemId] = { name: m.itemName, quantity: 0, cost: 0 };
        map[m.itemId].quantity += m.quantity;
        map[m.itemId].cost += m.totalCost || 0;
      });
    return Object.values(map).sort((a, b) => b.cost - a.cost).slice(0, 6);
  }, [warehouseMovements]);

  const topMaterialServices = useMemo(() => {
    const map: Record<string, { name: string; cost: number }> = {};
    warehouseMovements
      .filter(m => m.source === 'order_auto' && m.serviceName)
      .forEach(m => {
        const key = m.serviceName!;
        if (!map[key]) map[key] = { name: key, cost: 0 };
        map[key].cost += m.totalCost || 0;
      });
    return Object.values(map).sort((a, b) => b.cost - a.cost).slice(0, 6);
  }, [warehouseMovements]);

  const fmt = (n: number) => n.toLocaleString('ru-RU');

  // Export Excel using Electron main with template preservation
  const exportExcel = async () => {
    // Prefer electron export when available (preserves template), otherwise use web exporter
    if (window.electron?.exportReport) {
      const ordersData = filteredOrders.map((o, index) => ({
        id: index + 1,
        date: o.createdAt,
        service: o.services.map(s => s.serviceName).join(', '),
        amount: o.totalAmount,
        paymentMethod: o.paymentMethod || 'Наличные',
        washer: o.washerName || '',
        licensePlate: o.licensePlate,
      }));
      try {
        const result = await window.electron.exportReport({ orders: ordersData, from: dateRange.from.toISOString(), to: dateRange.to.toISOString(), fileName: `report_${format(dateRange.from, 'yyyyMMdd')}-${format(dateRange.to, 'yyyyMMdd')}.xlsx` });
        if (!result || result.canceled) return;
        alert(`Отчёт сохранён: ${result.filePath}`);
        return;
      } catch (error) { console.error(error); }
    }
    try {
      exportCashJournalExcel(activeOrg, filteredOrders, dateRange.from.toISOString(), dateRange.to.toISOString());
      alert('Журнал экспортирован (Excel)');
    } catch (err) {
      console.error(err);
      alert('Ошибка при экспорте');
    }
  };

  const exportSummaryExcel = () => {
    try {
      const summary = calculateCashSummary(activeOrg.id, dateRange.from.toISOString(), dateRange.to.toISOString());
      exportCashSummaryExcel(activeOrg, summary, dateRange.from.toISOString(), dateRange.to.toISOString());
      alert('Сводка экспортирована (Excel)');
    } catch (err) { console.error(err); alert('Ошибка при экспорте сводки'); }
  };

  const exportCashReportPdf = () => {
    try {
      const summary = calculateCashSummary(activeOrg.id, dateRange.from.toISOString(), dateRange.to.toISOString());
      exportCashPdf(activeOrg, filteredOrders, summary, dateRange.from.toISOString(), dateRange.to.toISOString());
      alert('PDF отчёт экспортирован');
    } catch (err) { console.error(err); alert('Ошибка при экспорте PDF'); }
  };

  const exportEmployeesExcel = () => { exportEmployeeReportExcel(activeOrg, filteredOrders, dateRange.from.toISOString(), dateRange.to.toISOString()); alert('Отчёт по сотрудникам (Excel) сохранён'); };
  const exportServicesExcel = () => { exportServiceReportExcel(activeOrg, filteredOrders, dateRange.from.toISOString(), dateRange.to.toISOString()); alert('Отчёт по услугам (Excel) сохранён'); };
  const exportEmployeesPdf = () => { exportEmployeeReportPdf(activeOrg, filteredOrders, dateRange.from.toISOString(), dateRange.to.toISOString()); alert('Отчёт по сотрудникам (PDF) сохранён'); };
  const exportServicesPdf = () => { exportServiceReportPdf(activeOrg, filteredOrders, dateRange.from.toISOString(), dateRange.to.toISOString()); alert('Отчёт по услугам (PDF) сохранён'); };

  // Print report
  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Отчёты</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportExcel} className="btn-neon rounded-lg px-3 py-2 text-sm">📥 Журнал (Excel)</button>
          <button onClick={exportSummaryExcel} className="btn-neon rounded-lg px-3 py-2 text-sm">📊 Сводка (Excel)</button>
          <button onClick={exportCashReportPdf} className="btn-neon rounded-lg px-3 py-2 text-sm">🖨 Касса (PDF)</button>
          <button onClick={exportEmployeesExcel} className="btn-neon rounded-lg px-3 py-2 text-sm">👷 Мойщики (Excel)</button>
          <button onClick={exportEmployeesPdf} className="btn-neon rounded-lg px-3 py-2 text-sm">👷 Мойщики (PDF)</button>
          <button onClick={exportServicesExcel} className="btn-neon rounded-lg px-3 py-2 text-sm">🔧 Услуги (Excel)</button>
          <button onClick={exportServicesPdf} className="btn-neon rounded-lg px-3 py-2 text-sm">🔧 Услуги (PDF)</button>
          <button onClick={() => exportClientList('csv')} className="btn-neon rounded-lg px-3 py-2 text-sm">👥 Клиенты (CSV)</button>
          <button onClick={() => exportClientList('xlsx')} className="btn-neon rounded-lg px-3 py-2 text-sm">👥 Клиенты (Excel)</button>
          <button onClick={() => exportClientList('pdf')} className="btn-neon rounded-lg px-3 py-2 text-sm">👥 Клиенты (PDF)</button>
          <button onClick={() => exportClientHistoryReport('xlsx')} className="btn-neon rounded-lg px-3 py-2 text-sm">📜 История (Excel)</button>
          <button onClick={() => exportClientHistoryReport('pdf')} className="btn-neon rounded-lg px-3 py-2 text-sm">📜 История (PDF)</button>
          <button onClick={printReport} className="btn-neon rounded-lg px-3 py-2 text-sm">🖨 Печать</button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex gap-2 flex-wrap">
          {(['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'custom'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${period === p ? 'btn-neon' : 'text-slate-400 hover:text-white'}`}
            >
              {p === 'today' ? 'Сегодня' : p === 'yesterday' ? 'Вчера' : p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : p === 'quarter' ? 'Квартал' : p === 'year' ? 'Год' : 'Период'}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-xs" />
            <span className="text-slate-400">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-xs" />
          </>
        )}
        <div className="flex gap-2 ml-auto">
          {(['revenue', 'services', 'washers', 'cars'] as const).map(t => (
            <button
              key={t}
              onClick={() => setReportType(t)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${reportType === t ? 'btn-neon' : 'text-slate-400 hover:text-white'}`}
            >
              {t === 'revenue' ? '💰 Доход' : t === 'services' ? '🔧 Услуги' : t === 'washers' ? '👷 Мойщики' : '🚗 Авто'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Выручка</p>
          <p className="text-xl font-bold text-cyan-400">{fmt(totalRevenue)} {activeOrg.currency}</p>
        </div>
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Заказов завершено</p>
          <p className="text-xl font-bold text-green-400">{completedOrders.length}</p>
        </div>
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Средний чек</p>
          <p className="text-xl font-bold text-purple-400">{fmt(Math.round(avgCheck))} {activeOrg.currency}</p>
        </div>
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Всего заказов</p>
          <p className="text-xl font-bold text-amber-400">{filteredOrders.length}</p>
        </div>
      </div>

      <div className="glass rounded-xl p-4 card-hover mt-4">
        <p className="text-xs text-slate-400">Сравнение с предыдущим периодом</p>
        <p className={`text-xl font-bold ${revenueDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{revenueDelta >= 0 ? '+' : ''}{fmt(revenueDelta)} {activeOrg.currency}</p>
        <p className="text-slate-400 text-xs">Предыдущий период: {fmt(prevCashSummary.income)} {activeOrg.currency}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Наличные</p>
          <p className="text-xl font-bold text-cyan-400">{fmt(cashSummary.cashIncome)} {activeOrg.currency}</p>
        </div>
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Kaspi / карта</p>
          <p className="text-xl font-bold text-purple-400">{fmt((cashSummary.kaspiIncome || 0) + cashSummary.cardIncome)} {activeOrg.currency}</p>
        </div>
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Возвраты / скидки</p>
          <p className="text-xl font-bold text-red-400">{fmt((cashSummary.refunds || 0) + (cashSummary.discounts || 0))} {activeOrg.currency}</p>
        </div>
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Бонусы</p>
          <p className="text-xl font-bold text-pink-400">{fmt(cashSummary.bonusIncome || 0)} {activeOrg.currency}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Материалы</p>
          <p className="text-xl font-bold text-red-400">{fmt(Math.round(totalMaterialsCost))} {activeOrg.currency}</p>
        </div>
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Зарплата мойщиков</p>
          <p className="text-xl font-bold text-purple-400">{fmt(Math.round(totalWorkersCost))} {activeOrg.currency}</p>
        </div>
        <div className="glass rounded-xl p-4 card-hover">
          <p className="text-xs text-slate-400">Прибыль после расходников</p>
          <p className="text-xl font-bold text-green-400">{fmt(Math.round(profitAfterMaterials))} {activeOrg.currency}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Доход по дням</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueByDay}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: 'rgba(10,10,26,0.9)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px', color: '#e2e8f0' }} />
            <Bar dataKey="revenue" fill="#00d4ff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Report Table */}
      {reportType === 'services' && (
        <div className="glass rounded-xl overflow-hidden">
          <h3 className="text-sm font-semibold text-white p-5 pb-0">Отчёт по услугам</h3>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs text-slate-400">Услуга</th>
                <th className="px-5 py-3 text-center text-xs text-slate-400">Количество</th>
                <th className="px-5 py-3 text-center text-xs text-slate-400">Доход</th>
                <th className="px-5 py-3 text-center text-xs text-slate-400">Доля</th>
              </tr>
            </thead>
            <tbody>
              {serviceReport.map((s, i) => (
                <tr key={i} className="border-b border-white/3 hover:bg-white/3">
                  <td className="px-5 py-3 text-white">{s.name}</td>
                  <td className="px-5 py-3 text-center text-slate-300">{s.count}</td>
                  <td className="px-5 py-3 text-center text-cyan-400">{fmt(s.revenue)} {activeOrg.currency}</td>
                  <td className="px-5 py-3 text-center text-slate-400">{totalRevenue > 0 ? Math.round(s.revenue / totalRevenue * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'washers' && (
        <div className="glass rounded-xl overflow-hidden">
          <h3 className="text-sm font-semibold text-white p-5 pb-0">Отчёт по мойщикам</h3>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs text-slate-400">Мойщик</th>
                <th className="px-5 py-3 text-center text-xs text-slate-400">Заказов</th>
                <th className="px-5 py-3 text-center text-xs text-slate-400">Доход</th>
                <th className="px-5 py-3 text-center text-xs text-slate-400">Доля</th>
              </tr>
            </thead>
            <tbody>
              {washerReport.map((w, i) => (
                <tr key={i} className="border-b border-white/3 hover:bg-white/3">
                  <td className="px-5 py-3 text-white">{w.name}</td>
                  <td className="px-5 py-3 text-center text-slate-300">{w.count}</td>
                  <td className="px-5 py-3 text-center text-cyan-400">{fmt(w.revenue)} {activeOrg.currency}</td>
                  <td className="px-5 py-3 text-center text-slate-400">{totalRevenue > 0 ? Math.round(w.revenue / totalRevenue * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'cars' && (
        <div className="glass rounded-xl overflow-hidden">
          <h3 className="text-sm font-semibold text-white p-5 pb-0">Отчёт по типам авто</h3>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs text-slate-400">Тип</th>
                <th className="px-5 py-3 text-center text-xs text-slate-400">Количество</th>
                <th className="px-5 py-3 text-center text-xs text-slate-400">Доход</th>
                <th className="px-5 py-3 text-center text-xs text-slate-400">Доля</th>
              </tr>
            </thead>
            <tbody>
              {carReport.map((c, i) => (
                <tr key={i} className="border-b border-white/3 hover:bg-white/3">
                  <td className="px-5 py-3 text-white">{c.name}</td>
                  <td className="px-5 py-3 text-center text-slate-300">{c.count}</td>
                  <td className="px-5 py-3 text-center text-cyan-400">{fmt(c.revenue)} {activeOrg.currency}</td>
                  <td className="px-5 py-3 text-center text-slate-400">{totalRevenue > 0 ? Math.round(c.revenue / totalRevenue * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'revenue' && (
        <div className="glass rounded-xl overflow-hidden">
          <h3 className="text-sm font-semibold text-white p-5 pb-0">Детализация заказов</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3 text-left text-xs text-slate-400">Дата</th>
                  <th className="px-5 py-3 text-left text-xs text-slate-400">Госномер</th>
                  <th className="px-5 py-3 text-left text-xs text-slate-400">Тип</th>
                  <th className="px-5 py-3 text-left text-xs text-slate-400">Услуги</th>
                  <th className="px-5 py-3 text-left text-xs text-slate-400">Мойщик</th>
                  <th className="px-5 py-3 text-right text-xs text-slate-400">Сумма</th>
                  <th className="px-5 py-3 text-center text-xs text-slate-400">Статус</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, 100).map(o => (
                  <tr key={o.id} className="border-b border-white/3 hover:bg-white/3">
                    <td className="px-5 py-3 text-slate-300 text-xs">{format(new Date(o.createdAt), 'dd.MM HH:mm')}</td>
                    <td className="px-5 py-3 text-white">{o.licensePlate}</td>
                    <td className="px-5 py-3 text-slate-300">{o.carTypeName}</td>
                    <td className="px-5 py-3 text-slate-300 text-xs max-w-32 truncate">{o.services.map(s => s.serviceName).join(', ')}</td>
                    <td className="px-5 py-3 text-slate-300 text-xs">{o.washerName || '—'}</td>
                    <td className="px-5 py-3 text-right text-cyan-400">{fmt(o.totalAmount)} {activeOrg.currency}</td>
                    <td className="px-5 py-3 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full status-${o.status}`}>{o.status === 'completed' ? 'Завершён' : o.status === 'waiting' ? 'Ожидание' : o.status === 'in_progress' ? 'В работе' : 'Отменён'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Кассовый раздел</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Наличные</p><p className="text-white font-semibold">{fmt(cashSummary.cashIncome)} {activeOrg.currency}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Kaspi</p><p className="text-white font-semibold">{fmt(cashSummary.kaspiIncome || 0)} {activeOrg.currency}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Карта / QR / перевод</p><p className="text-white font-semibold">{fmt(cashSummary.cardIncome + cashSummary.qrIncome + cashSummary.transferIncome)} {activeOrg.currency}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Смешанная</p><p className="text-white font-semibold">{fmt(cashSummary.mixedIncome || 0)} {activeOrg.currency}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Расходы</p><p className="text-white font-semibold">{fmt(cashSummary.expense || 0)} {activeOrg.currency}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Возвраты</p><p className="text-white font-semibold">{fmt(cashSummary.refunds || 0)} {activeOrg.currency}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Скидки</p><p className="text-white font-semibold">{fmt(cashSummary.discounts || 0)} {activeOrg.currency}</p></div>
          <div className="rounded-lg bg-white/3 px-4 py-3"><p className="text-slate-400 text-xs">Бонусы</p><p className="text-white font-semibold">{fmt(cashSummary.bonusIncome || 0)} {activeOrg.currency}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Расход материалов</h3>
          <div className="space-y-2 text-sm">
            {materialsConsumption.length === 0 ? (
              <p className="text-slate-500">Пока нет списаний материалов</p>
            ) : materialsConsumption.map(item => (
              <div key={item.name} className="flex items-center justify-between rounded-lg bg-white/3 px-3 py-2">
                <span className="text-slate-300">{item.name}</span>
                <span className="text-white">{item.quantity} • {fmt(Math.round(item.cost))} {activeOrg.currency}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Себестоимость по услугам</h3>
          <div className="space-y-2 text-sm">
            {topMaterialServices.length === 0 ? (
              <p className="text-slate-500">Нет данных по списанию на услуги</p>
            ) : topMaterialServices.map(item => (
              <div key={item.name} className="flex items-center justify-between rounded-lg bg-white/3 px-3 py-2">
                <span className="text-slate-300">{item.name}</span>
                <span className="text-white">{fmt(Math.round(item.cost))} {activeOrg.currency}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
