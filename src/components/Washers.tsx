import { useEffect, useMemo, useState } from 'react';
import {
  Organization,
  Washer,
  Box,
  Order,
  WorkerTimelog,
  WasherStatus,
  ShiftStatus,
  generateId,
} from '../types';
import {
  addWasher,
  updateWasher,
  deleteWasher,
  getBoxes,
  getOrders,
  getWashers,
  getShifts,
  addShift,
  deleteShift,
  getWasherShiftDays,
  getWasherShiftDaysForDate,
  getWasherCurrentStatuses,
  addOrUpdateWasherCurrentStatus,
  updateWasherShiftDay,
  getWorkerTimelogs,
  getWorkerTimelogsForWasher,
  addCashOperation,
  addActionLog,
  getWorkerNotifications,
  addWorkerNotification,
} from '../store';
import { format, parseISO, subDays } from 'date-fns';
import ShiftStartModal from './ShiftStartModal';
import WasherAnalytics from './WasherAnalytics';
import WorkerProfileCard from './WorkerProfileCard';
import AttendanceTable from './AttendanceTable';
import PaginationControl from './PaginationControl';
import { calculatePagination } from '../utils/pagination';

interface WashersProps {
  activeOrg: Organization;
  userRole: 'admin' | 'manager';
}

type Tab = 'overview' | 'shifts' | 'history' | 'salary' | 'analytics';

const WORKER_STATUS_LABELS: Record<WasherStatus, string> = {
  free: 'Свободен',
  working: 'В работе',
  break: 'Перерыв',
  absent: 'Отсутствует',
  vacation: 'Выходной',
  sick: 'Больничный',
};

const WORKER_STATUS_CLASSES: Record<WasherStatus, string> = {
  free: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
  working: 'bg-green-500/10 border-green-500/20 text-green-400',
  break: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  absent: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
  vacation: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  sick: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
};

const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  working: 'Работает',
  absent: 'Отсутствует',
  vacation: 'Выходной',
  sick: 'Больничный',
};

const SHIFT_STATUS_CLASSES: Record<ShiftStatus, string> = {
  working: 'bg-green-500/10 border-green-500/20 text-green-400',
  absent: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
  vacation: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  sick: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
};

function formatMaybeTime(value?: string): string {
  return value ? format(parseISO(value), 'HH:mm') : '—';
}

function money(n: number) {
  return Math.round(n).toLocaleString('ru-RU');
}

function getCurrentStatusLabel(status?: WasherStatus): string {
  return status ? WORKER_STATUS_LABELS[status] : 'Смена не открыта';
}

