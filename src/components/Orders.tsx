import { useState, useMemo, useEffect } from 'react';
import { Organization, Order, OrderStatus, OrderPaymentStatus, OrderService, DirtLevel, dirtLevelLabels, Box, CashPaymentMethod, generateId, Washer, Client, PaymentPart } from '../types';
import { getOrders, addOrder, updateOrder, deleteOrder, getServices, getCarTypes, getWashers, getPrices, getShifts, addBatch, getBoxes, getWasherShiftDaysForDate, getWasherCurrentStatuses, addOrUpdateWasherCurrentStatus, calculateOrderFinancialBreakdown, calculateOrderCostBreakdown, recordOrderFinancialAccrual, recordOrderFinancialAdjustment, getFinancialSettings, upsertOrderPaymentOperation, consumeMaterialsForOrder, recalculateOrderCostFields, ensureClientAndVehicleOnOrder, createClientForOrderIfMissing, updateClientStatsAfterOrderCompletion, findVehicleByPlate, getClients, getClientRecommendationsStructured } from '../store';
import { format, startOfMonth, isSameDay, isToday, parseISO } from 'date-fns';
import PaginationControl from './PaginationControl';
import { calculatePagination } from '../utils/pagination';

interface OrdersProps {
  activeOrg: Organization;
  userRole: 'admin' | 'manager';
}

interface CompletionPaymentData {
  paymentMethod: CashPaymentMethod;
  receivedAmount?: number;
  changeAmount?: number;
  paymentParts?: PaymentPart[];
  discountAmount?: number;
  bonusApplied?: number;
  refundAmount?: number;
}

type OrderPaymentPartMethod = Exclude<CashPaymentMethod, 'Смешанная'>;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  'Наличные': 'Наличные',
  'Банковская карта': 'Карта',
  QR: 'QR',
  'Перевод': 'Перевод',
  'Бонусы': 'Бонусы',
  'Смешанная': 'Смешанная',
  'Другой': 'Другой',
  Kaspi: 'Kaspi',
  Card: 'Карта',
  cash: 'Наличные',
  card: 'Карта',
  qr: 'QR',
  transfer: 'Перевод',
  other: 'Другой',
};

function normalizeOrderPaymentMethod(method?: CashPaymentMethod): OrderPaymentPartMethod {
  switch (method) {
    case 'cash':
      return 'Наличные';
    case 'card':
    case 'Card':
      return 'Банковская карта';
    case 'Kaspi':
      return 'Kaspi';
    case 'qr':
      return 'QR';
    case 'transfer':
      return 'Перевод';
    case 'other':
      return 'Другой';
    case 'Смешанная':
      return 'Другой';
    default:
      return (method || 'Другой') as OrderPaymentPartMethod;
  }
}

function getOrderPaymentParts(order: Order): PaymentPart[] {
  const parts = (order.paymentParts || []).filter(part => part.amount > 0);
  if (parts.length > 0) {
    return parts.map(part => ({
      method: normalizeOrderPaymentMethod(part.method),
      amount: Math.round(part.amount),
    }));
  }
  return [{
    method: normalizeOrderPaymentMethod(order.paymentMethod),
    amount: Math.round(order.totalAmount || 0),
  }];
}

function getOrderPaymentLabel(order: Order): string {
  const parts = getOrderPaymentParts(order);
  if (parts.length <= 1) {
    return PAYMENT_METHOD_LABELS[parts[0]?.method || 'Другой'] || (parts[0]?.method || 'Другой');
  }
  return `Смешанная (${parts.map(part => `${PAYMENT_METHOD_LABELS[part.method] || part.method}: ${part.amount.toLocaleString('ru-RU')}`).join(', ')})`;
}

function buildOrderPaymentTotals(items: Order[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, order) => {
    getOrderPaymentParts(order).forEach(part => {
      const key = normalizeOrderPaymentMethod(part.method);
      acc[key] = (acc[key] || 0) + Math.round(part.amount);
    });
    return acc;
  }, {});
}

const paymentStatusLabels: Record<OrderPaymentStatus, string> = {
  unpaid: 'Ожидает оплаты',
  paid: 'Оплачен',
};

