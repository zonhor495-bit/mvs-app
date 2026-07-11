import { useEffect, useMemo, useState, memo } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isSameDay } from 'date-fns';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Organization, CashPaymentMethod, UserRole, Order, WorkerTimelog } from '../types';
import { getBoxes, getCashOperations, getOrders, getWarehouseMovements, getWashers, getWorkerTimelogs } from '../store';

interface AnalyticsProps {
  activeOrg: Organization;
  userRole: UserRole;
}

type PeriodPreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type ChartPeriod = 'week' | 'month' | 'year';

type PaymentFilter = 'all' | CashPaymentMethod;

function money(n: number) {
  return Math.round(n).toLocaleString('ru-RU');
}

function durationToText(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}ч ${mm}м`;
}

function normalizePayment(value?: string): string {
  if (!value) return 'Другой';
  if (value === 'cash') return 'Наличные';
  if (value === 'card' || value === 'Card' || value === 'Kaspi') return 'Банковская карта';
  if (value === 'qr') return 'QR';
  if (value === 'transfer') return 'Перевод';
  if (value === 'other') return 'Другой';
  return value;
}

export default memo(function Analytics({ activeOrg, userRole }: AnalyticsProps) {
  const [tick, setTick] = useState(0);
  const [period, setPeriod] = useState<PeriodPreset>('today');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('month');
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [filterWasherId, setFilterWasherId] = useState('all');
  const [filterServiceId, setFilterServiceId] = useState('all');
  const [filterPayment, setFilterPayment] = useState<PaymentFilter>('all');
  const [filterBoxId, setFilterBoxId] = useState('all');

  const canView = userRole === 'manager' || activeOrg.analyticsAdminView !== false;
  const canExport = userRole === 'manager';

  useEffect(() => {
    const onChanged = () => setTick(t => t + 1);
    window.addEventListener('wd-store-changed', onChanged);
    return () => window.removeEventListener('wd-store-changed', onChanged);
  }, []);

  const orders = useMemo(() => getOrders(activeOrg.id), [activeOrg.id, tick]);
  const cashOps = useMemo(() => getCashOperations(activeOrg.id), [activeOrg.id, tick]);
  const timelogs = useMemo(() => getWorkerTimelogs(activeOrg.id), [activeOrg.id, tick]);
  const movements = useMemo(() => getWarehouseMovements(activeOrg.id), [activeOrg.id, tick]);
  const washers = useMemo(() => getWashers(activeOrg.id), [activeOrg.id, tick]);
  const boxes = useMemo(() => getBoxes(activeOrg.id), [activeOrg.id, tick]);

  const range = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'yesterday': {
        const d = subDays(now, 1);
        return { from: startOfDay(d), to: endOfDay(d) };
      }
      case 'week':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      default:
        return { from: startOfDay(new Date(dateFrom)), to: endOfDay(new Date(dateTo)) };
    }
  }, [period, dateFrom, dateTo]);

  const orderById = useMemo(() => {
    const map = new Map<string, typeof orders[number]>();
    orders.forEach(order => map.set(order.id, order));
    return map;
  }, [orders]);

  const allServiceOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach(order => order.services.forEach(service => map.set(service.serviceId, service.serviceName)));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [orders]);

  const paymentOptions: PaymentFilter[] = ['all', 'Наличные', 'Банковская карта', 'QR', 'Перевод', 'Другой'];

  const isInRange = (value?: string) => {
    if (!value) return false;
    const ts = new Date(value).getTime();
    return ts >= range.from.getTime() && ts <= range.to.getTime();
  };

  const orderMatchesFilters = (order: typeof orders[number]) => {
    const dateValue = order.completedAt || order.createdAt;
    if (!isInRange(dateValue)) return false;
    if (order.status !== 'completed') return false;

    if (filterWasherId !== 'all') {
      const hasWasher = order.washerId === filterWasherId || (order.washerIds || []).includes(filterWasherId);
      if (!hasWasher) return false;
    }

    if (filterServiceId !== 'all' && !order.services.some(service => service.serviceId === filterServiceId)) {
      return false;
    }

    if (filterPayment !== 'all' && normalizePayment(order.paymentMethod) !== filterPayment) {
      return false;
    }

    if (filterBoxId !== 'all' && order.boxId !== filterBoxId) {
      return false;
    }

    return true;
  };

  const filteredCompletedOrders = useMemo(() => orders.filter(orderMatchesFilters), [orders, range, filterWasherId, filterServiceId, filterPayment, filterBoxId]);
  const todayCompletedOrders = useMemo(
    () => orders.filter(order => order.status === 'completed' && isSameDay(new Date(order.completedAt || order.createdAt), new Date())),
    [orders]
  );

  const filteredTimelogs = useMemo(() => {
    return timelogs.filter(log => {
      const ts = new Date(log.date).getTime();
      if (ts < range.from.getTime() || ts > range.to.getTime()) return false;
      if (filterWasherId !== 'all' && log.washerId !== filterWasherId) return false;
      return true;
    });
  }, [timelogs, range, filterWasherId]);

  const filteredMovements = useMemo(() => {
    return movements.filter(movement => {
      if (!isInRange(movement.createdAt)) return false;
      if (filterServiceId !== 'all' && movement.serviceId && movement.serviceId !== filterServiceId) return false;
      if (filterBoxId !== 'all' || filterPayment !== 'all' || filterWasherId !== 'all') {
        if (movement.orderId) {
          const order = orderById.get(movement.orderId);
          if (!order) return false;
          if (filterBoxId !== 'all' && order.boxId !== filterBoxId) return false;
          if (filterPayment !== 'all' && normalizePayment(order.paymentMethod) !== filterPayment) return false;
          if (filterWasherId !== 'all') {
            const hasWasher = order.washerId === filterWasherId || (order.washerIds || []).includes(filterWasherId);
            if (!hasWasher) return false;
          }
        }
      }
      return true;
    });
  }, [movements, range, filterServiceId, filterBoxId, filterPayment, filterWasherId, orderById]);

  const todayCars = new Set(todayCompletedOrders.map(order => order.licensePlate)).size;
  const todayRevenue = todayCompletedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  
  // Optimized: single pass through movements and cashOps for today metrics
  let todayMaterials = 0;
  let todayPurchases = 0;
  const today = new Date();
  for (const m of movements) {
    if (isSameDay(new Date(m.createdAt), today)) {
      if (m.type === 'consumption' || m.type === 'writeoff') {
        todayMaterials += m.totalCost || 0;
      } else if (m.type === 'incoming') {
        todayPurchases += m.totalCost || 0;
      }
    }
  }
  
  const todaySalary = timelogs.filter(log => isSameDay(new Date(log.date), new Date())).reduce((sum, log) => sum + log.washerShare, 0);
  
  let todayOtherExpenses = 0;
  for (const op of cashOps) {
    if (op.direction === 'expense' && isSameDay(new Date(op.createdAt), new Date()) && op.type !== 'expense_supply') {
      todayOtherExpenses += op.amount;
    }
  }
  const todayExpenses = todaySalary + todayMaterials + todayPurchases + todayOtherExpenses;
  const todayProfit = todayRevenue - todayExpenses;
  const todayAvgCheck = todayCompletedOrders.length > 0 ? todayRevenue / todayCompletedOrders.length : 0;

  const periodOrdersCount = filteredCompletedOrders.length;
  const periodRevenue = filteredCompletedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const periodSalary = filteredTimelogs.reduce((sum, log) => sum + log.washerShare, 0);
  
  // Optimized: single pass through filteredMovements instead of multiple filter calls
  let periodMaterials = 0;
  let periodPurchases = 0;
  for (const m of filteredMovements) {
    if (m.type === 'consumption' || m.type === 'writeoff') {
      periodMaterials += m.totalCost || 0;
    } else if (m.type === 'incoming') {
      periodPurchases += m.totalCost || 0;
    }
  }
  
  // Optimized: single pass through cashOps
  let periodOtherExpenses = 0;
  for (const op of cashOps) {
    if (op.direction === 'expense' && isInRange(op.createdAt) && op.type !== 'expense_supply') {
      periodOtherExpenses += op.amount;
    }
  }
  const periodExpenses = periodSalary + periodMaterials + periodPurchases + periodOtherExpenses;
  const periodProfit = periodRevenue - periodExpenses;
  const periodAvgCheck = periodOrdersCount > 0 ? periodRevenue / periodOrdersCount : 0;

  // Сравнение с предыдущим периодом
  const previousRange = useMemo(() => {
    const daysDiff = range.to.getTime() - range.from.getTime();
    const prevFrom = new Date(range.from.getTime() - daysDiff);
    const prevTo = new Date(range.from.getTime() - 1000);
    return { from: prevFrom, to: prevTo };
  }, [range]);

  const previousOrders = useMemo(() => {
    return orders.filter(order => {
      const date = new Date(order.completedAt || order.createdAt);
      return order.status === 'completed' && date >= previousRange.from && date <= previousRange.to;
    });
  }, [orders, previousRange]);

  const previousRevenue = previousOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const previousOrdersCount = previousOrders.length;
  const previousSalary = timelogs
    .filter(log => new Date(log.date) >= previousRange.from && new Date(log.date) <= previousRange.to)
    .reduce((sum, log) => sum + log.washerShare, 0);
  
  // Optimized: single pass through movements and cashOps for previous period metrics
  let previousMaterials = 0;
  let previousPurchases = 0;
  for (const m of movements) {
    const moveDate = new Date(m.createdAt);
    if (moveDate >= previousRange.from && moveDate <= previousRange.to) {
      if (m.type === 'consumption' || m.type === 'writeoff') {
        previousMaterials += m.totalCost || 0;
      } else if (m.type === 'incoming') {
        previousPurchases += m.totalCost || 0;
      }
    }
  }
  
  let previousOtherExpenses = 0;
  for (const op of cashOps) {
    const opDate = new Date(op.createdAt);
    if (op.direction === 'expense' && opDate >= previousRange.from && opDate <= previousRange.to) {
      previousOtherExpenses += op.amount;
    }
  }
  const previousExpenses = previousSalary + previousMaterials + previousPurchases + previousOtherExpenses;
  const previousProfit = previousRevenue - previousExpenses;

  // Расчёт процентов роста
  const revenueGrowthPercent = previousRevenue > 0 ? Math.round(((periodRevenue - previousRevenue) / previousRevenue) * 100) : 0;
  const ordersGrowthPercent = previousOrdersCount > 0 ? Math.round(((periodOrdersCount - previousOrdersCount) / previousOrdersCount) * 100) : 0;
  const profitGrowthPercent = previousProfit > 0 ? Math.round(((periodProfit - previousProfit) / previousProfit) * 100) : 0;

  // Прогнозирование
  const daysInCurrentMonth = endOfMonth(new Date()).getDate();
  const currentDayOfMonth = new Date().getDate();
  const avgDailyRevenue = currentDayOfMonth > 0 ? periodRevenue / currentDayOfMonth : 0;
  const avgDailyProfit = currentDayOfMonth > 0 ? periodProfit / currentDayOfMonth : 0;
  const avgDailyCars = currentDayOfMonth > 0 ? periodOrdersCount / currentDayOfMonth : 0;

  const forecastedMonthRevenue = avgDailyRevenue * daysInCurrentMonth;
  const forecastedMonthProfit = avgDailyProfit * daysInCurrentMonth;
  const forecastedMonthCars = Math.round(avgDailyCars * daysInCurrentMonth);

  // Анализ боксов по доходу
  const boxesRevenueAnalytics = useMemo(() => {
    // Optimized: pre-group orders by boxId to avoid N×M filter
    const ordersByBox = new Map<string, typeof filteredCompletedOrders>();
    for (const order of filteredCompletedOrders) {
      if (!order.boxId) continue;
      if (!ordersByBox.has(order.boxId)) {
        ordersByBox.set(order.boxId, []);
      }
      ordersByBox.get(order.boxId)!.push(order);
    }

    return boxes.map(box => {
      const boxOrders = ordersByBox.get(box.id) || [];
      const revenue = boxOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      const totalMinutesInRange = Math.max(1, (range.to.getTime() - range.from.getTime()) / 60000);
      const busyMinutes = boxOrders.reduce((sum, order) => {
        const start = new Date(order.createdAt).getTime();
        const end = new Date(order.completedAt || order.createdAt).getTime();
        return sum + Math.max(1, Math.round((end - start) / 60000));
      }, 0);
      const occupancy = Math.min(100, Math.round((busyMinutes / totalMinutesInRange) * 100));
      const avgTime = boxOrders.length > 0 ? busyMinutes / boxOrders.length : 0;
      return {
        boxId: box.id,
        boxName: box.name,
        cars: boxOrders.length,
        revenue,
        occupancy,
        avgTime,
        busyMinutes,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [boxes, filteredCompletedOrders, range]);

  const servicesAnalytics = useMemo(() => {
    const serviceCosts = new Map<string, number>();
    filteredMovements.filter(m => m.source === 'order_auto').forEach(m => {
      const key = m.serviceId || m.serviceName || 'unknown';
      serviceCosts.set(key, (serviceCosts.get(key) || 0) + (m.totalCost || 0));
    });

    const map = new Map<string, { id: string; name: string; count: number; revenue: number; cost: number }>();
    filteredCompletedOrders.forEach(order => {
      order.services.forEach(service => {
        const row = map.get(service.serviceId) || { id: service.serviceId, name: service.serviceName, count: 0, revenue: 0, cost: 0 };
        row.count += 1;
        row.revenue += service.price;
        map.set(service.serviceId, row);
      });
    });

    const rows = Array.from(map.values()).map(row => {
      const cost = serviceCosts.get(row.id) || serviceCosts.get(row.name) || 0;
      const profit = row.revenue - cost;
      return {
        ...row,
        cost,
        profit,
        marginPercent: row.revenue > 0 ? Math.round((profit / row.revenue) * 100) : 0,
      };
    });

    return rows.sort((a, b) => b.count - a.count);
  }, [filteredCompletedOrders, filteredMovements]);

  const employeesAnalytics = useMemo(() => {
    const ordersByWasher = new Map<string, Order[]>();
    for (const order of filteredCompletedOrders) {
      const ids = order.washerIds && order.washerIds.length ? order.washerIds : order.washerId ? [order.washerId] : [];
      for (const id of ids) {
        const list = ordersByWasher.get(id) || [];
        list.push(order);
        ordersByWasher.set(id, list);
      }
    }

    const logsByWasher = new Map<string, WorkerTimelog[]>();
    for (const log of filteredTimelogs) {
      const list = logsByWasher.get(log.washerId) || [];
      list.push(log);
      logsByWasher.set(log.washerId, list);
    }

    const rows = washers.map(washer => {
      const washerOrders = ordersByWasher.get(washer.id) || [];
      const washerLogs = logsByWasher.get(washer.id) || [];
      const totalCars = washerOrders.length;
      const totalEarnings = washerLogs.reduce((sum, log) => sum + log.washerShare, 0);
      const totalMinutes = washerLogs.reduce((sum, log) => sum + (log.durationMinutes || 0), 0);
      const avgMinutes = washerLogs.length > 0 ? totalMinutes / washerLogs.length : 0;
      const avgCheck = washerOrders.length > 0 ? washerOrders.reduce((sum, order) => sum + order.totalAmount, 0) / washerOrders.length : 0;
      const workDays = new Set(washerLogs.map(log => log.date)).size;
      return {
        washerId: washer.id,
        washerName: washer.name,
        totalCars,
        totalEarnings,
        avgMinutes,
        avgCheck,
        workDays,
      };
    });

    return rows.sort((a, b) => b.totalCars - a.totalCars);
  }, [washers, filteredCompletedOrders, filteredTimelogs]);

  // Рейтинг сотрудников по эффективности
  const employeesRating = useMemo(() => {
    return employeesAnalytics.map((emp, index) => ({
      ...emp,
      rank: index + 1,
      efficiency: emp.totalCars > 0 && emp.totalEarnings > 0 ? Math.round((emp.totalCars * 100) / Math.max(1, emp.avgMinutes || 1)) : 0,
    }));
  }, [employeesAnalytics]);

  const boxesAnalytics = useMemo(() => {
    // Optimized: pre-group orders by boxId
    const ordersByBox = new Map<string, typeof filteredCompletedOrders>();
    for (const order of filteredCompletedOrders) {
      if (!order.boxId) continue;
      if (!ordersByBox.has(order.boxId)) {
        ordersByBox.set(order.boxId, []);
      }
      ordersByBox.get(order.boxId)!.push(order);
    }

    const totalMinutesInRange = Math.max(1, (range.to.getTime() - range.from.getTime()) / 60000);
    return boxes.map(box => {
      const boxOrders = ordersByBox.get(box.id) || [];
      const busyMinutes = boxOrders.reduce((sum, order) => {
        const start = new Date(order.createdAt).getTime();
        const end = new Date(order.completedAt || order.createdAt).getTime();
        const duration = Math.max(1, Math.round((end - start) / 60000));
        return sum + duration;
      }, 0);
      const occupancy = Math.min(100, Math.round((busyMinutes / totalMinutesInRange) * 100));
      return {
        boxId: box.id,
        boxName: box.name,
        cars: boxOrders.length,
        busyMinutes,
        idleMinutes: Math.max(0, Math.round(totalMinutesInRange - busyMinutes)),
        occupancy,
      };
    }).sort((a, b) => b.occupancy - a.occupancy);
  }, [boxes, filteredCompletedOrders, range]);

  const clientsAnalytics = useMemo(() => {
    const map = new Map<string, { plate: string; visits: number; revenue: number; lastVisit: string }>();
    filteredCompletedOrders.forEach(order => {
      const key = order.licensePlate.toUpperCase();
      const row = map.get(key) || { plate: order.licensePlate, visits: 0, revenue: 0, lastVisit: order.completedAt || order.createdAt };
      row.visits += 1;
      row.revenue += order.totalAmount;
      const currentLast = new Date(row.lastVisit).getTime();
      const candidate = new Date(order.completedAt || order.createdAt).getTime();
      if (candidate > currentLast) row.lastVisit = order.completedAt || order.createdAt;
      map.set(key, row);
    });

    return Array.from(map.values()).map(row => ({
      ...row,
      avgCheck: row.visits > 0 ? row.revenue / row.visits : 0,
      lastVisitLabel: format(new Date(row.lastVisit), 'dd.MM.yyyy'),
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filteredCompletedOrders]);

  const chartData = useMemo(() => {
    if (chartPeriod === 'year') {
      const result: Array<{ label: string; revenue: number; cars: number; expenses: number; profit: number }> = [];
      for (let month = 0; month < 12; month += 1) {
        const monthOrders = orders.filter(order => {
          const d = new Date(order.completedAt || order.createdAt);
          return order.status === 'completed' && d.getMonth() === month && d.getFullYear() === new Date().getFullYear();
        });
        const monthRevenue = monthOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const monthCars = new Set(monthOrders.map(order => order.licensePlate)).size;
        const monthSalary = timelogs
          .filter(log => {
            const d = new Date(log.date);
            return d.getMonth() === month && d.getFullYear() === new Date().getFullYear();
          })
          .reduce((sum, log) => sum + log.washerShare, 0);
        const monthMaterials = movements
          .filter(m => (m.type === 'consumption' || m.type === 'writeoff' || m.type === 'incoming') && new Date(m.createdAt).getMonth() === month && new Date(m.createdAt).getFullYear() === new Date().getFullYear())
          .reduce((sum, m) => sum + (m.totalCost || 0), 0);
        const monthOtherExpenses = cashOps
          .filter(op => op.direction === 'expense' && new Date(op.createdAt).getMonth() === month && new Date(op.createdAt).getFullYear() === new Date().getFullYear() && op.type !== 'expense_supply')
          .reduce((sum, op) => sum + op.amount, 0);
        const monthExpenses = monthSalary + monthMaterials + monthOtherExpenses;
        result.push({
          label: `${month + 1}`,
          revenue: monthRevenue,
          cars: monthCars,
          expenses: monthExpenses,
          profit: monthRevenue - monthExpenses,
        });
      }
      return result;
    }

    const days = chartPeriod === 'week' ? 7 : 30;
    const result: Array<{ label: string; revenue: number; cars: number; expenses: number; profit: number }> = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = subDays(new Date(), i);
      const dayOrders = orders.filter(order => order.status === 'completed' && isSameDay(new Date(order.completedAt || order.createdAt), day));
      const revenue = dayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      const cars = new Set(dayOrders.map(order => order.licensePlate)).size;
      const salary = timelogs.filter(log => isSameDay(new Date(log.date), day)).reduce((sum, log) => sum + log.washerShare, 0);
      const materials = movements
        .filter(m => (m.type === 'consumption' || m.type === 'writeoff' || m.type === 'incoming') && isSameDay(new Date(m.createdAt), day))
        .reduce((sum, movement) => sum + (movement.totalCost || 0), 0);
      const otherExpenses = cashOps
        .filter(op => op.direction === 'expense' && isSameDay(new Date(op.createdAt), day) && op.type !== 'expense_supply')
        .reduce((sum, op) => sum + op.amount, 0);
      const expenses = salary + materials + otherExpenses;
      result.push({
        label: format(day, 'dd.MM'),
        revenue,
        cars,
        expenses,
        profit: revenue - expenses,
      });
    }
    return result;
  }, [chartPeriod, orders, timelogs, movements, cashOps]);

  const exportCSV = () => {
    const sections: string[] = [];
    sections.push('Период,Доход,Расходы,Прибыль,Заказов,Средний чек');
    sections.push(`"${format(range.from, 'dd.MM.yyyy')} - ${format(range.to, 'dd.MM.yyyy')}",${Math.round(periodRevenue)},${Math.round(periodExpenses)},${Math.round(periodProfit)},${periodOrdersCount},${Math.round(periodAvgCheck)}`);
    sections.push('');
    sections.push('Сравнение с прошлым периодом');
    sections.push(`Период,Доход,Рост %,Заказы,Рост %,Прибыль,Рост %`);
    sections.push(`"${format(range.from, 'dd.MM.yyyy')} - ${format(range.to, 'dd.MM.yyyy')}",${Math.round(periodRevenue)},${revenueGrowthPercent.toFixed(1)},${periodOrdersCount},${ordersGrowthPercent.toFixed(1)},${Math.round(periodProfit)},${profitGrowthPercent.toFixed(1)}`);
    sections.push('');
    sections.push('Прогноз на месяц');
    sections.push(`Метрика,Текущий месяц,Прогноз при текущем темпе`);
    sections.push(`Доход,${Math.round(periodRevenue)},${Math.round(forecastedMonthRevenue)}`);
    sections.push(`Прибыль,${Math.round(periodProfit)},${Math.round(forecastedMonthProfit)}`);
    sections.push(`Заказы,${periodOrdersCount},${Math.round(forecastedMonthCars)}`);
    sections.push('');
    sections.push('Услуги,Количество,Выручка,Себестоимость,Прибыльность %');
    servicesAnalytics.forEach(row => sections.push(`"${row.name}",${row.count},${Math.round(row.revenue)},${Math.round(row.cost)},${row.marginPercent}`));
    sections.push('');
    sections.push('Рейтинг сотрудников,Машин,Доход,Ср. время,Место');
    employeesRating.forEach(row => sections.push(`"${row.washerName}",${row.totalCars},${Math.round(row.totalEarnings)},"${durationToText(row.avgMinutes)}",${row.rank}`));
    sections.push('');
    sections.push('Сотрудник,Машин,Заработал,Среднее время,Средний чек,Рабочих дней');
    employeesAnalytics.forEach(row => sections.push(`"${row.washerName}",${row.totalCars},${Math.round(row.totalEarnings)},"${durationToText(row.avgMinutes)}",${Math.round(row.avgCheck)},${row.workDays}`));
    sections.push('');
    sections.push('Доход по боксам,Машин,Доход,Загрузка %,Ср. время');
    boxesRevenueAnalytics.forEach(row => sections.push(`"${row.boxName}",${row.cars},${Math.round(row.revenue)},${row.occupancy},"${durationToText(row.avgTime)}"`));
    sections.push('');
    sections.push('Клиент,Визитов,Доход,Средний чек,Последняя мойка');
    clientsAnalytics.slice(0, 50).forEach(row => sections.push(`"${row.plate}",${row.visits},${Math.round(row.revenue)},${Math.round(row.avgCheck)},"${row.lastVisitLabel}"`));

    const blob = new Blob(['\uFEFF' + sections.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${format(range.from, 'yyyyMMdd')}_${format(range.to, 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = async () => {
    if (!window.electron?.exportReport) {
      alert('Экспорт Excel недоступен в этой среде');
      return;
    }

    const ordersRows = filteredCompletedOrders.map((order, index) => ({
      id: index + 1,
      date: order.completedAt || order.createdAt,
      service: order.services.map(service => service.serviceName).join(', '),
      amount: order.totalAmount,
      paymentMethod: normalizePayment(order.paymentMethod),
      washer: order.washerNames?.join(', ') || order.washerName || '',
      licensePlate: order.licensePlate,
      box: order.boxName || '',
    }));

    const result = await window.electron.exportReport({
      orders: ordersRows,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      fileName: `analytics_${format(range.from, 'yyyyMMdd')}_${format(range.to, 'yyyyMMdd')}.xlsx`,
      warehouse: {
        items: [
          { 
            period: `${format(range.from, 'dd.MM.yyyy')} - ${format(range.to, 'dd.MM.yyyy')}`, 
            orders: periodOrdersCount, 
            income: Math.round(periodRevenue), 
            expenses: Math.round(periodExpenses), 
            profit: Math.round(periodProfit),
            revenueGrowth: revenueGrowthPercent.toFixed(1),
            ordersGrowth: ordersGrowthPercent.toFixed(1),
            profitGrowth: profitGrowthPercent.toFixed(1),
            forecastRevenue: Math.round(forecastedMonthRevenue),
            forecastProfit: Math.round(forecastedMonthProfit),
            forecastCars: Math.round(forecastedMonthCars),
          }
        ],
        movements: servicesAnalytics.map(row => ({ service: row.name, count: row.count, revenue: Math.round(row.revenue), cost: Math.round(row.cost), marginPercent: row.marginPercent })),
        purchases: employeesAnalytics.map(row => ({ washer: row.washerName, cars: row.totalCars, earnings: Math.round(row.totalEarnings), avgTime: durationToText(row.avgMinutes), avgCheck: Math.round(row.avgCheck), workDays: row.workDays })),
        expenses: boxesRevenueAnalytics.map(row => ({ box: row.boxName, cars: row.cars, revenue: Math.round(row.revenue), occupancyPercent: row.occupancy, avgTime: durationToText(row.avgTime) })),
        cost: clientsAnalytics.slice(0, 50).map(row => ({ plate: row.plate, visits: row.visits, revenue: Math.round(row.revenue), avgCheck: Math.round(row.avgCheck), lastVisit: row.lastVisitLabel })),
      },
    });

    if (!result?.canceled) {
      alert(`Отчёт сохранён: ${result.filePath}`);
    }
  };

  const exportPdf = () => {
    const html = `
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Аналитика</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #111827; line-height: 1.6; }
          h1 { margin: 0 0 12px; font-size: 24px; }
          h2 { margin: 20px 0 12px; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
          .muted { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 20px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px 12px; font-size: 12px; text-align: left; }
          th { background: #f3f4f6; font-weight: 600; }
          tr:nth-child(even) { background: #f9fafb; }
          .summary { display: flex; gap: 20px; margin: 16px 0; }
          .summary-item { flex: 1; padding: 12px; background: #f3f4f6; border-radius: 4px; }
          .summary-item-label { font-size: 11px; color: #6b7280; }
          .summary-item-value { font-size: 16px; font-weight: 600; color: #111827; margin-top: 4px; }
          .page-break { page-break-after: always; margin: 40px 0; }
        </style>
      </head>
      <body>
        <h1>${activeOrg.name} — Отчёт аналитики</h1>
        <div class="muted">Период: ${format(range.from, 'dd.MM.yyyy')} - ${format(range.to, 'dd.MM.yyyy')}</div>
        <div class="muted">Сгенерирован: ${format(new Date(), 'dd.MM.yyyy HH:mm')}</div>
        
        <h2>Финансовый итог</h2>
        <div class="summary">
          <div class="summary-item">
            <div class="summary-item-label">Доход</div>
            <div class="summary-item-value">${money(periodRevenue)} ${activeOrg.currency}</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">Расходы</div>
            <div class="summary-item-value">${money(periodExpenses)} ${activeOrg.currency}</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">Чистая прибыль</div>
            <div class="summary-item-value">${money(periodProfit)} ${activeOrg.currency}</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">Заказов</div>
            <div class="summary-item-value">${periodOrdersCount}</div>
          </div>
        </div>

        <h2>Сравнение с прошлым периодом</h2>
        <table>
          <tr><th>Метрика</th><th>Текущий период</th><th>Рост (%)</th></tr>
          <tr><td>Доход</td><td>${money(periodRevenue)}</td><td>${revenueGrowthPercent.toFixed(1)}%</td></tr>
          <tr><td>Заказы</td><td>${periodOrdersCount}</td><td>${ordersGrowthPercent.toFixed(1)}%</td></tr>
          <tr><td>Прибыль</td><td>${money(periodProfit)}</td><td>${profitGrowthPercent.toFixed(1)}%</td></tr>
        </table>

        <h2>Прогноз на месяц</h2>
        <table>
          <tr><th>Метрика</th><th>Текущий месяц</th><th>Прогноз при текущем темпе</th></tr>
          <tr><td>Доход</td><td>${money(periodRevenue)}</td><td>${money(forecastedMonthRevenue)}</td></tr>
          <tr><td>Прибыль</td><td>${money(periodProfit)}</td><td>${money(forecastedMonthProfit)}</td></tr>
          <tr><td>Заказы</td><td>${periodOrdersCount}</td><td>${Math.round(forecastedMonthCars)}</td></tr>
        </table>
        
        <h2>Детализация расходов</h2>
        <table>
          <tr>
            <th>Статья</th>
            <th>Сумма (${activeOrg.currency})</th>
            <th>Доля (%)</th>
          </tr>
          <tr>
            <td>Зарплаты сотрудников</td>
            <td>${money(periodSalary)}</td>
            <td>${periodExpenses > 0 ? Math.round((periodSalary / periodExpenses) * 100) : 0}%</td>
          </tr>
          <tr>
            <td>Расходники</td>
            <td>${money(periodMaterials)}</td>
            <td>${periodExpenses > 0 ? Math.round((periodMaterials / periodExpenses) * 100) : 0}%</td>
          </tr>
          <tr>
            <td>Закупки</td>
            <td>${money(periodPurchases)}</td>
            <td>${periodExpenses > 0 ? Math.round((periodPurchases / periodExpenses) * 100) : 0}%</td>
          </tr>
          <tr>
            <td>Прочие расходы</td>
            <td>${money(periodOtherExpenses)}</td>
            <td>${periodExpenses > 0 ? Math.round((periodOtherExpenses / periodExpenses) * 100) : 0}%</td>
          </tr>
          <tr style="background: #e8f5e9; font-weight: 600;">
            <td>Всего расходов</td>
            <td>${money(periodExpenses)}</td>
            <td>100%</td>
          </tr>
        </table>

        <h2>Популярные услуги</h2>
        <table>
          <tr><th>Услуга</th><th>Кол-во</th><th>Выручка</th><th>Себестоимость</th><th>Маржа %</th></tr>
          ${servicesAnalytics.slice(0, 15).map(row => `<tr><td>${row.name}</td><td>${row.count}</td><td>${money(row.revenue)}</td><td>${money(row.cost)}</td><td>${row.marginPercent}%</td></tr>`).join('')}
        </table>

        <div class="page-break"></div>

        <h2>Рейтинг сотрудников</h2>
        <table>
          <tr><th>Место</th><th>Сотрудник</th><th>Машин</th><th>Заработал</th><th>Ср. время</th><th>Эффективность</th></tr>
          ${employeesRating.map(row => `<tr><td>#${row.rank}</td><td>${row.washerName}</td><td>${row.totalCars}</td><td>${money(row.totalEarnings)}</td><td>${durationToText(row.avgMinutes)}</td><td>${row.efficiency.toFixed(1)}</td></tr>`).join('')}
        </table>

        <h2>Полная аналитика сотрудников</h2>
        <table>
          <tr><th>Сотрудник</th><th>Машин</th><th>Заработал</th><th>Ср. время</th><th>Ср. чек</th><th>Дней</th></tr>
          ${employeesAnalytics.map(row => `<tr><td>${row.washerName}</td><td>${row.totalCars}</td><td>${money(row.totalEarnings)}</td><td>${durationToText(row.avgMinutes)}</td><td>${money(row.avgCheck)}</td><td>${row.workDays}</td></tr>`).join('')}
        </table>

        <h2>Доход по боксам</h2>
        <table>
          <tr><th>Бокс</th><th>Машин</th><th>Доход</th><th>Загрузка %</th><th>Ср. время</th></tr>
          ${boxesRevenueAnalytics.map(row => `<tr><td>${row.boxName}</td><td>${row.cars}</td><td>${money(row.revenue)}</td><td>${row.occupancy}%</td><td>${durationToText(row.avgTime)}</td></tr>`).join('')}
        </table>

        <h2>Загруженность боксов</h2>
        <table>
          <tr><th>Бокс</th><th>Машин</th><th>Загрузка %</th><th>Занято</th><th>Простой</th></tr>
          ${boxesAnalytics.map(row => `<tr><td>${row.boxName}</td><td>${row.cars}</td><td>${row.occupancy}%</td><td>${durationToText(row.busyMinutes)}</td><td>${durationToText(row.idleMinutes)}</td></tr>`).join('')}
        </table>

        <div class="page-break"></div>

        <h2>Топ клиентов</h2>
        <table>
          <tr><th>Госномер</th><th>Визитов</th><th>Доход</th><th>Ср. чек</th><th>Последняя мойка</th></tr>
          ${clientsAnalytics.slice(0, 30).map(row => `<tr><td>${row.plate}</td><td>${row.visits}</td><td>${money(row.revenue)}</td><td>${money(row.avgCheck)}</td><td>${row.lastVisitLabel}</td></tr>`).join('')}
        </table>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=1000,height=700');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto glass rounded-xl p-6 text-slate-300">
        Доступ к аналитике для администратора отключён в настройках организации.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Аналитика</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canExport}>CSV</button>
          <button onClick={exportXlsx} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canExport}>Excel</button>
          <button onClick={exportPdf} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canExport}>PDF</button>
        </div>
      </div>

      {!canExport && <div className="glass rounded-xl p-3 text-xs text-slate-400">Режим просмотра: экспорт доступен управляющему.</div>}

      <div className="glass rounded-xl p-4 flex flex-wrap gap-2 items-center">
        {(['today', 'yesterday', 'week', 'month', 'custom'] as const).map(preset => (
          <button
            key={preset}
            onClick={() => setPeriod(preset)}
            className={`px-3 py-2 rounded-lg text-xs ${period === preset ? 'btn-neon' : 'text-slate-400 hover:text-white'}`}
          >
            {preset === 'today' ? 'Сегодня' : preset === 'yesterday' ? 'Вчера' : preset === 'week' ? 'Неделя' : preset === 'month' ? 'Месяц' : 'Период'}
          </button>
        ))}

        {period === 'custom' && (
          <>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-xs" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-xs" />
          </>
        )}
      </div>

      <div className="glass rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
        <select value={filterWasherId} onChange={e => setFilterWasherId(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm">
          <option value="all">Все сотрудники</option>
          {washers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={filterServiceId} onChange={e => setFilterServiceId(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm">
          <option value="all">Все услуги</option>
          {allServiceOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterPayment} onChange={e => setFilterPayment(e.target.value as PaymentFilter)} className="input-neon rounded-lg px-3 py-2 text-sm">
          {paymentOptions.map(p => <option key={p} value={p}>{p === 'all' ? 'Все оплаты' : p}</option>)}
        </select>
        <select value={filterBoxId} onChange={e => setFilterBoxId(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm">
          <option value="all">Все боксы</option>
          {boxes.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={chartPeriod} onChange={e => setChartPeriod(e.target.value as ChartPeriod)} className="input-neon rounded-lg px-3 py-2 text-sm">
          <option value="week">Графики: неделя</option>
          <option value="month">Графики: месяц</option>
          <option value="year">Графики: год</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Сегодня: машин</p><p className="text-2xl font-bold text-cyan-400">{todayCars}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Сегодня: завершено</p><p className="text-2xl font-bold text-green-400">{todayCompletedOrders.length}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Сегодня: выручка</p><p className="text-2xl font-bold text-white">{money(todayRevenue)} {activeOrg.currency}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Сегодня: расходы</p><p className="text-2xl font-bold text-red-400">{money(todayExpenses)} {activeOrg.currency}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Сегодня: чистая прибыль</p><p className="text-2xl font-bold text-green-400">{money(todayProfit)} {activeOrg.currency}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Сегодня: зарплата</p><p className="text-lg font-bold text-orange-400">{money(todaySalary)} {activeOrg.currency}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Сегодня: расходники</p><p className="text-lg font-bold text-orange-300">{money(todayMaterials)} {activeOrg.currency}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Сегодня: закупки</p><p className="text-lg font-bold text-amber-300">{money(todayPurchases)} {activeOrg.currency}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Сегодня: прочие расходы</p><p className="text-lg font-bold text-yellow-300">{money(todayOtherExpenses)} {activeOrg.currency}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Сегодня: средний чек</p><p className="text-lg font-bold text-purple-400">{money(todayAvgCheck)} {activeOrg.currency}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Период: заказов</p><p className="text-xl font-bold text-white">{periodOrdersCount}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Период: доход</p><p className="text-xl font-bold text-cyan-400">{money(periodRevenue)} {activeOrg.currency}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Период: расходы</p><p className="text-xl font-bold text-red-400">{money(periodExpenses)} {activeOrg.currency}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Период: средний чек</p><p className="text-xl font-bold text-purple-400">{money(periodAvgCheck)} {activeOrg.currency}</p></div>
      </div>

      {/* Блок сравнения периодов */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Сравнение периодов</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Доход</p>
            <p className="text-white font-semibold">{money(periodRevenue)}</p>
            <p className={`text-xs mt-1 ${previousRevenue > 0 && revenueGrowthPercent >= 0 ? 'text-green-400' : previousRevenue > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {previousRevenue > 0 ? (revenueGrowthPercent > 0 ? '+' : '') + revenueGrowthPercent + '%' : 'нет данных'}
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Машин</p>
            <p className="text-white font-semibold">{periodOrdersCount}</p>
            <p className={`text-xs mt-1 ${previousOrdersCount > 0 && ordersGrowthPercent >= 0 ? 'text-green-400' : previousOrdersCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {previousOrdersCount > 0 ? (ordersGrowthPercent > 0 ? '+' : '') + ordersGrowthPercent + '%' : 'нет данных'}
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Расходы</p>
            <p className="text-white font-semibold">{money(periodExpenses)}</p>
            <p className="text-xs text-slate-400 mt-1">-</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Прибыль</p>
            <p className={`font-semibold ${periodProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(periodProfit)}</p>
            <p className={`text-xs mt-1 ${previousProfit > 0 && profitGrowthPercent >= 0 ? 'text-green-400' : previousProfit > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {previousProfit > 0 ? (profitGrowthPercent > 0 ? '+' : '') + profitGrowthPercent + '%' : 'нет данных'}
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Средний чек</p>
            <p className="text-white font-semibold">{money(periodAvgCheck)}</p>
            <p className="text-xs text-slate-400 mt-1">-</p>
          </div>
        </div>
      </div>

      {/* Блок прогнозирования */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Прогноз на месяц</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-slate-400">Прогноз доход</p>
            <p className="text-xl font-bold text-cyan-400 mt-2">{money(forecastedMonthRevenue)}</p>
            <p className="text-xs text-slate-400 mt-1">~{money(avgDailyRevenue)}/день</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-slate-400">Прогноз прибыль</p>
            <p className={`text-xl font-bold mt-2 ${forecastedMonthProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(forecastedMonthProfit)}</p>
            <p className="text-xs text-slate-400 mt-1">~{money(avgDailyProfit)}/день</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-slate-400">Прогноз машин</p>
            <p className="text-xl font-bold text-purple-400 mt-2">{forecastedMonthCars}</p>
            <p className="text-xs text-slate-400 mt-1">~{Math.round(avgDailyCars)}/день</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-slate-400">Текущий прогресс</p>
            <p className="text-xl font-bold text-white mt-2">{new Date().getDate()} дн.</p>
            <p className="text-xs text-slate-400 mt-1">из {endOfMonth(new Date()).getDate()} дн.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Финансовый отчёт</h3>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex justify-between"><span>Доход (заказы)</span><span className="text-cyan-400">{money(periodRevenue)} {activeOrg.currency}</span></div>
            <div className="flex justify-between"><span>Зарплаты сотрудников</span><span>{money(periodSalary)} {activeOrg.currency}</span></div>
            <div className="flex justify-between"><span>Расходники</span><span>{money(periodMaterials)} {activeOrg.currency}</span></div>
            <div className="flex justify-between"><span>Закупки</span><span>{money(periodPurchases)} {activeOrg.currency}</span></div>
            <div className="flex justify-between"><span>Другие расходы</span><span>{money(periodOtherExpenses)} {activeOrg.currency}</span></div>
            <div className="border-t border-white/10 pt-2 mt-2 flex justify-between font-semibold text-white"><span>Чистая прибыль</span><span className={periodProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{money(periodProfit)} {activeOrg.currency}</span></div>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Топ клиентов</h3>
          <div className="space-y-2 text-sm">
            {clientsAnalytics.slice(0, 5).map(client => (
              <div key={client.plate} className="rounded bg-white/3 p-2 flex items-center justify-between">
                <span className="text-white">{client.plate}</span>
                <span className="text-slate-300">{client.visits} визитов • {money(client.revenue)} {activeOrg.currency}</span>
              </div>
            ))}
            {clientsAnalytics.length === 0 && <p className="text-slate-500">Нет данных за период</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">График: доход/расходы/прибыль</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#00d4ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">График: количество машин</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="cars" stroke="#8b5cf6" fill="#8b5cf633" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold text-white">Аналитика услуг</h3></div>
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs text-slate-400">Услуга</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Кол-во</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Выручка</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Прибыльность</th>
                </tr>
              </thead>
              <tbody>
                {servicesAnalytics.map(row => (
                  <tr key={row.id} className="border-b border-white/3">
                    <td className="px-4 py-3 text-white">{row.name}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{row.count}</td>
                    <td className="px-4 py-3 text-right text-cyan-400">{money(row.revenue)}</td>
                    <td className="px-4 py-3 text-right text-green-400">{row.marginPercent}%</td>
                  </tr>
                ))}
                {servicesAnalytics.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Нет данных</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold text-white">🏆 Рейтинг сотрудников</h3></div>
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-center text-xs text-slate-400">Место</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400">Сотрудник</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Машин</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Заработок</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Ср. время</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">⭐ Эффект.</th>
                </tr>
              </thead>
              <tbody>
                {employeesRating.map(emp => (
                  <tr key={emp.washerId} className={`border-b border-white/3 ${emp.rank === 1 ? 'bg-yellow-900/10' : emp.rank === 2 ? 'bg-gray-400/10' : emp.rank === 3 ? 'bg-orange-900/10' : ''}`}>
                    <td className="px-4 py-3 text-center font-bold text-white">{emp.rank}</td>
                    <td className="px-4 py-3 text-white">{emp.washerName}</td>
                    <td className="px-4 py-3 text-right text-cyan-400">{emp.totalCars}</td>
                    <td className="px-4 py-3 text-right text-green-400">{money(emp.totalEarnings)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{durationToText(emp.avgMinutes)}</td>
                    <td className="px-4 py-3 text-right"><span className="bg-purple-900/30 text-purple-300 px-2 py-1 rounded text-xs font-semibold">{emp.efficiency}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold text-white">Аналитика сотрудников</h3></div>
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs text-slate-400">Сотрудник</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Машин</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Заработал</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Ср. время</th>
                </tr>
              </thead>
              <tbody>
                {employeesAnalytics.map(row => (
                  <tr key={row.washerId} className="border-b border-white/3">
                    <td className="px-4 py-3 text-white">{row.washerName}<div className="text-[10px] text-slate-500">Дней: {row.workDays} • Ср. чек: {money(row.avgCheck)}</div></td>
                    <td className="px-4 py-3 text-right text-slate-300">{row.totalCars}</td>
                    <td className="px-4 py-3 text-right text-cyan-400">{money(row.totalEarnings)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{durationToText(row.avgMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold text-white">💰 Аналитика боксов по доходу</h3></div>
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs text-slate-400">Бокс</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Машин</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Доход</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Загрузка</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Ср. время</th>
                </tr>
              </thead>
              <tbody>
                {boxesRevenueAnalytics.map((row, idx) => (
                  <tr key={row.boxId} className={`border-b border-white/3 ${idx === 0 ? 'bg-green-900/10' : ''}`}>
                    <td className="px-4 py-3 text-white font-semibold">{row.boxName}</td>
                    <td className="px-4 py-3 text-right text-cyan-400">{row.cars}</td>
                    <td className="px-4 py-3 text-right text-green-400">{money(row.revenue)} {activeOrg.currency}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{row.occupancy}%</td>
                    <td className="px-4 py-3 text-right text-slate-300">{durationToText(row.avgTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold text-white">Аналитика боксов</h3></div>
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs text-slate-400">Бокс</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Машин</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Загрузка</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400">Простой</th>
                </tr>
              </thead>
              <tbody>
                {boxesAnalytics.map(row => (
                  <tr key={row.boxId} className="border-b border-white/3">
                    <td className="px-4 py-3 text-white">{row.boxName}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{row.cars}</td>
                    <td className="px-4 py-3 text-right text-cyan-400">{row.occupancy}%</td>
                    <td className="px-4 py-3 text-right text-slate-300">{durationToText(row.idleMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Клиенты (по госномеру)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={clientsAnalytics.slice(0, 8).map(client => ({ name: client.plate, visits: client.visits, revenue: Math.round(client.revenue) }))}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="visits" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});