export default function Washers({ activeOrg, userRole }: WashersProps) {
  const canEdit = userRole === 'manager';
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>('overview');
  const [showAdd, setShowAdd] = useState(false);
  const [editWasher, setEditWasher] = useState<Washer | null>(null);
  const [showShiftStart, setShowShiftStart] = useState(false);
  const [showSalary, setShowSalary] = useState<string | null>(null);
  const [salaryMonth, setSalaryMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [historyWasherId, setHistoryWasherId] = useState('');
  const [historyFrom, setHistoryFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [historyTo, setHistoryTo] = useState(todayKey);
  const [analyticsWasherId, setAnalyticsWasherId] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WasherStatus>('all');
  const [sortBy, setSortBy] = useState<'name' | 'cars' | 'earnings'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [washersCurrentPage, setWashersCurrentPage] = useState(1);
  const [washersPageSize, setWashersPageSize] = useState(25);

  const refresh = () => setVersion(prev => prev + 1);

  useEffect(() => {
    const handleStoreChanged = () => setVersion(prev => prev + 1);
    window.addEventListener('wd-store-changed', handleStoreChanged);
    return () => window.removeEventListener('wd-store-changed', handleStoreChanged);
  }, []);

  const washers = useMemo(() => getWashers(activeOrg.id), [activeOrg.id, version]);
  const boxes = useMemo(() => getBoxes(activeOrg.id), [activeOrg.id, version]);
  const orders = useMemo(() => getOrders(activeOrg.id), [activeOrg.id, version]);
  const salaryShifts = useMemo(() => getShifts(activeOrg.id), [activeOrg.id, version]);
  const shiftDaysToday = useMemo(() => getWasherShiftDaysForDate(activeOrg.id, todayKey), [activeOrg.id, todayKey, version]);
  const shiftDaysAll = useMemo(() => getWasherShiftDays(activeOrg.id), [activeOrg.id, version]);
  const currentStatuses = useMemo(() => getWasherCurrentStatuses(activeOrg.id), [activeOrg.id, version]);
  const workerTimelogs = useMemo(() => getWorkerTimelogs(activeOrg.id), [activeOrg.id, version]);

  useEffect(() => {
    if (washers.length === 0) return;
    if (!historyWasherId || !washers.some(w => w.id === historyWasherId)) {
      setHistoryWasherId(washers[0].id);
    }
    if (!analyticsWasherId || !washers.some(w => w.id === analyticsWasherId)) {
      setAnalyticsWasherId(washers[0].id);
    }
  }, [washers, historyWasherId, analyticsWasherId]);

  const washersById = useMemo(() => new Map(washers.map(w => [w.id, w])), [washers]);
  const boxesById = useMemo(() => new Map(boxes.map(b => [b.id, b])), [boxes]);
  const shiftDaysByWasherId = useMemo(() => new Map(shiftDaysToday.map(day => [day.washerId, day])), [shiftDaysToday]);
  const currentStatusByWasherId = useMemo(
    () => new Map(currentStatuses.filter(status => status.date === todayKey).map(status => [status.washerId, status])),
    [currentStatuses, todayKey]
  );

  const notifications = useMemo(() => getWorkerNotifications(activeOrg.id), [activeOrg.id, version]);
  const unreadNotifications = useMemo(() => notifications.filter(n => !n.read), [notifications]);

  const selectedWorker = selectedWorkerId ? washersById.get(selectedWorkerId) : null;
  const selectedWorkerCurrentStatus = selectedWorkerId ? currentStatusByWasherId.get(selectedWorkerId) : undefined;
  const selectedWorkerTimelogs = useMemo(
    () => (selectedWorkerId ? workerTimelogs.filter(log => log.washerId === selectedWorkerId) : []),
    [workerTimelogs, selectedWorkerId]
  );
  const selectedWorkerOrders = useMemo(
    () => (selectedWorkerId ? orders.filter(order => order.washerId === selectedWorkerId || order.washerIds?.includes(selectedWorkerId)) : []),
    [orders, selectedWorkerId]
  );
  const selectedWorkerSalaryShifts = useMemo(
    () => (selectedWorkerId ? salaryShifts.filter(shift => shift.washerId === selectedWorkerId) : []),
    [salaryShifts, selectedWorkerId]
  );
  const selectedWorkerShiftDays = useMemo(
    () => (selectedWorkerId ? shiftDaysAll.filter(day => day.washerId === selectedWorkerId) : []),
    [shiftDaysAll, selectedWorkerId]
  );

  const activeOrderByWasherId = useMemo(() => {
    const map = new Map<string, Order>();
    orders.filter(order => order.status === 'in_progress').forEach(order => {
      const washerIds = order.washerIds?.length ? order.washerIds : order.washerId ? [order.washerId] : [];
      washerIds.forEach(id => map.set(id, order));
    });
    return map;
  }, [orders]);

  const todayLogsByWasherId = useMemo(() => {
    const map = new Map<string, WorkerTimelog[]>();
    workerTimelogs.filter(log => log.date === todayKey).forEach(log => {
      const list = map.get(log.washerId) || [];
      list.push(log);
      map.set(log.washerId, list);
    });
    return map;
  }, [workerTimelogs, todayKey]);

  const overviewWashers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return washers
      .map(washer => {
        const currentStatus = currentStatusByWasherId.get(washer.id);
        const shiftDay = shiftDaysByWasherId.get(washer.id);
        const todayLogs = todayLogsByWasherId.get(washer.id) || [];
        const todayEarnings = todayLogs.reduce((sum, log) => sum + log.washerShare, 0);
        const statusValue = currentStatus?.status || (shiftDay?.status === 'working' ? 'free' : 'absent');
        return { washer, todayEarnings, todayCars: todayLogs.length, statusValue };
      })
      .filter(item => {
        if (query && !item.washer.name.toLowerCase().includes(query) && !(item.washer.phone || '').toLowerCase().includes(query)) {
          return false;
        }
        if (statusFilter !== 'all' && item.statusValue !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'cars') {
          return sortDirection === 'asc' ? a.todayCars - b.todayCars : b.todayCars - a.todayCars;
        }
        if (sortBy === 'earnings') {
          return sortDirection === 'asc' ? a.todayEarnings - b.todayEarnings : b.todayEarnings - a.todayEarnings;
        }
        return sortDirection === 'asc'
          ? a.washer.name.localeCompare(b.washer.name)
          : b.washer.name.localeCompare(a.washer.name);
      })
      .map(item => item.washer);
  }, [washers, currentStatusByWasherId, shiftDaysByWasherId, todayLogsByWasherId, searchQuery, statusFilter, sortBy, sortDirection]);

  const historyLogs = useMemo(() => {
    if (!historyWasherId) return [] as WorkerTimelog[];
    return getWorkerTimelogsForWasher(activeOrg.id, historyWasherId, historyFrom, historyTo).sort((a, b) => {
      const aKey = `${a.date} ${a.endTime || a.startTime}`;
      const bKey = `${b.date} ${b.endTime || b.startTime}`;
      return bKey.localeCompare(aKey);
    });
  }, [activeOrg.id, historyWasherId, historyFrom, historyTo, version]);

  const salaryData = useMemo(() => {
    return washers.map(washer => {
      const wShifts = salaryShifts.filter(shift => shift.washerId === washer.id && shift.date.startsWith(salaryMonth));
      const totalDays = wShifts.length;
      const totalBase = wShifts.reduce((sum, shift) => sum + shift.dailyRate, 0);
      const totalBonus = wShifts.reduce((sum, shift) => sum + shift.bonus, 0);
      const totalPenalty = wShifts.reduce((sum, shift) => sum + shift.penalty, 0);
      const totalOrders = wShifts.reduce((sum, shift) => sum + shift.ordersCompleted, 0);
      const totalPayout = totalBase + totalBonus - totalPenalty;

      return { washer, totalDays, totalBase, totalBonus, totalPenalty, totalOrders, totalPayout, wShifts };
    });
  }, [washers, salaryShifts, salaryMonth]);

  const historySummary = useMemo(() => {
    const totalOrders = new Set(historyLogs.map(log => log.orderId)).size;
    const totalEarnings = historyLogs.reduce((sum, log) => sum + log.washerShare, 0);
    const totalMinutes = historyLogs.reduce((sum, log) => sum + (log.durationMinutes || 0), 0);
    const carsCount = new Set(historyLogs.map(log => log.licensePlate)).size;
    return { totalOrders, totalEarnings, totalMinutes, carsCount };
  }, [historyLogs]);

  const handleAddWasher = (
    name: string,
    phone: string,
    dailyRate: number,
    primaryBoxId?: string,
    payMode?: 'percent' | 'salary' | 'mixed' | 'fixed',
    payPercent?: number,
    paySalaryAmount?: number,
    payFixedAmount?: number,
  ) => {
    const washerId = generateId();
    addWasher({
      id: washerId,
      name,
      phone: phone || undefined,
      organizationId: activeOrg.id,
      dailyRate,
      primaryBoxId: primaryBoxId || undefined,
      payMode,
      payPercent,
      paySalaryAmount,
      payFixedAmount,
      createdAt: new Date().toISOString(),
    });
    addActionLog({
      id: generateId(),
      organizationId: activeOrg.id,
      performedBy: userRole === 'manager' ? 'Менеджер' : 'Админ',
      action: 'create_worker',
      targetType: 'worker',
      targetId: washerId,
      targetName: name,
      description: `Сотрудник ${name} добавлен в систему`,
      createdAt: new Date().toISOString(),
    });
    if (!primaryBoxId) {
      addWorkerNotification({
        id: generateId(),
        organizationId: activeOrg.id,
        workerId: washerId,
        type: 'free_box',
        message: `Сотруднику ${name} не назначен основной бокс`,
        severity: 'warning',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
    setShowAdd(false);
    refresh();
  };

  const handleUpdateWasher = (washer: Washer) => {
    const before = washersById.get(washer.id);
    updateWasher(washer);
    setEditWasher(null);
    addActionLog({
      id: generateId(),
      organizationId: activeOrg.id,
      performedBy: userRole === 'manager' ? 'Менеджер' : 'Админ',
      action: 'update_worker',
      targetType: 'worker',
      targetId: washer.id,
      targetName: washer.name,
      changes: {
        dailyRate: { oldValue: before?.dailyRate ?? 0, newValue: washer.dailyRate },
        payMode: { oldValue: before?.payMode ?? 'percent', newValue: washer.payMode ?? 'percent' },
        payPercent: { oldValue: before?.payPercent ?? 0, newValue: washer.payPercent ?? 0 },
        paySalaryAmount: { oldValue: before?.paySalaryAmount ?? 0, newValue: washer.paySalaryAmount ?? 0 },
        payFixedAmount: { oldValue: before?.payFixedAmount ?? 0, newValue: washer.payFixedAmount ?? 0 },
      },
      description: `Обновлены данные сотрудника ${washer.name}`,
      createdAt: new Date().toISOString(),
    });
    refresh();
  };

  const handleDeleteWasher = (id: string) => {
    const washer = washersById.get(id);
    if (!washer) return;
    if (!confirm('Удалить сотрудника?')) return;
    deleteWasher(id);
    addActionLog({
      id: generateId(),
      organizationId: activeOrg.id,
      performedBy: userRole === 'manager' ? 'Менеджер' : 'Админ',
      action: 'delete_worker',
      targetType: 'worker',
      targetId: id,
      targetName: washer.name,
      description: `Сотрудник ${washer.name} удалён из системы`,
      createdAt: new Date().toISOString(),
    });
    refresh();
  };

  const handleTemporaryBoxChange = (washerId: string, boxId: string) => {
    const washer = washersById.get(washerId);
    if (!washer) return;

    const now = new Date().toISOString();
    const shift = shiftDaysByWasherId.get(washerId);
    const current = currentStatusByWasherId.get(washerId);
    const activeOrder = activeOrderByWasherId.get(washerId);

    const nextStatus: WasherStatus = activeOrder ? 'working' : current?.status || (shift?.status === 'working' ? 'free' : 'free');

    addOrUpdateWasherCurrentStatus({
      id: current?.id || generateId(),
      washerId,
      organizationId: activeOrg.id,
      date: todayKey,
      status: nextStatus,
      currentOrderId: activeOrder?.id,
      currentBoxId: boxId || washer.primaryBoxId,
      updatedAt: now,
    });
    addActionLog({
      id: generateId(),
      organizationId: activeOrg.id,
      performedBy: userRole === 'manager' ? 'Менеджер' : 'Админ',
      action: 'assign_box',
      targetType: 'worker',
      targetId: washerId,
      targetName: washer.name,
      description: `Сотруднику ${washer.name} назначен бокс ${boxId || washer.primaryBoxId || '—'}`,
      createdAt: now,
    });
    refresh();
  };

  const handleCloseShiftDay = () => {
    if (!confirm('Закрыть рабочий день для сегодняшней смены?')) return;

    const now = new Date().toISOString();
    shiftDaysToday.forEach(day => {
      if (day.status === 'working' && !day.endedAt) {
        updateWasherShiftDay({ ...day, endedAt: now });
      }

      const current = currentStatusByWasherId.get(day.washerId);
      const washer = washersById.get(day.washerId);
      if (!current || !washer) return;

      addOrUpdateWasherCurrentStatus({
        id: current.id,
        washerId: day.washerId,
        organizationId: activeOrg.id,
        date: todayKey,
        status: day.status === 'working' ? 'free' : current.status,
        currentOrderId: undefined,
        currentBoxId: washer.primaryBoxId,
        updatedAt: now,
      });

      if (day.status === 'absent') {
        addWorkerNotification({
          id: generateId(),
          organizationId: activeOrg.id,
          workerId: day.washerId,
          type: 'absent',
          message: `Сотрудник ${day.washerName} отсутствовал сегодня`,
          severity: 'warning',
          read: false,
          createdAt: now,
        });
      }
    });

    addActionLog({
      id: generateId(),
      organizationId: activeOrg.id,
      performedBy: userRole === 'manager' ? 'Менеджер' : 'Админ',
      action: 'close_shift',
      targetType: 'shift',
      targetId: todayKey,
      targetName: `Закрытие смены ${todayKey}`,
      description: `Рабочий день ${todayKey} закрыт`,
      createdAt: now,
    });

    refresh();
  };

  const handleAddShift = (washerId: string, washerName: string, dailyRate: number, date: string, bonus: number, penalty: number) => {
    const shiftId = generateId();
    const completedOrders = orders.filter(order => order.washerId === washerId && order.status === 'completed' && order.createdAt.startsWith(date)).length;
    addShift({
      id: shiftId,
      washerId,
      washerName,
      organizationId: activeOrg.id,
      date,
      dailyRate,
      bonus,
      penalty,
      ordersCompleted: completedOrders,
    });
    addActionLog({
      id: generateId(),
      organizationId: activeOrg.id,
      performedBy: userRole === 'manager' ? 'Менеджер' : 'Админ',
      action: 'create_shift',
      targetType: 'shift',
      targetId: shiftId,
      targetName: `${washerName} — ${date}`,
      changes: {
        bonus: { oldValue: 0, newValue: bonus },
        penalty: { oldValue: 0, newValue: penalty },
      },
      description: `Добавлена смена для ${washerName} на ${date}`,
      createdAt: new Date().toISOString(),
    });
    if (bonus > 0) {
      addWorkerNotification({
        id: generateId(),
        organizationId: activeOrg.id,
        workerId: washerId,
        type: 'payment_issue',
        message: `Сотруднику ${washerName} добавлен бонус +${bonus}`,
        severity: 'info',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
    if (penalty > 0) {
      addWorkerNotification({
        id: generateId(),
        organizationId: activeOrg.id,
        workerId: washerId,
        type: 'payment_issue',
        message: `Сотруднику ${washerName} начислен штраф -${penalty}`,
        severity: 'warning',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
    refresh();
  };

  const handleSalaryPayout = (washerId: string, amount: number, monthLabel: string) => {
    const washer = washersById.get(washerId);
    if (!washer) return;
    const now = new Date().toISOString();
    addCashOperation({
      id: generateId(),
      organizationId: activeOrg.id,
      employeeName: userRole === 'manager' ? 'Менеджер' : 'Админ',
      performedBy: userRole === 'manager' ? 'Менеджер' : 'Админ',
      createdAt: now,
      amount,
      direction: 'expense',
      type: 'expense_payout',
      paymentMethod: 'Наличные',
      description: `Выплата зарплаты ${washer.name} за ${monthLabel}`,
      orderId: undefined,
    });
    addActionLog({
      id: generateId(),
      organizationId: activeOrg.id,
      performedBy: userRole === 'manager' ? 'Менеджер' : 'Админ',
      action: 'salary_payout',
      targetType: 'worker',
      targetId: washerId,
      targetName: washer.name,
      description: `Выплачена зарплата ${money(amount)} за ${monthLabel}`,
      createdAt: now,
    });
    addWorkerNotification({
      id: generateId(),
      organizationId: activeOrg.id,
      workerId: washerId,
      type: 'payment_issue',
      message: `Выплачена зарплата ${washer.name} за ${monthLabel}: ${money(amount)}`,
      severity: 'info',
      read: false,
      createdAt: now,
    });
    refresh();
  };

  const handleDeleteShift = (id: string) => {
    deleteShift(id);
    refresh();
  };

  const selectedHistoryWasher = washersById.get(historyWasherId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Сотрудники</h1>
          <p className="text-xs text-slate-500 mt-1">Смены, боксы, история и карточки работников</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['overview', 'shifts', 'history', 'salary', 'analytics'] as const).map(currentTab => (
            <button
              key={currentTab}
              onClick={() => setTab(currentTab)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${tab === currentTab ? 'btn-neon' : 'text-slate-400 hover:text-white'}`}
            >
              {currentTab === 'overview' && '👷 Сотрудники'}
              {currentTab === 'shifts' && '📅 Смены'}
              {currentTab === 'history' && '🕘 История'}
              {currentTab === 'salary' && '💵 Зарплата'}
              {currentTab === 'analytics' && '📈 Аналитика'}
            </button>
          ))}

          {canEdit && tab === 'overview' && (
            <button onClick={() => setShowAdd(true)} className="btn-neon rounded-lg px-4 py-2 text-sm font-medium">+ Добавить</button>
          )}

          {tab === 'shifts' && canEdit && (
            <>
              <button onClick={() => setShowShiftStart(true)} className="btn-neon rounded-lg px-4 py-2 text-sm font-medium">📅 Открыть день</button>
              <button onClick={handleCloseShiftDay} className="btn-success rounded-lg px-4 py-2 text-sm font-medium">✅ Закрыть день</button>
            </>
          )}
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <div className="space-y-4">
            <div className="glass rounded-xl p-4 grid gap-3 sm:grid-cols-[1fr,180px,180px,120px] items-end">
              <div>
                <label className="text-xs text-slate-400">Поиск</label>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Имя или телефон"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Статус</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | WasherStatus)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
                >
                  <option value="all">Все</option>
                  <option value="free">Свободен</option>
                  <option value="working">В работе</option>
                  <option value="break">Перерыв</option>
                  <option value="absent">Отсутствует</option>
                  <option value="vacation">Выходной</option>
                  <option value="sick">Больничный</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Сортировка</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as 'name' | 'cars' | 'earnings')}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
                >
                  <option value="name">Имя</option>
                  <option value="cars">Машин</option>
                  <option value="earnings">Доход</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Порядок</label>
                <button
                  onClick={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
                >
                  {sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr,320px] gap-4">
            <AttendanceTable
              washers={overviewWashers}
              currentStatuses={currentStatuses}
              shiftDaysToday={shiftDaysToday}
              boxes={boxes}
              todayLogsByWasherId={todayLogsByWasherId}
              activeOrderByWasherId={activeOrderByWasherId}
              onWorkerClick={washer => setSelectedWorkerId(washer.id)}
            />
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Уведомления</h3>
                  <p className="text-xs text-slate-500">Новые события и предупреждения</p>
                </div>
                <span className="text-xs text-slate-400">{unreadNotifications.length} новых</span>
              </div>
              {notifications.length === 0 ? (
                <p className="text-slate-500 text-sm">Нет уведомлений</p>
              ) : (
                <div className="space-y-3">
                  {notifications.slice(0, 5).map(note => {
                    const className = 'p-3 rounded-xl border ' + (note.read ? 'border-white/10 bg-white/5' : 'border-cyan-500/20 bg-cyan-500/5');
                    const severityLabel = note.severity === 'error' ? 'Ошибка' : note.severity === 'warning' ? 'Внимание' : 'Инфо';
                    return (
                      <div key={note.id} className={className}>
                        <p className="text-sm text-white">{note.message}</p>
                        <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between gap-2">
                          <span>{severityLabel}</span>
                          <span>{format(parseISO(note.createdAt), 'dd.MM HH:mm')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {overviewWashers.map(washer => {
            const shiftDay = shiftDaysByWasherId.get(washer.id);
            const currentStatus = currentStatusByWasherId.get(washer.id);
            const activeOrder = activeOrderByWasherId.get(washer.id);
            const todayLogs = todayLogsByWasherId.get(washer.id) || [];
            const todayCarsCount = new Set(todayLogs.map(log => log.orderId)).size;
            const todayEarnings = todayLogs.reduce((sum, log) => sum + log.washerShare, 0);
            const currentBox = boxesById.get(currentStatus?.currentBoxId || washer.primaryBoxId || '');
            const primaryBox = boxesById.get(washer.primaryBoxId || '');
            const currentStatusValue = shiftDay ? (currentStatus?.status || (shiftDay.status === 'working' ? 'free' : shiftDay.status)) : undefined;

            return (
              <div key={washer.id} className="glass rounded-xl p-5 card-hover animate-fadeIn">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg" style={{
                      background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))',
                      border: '1px solid rgba(0,212,255,0.2)',
                    }}>👷</div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold">{washer.name}</h3>
                        <span className={`text-[10px] px-2 py-1 rounded-full border ${currentStatusValue ? WORKER_STATUS_CLASSES[currentStatusValue] : 'bg-white/5 border-white/10 text-slate-500'}`}>
                          {getCurrentStatusLabel(currentStatusValue)}
                        </span>
                      </div>
                      {washer.phone && <p className="text-xs text-slate-400 mt-1">{washer.phone}</p>}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => setEditWasher(washer)} className="text-xs text-slate-400 hover:text-cyan-400 transition-colors">✎</button>
                      <button onClick={() => handleDeleteWasher(washer.id)} className="text-xs text-slate-400 hover:text-red-400 transition-colors">✕</button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-4">
                  <div>
                    <p className="text-xs text-slate-400">Ставка</p>
                    <p className="text-sm text-cyan-400 font-medium">{washer.dailyRate.toLocaleString('ru-RU')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Сегодня машин</p>
                    <p className="text-sm text-green-400 font-medium">{todayCarsCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Сегодня заработок</p>
                    <p className="text-sm text-purple-400 font-medium">{todayEarnings.toLocaleString('ru-RU')} {activeOrg.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Активный заказ</p>
                    <p className="text-sm text-amber-400 font-medium">{activeOrder ? activeOrder.licensePlate : '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-white/3 border border-white/5 p-3">
                    <p className="text-slate-400 mb-1">Основной бокс</p>
                    <p className="text-white font-medium">{primaryBox?.name || 'Не назначен'}</p>
                  </div>
                  <div className="rounded-lg bg-white/3 border border-white/5 p-3">
                    <p className="text-slate-400 mb-1">Текущий бокс</p>
                    <p className="text-white font-medium">{currentBox?.name || 'Не назначен'}</p>
                  </div>
                </div>

                {activeOrder && (
                  <div className="mt-4 rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-3 text-xs text-slate-300">
                    <p className="font-medium text-cyan-400 mb-1">Сейчас в работе</p>
                    <p>Авто: <span className="text-white">{activeOrder.licensePlate}</span></p>
                    <p>Бокс: <span className="text-white">{activeOrder.boxName || '—'}</span></p>
                  </div>
                )}

                {canEdit && shiftDay?.status === 'working' && boxes.length > 0 && (
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <label className="text-xs text-slate-400">Временный бокс</label>
                    <select
                      value={currentStatus?.currentBoxId || washer.primaryBoxId || ''}
                      onChange={e => handleTemporaryBoxChange(washer.id, e.target.value)}
                      className="input-neon rounded-lg px-3 py-2 text-xs min-w-44"
                    >
                      <option value={washer.primaryBoxId || ''}>Основной бокс{primaryBox ? `: ${primaryBox.name}` : ''}</option>
                      {boxes.filter(box => box.id !== washer.primaryBoxId).map(box => <option key={box.id} value={box.id}>{box.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setSelectedWorkerId(washer.id)}
                    className="text-xs rounded-lg border border-cyan-500/20 px-3 py-2 text-cyan-400 hover:bg-cyan-500/10 transition"
                  >
                    Открыть профиль
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </>
      )}

      {tab === 'shifts' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">Работают</p>
              <p className="text-2xl font-bold text-green-400">{shiftDaysToday.filter(day => day.status === 'working').length}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">Отсутствуют</p>
              <p className="text-2xl font-bold text-slate-300">{shiftDaysToday.filter(day => day.status === 'absent').length}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">Выходной</p>
              <p className="text-2xl font-bold text-blue-400">{shiftDaysToday.filter(day => day.status === 'vacation').length}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">Больничный</p>
              <p className="text-2xl font-bold text-orange-400">{shiftDaysToday.filter(day => day.status === 'sick').length}</p>
            </div>
          </div>

          <div className="glass rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-white">Журнал смен на сегодня</h3>
                <p className="text-xs text-slate-500 mt-1">Кто вышел, кто отсутствует и время открытия/закрытия смены</p>
              </div>
              <button onClick={() => setShowShiftStart(true)} className="btn-neon rounded-lg px-4 py-2 text-sm font-medium">Открыть рабочий день</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Сотрудник</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Статус</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Начало</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Окончание</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Бокс</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Активный заказ</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const { items: paginatedWashers } = calculatePagination(washers, washersPageSize, washersCurrentPage);
                    if (paginatedWashers.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                            {washers.length === 0 ? 'Мойщиков нет' : 'Нет мойщиков на этой странице'}
                          </td>
                        </tr>
                      );
                    }
                    return paginatedWashers.map(washer => {
                      const day = shiftDaysByWasherId.get(washer.id);
                      const current = currentStatusByWasherId.get(washer.id);
                      const activeOrder = activeOrderByWasherId.get(washer.id);
                      const currentBox = boxesById.get(current?.currentBoxId || washer.primaryBoxId || '');

                      return (
                        <tr key={washer.id} className="border-b border-white/3">
                          <td className="px-4 py-3 text-white font-medium">{washer.name}</td>
                          <td className="px-4 py-3">
                            {day ? (
                              <span className={`text-[10px] px-2 py-1 rounded-full border ${SHIFT_STATUS_CLASSES[day.status]}`}>{SHIFT_STATUS_LABELS[day.status]}</span>
                            ) : (
                              <span className="text-[10px] px-2 py-1 rounded-full border bg-white/5 border-white/10 text-slate-500">Нет записи</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{formatMaybeTime(day?.startedAt)}</td>
                          <td className="px-4 py-3 text-slate-300">{formatMaybeTime(day?.endedAt)}</td>
                          <td className="px-4 py-3 text-slate-300">{currentBox?.name || '—'}</td>
                          <td className="px-4 py-3 text-slate-300">{activeOrder?.licensePlate || '—'}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            
            {/* Pagination for washers */}
            {washers.length > 0 && (
              <div className="px-4 py-4 border-t border-white/10">
                <PaginationControl
                  currentPage={washersCurrentPage}
                  totalPages={Math.ceil(washers.length / washersPageSize)}
                  onPageChange={setWashersCurrentPage}
                  pageSize={washersPageSize}
                  onPageSizeChange={setWashersPageSize}
                  totalItems={washers.length}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center gap-3">
            <select value={historyWasherId} onChange={e => setHistoryWasherId(e.target.value)} className="input-neon rounded-lg px-4 py-2 text-sm">
              {washers.map(washer => <option key={washer.id} value={washer.id}>{washer.name}</option>)}
            </select>
            <input type="date" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} className="input-neon rounded-lg px-4 py-2 text-sm" />
            <input type="date" value={historyTo} onChange={e => setHistoryTo(e.target.value)} className="input-neon rounded-lg px-4 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400 mb-1">Заказы</p><p className="text-2xl font-bold text-cyan-400">{historySummary.totalOrders}</p></div>
            <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400 mb-1">Машин</p><p className="text-2xl font-bold text-green-400">{historySummary.carsCount}</p></div>
            <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400 mb-1">Время</p><p className="text-2xl font-bold text-purple-400">{Math.round(historySummary.totalMinutes / 60)}ч</p></div>
            <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400 mb-1">Заработок</p><p className="text-2xl font-bold text-amber-400">{historySummary.totalEarnings.toLocaleString('ru-RU')}</p></div>
          </div>

          <div className="glass rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-white">История работы</h3>
                <p className="text-xs text-slate-500 mt-1">{selectedHistoryWasher?.name || 'Сотрудник не выбран'}</p>
              </div>
              <div className="text-xs text-slate-500">{historyFrom} → {historyTo}</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Дата</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Заказ</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Начало</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Окончание</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Длительность</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Заработок</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Бокс</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Коллеги</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Нет выполненных заказов за выбранный период</td></tr>
                  ) : historyLogs.map(log => (
                    <tr key={log.id} className="border-b border-white/3">
                      <td className="px-4 py-3 text-slate-300">{format(parseISO(log.date), 'dd.MM.yyyy')}</td>
                      <td className="px-4 py-3 text-white">
                        <div className="font-medium">{log.licensePlate}</div>
                        <div className="text-xs text-slate-500">{log.carTypeName}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{log.services.join(', ')}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{log.startTime}</td>
                      <td className="px-4 py-3 text-slate-300">{log.endTime || '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{log.durationMinutes ? `${log.durationMinutes} мин` : '—'}</td>
                      <td className="px-4 py-3 text-cyan-400 font-medium">{log.washerShare.toLocaleString('ru-RU')}</td>
                      <td className="px-4 py-3 text-slate-300">{log.boxName || '—'}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{log.coworkers.length > 0 ? log.coworkers.join(', ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'salary' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm text-slate-400">Месяц:</label>
            <input type="month" value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)} className="input-neon rounded-lg px-4 py-2 text-sm" />
          </div>

          <div className="glass rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Сотрудник</th>
                    <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Дней</th>
                    <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">База</th>
                    <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Премии</th>
                    <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Штрафы</th>
                    <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Заказов</th>
                    <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">К выплате</th>
                    <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryData.map(entry => (
                    <tr key={entry.washer.id} className="border-b border-white/3">
                      <td className="px-4 py-3 text-white font-medium">{entry.washer.name}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{entry.totalDays}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{entry.totalBase.toLocaleString('ru-RU')}</td>
                      <td className="px-4 py-3 text-center text-green-400">+{entry.totalBonus.toLocaleString('ru-RU')}</td>
                      <td className="px-4 py-3 text-center text-red-400">-{entry.totalPenalty.toLocaleString('ru-RU')}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{entry.totalOrders}</td>
                      <td className="px-4 py-3 text-center text-cyan-400 font-bold">{entry.totalPayout.toLocaleString('ru-RU')} {activeOrg.currency}</td>
                      <td className="px-4 py-3 text-center space-y-2">
                        {canEdit && (
                          <>
                            <button onClick={() => setShowSalary(entry.washer.id)} className="text-[10px] px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors">+ Смена</button>
                            <button onClick={() => handleSalaryPayout(entry.washer.id, entry.totalPayout, salaryMonth)} className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors">Выплатить</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {salaryData.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Нет данных</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {washers.map(washer => {
            const wShifts = salaryShifts.filter(shift => shift.washerId === washer.id && shift.date.startsWith(salaryMonth)).sort((a, b) => b.date.localeCompare(a.date));
            if (wShifts.length === 0) return null;

            return (
              <div key={washer.id} className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">{washer.name} — Смены</h3>
                <div className="space-y-2">
                  {wShifts.map(shift => (
                    <div key={shift.id} className="flex items-center justify-between text-xs py-2 border-b border-white/3 last:border-0">
                      <span className="text-slate-300">{shift.date}</span>
                      <div className="flex items-center gap-4 flex-wrap justify-end">
                        <span className="text-slate-400">Ставка: {shift.dailyRate.toLocaleString('ru-RU')}</span>
                        {shift.bonus > 0 && <span className="text-green-400">+{shift.bonus.toLocaleString('ru-RU')}</span>}
                        {shift.penalty > 0 && <span className="text-red-400">-{shift.penalty.toLocaleString('ru-RU')}</span>}
                        <span className="text-slate-400">Заказов: {shift.ordersCompleted}</span>
                        <span className="text-cyan-400 font-medium">{(shift.dailyRate + shift.bonus - shift.penalty).toLocaleString('ru-RU')}</span>
                        {canEdit && <button onClick={() => handleDeleteShift(shift.id)} className="text-red-400/50 hover:text-red-400">✕</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-slate-400">Сотрудник:</label>
            <select value={analyticsWasherId} onChange={e => setAnalyticsWasherId(e.target.value)} className="input-neon rounded-lg px-4 py-2 text-sm">
              {washers.map(washer => <option key={washer.id} value={washer.id}>{washer.name}</option>)}
            </select>
          </div>

          <WasherAnalytics activeOrg={activeOrg} washerId={analyticsWasherId || washers[0]?.id} />
        </div>
      )}

      {showAdd && (
        <WasherModal boxes={boxes} onSave={handleAddWasher} onClose={() => setShowAdd(false)} defaultRate={10000} />
      )}

      {editWasher && (
        <WasherModal
          washer={editWasher}
          boxes={boxes}
          onSave={(name, phone, dailyRate, primaryBoxId, payMode, payPercent, paySalaryAmount, payFixedAmount) => handleUpdateWasher({
            ...editWasher,
            name,
            phone: phone || undefined,
            dailyRate,
            primaryBoxId,
            payMode,
            payPercent,
            paySalaryAmount,
            payFixedAmount,
          })}
          onClose={() => setEditWasher(null)}
          defaultRate={editWasher.dailyRate}
        />
      )}

      {showSalary && (
        <ShiftModal washer={washersById.get(showSalary)!} onSave={handleAddShift} onClose={() => setShowSalary(null)} />
      )}

      {selectedWorker && (
        <WorkerProfileCard
          washer={selectedWorker}
          currentStatus={selectedWorkerCurrentStatus}
          shiftDays={selectedWorkerShiftDays}
          timelogs={selectedWorkerTimelogs}
          salaryShifts={selectedWorkerSalaryShifts}
          orders={selectedWorkerOrders}
          onClose={() => setSelectedWorkerId(null)}
        />
      )}

      {showShiftStart && (
        <ShiftStartModal activeOrg={activeOrg} washers={washers} onClose={() => { setShowShiftStart(false); refresh(); }} />
      )}
    </div>
  );
}

function WasherModal({
  washer,
  boxes,
  onSave,
  onClose,
  defaultRate,
}: {
  washer?: Washer;
  boxes: Box[];
  onSave: (
    name: string,
    phone: string,
    dailyRate: number,
    primaryBoxId?: string,
    payMode?: 'percent' | 'salary' | 'mixed' | 'fixed',
    payPercent?: number,
    paySalaryAmount?: number,
    payFixedAmount?: number,
  ) => void;
  onClose: () => void;
  defaultRate: number;
}) {
  const [name, setName] = useState(washer?.name || '');
  const [phone, setPhone] = useState(washer?.phone || '');
  const [dailyRate, setDailyRate] = useState(washer?.dailyRate || defaultRate);
  const [primaryBoxId, setPrimaryBoxId] = useState(washer?.primaryBoxId || boxes[0]?.id || '');
  const [payMode, setPayMode] = useState<'percent' | 'salary' | 'mixed' | 'fixed'>(washer?.payMode || 'percent');
  const [payPercent, setPayPercent] = useState(washer?.payPercent ?? 45);
  const [paySalaryAmount, setPaySalaryAmount] = useState(washer?.paySalaryAmount ?? 0);
  const [payFixedAmount, setPayFixedAmount] = useState(washer?.payFixedAmount ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div className="modal-panel rounded-2xl p-6 w-full max-w-md mx-4 animate-fadeIn neon-glow" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">{washer ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Имя *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full input-neon rounded-lg px-4 py-2 text-sm" autoFocus />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Телефон</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Ставка за день</label>
            <input type="number" value={dailyRate} onChange={e => setDailyRate(Number(e.target.value))} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Основной бокс</label>
            <select value={primaryBoxId} onChange={e => setPrimaryBoxId(e.target.value)} className="w-full input-neon rounded-lg px-4 py-2 text-sm">
              <option value="">Не назначен</option>
              {boxes.map(box => <option key={box.id} value={box.id}>{box.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Схема оплаты</label>
            <select value={payMode} onChange={e => setPayMode(e.target.value as any)} className="w-full input-neon rounded-lg px-4 py-2 text-sm">
              <option value="percent">Процент</option>
              <option value="salary">Фиксированная зарплата</option>
              <option value="mixed">Смешанная</option>
              <option value="fixed">Фиксированная сумма за заказ</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(payMode === 'percent' || payMode === 'mixed') && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Процент</label>
                <input type="number" value={payPercent} onChange={e => setPayPercent(Number(e.target.value))} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
              </div>
            )}
            {(payMode === 'salary' || payMode === 'mixed') && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Фикс. сумма</label>
                <input type="number" value={paySalaryAmount} onChange={e => setPaySalaryAmount(Number(e.target.value))} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
              </div>
            )}
            {payMode === 'fixed' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Фикс. сумма за заказ</label>
                <input type="number" value={payFixedAmount} onChange={e => setPayFixedAmount(Number(e.target.value))} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Отмена</button>
            <button onClick={() => {
              if (!name.trim()) return;
              onSave(
                name.trim(),
                phone.trim(),
                dailyRate,
                primaryBoxId || undefined,
                payMode,
                payPercent,
                paySalaryAmount,
                payFixedAmount,
              );
            }} className="btn-neon rounded-lg px-6 py-2 text-sm font-medium">Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShiftModal({
  washer,
  onSave,
  onClose,
}: {
  washer: Washer;
  onSave: (washerId: string, washerName: string, dailyRate: number, date: string, bonus: number, penalty: number) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bonus, setBonus] = useState(0);
  const [penalty, setPenalty] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div className="modal-panel rounded-2xl p-6 w-full max-w-md mx-4 animate-fadeIn neon-glow" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">Добавить смену — {washer.name}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Дата</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Премия</label>
              <input type="number" value={bonus} onChange={e => setBonus(Number(e.target.value))} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Штраф</label>
              <input type="number" value={penalty} onChange={e => setPenalty(Number(e.target.value))} className="w-full input-neon rounded-lg px-4 py-2 text-sm" />
            </div>
          </div>

          <div className="text-sm text-slate-400">
            Ставка: <span className="text-cyan-400">{washer.dailyRate.toLocaleString('ru-RU')}</span> •
            К выплате: <span className="text-cyan-400">{(washer.dailyRate + bonus - penalty).toLocaleString('ru-RU')}</span>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Отмена</button>
            <button onClick={() => onSave(washer.id, washer.name, washer.dailyRate, date, bonus, penalty)} className="btn-neon rounded-lg px-6 py-2 text-sm font-medium">Добавить</button>
          </div>
        </div>
      </div>
    </div>
  );
}