const statusLabels: Record<OrderStatus, string> = {
  waiting: 'Ожидание',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

const statusFlow: OrderStatus[] = ['waiting', 'in_progress', 'completed', 'cancelled'];

function getPaymentStatus(order: Order): OrderPaymentStatus {
  if (order.paymentStatus) return order.paymentStatus;
  return order.paidAt ? 'paid' : 'unpaid';
}

export default function Orders({ activeOrg, userRole }: OrdersProps) {
  const [orders, setOrders] = useState(() => getOrders(activeOrg.id));
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [todayKey, setTodayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const services = useMemo(() => getServices(activeOrg.id), [activeOrg.id]);
  const carTypes = useMemo(() => getCarTypes(activeOrg.id), [activeOrg.id]);
  const washers = useMemo(() => getWashers(activeOrg.id), [activeOrg.id]);
  const prices = useMemo(() => getPrices(activeOrg.id), [activeOrg.id]);
  const shifts = useMemo(() => getShifts(activeOrg.id), [activeOrg.id]);
  const boxes = useMemo(() => getBoxes(activeOrg.id), [activeOrg.id]);

  const refresh = () => setOrders(getOrders(activeOrg.id));

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowCalendar(true);
      }
      if (e.key === 'Escape') {
        setShowCalendar(false);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = format(new Date(), 'yyyy-MM-dd');
      setTodayKey(prev => {
        if (prev !== now) {
          if (selectedDate === prev) {
            setSelectedDate(now);
          }
          return now;
        }
        return prev;
      });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [selectedDate]);

  const ordersForDate = useMemo(() => {
    return orders.filter(o => isSameDay(new Date(o.createdAt), parseISO(selectedDate)));
  }, [orders, selectedDate]);

  const filtered = useMemo(() => {
    let result = [...ordersForDate].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o => o.licensePlate.toLowerCase().includes(q) || o.carTypeName.toLowerCase().includes(q) || o.washerName?.toLowerCase().includes(q));
    }
    if (filterStatus) result = result.filter(o => o.status === filterStatus);
    return result;
  }, [ordersForDate, search, filterStatus]);

  const filteredStats = useMemo(() => {
    const waiting = filtered.filter(o => o.status === 'waiting').length;
    const inProgress = filtered.filter(o => o.status === 'in_progress').length;
    const completed = filtered.filter(o => o.status === 'completed').length;
    const completedSum = filtered.reduce((sum, o) => sum + o.totalAmount, 0);
    return { waiting, inProgress, completed, completedSum };
  }, [filtered]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, selectedDate]);

  const handleStatusChange = (order: Order, newStatus: OrderStatus, payment?: CompletionPaymentData) => {
    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');
    const isNewCompletion = order.status !== 'completed' && newStatus === 'completed';
    const nextPaymentStatus: OrderPaymentStatus = newStatus === 'completed'
      ? (payment ? 'paid' : (order.paymentStatus || 'unpaid'))
      : (order.paymentStatus || 'unpaid');
    
    let updated: Order = {
      ...order,
      status: newStatus,
      completedAt: newStatus === 'completed' ? now.toISOString() : undefined,
      paymentStatus: nextPaymentStatus,
      paymentMethod: newStatus === 'completed' ? (payment?.paymentMethod || order.paymentMethod || 'Наличные') : order.paymentMethod,
      paymentParts: newStatus === 'completed' ? payment?.paymentParts : order.paymentParts,
      discountAmount: newStatus === 'completed' ? Math.max(0, Math.round(payment?.discountAmount || order.discountAmount || 0)) : order.discountAmount,
      bonusApplied: newStatus === 'completed' ? Math.max(0, Math.round(payment?.bonusApplied || order.bonusApplied || 0)) : order.bonusApplied,
      refundAmount: newStatus === 'completed' ? Math.max(0, Math.round(payment?.refundAmount || order.refundAmount || 0)) : order.refundAmount,
      receivedAmount: newStatus === 'completed' ? payment?.receivedAmount : order.receivedAmount,
      changeAmount: newStatus === 'completed' ? (payment?.changeAmount ?? 0) : order.changeAmount,
      paidAt: newStatus === 'completed'
        ? (payment ? now.toISOString() : order.paidAt)
        : order.paidAt,
    };

    // При переходе в работу: обновляем статус мойщиков
    if (newStatus === 'in_progress') {
      const ids = updated.washerIds || (updated.washerId ? [updated.washerId] : []);
      ids.forEach(washerId => {
        const status = getWasherCurrentStatuses(activeOrg.id).find(s => s.washerId === washerId && s.date === dateStr);
        addOrUpdateWasherCurrentStatus({
          id: status?.id || generateId(),
          washerId,
          organizationId: activeOrg.id,
          date: dateStr,
          status: 'working',
          currentOrderId: updated.id,
          currentBoxId: updated.boxId,
          updatedAt: now.toISOString(),
        });
      });
    }

    // При завершении
    if (isNewCompletion) {
      const breakdown = calculateOrderFinancialBreakdown(updated, activeOrg.id, washers as Washer[]);
      updated = {
        ...updated,
        washerSalaries: breakdown.workers.map(worker => ({
          washerId: worker.washerId,
          washerName: worker.washerName,
          amount: worker.amount,
        })),
      };
      updated = recalculateOrderCostFields(updated, activeOrg.id, washers as Washer[]);
      recordOrderFinancialAccrual({
        ...updated,
        completedAt: updated.completedAt || now.toISOString(),
      }, activeOrg.id);
      if (payment) {
        upsertOrderPaymentOperation(updated, activeOrg.id, userRole === 'manager' ? 'Управляющий' : 'Администратор');
      }
      consumeMaterialsForOrder(updated, activeOrg.id, userRole === 'manager' ? 'Управляющий' : 'Администратор');

      // Обновляем CRM: клиент/автомобиль и статистику
      try {
        updateClientStatsAfterOrderCompletion(updated, activeOrg.id);
      } catch (e) {
        console.error('CRM update failed', e);
      }

      // Возвращаем мойщиков в статус свободны (если нет других активных заказов)
      (updated.washerIds || (updated.washerId ? [updated.washerId] : [])).forEach(washerId => {
        const hasOtherActive = getOrders(activeOrg.id).some(
          o => (o.washerIds?.includes(washerId) || o.washerId === washerId) &&
               o.status === 'in_progress' &&
               o.id !== updated.id
        );
        if (!hasOtherActive) {
          const status = getWasherCurrentStatuses(activeOrg.id).find(s => s.washerId === washerId && s.date === dateStr);
          const washer = washers.find(w => w.id === washerId);
          addOrUpdateWasherCurrentStatus({
            id: status?.id || generateId(),
            washerId,
            organizationId: activeOrg.id,
            date: dateStr,
            status: 'free',
            currentBoxId: washer?.primaryBoxId,
            updatedAt: now.toISOString(),
          });
        }
      });
    } else if (newStatus === 'completed' && payment) {
      upsertOrderPaymentOperation(updated, activeOrg.id, userRole === 'manager' ? 'Управляющий' : 'Администратор');
    }

    updateOrder(updated);
    refresh();
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить заказ?')) {
      deleteOrder(id);
      refresh();
      setSelectedOrders(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleBatchDelete = () => {
    if (selectedOrders.size === 0) return;
    if (!confirm(`Удалить ${selectedOrders.size} заказов?`)) return;
    selectedOrders.forEach(id => deleteOrder(id));
    setSelectedOrders(new Set());
    refresh();
  };

  const handleBatchStatus = (status: OrderStatus) => {
    if (selectedOrders.size === 0) return;
    selectedOrders.forEach(id => {
      const o = orders.find(x => x.id === id);
      if (o) {
        if (status === 'completed') {
          handleStatusChange(o, 'completed', {
            paymentMethod: (o.paymentMethod as CashPaymentMethod) || 'Другой',
            receivedAmount: (o.paymentMethod === 'Наличные' || o.paymentMethod === 'cash') ? (o.receivedAmount || o.totalAmount) : undefined,
            changeAmount: (o.paymentMethod === 'Наличные' || o.paymentMethod === 'cash') ? (o.changeAmount || 0) : 0,
          });
        } else {
          const updated = { ...o, status, completedAt: undefined };
          updateOrder(updated);
        }
      }
    });
    setSelectedOrders(new Set());
    refresh();
  };

  const printOrderReceipt = (order: Order) => {
    const servicesText = order.services.map(s => `${s.serviceName} — ${s.price.toLocaleString('ru-RU')} ${activeOrg.currency}`).join('\n');
    const receiptHtml = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Чек заказа ${order.orderNumber || order.id.slice(0, 8)}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #111827; }
            h1 { margin: 0 0 12px; font-size: 20px; }
            .muted { color: #6b7280; font-size: 12px; }
            .block { margin-top: 12px; }
            pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
            .total { margin-top: 16px; font-size: 18px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>${activeOrg.name} — чек заказа</h1>
          <div class="muted">Номер: ${order.orderNumber || order.id.slice(0, 8)}</div>
          <div class="muted">Дата: ${format(new Date(order.completedAt || order.createdAt), 'dd.MM.yyyy HH:mm')}</div>
          <div class="block">Авто: <strong>${order.licensePlate}</strong> (${order.carTypeName})</div>
          <div class="block">Мойщик: ${order.washerNames?.join(', ') || order.washerName || '—'}</div>
          <div class="block"><strong>Услуги:</strong><pre>${servicesText || '—'}</pre></div>
          <div class="block">Оплата: ${getOrderPaymentLabel(order)}</div>
          ${order.discountAmount ? `<div class="block">Скидка: ${order.discountAmount.toLocaleString('ru-RU')} ${activeOrg.currency}</div>` : ''}
          ${order.bonusApplied ? `<div class="block">Списано бонусами: ${order.bonusApplied.toLocaleString('ru-RU')} ${activeOrg.currency}</div>` : ''}
          ${order.refundAmount ? `<div class="block">Возврат: ${order.refundAmount.toLocaleString('ru-RU')} ${activeOrg.currency}</div>` : ''}
          ${order.paymentMethod === 'Наличные' && typeof order.receivedAmount === 'number' ? `<div class="block">Получено: ${order.receivedAmount.toLocaleString('ru-RU')} ${activeOrg.currency}, сдача: ${(order.changeAmount || 0).toLocaleString('ru-RU')} ${activeOrg.currency}</div>` : ''}
          <div class="total">Итого: ${order.totalAmount.toLocaleString('ru-RU')} ${activeOrg.currency}</div>
        </body>
      </html>
    `;

    const w = window.open('', '_blank', 'width=420,height=720');
    if (!w) {
      alert('Не удалось открыть окно печати. Разрешите всплывающие окна.');
      return;
    }
    w.document.write(receiptHtml);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const toggleSelect = (id: string) => {
    setSelectedOrders(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectedDateLabel = format(parseISO(selectedDate), 'dd.MM.yyyy');
  const todayDateLabel = format(new Date(), 'dd.MM.yyyy');
  const selectedRevenue = filtered.reduce((s, o) => s + o.totalAmount, 0);
  const selectedPaymentTotals = buildOrderPaymentTotals(filtered);
  const selectedCarsCount = new Set(filtered.map(o => o.licensePlate)).size;
  const selectedOrdersCount = filtered.length;
  const selectedSalary = shifts.filter(s => s.date === selectedDate).reduce((s, sh) => s + sh.dailyRate + sh.bonus - sh.penalty, 0);
  const selectedDrinks = 0;
  const selectedExpenses = 0;
  const selectedRemainder = selectedRevenue - selectedSalary - selectedExpenses;

  const todayOrders = orders.filter(o => isToday(new Date(o.createdAt)));
  const todayRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);
  const todayPaymentTotals = buildOrderPaymentTotals(todayOrders);
  const todayCarsCount = new Set(todayOrders.map(o => o.licensePlate)).size;
  const todaySalary = shifts.filter(s => s.date === todayKey).reduce((s, sh) => s + sh.dailyRate + sh.bonus - sh.penalty, 0);

  const allRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const allPaymentTotals = buildOrderPaymentTotals(orders);
  const allCarsCount = new Set(orders.map(o => o.licensePlate)).size;
  const allSalary = shifts.reduce((s, sh) => s + sh.dailyRate + sh.bonus - sh.penalty, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-white">Заказы</h1>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowCreate(true)} className="btn-neon rounded-lg px-4 py-2 text-sm font-medium">+ Новый заказ</button>
            <button onClick={() => setShowBatch(true)} className="btn-neon rounded-lg px-4 py-2 text-sm font-medium">📦 Пакет</button>
            <button onClick={() => { setShowCalendar(true); setCalendarMonth(startOfMonth(parseISO(selectedDate))); }} className="btn-neon rounded-lg px-4 py-2 text-sm font-medium">📅 История</button>
            {selectedDate !== todayKey && (
              <button onClick={() => setSelectedDate(todayKey)} className="btn-success rounded-lg px-4 py-2 text-sm font-medium">Сегодня</button>
            )}
            {selectedOrders.size > 0 && (
              <>
                <button onClick={() => handleBatchStatus('completed')} className="btn-success rounded-lg px-3 py-2 text-xs">✓ Завершить</button>
                <button onClick={handleBatchDelete} className="btn-danger rounded-lg px-3 py-2 text-xs">🗑 Удалить</button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center text-sm text-slate-400">
          <span>Выбранная дата: <strong className="text-white">{selectedDateLabel}</strong></span>
          <span>Сегодня: <strong className="text-white">{todayDateLabel}</strong></span>
          <span className="text-xs text-slate-500">Горячая клавиша: Ctrl+H</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Статистика за выбранный день</h2>
            <dl className="grid grid-cols-2 gap-3 text-slate-300 text-sm">
              <div><dt className="text-slate-500">Заказы</dt><dd className="text-white font-semibold">{selectedOrdersCount}</dd></div>
              <div><dt className="text-slate-500">Автомобилей</dt><dd className="text-white font-semibold">{selectedCarsCount}</dd></div>
              <div><dt className="text-slate-500">Выручка</dt><dd className="text-cyan-400 font-semibold">{selectedRevenue.toLocaleString('ru-RU')} {activeOrg.currency}</dd></div>
              <div><dt className="text-slate-500">Наличные</dt><dd className="text-white font-semibold">{(selectedPaymentTotals['Наличные'] || 0).toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">Kaspi / карта</dt><dd className="text-white font-semibold">{((selectedPaymentTotals.Kaspi || 0) + (selectedPaymentTotals['Банковская карта'] || 0)).toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">QR / бонусы</dt><dd className="text-white font-semibold">{((selectedPaymentTotals.QR || 0) + (selectedPaymentTotals['Бонусы'] || 0)).toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">Напитки</dt><dd className="text-white font-semibold">{selectedDrinks.toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">Расходы</dt><dd className="text-white font-semibold">{selectedExpenses.toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">Зарплата</dt><dd className="text-white font-semibold">{selectedSalary.toLocaleString('ru-RU')}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Остаток</dt><dd className="text-cyan-400 font-semibold">{selectedRemainder.toLocaleString('ru-RU')} {activeOrg.currency}</dd></div>
            </dl>
          </div>
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Сегодня</h2>
            <dl className="grid grid-cols-2 gap-3 text-slate-300 text-sm">
              <div><dt className="text-slate-500">Заказы</dt><dd className="text-white font-semibold">{todayOrders.length}</dd></div>
              <div><dt className="text-slate-500">Автомобилей</dt><dd className="text-white font-semibold">{todayCarsCount}</dd></div>
              <div><dt className="text-slate-500">Выручка</dt><dd className="text-cyan-400 font-semibold">{todayRevenue.toLocaleString('ru-RU')} {activeOrg.currency}</dd></div>
              <div><dt className="text-slate-500">Наличные</dt><dd className="text-white font-semibold">{(todayPaymentTotals['Наличные'] || 0).toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">Kaspi / карта</dt><dd className="text-white font-semibold">{((todayPaymentTotals.Kaspi || 0) + (todayPaymentTotals['Банковская карта'] || 0)).toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">QR / бонусы</dt><dd className="text-white font-semibold">{((todayPaymentTotals.QR || 0) + (todayPaymentTotals['Бонусы'] || 0)).toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">Зарплата</dt><dd className="text-white font-semibold">{todaySalary.toLocaleString('ru-RU')}</dd></div>
            </dl>
          </div>
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Всё время</h2>
            <dl className="grid grid-cols-2 gap-3 text-slate-300 text-sm">
              <div><dt className="text-slate-500">Заказы</dt><dd className="text-white font-semibold">{orders.length}</dd></div>
              <div><dt className="text-slate-500">Автомобилей</dt><dd className="text-white font-semibold">{allCarsCount}</dd></div>
              <div><dt className="text-slate-500">Выручка</dt><dd className="text-cyan-400 font-semibold">{allRevenue.toLocaleString('ru-RU')} {activeOrg.currency}</dd></div>
              <div><dt className="text-slate-500">Наличные</dt><dd className="text-white font-semibold">{(allPaymentTotals['Наличные'] || 0).toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">Kaspi / карта</dt><dd className="text-white font-semibold">{((allPaymentTotals.Kaspi || 0) + (allPaymentTotals['Банковская карта'] || 0)).toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">QR / бонусы</dt><dd className="text-white font-semibold">{((allPaymentTotals.QR || 0) + (allPaymentTotals['Бонусы'] || 0)).toLocaleString('ru-RU')}</dd></div>
              <div><dt className="text-slate-500">Зарплата</dt><dd className="text-white font-semibold">{allSalary.toLocaleString('ru-RU')}</dd></div>
            </dl>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск (госномер, тип...)" className="input-neon rounded-lg px-4 py-2 text-sm flex-1 min-w-48" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as OrderStatus | '')} className="input-neon rounded-lg px-4 py-2 text-sm">
            <option value="">Все статусы</option>
            {statusFlow.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">
                  <input type="checkbox" onChange={e => {
                    if (e.target.checked) setSelectedOrders(new Set(filtered.map(o => o.id)));
                    else setSelectedOrders(new Set());
                  }} checked={selectedOrders.size > 0 && selectedOrders.size === filtered.length} className="rounded" />
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Дата</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Госномер</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Тип авто</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Услуги</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Мойщик</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Сумма</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Статус</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const { items: paginatedOrders } = calculatePagination(filtered, pageSize, currentPage);
                if (paginatedOrders.length === 0) {
                  return (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                      {filtered.length === 0 ? 'Нет заказов' : 'Нет заказов на этой странице'}
                    </td></tr>
                  );
                }
                return paginatedOrders.map(o => (
                  <tr key={o.id} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedOrders.has(o.id)} onChange={() => toggleSelect(o.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{format(new Date(o.createdAt), 'dd.MM HH:mm')}</td>
                    <td className="px-4 py-3 text-white font-medium">{o.licensePlate}</td>
                    <td className="px-4 py-3 text-slate-300">{o.carTypeName}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs max-w-32 truncate">{o.services.map(s => s.serviceName).join(', ')}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      <div>{o.washerNames?.join(', ') || o.washerName || '—'}</div>
                      {o.boxName && <div className="text-slate-500 text-[10px]">{o.boxName}</div>}
                      {o.dirtLevel && (
                        <div className="text-[10px]" style={{ color: o.dirtLevel === 'light' ? '#4ade80' : o.dirtLevel === 'medium' ? '#fbbf24' : '#f87171' }}>
                          {dirtLevelLabels[o.dirtLevel]}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-cyan-400 font-medium">{o.totalAmount.toLocaleString('ru-RU')} {activeOrg.currency}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={`text-[10px] px-2 py-1 rounded-full status-${o.status}`}>{statusLabels[o.status]}</span>
                        {o.status === 'completed' && (
                          <span className={`text-[10px] px-2 py-1 rounded-full ${getPaymentStatus(o) === 'paid' ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>
                            {paymentStatusLabels[getPaymentStatus(o)]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {o.status === 'waiting' && <button onClick={() => handleStatusChange(o, 'in_progress')} className="text-[10px] px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">▶ В работу</button>}
                        {o.status === 'in_progress' && <button onClick={() => setPayOrder(o)} className="text-[10px] px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors">✓ Завершить</button>}
                        {o.status === 'completed' && getPaymentStatus(o) !== 'paid' && <button onClick={() => setPayOrder(o)} className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors">💳 Оплатить</button>}
                        {(o.status === 'waiting' || o.status === 'in_progress') && <button onClick={() => handleStatusChange(o, 'cancelled')} className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">✕</button>}
                        {o.status === 'completed' && getPaymentStatus(o) === 'paid' && <button onClick={() => printOrderReceipt(o)} className="text-[10px] px-2 py-1 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors">🧾</button>}
                        <button onClick={() => setEditOrder(o)} className="text-[10px] px-2 py-1 rounded bg-white/5 text-slate-400 hover:bg-white/10 transition-colors">✎</button>
                        {userRole === 'manager' && <button onClick={() => handleDelete(o.id)} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400/60 hover:bg-red-500/20 transition-colors">🗑</button>}
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <PaginationControl
            currentPage={currentPage}
            totalPages={Math.ceil(filtered.length / pageSize)}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            totalItems={filtered.length}
          />
        </div>
      )}

      {/* Summary */}
      <div className="flex gap-4 text-xs text-slate-400">
        <span>Всего: {filtered.length}</span>
        <span>Ожидание: {filteredStats.waiting}</span>
        <span>В работе: {filteredStats.inProgress}</span>
        <span>Завершено: {filteredStats.completed}</span>
        <span>Сумма: {filteredStats.completedSum.toLocaleString('ru-RU')} {activeOrg.currency}</span>
      </div>

      {/* Create Order Modal */}
      {showCreate && <OrderModal
        activeOrg={activeOrg}
        services={services}
        carTypes={carTypes}
        washers={washers}
        prices={prices}
        boxes={boxes}
        allOrders={orders}
        userRole={userRole}
        onClose={() => { setShowCreate(false); refresh(); }}
      />}

      {/* Edit Order Modal */}
      {editOrder && <OrderModal
        activeOrg={activeOrg}
        services={services}
        carTypes={carTypes}
        washers={washers}
        prices={prices}
        boxes={boxes}
        allOrders={orders}
        order={editOrder}
        userRole={userRole}
        onClose={() => { setEditOrder(null); refresh(); }}
      />}

      {/* Batch Create Modal */}
      {showBatch && <BatchModal
        activeOrg={activeOrg}
        services={services}
        carTypes={carTypes}
        washers={washers}
        prices={prices}
        onClose={() => { setShowBatch(false); refresh(); }}
      />}

      {payOrder && (
        <OrderPaymentModal
          order={payOrder}
          currency={activeOrg.currency}
          onCancel={() => setPayOrder(null)}
          onConfirm={(payment) => {
            handleStatusChange(payOrder, 'completed', payment);
            setPayOrder(null);
          }}
        />
      )}
    </div>
  );
}

// Order Modal Component
function OrderModal({ activeOrg, services, carTypes, washers, prices, boxes, allOrders, order, userRole, onClose }: {
  activeOrg: Organization;
  services: { id: string; name: string }[];
  carTypes: { id: string; name: string }[];
  washers: Washer[];
  prices: { serviceId: string; carTypeId: string; price: number }[];
  boxes: Box[];
  allOrders: Order[];
  order?: Order | null;
  userRole: 'admin' | 'manager';
  onClose: () => void;
}) {
  const [carTypeId, setCarTypeId] = useState(order?.carTypeId || (carTypes[0]?.id || ''));
  const [licensePlate, setLicensePlate] = useState(order?.licensePlate || '');
  const [clientName, setClientName] = useState(order?.clientName || '');
  const [clientPhone, setClientPhone] = useState(order?.clientPhone || '');
  const [matchedClient, setMatchedClient] = useState<Client | null>(null);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set(order?.services.map(s => s.serviceId) || [])
  );
  const [washerIds, setWasherIds] = useState<string[]>(() => {
    if (order?.washerIds?.length) return order.washerIds;
    if (order?.washerId) return [order.washerId];
    return [];
  });
  const [boxId, setBoxId] = useState(order?.boxId || '');
  const [dirtLevel, setDirtLevel] = useState<DirtLevel | ''>(order?.dirtLevel || '');
  const [paymentMethod, setPaymentMethod] = useState<CashPaymentMethod>((order?.paymentMethod as CashPaymentMethod) || 'Наличные');
  const [receivedAmount, setReceivedAmount] = useState<number>(order?.receivedAmount ?? order?.totalAmount ?? 0);
  const [discountAmount, setDiscountAmount] = useState<number>(order?.discountAmount ?? 0);
  const [bonusApplied, setBonusApplied] = useState<number>(order?.bonusApplied ?? 0);
  const [refundAmount, setRefundAmount] = useState<number>(order?.refundAmount ?? 0);
  const [mixedCash, setMixedCash] = useState<number>(order?.paymentParts?.find(part => normalizeOrderPaymentMethod(part.method) === 'Наличные')?.amount ?? 0);
  const [mixedKaspi, setMixedKaspi] = useState<number>(order?.paymentParts?.find(part => normalizeOrderPaymentMethod(part.method) === 'Kaspi')?.amount ?? 0);
  const [mixedCard, setMixedCard] = useState<number>(order?.paymentParts?.find(part => normalizeOrderPaymentMethod(part.method) === 'Банковская карта')?.amount ?? 0);
  const [mixedBonus, setMixedBonus] = useState<number>(order?.paymentParts?.find(part => normalizeOrderPaymentMethod(part.method) === 'Бонусы')?.amount ?? 0);
  const [comment, setComment] = useState(order?.comment || '');
  const [status, setStatus] = useState<OrderStatus>(order?.status || 'waiting');
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const financialSettings = getFinancialSettings(activeOrg.id);

  // Занятые боксы (кроме текущего заказа при редактировании)
  const occupiedBoxIds = useMemo(() => {
    return new Set(
      allOrders
        .filter(o =>
          (o.status === 'waiting' || o.status === 'in_progress') &&
          o.boxId &&
          o.id !== order?.id
        )
        .map(o => o.boxId!)
    );
  }, [allOrders, order?.id]);

  // История номеров для автоподстановки
  const plateHistory = useMemo(() => {
    const seen = new Map<string, { carTypeId: string; carTypeName: string }>();
    allOrders.forEach(o => {
      const plate = o.licensePlate.toUpperCase();
      if (!seen.has(plate)) {
        seen.set(plate, { carTypeId: o.carTypeId, carTypeName: o.carTypeName });
      }
    });
    return Array.from(seen.entries()).map(([plate, info]) => ({ plate, ...info }));
  }, [allOrders]);

  const plateSuggestions = useMemo(() => {
    const q = licensePlate.trim().toUpperCase();
    if (!q) return [];
    return plateHistory.filter(p => p.plate.includes(q) && p.plate !== q).slice(0, 6);
  }, [licensePlate, plateHistory]);

  const plateHistorySummary = useMemo(() => {
    const q = licensePlate.trim().toUpperCase();
    if (!q) return null;
    const matches = allOrders.filter(o => o.licensePlate.toUpperCase().includes(q));
    if (matches.length === 0) return null;

    const exactPlate = matches[0].licensePlate;
    const vehicleOrders = allOrders.filter(o => o.licensePlate.toUpperCase() === exactPlate.toUpperCase());
    const lastOrder = vehicleOrders.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const averageCheck = vehicleOrders.reduce((sum, order) => sum + order.totalAmount, 0) / vehicleOrders.length;
    const servicesHistory = Array.from(new Set(vehicleOrders.flatMap(order => order.services.map(service => service.serviceName)))).slice(0, 5);

    return {
      plate: exactPlate,
      count: vehicleOrders.length,
      averageCheck,
      lastDate: lastOrder ? format(new Date(lastOrder.completedAt || lastOrder.createdAt), 'dd.MM.yyyy') : '—',
      services: servicesHistory,
      carTypeName: lastOrder?.carTypeName || matches[0]?.carTypeName || '—',
    };
  }, [allOrders, licensePlate]);

  const matchedVehicle = useMemo(() => {
    const plate = licensePlate.trim().toUpperCase();
    return plate ? findVehicleByPlate(activeOrg.id, plate) || null : null;
  }, [activeOrg.id, licensePlate]);

  const matchedClientOrders = useMemo(() => {
    if (!matchedClient && !matchedVehicle) return [];
    return allOrders
      .filter(item => {
        if (matchedClient?.id && item.clientId === matchedClient.id) return true;
        if (matchedVehicle?.id && item.vehicleId === matchedVehicle.id) return true;
        return matchedVehicle?.licensePlate ? item.licensePlate.toUpperCase() === matchedVehicle.licensePlate.toUpperCase() : false;
      })
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
      .slice(0, 4);
  }, [allOrders, matchedClient, matchedVehicle]);

  const matchedRecommendations = useMemo(() => {
    return matchedClient ? getClientRecommendationsStructured(activeOrg.id, matchedClient.id).slice(0, 3) : [];
  }, [activeOrg.id, matchedClient]);

  const getServicePrice = (serviceId: string): number => {
    const p = prices.find(p => p.serviceId === serviceId && p.carTypeId === carTypeId);
    return p?.price || 0;
  };

  const orderServices: OrderService[] = Array.from(selectedServices).map(sid => {
    const svc = services.find(s => s.id === sid);
    return { serviceId: sid, serviceName: svc?.name || '', price: getServicePrice(sid) };
  });

  const totalAmount = orderServices.reduce((s, os) => s + os.price, 0);
  const payableAmount = Math.max(0, totalAmount - Math.max(0, discountAmount) - Math.max(0, bonusApplied));
  const paymentParts: PaymentPart[] = paymentMethod === 'Смешанная'
    ? [
      { method: 'Наличные' as OrderPaymentPartMethod, amount: Math.max(0, mixedCash) },
      { method: 'Kaspi' as OrderPaymentPartMethod, amount: Math.max(0, mixedKaspi) },
      { method: 'Банковская карта' as OrderPaymentPartMethod, amount: Math.max(0, mixedCard) },
      { method: 'Бонусы' as OrderPaymentPartMethod, amount: Math.max(0, mixedBonus) },
    ].filter(part => part.amount > 0)
    : [{ method: normalizeOrderPaymentMethod(paymentMethod), amount: payableAmount }];
  const mixedTotal = paymentParts.reduce((sum, part) => sum + part.amount, 0);

  const addWasher = (id: string) => {
    if (!id || washerIds.includes(id)) return;
    
    // Проверяем занятость мойщика
    const busyOrder = allOrders.find(o =>
      (o.washerIds?.includes(id) || o.washerId === id) &&
      (o.status === 'in_progress') &&
      o.id !== order?.id
    );
    
    if (busyOrder) {
      if (!confirm(`Мойщик уже выполняет другой заказ (${busyOrder.licensePlate}). Всё равно добавить?`)) {
        return;
      }
    }
    
    setWasherIds(prev => [...prev, id]);
  };

  const removeWasher = (id: string) => {
    setWasherIds(prev => prev.filter(x => x !== id));
  };

  const handleBoxChange = (newBoxId: string) => {
    if (newBoxId && occupiedBoxIds.has(newBoxId)) {
      const box = boxes.find(b => b.id === newBoxId);
      if (!confirm(`Бокс «${box?.name}» уже занят активным заказом. Всё равно назначить?`)) return;
    }
    setBoxId(newBoxId);
    setErrorMessage('');
  };

  const handlePlateChange = (value: string) => {
    setLicensePlate(value.toUpperCase());
    setShowSuggestions(true);
    setErrorMessage('');
  };

  const handlePlateSelect = (plate: string, ctId: string) => {
    setLicensePlate(plate);
    if (ctId) setCarTypeId(ctId);
    setShowSuggestions(false);
  };

  useEffect(() => {
    const plate = licensePlate.trim().toUpperCase();
    if (!plate) {
      setMatchedClient(null);
      return;
    }
    const vehicle = findVehicleByPlate(activeOrg.id, plate);
    if (vehicle && vehicle.clientId) {
      const client = getClients(activeOrg.id).find(c => c.id === vehicle.clientId);
      if (client) {
        setMatchedClient(client);
        setClientName(client.fullName);
        setClientPhone(client.phone || '');
        return;
      }
    }
    setMatchedClient(null);
  }, [licensePlate, activeOrg.id]);

  const handleSave = () => {
    if (!carTypeId) {
      setErrorMessage('Выберите тип автомобиля');
      return;
    }
    if (!licensePlate.trim()) {
      setErrorMessage('Введите государственный номер автомобиля');
      return;
    }
    if (selectedServices.size === 0) {
      setErrorMessage('Выберите хотя бы одну услугу');
      return;
    }
    if (status === 'completed' && paymentMethod === 'Наличные' && receivedAmount < payableAmount) {
      setErrorMessage('Недостаточно средств: получено меньше стоимости заказа');
      return;
    }
    if (status === 'completed' && paymentMethod === 'Смешанная' && mixedTotal !== payableAmount) {
      setErrorMessage('Сумма смешанной оплаты должна совпадать с суммой к оплате');
      return;
    }
    if (order?.status === 'completed' && status !== 'completed') {
      setErrorMessage('Оплаченный заказ нельзя перевести в другой статус. Для исправления используйте корректировку.');
      return;
    }

    const ct = carTypes.find(c => c.id === carTypeId);
    const selectedBox = boxes.find(b => b.id === boxId);
    const washerNames = washerIds.map(id => washers.find(w => w.id === id)?.name || '');
    const previousPaidMethod = order?.paymentMethod || 'Другой';
    const nextPaidMethod = paymentMethod || 'Другой';
    const paymentChanged = Boolean(order?.status === 'completed' && (previousPaidMethod !== nextPaidMethod));
    const amountChanged = Boolean(order?.status === 'completed' && totalAmount !== (order?.totalAmount || 0));
    const nextPaymentStatus: OrderPaymentStatus = status === 'completed'
      ? (order?.status === 'completed' ? (order.paymentStatus || 'unpaid') : 'unpaid')
      : (order?.paymentStatus || 'unpaid');
    const nextOrder: Order = {
      ...draftOrder,
      carTypeName: ct?.name || '',
      washerName: washerNames[0] || undefined,
      washerNames: washerNames.length > 0 ? washerNames : undefined,
      washerSalaries: financialPreview.workers.map(worker => ({
        washerId: worker.washerId,
        washerName: worker.washerName,
        amount: worker.amount,
      })),
      boxName: selectedBox?.name || undefined,
      totalAmount,
      paymentParts,
      discountAmount: Math.max(0, Math.round(discountAmount)),
      bonusApplied: Math.max(0, Math.round(bonusApplied)),
      refundAmount: Math.max(0, Math.round(refundAmount)),
      status,
      paymentStatus: nextPaymentStatus,
      completedAt: status === 'completed' ? (order?.completedAt || new Date().toISOString()) : undefined,
    };
    const nextOrderWithCost = nextOrder.status === 'completed'
      ? recalculateOrderCostFields(nextOrder, activeOrg.id, washers)
      : nextOrder;

    if (order?.status === 'completed' && (amountChanged || paymentChanged)) {
      if (userRole !== 'manager') {
        setErrorMessage('Менять оплату/сумму завершённого заказа может только управляющий');
        return;
      }
      if (!confirm('Завершённый заказ был изменён. Создать корректирующую запись в кассе и истории начислений?')) {
        return;
      }
    }

    if (order) {
      let updated = ensureClientAndVehicleOnOrder(nextOrderWithCost, activeOrg.id);
      const isBecomingCompleted = order.status !== 'completed' && updated.status === 'completed';
      if (!updated.clientId && isBecomingCompleted) {
        const matched = createClientForOrderIfMissing(updated, activeOrg.id);
        if (matched) {
          updated = { ...updated, clientId: matched.id, clientName: matched.fullName };
        }
      }
      updateOrder(updated);
      if (updated.status === 'completed') {
        if (order.status === 'completed' && amountChanged) {
          recordOrderFinancialAdjustment(nextOrderWithCost, order.totalAmount, activeOrg.id);
        } else if (order.status !== 'completed') {
          recordOrderFinancialAccrual(nextOrderWithCost, activeOrg.id);
          updateClientStatsAfterOrderCompletion(updated, activeOrg.id);
        }
        upsertOrderPaymentOperation(nextOrderWithCost, activeOrg.id, userRole === 'manager' ? 'Управляющий' : 'Администратор');
        consumeMaterialsForOrder(nextOrderWithCost, activeOrg.id, userRole === 'manager' ? 'Управляющий' : 'Администратор');
      }
    } else {
      // Attach existing client/vehicle if possible before saving
      let prepared = ensureClientAndVehicleOnOrder({
        ...nextOrder,
        id: generateId(),
        orderNumber: generateId(),
        washerSalaries: undefined,
        createdAt: new Date().toISOString(),
      }, activeOrg.id);
      if (!prepared.clientId && prepared.status === 'completed') {
        const matched = createClientForOrderIfMissing(prepared, activeOrg.id);
        if (matched) {
          prepared = { ...prepared, clientId: matched.id, clientName: matched.fullName };
        }
      }
      addOrder(prepared);
      if (prepared.status === 'completed') {
        updateClientStatsAfterOrderCompletion(prepared, activeOrg.id);
      }
    }
    onClose();
  };

  const dirtStyles: Record<DirtLevel, string> = {
    light: 'bg-green-500/10 border-green-500/30 text-green-400',
    medium: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    heavy: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  const activeBoxes = boxes.filter(b => b.isActive);
  const occupiedBoxOrders = new Map(
    allOrders
      .filter(o => (o.status === 'waiting' || o.status === 'in_progress') && o.boxId && o.id !== order?.id)
      .map(o => [o.boxId!, o])
  );
  // Фильтруем мойщиков: исключаем уже выбранных и только те, кто на смене сегодня
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const todayShifts = getWasherShiftDaysForDate(activeOrg.id, dateStr);
  const workingWasherIds = new Set(todayShifts.filter(s => s.status === 'working').map(s => s.washerId));
  
  const availableWashers = washers.filter(w =>
    !washerIds.includes(w.id) && workingWasherIds.has(w.id)
  );
  const washerPercent = financialSettings.employeePercent;
  const draftOrderBase = useMemo<Order>(() => ({
    id: order?.id || generateId(),
    orderNumber: order?.orderNumber || order?.id || generateId(),
    organizationId: activeOrg.id,
    carTypeId,
    carTypeName: carTypes.find(c => c.id === carTypeId)?.name || '',
    licensePlate: licensePlate.trim(),
    clientId: matchedClient?.id || order?.clientId || undefined,
    clientName: clientName.trim() || undefined,
    clientPhone: clientPhone.trim() || undefined,
    services: orderServices,
    status,
    washerId: washerIds[0] || undefined,
    washerName: washerIds[0] ? washers.find(w => w.id === washerIds[0])?.name : undefined,
    washerIds: washerIds.length > 0 ? washerIds : undefined,
    washerNames: washerIds.length > 0 ? washerIds.map(id => washers.find(w => w.id === id)?.name || '') : undefined,
    washerSalaries: order?.washerSalaries,
    boxId: boxId || undefined,
    boxName: boxes.find(b => b.id === boxId)?.name || undefined,
    dirtLevel: (dirtLevel || undefined) as DirtLevel | undefined,
    paymentMethod,
    paymentParts,
    paymentStatus: order?.paymentStatus || 'unpaid',
    receivedAmount: status === 'completed' && paymentMethod === 'Наличные' ? receivedAmount : undefined,
    changeAmount: status === 'completed' && paymentMethod === 'Наличные' ? Math.max(0, receivedAmount - payableAmount) : undefined,
    discountAmount: Math.max(0, Math.round(discountAmount)),
    bonusApplied: Math.max(0, Math.round(bonusApplied)),
    refundAmount: Math.max(0, Math.round(refundAmount)),
    paidAt: status === 'completed' ? (order?.paidAt || (order?.paymentStatus === 'paid' ? new Date().toISOString() : undefined)) : undefined,
    comment: comment.trim() || undefined,
    totalAmount,
    createdAt: order?.createdAt || new Date().toISOString(),
    completedAt: status === 'completed' ? (order?.completedAt || new Date().toISOString()) : undefined,
    batchId: order?.batchId,
  }), [activeOrg.id, bonusApplied, boxId, boxes, carTypeId, carTypes, clientName, clientPhone, comment, dirtLevel, discountAmount, licensePlate, matchedClient, order, orderServices, payableAmount, paymentMethod, paymentParts, receivedAmount, refundAmount, status, totalAmount, washers, washerIds]);

  const financialPreview = useMemo(
    () => calculateOrderFinancialBreakdown(draftOrderBase, activeOrg.id, washers),
    [activeOrg.id, draftOrderBase, washers]
  );
  const costPreview = useMemo(
    () => calculateOrderCostBreakdown(draftOrderBase, activeOrg.id, washers),
    [activeOrg.id, draftOrderBase, washers]
  );
  const draftOrder = useMemo<Order>(() => ({
    ...draftOrderBase,
    washerSalaries: financialPreview.workers.map(worker => ({
      washerId: worker.washerId,
      washerName: worker.washerName,
      amount: worker.amount,
    })),
  }), [draftOrderBase, financialPreview.workers]);
  const washerShare = financialPreview.employeeTotal;
  const perWasher = washerIds.length > 1 ? Math.round(washerShare / washerIds.length) : washerShare;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div
        className="modal-panel rounded-2xl p-6 w-full max-w-xl mx-4 animate-fadeIn neon-glow"
        style={{ maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-4">
          {order ? 'Редактировать заказ' : 'Новый заказ'}
        </h2>

        {errorMessage && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-4">
            ⚠ {errorMessage}
          </div>
        )}

        <div className="space-y-4">
          {/* Тип авто + Госномер с автоподстановкой */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Тип авто *</label>
              <select
                value={carTypeId}
                onChange={e => { setCarTypeId(e.target.value); setErrorMessage(''); }}
                className="w-full input-neon rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Выберите</option>
                {carTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
              </select>
            </div>
            <div className="relative">
              <label className="block text-xs text-slate-400 mb-1">Госномер *</label>
              <input
                type="text"
                value={licensePlate}
                onChange={e => handlePlateChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="А123ВС"
                className="w-full input-neon rounded-lg px-3 py-2 text-sm"
              />
              {showSuggestions && plateSuggestions.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 glass-strong rounded-lg border border-white/10 shadow-xl overflow-hidden">
                  {plateSuggestions.map(s => (
                    <button
                      key={s.plate}
                      type="button"
                      onMouseDown={() => handlePlateSelect(s.plate, s.carTypeId)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                    >
                      <span className="text-white font-medium">{s.plate}</span>
                      <span className="text-slate-400">{s.carTypeName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Клиент</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="ФИО клиента"
                className="w-full input-neon rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Телефон</label>
              <input
                type="tel"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                placeholder="+7 900 000-00-00"
                className="w-full input-neon rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {matchedClient ? (
            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-200">Клиент найден</p>
                  <p className="text-white font-semibold">{matchedClient.fullName}</p>
                </div>
                <span className="text-xs text-slate-300">{matchedClient.phone || 'Телефон не указан'}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                <div>
                  <p className="text-slate-400">Посещений</p>
                  <p className="text-white">{matchedClient.totalVisits || 0}</p>
                </div>
                <div>
                  <p className="text-slate-400">Скидка</p>
                  <p className="text-white">{(matchedClient.discountPercent || 0).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-slate-400">Бонусы</p>
                  <p className="text-white">{matchedClient.bonusPoints || 0}</p>
                </div>
                <div>
                  <p className="text-slate-400">Уровень</p>
                  <p className="text-white">{matchedClient.loyaltyLevel || 'Standard'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Последний визит</p>
                  <p className="text-white">{matchedClient.lastVisitAt ? format(new Date(matchedClient.lastVisitAt), 'dd.MM.yyyy') : '—'}</p>
                </div>
                <div>
                  <p className="text-slate-400">VIP</p>
                  <p className="text-white">{matchedClient.isVip ? 'Да' : 'Нет'}</p>
                </div>
              </div>
              {(matchedRecommendations.length > 0 || matchedClientOrders.length > 0) && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/30 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Последние посещения</p>
                    <div className="space-y-2">
                      {matchedClientOrders.length > 0 ? matchedClientOrders.map(item => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                          <div>
                            <p className="text-white">{format(new Date(item.completedAt || item.createdAt), 'dd.MM.yyyy')}</p>
                            <p className="text-slate-400">{item.services.map(service => service.serviceName).join(', ')}</p>
                          </div>
                          <p className="text-cyan-200">{item.totalAmount.toLocaleString('ru-RU')} {activeOrg.currency}</p>
                        </div>
                      )) : <p className="text-slate-400 text-xs">История пока отсутствует.</p>}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-950/30 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Рекомендации CRM</p>
                    <div className="space-y-2">
                      {matchedRecommendations.length > 0 ? matchedRecommendations.map((rec, index) => (
                        <div key={`${rec.type}-${index}`} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-white font-medium">{rec.title}</p>
                            <span className="text-slate-400">P{rec.priority}</span>
                          </div>
                          {rec.description && <p className="mt-1 text-slate-300">{rec.description}</p>}
                        </div>
                      )) : <p className="text-slate-400 text-xs">Рекомендаций пока нет.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            licensePlate.trim() && (
              <div className="rounded-3xl border border-slate-500/20 bg-slate-900/70 p-4 text-sm text-slate-300 space-y-3">
                <p>Автомобиль не найден в CRM. Введите данные клиента для создания новой записи.</p>
                {plateHistorySummary && (
                  <div className="rounded-2xl bg-white/5 p-3 text-xs text-slate-300">
                    <p className="text-white font-medium">Похожий номер найден в истории: {plateHistorySummary.plate}</p>
                    <p className="mt-1">Визитов: {plateHistorySummary.count} · Средний чек: {Math.round(plateHistorySummary.averageCheck).toLocaleString('ru-RU')} {activeOrg.currency}</p>
                    <p className="mt-1">Последний визит: {plateHistorySummary.lastDate}</p>
                  </div>
                )}
                <button type="button" onClick={() => { setMatchedClient(null); setClientName(''); setClientPhone(''); }} className="btn-neon rounded-xl px-4 py-2 text-sm">Создать нового клиента</button>
              </div>
            )
          )}

          {/* Степень загрязнения + Бокс */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Загрязнение</label>
              <div className="flex gap-1.5">
                {(['light', 'medium', 'heavy'] as DirtLevel[]).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDirtLevel(dirtLevel === level ? '' : level)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-medium border transition-all ${
                      dirtLevel === level
                        ? dirtStyles[level]
                        : 'bg-white/3 border-white/5 text-slate-500 hover:border-white/15 hover:text-slate-400'
                    }`}
                  >
                    {dirtLevelLabels[level]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Бокс</label>
              {activeBoxes.length > 0 ? (
                <select
                  value={boxId}
                  onChange={e => handleBoxChange(e.target.value)}
                  className="w-full input-neon rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Не выбран</option>
                  {activeBoxes.map(b => {
                    const occ = occupiedBoxIds.has(b.id);
                    const busyOrder = occupiedBoxOrders.get(b.id);
                    const busyWorkers = busyOrder?.washerNames?.filter(Boolean).join(', ') || busyOrder?.washerName || '';
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name}{occ ? ` — Занят ⚠${busyWorkers ? ` (${busyWorkers})` : ''}` : ' — Свободен'}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="w-full input-neon rounded-lg px-3 py-2 text-sm text-slate-500">
                  Настройте боксы в Настройках
                </div>
              )}
            </div>
          </div>

          {/* Услуги */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Услуги *</label>
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-0.5">
              {services.map(svc => {
                const price = getServicePrice(svc.id);
                const checked = selectedServices.has(svc.id);
                return (
                  <label
                    key={svc.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs ${
                      checked
                        ? 'bg-cyan-500/10 border border-cyan-500/30'
                        : 'bg-white/3 border border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedServices(prev => {
                          const n = new Set(prev);
                          if (n.has(svc.id)) n.delete(svc.id); else n.add(svc.id);
                          return n;
                        });
                        setErrorMessage('');
                      }}
                      className="rounded"
                    />
                    <span className="flex-1 text-slate-300">{svc.name}</span>
                    <span className="text-cyan-400">{price ? price.toLocaleString('ru-RU') : '—'}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Мойщики */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Мойщики
              {washerIds.length > 1 && totalAmount > 0 && (
                <span className="ml-2 text-slate-500 font-normal">
                  ({washerPercent}% ÷ {washerIds.length} ≈ {perWasher.toLocaleString('ru-RU')} {activeOrg.currency} каждому)
                </span>
              )}
            </label>
            {washerIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {washerIds.map((id, idx) => {
                  const w = washers.find(x => x.id === id);
                  if (!w) return null;
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300"
                    >
                      {idx === 0
                        ? <span title="Основной мойщик" className="text-amber-400">⭐</span>
                        : <span className="text-slate-500">+</span>
                      }
                      <span>{w.name}</span>
                      <button
                        type="button"
                        onClick={() => removeWasher(id)}
                        className="ml-0.5 text-slate-400 hover:text-red-400 transition-colors text-base leading-none"
                        title="Убрать"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {availableWashers.length > 0 ? (
              <select
                value=""
                onChange={e => addWasher(e.target.value)}
                className="w-full input-neon rounded-lg px-3 py-2 text-sm"
              >
                <option value="">
                  {washerIds.length === 0 ? '+ Выбрать мойщика' : '+ Добавить мойщика'}
                </option>
                {availableWashers.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            ) : washerIds.length > 0 ? (
              <p className="text-xs text-slate-500 mt-1">Все мойщики добавлены</p>
            ) : (
              <p className="text-xs text-slate-500">Нет доступных мойщиков</p>
            )}
          </div>

          {/* Способ оплаты */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Способ оплаты</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as CashPaymentMethod)}
              className="w-full input-neon rounded-lg px-3 py-2 text-sm"
            >
              <option value="Наличные">Наличные</option>
              <option value="Банковская карта">Банковская карта</option>
              <option value="QR">QR</option>
              <option value="Перевод">Перевод</option>
              <option value="Бонусы">Бонусы</option>
              <option value="Смешанная">Смешанная</option>
              <option value="Другой">Другой</option>
              <option value="Kaspi">Kaspi</option>
              <option value="Card">Card</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Скидка</label>
              <input type="number" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Бонусы</label>
              <input type="number" value={bonusApplied} onChange={e => setBonusApplied(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Возврат</label>
              <input type="number" value={refundAmount} onChange={e => setRefundAmount(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {paymentMethod === 'Смешанная' && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div><label className="block text-xs text-slate-400 mb-1">Наличные</label><input type="number" value={mixedCash} onChange={e => setMixedCash(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Kaspi</label><input type="number" value={mixedKaspi} onChange={e => setMixedKaspi(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Карта</label><input type="number" value={mixedCard} onChange={e => setMixedCard(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Бонусы</label><input type="number" value={mixedBonus} onChange={e => setMixedBonus(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" /></div>
              <div className="col-span-2 text-xs text-slate-400">Сумма частей: {mixedTotal.toLocaleString('ru-RU')} / {payableAmount.toLocaleString('ru-RU')} {activeOrg.currency}</div>
            </div>
          )}

          {(status === 'completed' || order?.status === 'completed') && paymentMethod === 'Наличные' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Получено от клиента</label>
                <input
                  type="number"
                  value={receivedAmount}
                  onChange={e => setReceivedAmount(Number(e.target.value))}
                  className="w-full input-neon rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Сдача</label>
                <div className="w-full input-neon rounded-lg px-3 py-2 text-sm text-cyan-400">
                  {Math.max(0, receivedAmount - payableAmount).toLocaleString('ru-RU')} {activeOrg.currency}
                </div>
                {receivedAmount < payableAmount && (
                  <p className="text-[10px] text-red-400 mt-1">Недостаточно средств</p>
                )}
              </div>
            </div>
          )}

          {/* Комментарий */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Комментарий</label>
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Доп. информация"
              className="w-full input-neon rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {plateHistorySummary && (
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-slate-300 space-y-1">
              <div className="text-cyan-300 font-medium">История клиента по номеру</div>
              <div>Госномер: <span className="text-white">{plateHistorySummary.plate}</span></div>
              <div>Тип авто: <span className="text-white">{plateHistorySummary.carTypeName}</span></div>
              <div>Заездов: <span className="text-white">{plateHistorySummary.count}</span></div>
              <div>Средний чек: <span className="text-white">{Math.round(plateHistorySummary.averageCheck).toLocaleString('ru-RU')} {activeOrg.currency}</span></div>
              <div>Последняя мойка: <span className="text-white">{plateHistorySummary.lastDate}</span></div>
              <div>Прошлые услуги: <span className="text-white">{plateHistorySummary.services.join(', ') || '—'}</span></div>
            </div>
          )}

          {/* Статус — только при редактировании */}
          {order && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Статус</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as OrderStatus)}
                className="w-full input-neon rounded-lg px-3 py-2 text-sm"
              >
                {statusFlow.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
              </select>
            </div>
          )}

          {/* Итого + кнопки */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div>
              <span className="text-lg font-bold text-cyan-400">
                {payableAmount.toLocaleString('ru-RU')} {activeOrg.currency}
              </span>
              {(discountAmount > 0 || bonusApplied > 0) && <p className="text-[10px] text-slate-500 mt-0.5">Полная стоимость: {totalAmount.toLocaleString('ru-RU')} {activeOrg.currency}</p>}
              {(status === 'completed' || order?.status === 'completed') && (
                <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                  <div>Расходники: <span className="text-white">{(order?.materialsCost ?? costPreview.materialsCost).toLocaleString('ru-RU')} {activeOrg.currency}</span></div>
                  <div>Мойщики: <span className="text-white">{(order?.workersCost ?? costPreview.workersCost).toLocaleString('ru-RU')} {activeOrg.currency}</span></div>
                  <div>Прибыль автомойки: <span className="text-green-400">{(order?.organizationProfit ?? costPreview.organizationProfit).toLocaleString('ru-RU')} {activeOrg.currency}</span></div>
                </div>
              )}
              {washerIds.length > 0 && totalAmount > 0 && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Мойщикам: ~{washerShare.toLocaleString('ru-RU')} {activeOrg.currency} ({washerPercent}%)
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button onClick={handleSave} className="btn-neon rounded-lg px-6 py-2 text-sm font-medium">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderPaymentModal({
  order,
  currency,
  onCancel,
  onConfirm,
}: {
  order: Order;
  currency: string;
  onCancel: () => void;
  onConfirm: (payment: CompletionPaymentData) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<CashPaymentMethod>((order.paymentMethod as CashPaymentMethod) || 'Наличные');
  const [receivedAmount, setReceivedAmount] = useState<number>(order.receivedAmount ?? order.totalAmount);
  const [discountAmount, setDiscountAmount] = useState<number>(order.discountAmount ?? 0);
  const [bonusApplied, setBonusApplied] = useState<number>(order.bonusApplied ?? 0);
  const [refundAmount, setRefundAmount] = useState<number>(order.refundAmount ?? 0);
  const [mixedCash, setMixedCash] = useState<number>(order.paymentParts?.find(part => normalizeOrderPaymentMethod(part.method) === 'Наличные')?.amount ?? 0);
  const [mixedKaspi, setMixedKaspi] = useState<number>(order.paymentParts?.find(part => normalizeOrderPaymentMethod(part.method) === 'Kaspi')?.amount ?? 0);
  const [mixedCard, setMixedCard] = useState<number>(order.paymentParts?.find(part => normalizeOrderPaymentMethod(part.method) === 'Банковская карта')?.amount ?? 0);
  const [mixedBonus, setMixedBonus] = useState<number>(order.paymentParts?.find(part => normalizeOrderPaymentMethod(part.method) === 'Бонусы')?.amount ?? 0);
  const [error, setError] = useState('');

  const payableAmount = Math.max(0, order.totalAmount - Math.max(0, discountAmount) - Math.max(0, bonusApplied));
  const changeAmount = Math.max(0, receivedAmount - payableAmount);
  const paymentParts: PaymentPart[] = paymentMethod === 'Смешанная'
    ? [
      { method: 'Наличные' as OrderPaymentPartMethod, amount: Math.max(0, mixedCash) },
      { method: 'Kaspi' as OrderPaymentPartMethod, amount: Math.max(0, mixedKaspi) },
      { method: 'Банковская карта' as OrderPaymentPartMethod, amount: Math.max(0, mixedCard) },
      { method: 'Бонусы' as OrderPaymentPartMethod, amount: Math.max(0, mixedBonus) },
    ].filter(part => part.amount > 0)
    : [{ method: normalizeOrderPaymentMethod(paymentMethod), amount: payableAmount }];
  const mixedTotal = paymentParts.reduce((sum, part) => sum + part.amount, 0);

  const handleConfirm = () => {
    if (paymentMethod === 'Наличные' && receivedAmount < payableAmount) {
      setError('Недостаточно средств');
      return;
    }
    if (paymentMethod === 'Смешанная' && mixedTotal !== payableAmount) {
      setError('Сумма смешанной оплаты должна совпадать с суммой к оплате');
      return;
    }
    onConfirm({
      paymentMethod,
      paymentParts,
      receivedAmount: paymentMethod === 'Наличные' ? receivedAmount : undefined,
      changeAmount: paymentMethod === 'Наличные' ? changeAmount : 0,
      discountAmount,
      bonusApplied,
      refundAmount,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onCancel}>
      <div className="modal-panel rounded-2xl p-6 w-full max-w-md mx-4 animate-fadeIn neon-glow" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">Оплата заказа</h2>
        <div className="space-y-4">
          <div className="text-sm text-slate-300">
            Заказ: <span className="text-white">{order.orderNumber || order.id}</span> •
            Сумма: <span className="text-cyan-400 ml-1">{payableAmount.toLocaleString('ru-RU')} {currency}</span>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Способ оплаты</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as CashPaymentMethod)} className="w-full input-neon rounded-lg px-3 py-2 text-sm">
              <option value="Наличные">Наличные</option>
              <option value="Банковская карта">Банковская карта</option>
              <option value="QR">QR</option>
              <option value="Перевод">Перевод</option>
              <option value="Бонусы">Бонусы</option>
              <option value="Смешанная">Смешанная</option>
              <option value="Другой">Другой</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Скидка</label>
              <input type="number" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Бонусы</label>
              <input type="number" value={bonusApplied} onChange={e => setBonusApplied(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Возврат</label>
              <input type="number" value={refundAmount} onChange={e => setRefundAmount(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {paymentMethod === 'Смешанная' && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div><label className="block text-xs text-slate-400 mb-1">Наличные</label><input type="number" value={mixedCash} onChange={e => setMixedCash(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Kaspi</label><input type="number" value={mixedKaspi} onChange={e => setMixedKaspi(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Карта</label><input type="number" value={mixedCard} onChange={e => setMixedCard(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Бонусы</label><input type="number" value={mixedBonus} onChange={e => setMixedBonus(Number(e.target.value) || 0)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" /></div>
              <div className="col-span-2 text-xs text-slate-400">Сумма частей: {mixedTotal.toLocaleString('ru-RU')} / {payableAmount.toLocaleString('ru-RU')} {currency}</div>
            </div>
          )}

          {paymentMethod === 'Наличные' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Получено</label>
                <input type="number" value={receivedAmount} onChange={e => setReceivedAmount(Number(e.target.value))} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Сдача</label>
                <div className="w-full input-neon rounded-lg px-3 py-2 text-sm text-cyan-400">{changeAmount.toLocaleString('ru-RU')} {currency}</div>
              </div>
            </div>
          )}

          {error && <div className="text-xs text-red-400">{error}</div>}

          <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Отмена</button>
            <button onClick={handleConfirm} className="btn-neon rounded-lg px-6 py-2 text-sm font-medium">Подтвердить оплату</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Batch Create Modal
function BatchModal({ activeOrg, services, carTypes, washers, prices, onClose }: {
  activeOrg: Organization;
  services: { id: string; name: string }[];
  carTypes: { id: string; name: string }[];
  washers: { id: string; name: string }[];
  prices: { serviceId: string; carTypeId: string; price: number }[];
  onClose: () => void;
}) {
  const [count, setCount] = useState(5);
  const [carTypeId, setCarTypeId] = useState(carTypes[0]?.id || '');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [washerId, setWasherId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const getServicePrice = (serviceId: string): number => {
    const p = prices.find(p => p.serviceId === serviceId && p.carTypeId === carTypeId);
    return p?.price || 0;
  };

  const orderServices: OrderService[] = Array.from(selectedServices).map(sid => ({
    serviceId: sid,
    serviceName: services.find(s => s.id === sid)?.name || '',
    price: getServicePrice(sid),
  }));
  const totalPerOrder = orderServices.reduce((s, os) => s + os.price, 0);
  const totalAmount = totalPerOrder * count;

  const handleCreate = () => {
    if (count < 1 || count > 100 || selectedServices.size === 0 || !carTypeId) {
      setErrorMessage('Заполните все поля корректно (1-100 заказов)');
      return;
    }

    const ct = carTypes.find(c => c.id === carTypeId);
    const w = washers.find(x => x.id === washerId);
    const batchId = generateId();
    const orderIds: string[] = [];

    for (let i = 0; i < count; i++) {
      const orderId = generateId();
      orderIds.push(orderId);
      addOrder({
        id: orderId,
        organizationId: activeOrg.id,
        carTypeId,
        carTypeName: ct?.name || '',
        licensePlate: `БАТЧ-${i + 1}`,
        services: orderServices,
        status: 'waiting',
        washerId: washerId || undefined,
        washerName: w?.name || undefined,
        comment: `Пакет: ${batchName || batchId}`,
        totalAmount: totalPerOrder,
        createdAt: new Date().toISOString(),
        batchId,
      });
    }

    addBatch({
      id: batchId,
      organizationId: activeOrg.id,
      name: batchName || `Пакет ${new Date().toLocaleDateString('ru-RU')}`,
      orderIds,
      createdAt: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div className="modal-panel rounded-2xl p-6 w-full max-w-lg mx-4 animate-fadeIn neon-glow" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">📦 Пакетное создание</h2>
        {errorMessage && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-3">
            {errorMessage}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Название пакета</label>
            <input type="text" value={batchName} onChange={e => setBatchName(e.target.value)} placeholder="Например: Корпоративные клиенты" className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Количество (1-100)</label>
              <input type="number" value={count} onChange={e => setCount(Math.min(100, Math.max(1, Number(e.target.value))))} min={1} max={100} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Тип авто</label>
              <select value={carTypeId} onChange={e => setCarTypeId(e.target.value)} className="w-full input-neon rounded-lg px-3 py-2 text-sm">
                <option value="">Выберите</option>
                {carTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Услуги</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {services.map(svc => {
                const price = getServicePrice(svc.id);
                const checked = selectedServices.has(svc.id);
                return (
                  <label key={svc.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs ${checked ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-white/3 border border-white/5'}`}>
                    <input type="checkbox" checked={checked} onChange={() => {
                      setSelectedServices(prev => {
                        const n = new Set(prev);
                        if (n.has(svc.id)) n.delete(svc.id); else n.add(svc.id);
                        return n;
                      });
                    }} className="rounded" />
                    <span className="flex-1 text-slate-300">{svc.name}</span>
                    <span className="text-cyan-400">{price.toLocaleString('ru-RU')}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Мойщик</label>
            <select value={washerId} onChange={e => setWasherId(e.target.value)} className="w-full input-neon rounded-lg px-3 py-2 text-sm">
              <option value="">Не назначен</option>
              {washers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div>
              <span className="text-lg font-bold text-cyan-400">{totalAmount.toLocaleString('ru-RU')} {activeOrg.currency}</span>
              <p className="text-[10px] text-slate-500">{totalPerOrder.toLocaleString('ru-RU')} × {count}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors">Отмена</button>
              <button onClick={handleCreate} className="btn-neon rounded-lg px-6 py-2 text-sm font-medium">Создать {count} заказов</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
