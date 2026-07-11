import { useMemo, useState } from 'react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { downloadWorkbook, createWorksheetFromObjects, createWorksheetFromRowArrays } from '../utils/excelUtils';
import { Organization, CashOperationType, CashPaymentMethod, generateId, User } from '../types';
import {
  addActionLog,
  addCashOperation,
  addCashShift,
  calculateCashSummary,
  calculateCashReport,
  closeCashShift,
  getCashOperations,
  getCashShifts,
  getOpenCashShift,
  getCashShiftMetrics,
  normalizePaymentMethod,
  userHasPermission,
} from '../store';

interface CashierProps {
  activeOrg: Organization;
  userRole: 'admin' | 'manager';
}

const PAYMENT_LABELS: Record<string, string> = {
  'Наличные': 'Наличные',
  'Банковская карта': 'Карта',
  QR: 'QR',
  'Перевод': 'Перевод',
  'Бонусы': 'Бонусы',
  'Смешанная': 'Смешанная',
  'Другой': 'Другой',
  Kaspi: 'Kaspi',
  Card: 'Card',
};

const OP_TYPE_LABELS: Record<CashOperationType, string> = {
  order_payment: 'Оплата заказа',
  cash_in: 'Внесение в кассу',
  expense_supply: 'Покупка расходников',
  expense_payout: 'Выдача денег',
  cash_collection: 'Инкассация',
  refund: 'Возврат',
  expense_other: 'Прочий расход',
  correction: 'Корректировка',
};

const CASH_OP_OPTIONS: Array<{ type: CashOperationType; label: string; direction: 'income' | 'expense' }> = [
  { type: 'cash_in', label: 'Внесение', direction: 'income' },
  { type: 'expense_payout', label: 'Изъятие', direction: 'expense' },
  { type: 'cash_collection', label: 'Инкассация', direction: 'expense' },
  { type: 'refund', label: 'Возврат', direction: 'expense' },
  { type: 'correction', label: 'Корректировка', direction: 'expense' },
];

export default function Cashier({ activeOrg, userRole }: CashierProps) {
  const [version, setVersion] = useState(0);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [cashierName, setCashierName] = useState(userRole === 'manager' ? 'Управляющий' : 'Администратор');
  const [openAtLocal, setOpenAtLocal] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [openingCash, setOpeningCash] = useState(20000);
  const [openingComment, setOpeningComment] = useState('');
  const [factCash, setFactCash] = useState(0);
  const [closingComment, setClosingComment] = useState('');

  const [opAmount, setOpAmount] = useState(0);
  const [opType, setOpType] = useState<CashOperationType>('cash_in');
  const [opDirection, setOpDirection] = useState<'income' | 'expense'>('income');
  const [opDescription, setOpDescription] = useState('');
  const [opPaymentMethod, setOpPaymentMethod] = useState<CashPaymentMethod>('Наличные');

  const [reportRange, setReportRange] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [reportFrom, setReportFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportTo, setReportTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportCashier, setReportCashier] = useState('');

  const [searchOrder, setSearchOrder] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<'all' | CashPaymentMethod>('all');
  const [filterDirection, setFilterDirection] = useState<'all' | 'income' | 'expense'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'type'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const refresh = () => setVersion(v => v + 1);
  const currentUser: User = useMemo(() => ({ role: userRole, name: userRole === 'manager' ? 'Управляющий' : 'Администратор' }), [userRole]);
  const canViewCash = userHasPermission(currentUser, 'canViewCash');
  const canManageCashShift = userHasPermission(currentUser, 'canManageCashShift');
  const canManageCashOps = userHasPermission(currentUser, 'canManageCashOperations');
  const canViewCashReports = userHasPermission(currentUser, 'canViewCashReports');
  const canExportCash = userHasPermission(currentUser, 'canExportCash');
  const actorName = userRole === 'manager' ? 'Управляющий' : 'Администратор';

  const shifts = useMemo(() => getCashShifts(activeOrg.id), [activeOrg.id, version]);
  const openShift = useMemo(() => getOpenCashShift(activeOrg.id), [activeOrg.id, version]);
  const operations = useMemo(
    () => getCashOperations(activeOrg.id).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [activeOrg.id, version]
  );

  const now = new Date();
  const daySummary = useMemo(() => calculateCashSummary(activeOrg.id, startOfDay(now).toISOString(), endOfDay(now).toISOString()), [activeOrg.id, version]);
  const monthSummary = useMemo(() => calculateCashSummary(activeOrg.id, startOfMonth(now).toISOString(), endOfMonth(now).toISOString()), [activeOrg.id, version]);

  const openShiftMetrics = useMemo(
    () => (openShift
      ? getCashShiftMetrics(activeOrg.id, openShift.id)
      : {
        cashIncome: 0,
        cardIncome: 0,
        qrIncome: 0,
        transferIncome: 0,
        bonusIncome: 0,
        mixedIncome: 0,
        otherIncome: 0,
        refunds: 0,
        discounts: 0,
        bonuses: 0,
        checksCount: 0,
        averageCheck: 0,
        expense: 0,
        income: 0,
        turnover: 0,
      }),
    [activeOrg.id, openShift, version]
  );

  const expectedCashNow = (openShift?.openingCash || 0) + openShiftMetrics.cashIncome - openShiftMetrics.expense;
  const turnoverNow = openShiftMetrics.turnover || (openShiftMetrics.income + openShiftMetrics.expense);

  const formatPaymentLabel = (method: CashPaymentMethod) => PAYMENT_LABELS[normalizePaymentMethod(method)] || normalizePaymentMethod(method);
  const getOperationPaymentLabel = (op: typeof operations[number]) => {
    if (!op.paymentParts || op.paymentParts.length === 0) {
      return op.paymentMethod ? formatPaymentLabel(op.paymentMethod) : '—';
    }
    const partsText = op.paymentParts
      .map(part => `${formatPaymentLabel(part.method as CashPaymentMethod)}: ${Math.round(part.amount).toLocaleString('ru-RU')}`)
      .join('; ');
    return `Смешанная (${partsText})`;
  };

  const filteredOperationsRaw = useMemo(() => {
    const fromTime = filterDateFrom ? startOfDay(new Date(filterDateFrom)).getTime() : Number.MIN_SAFE_INTEGER;
    const toTime = filterDateTo ? endOfDay(new Date(filterDateTo)).getTime() : Number.MAX_SAFE_INTEGER;
    const orderQuery = searchOrder.trim().toLowerCase();

    return operations.filter(op => {
      const time = new Date(op.createdAt).getTime();
      if (time < fromTime || time > toTime) return false;
      if (filterDirection !== 'all' && op.direction !== filterDirection) return false;
      if (filterPaymentMethod !== 'all' && normalizePaymentMethod(op.paymentMethod) !== filterPaymentMethod) return false;
      if (orderQuery) {
        const hay = `${op.orderNumber || ''} ${op.licensePlate || ''} ${op.description || ''}`.toLowerCase();
        if (!hay.includes(orderQuery)) return false;
      }
      return true;
    });
  }, [operations, filterDateFrom, filterDateTo, filterDirection, filterPaymentMethod, searchOrder]);

  const filteredOperations = useMemo(() => {
    const sorted = [...filteredOperationsRaw].sort((a, b) => {
      const directionFactor = sortDirection === 'asc' ? 1 : -1;
      if (sortBy === 'amount') return directionFactor * (a.amount - b.amount);
      if (sortBy === 'type') return directionFactor * OP_TYPE_LABELS[a.type].localeCompare(OP_TYPE_LABELS[b.type]);
      return directionFactor * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
    return sorted;
  }, [filteredOperationsRaw, sortBy, sortDirection]);

  const paginatedOperations = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOperations.slice(start, start + pageSize);
  }, [filteredOperations, page]);

  const totalPages = Math.max(1, Math.ceil(filteredOperations.length / pageSize));

  const cashDailyChart = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const date = subDays(now, 13 - i);
      const summary = calculateCashSummary(activeOrg.id, startOfDay(date).toISOString(), endOfDay(date).toISOString());
      return {
        day: format(date, 'dd.MM'),
        revenue: summary.income,
        checks: summary.checksCount || 0,
        avgCheck: summary.averageCheck || 0,
        refunds: summary.refunds || 0,
      };
    });
  }, [activeOrg.id, version]);

  const paymentMethodChart = useMemo(() => {
    return [
      { name: 'Наличные', value: monthSummary.cashIncome, color: '#06b6d4' },
      { name: 'Карта', value: monthSummary.cardIncome, color: '#8b5cf6' },
      { name: 'QR', value: monthSummary.qrIncome, color: '#22c55e' },
      { name: 'Перевод', value: monthSummary.transferIncome, color: '#f59e0b' },
      { name: 'Бонусы', value: monthSummary.bonusIncome || 0, color: '#ec4899' },
    ].filter(item => item.value > 0);
  }, [monthSummary]);

  const report = useMemo(() => {
    const from = reportRange === 'day'
      ? startOfDay(now)
      : reportRange === 'week'
        ? startOfWeek(now, { weekStartsOn: 1 })
        : reportRange === 'month'
          ? startOfMonth(now)
          : startOfDay(new Date(reportFrom));
    const to = reportRange === 'day'
      ? endOfDay(now)
      : reportRange === 'week'
        ? endOfWeek(now, { weekStartsOn: 1 })
        : reportRange === 'month'
          ? endOfMonth(now)
          : endOfDay(new Date(reportTo));
    return calculateCashReport(activeOrg.id, from.toISOString(), to.toISOString(), reportCashier.trim() || undefined);
  }, [activeOrg.id, now, reportRange, reportFrom, reportTo, reportCashier, version]);

  const openCashShift = () => {
    if (openShift) {
      alert('Кассовая смена уже открыта');
      return;
    }
    addCashShift({
      id: generateId(),
      organizationId: activeOrg.id,
      cashierName: cashierName.trim() || (userRole === 'manager' ? 'Управляющий' : 'Администратор'),
      openedAt: new Date(openAtLocal).toISOString(),
      openingCash: Math.max(0, Math.round(openingCash)),
      openingComment: openingComment.trim() || undefined,
    });
    setShowOpenShift(false);
    setOpeningComment('');
    setOpenAtLocal(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    refresh();
  };

  const handleCloseShift = () => {
    if (!openShift) return;
    if (!canManageCashShift) {
      alert('Закрывать смену может только управляющий');
      return;
    }
    const delta = Math.round(factCash - expectedCashNow);
    if (delta !== 0 && !closingComment.trim()) {
      alert('При расхождении требуется комментарий');
      return;
    }
    const closed = closeCashShift(activeOrg.id, openShift.id, actorName, factCash, closingComment.trim());
    if (!closed) {
      alert('Не удалось закрыть смену');
      return;
    }
    setShowCloseShift(false);
    setClosingComment('');
    refresh();
  };

  const submitManualOperation = () => {
    if (!canManageCashOps) {
      alert('Кассовые операции недоступны для текущей роли');
      return;
    }
    if (!openShift) {
      alert('Сначала откройте смену');
      return;
    }
    if (opAmount <= 0) {
      alert('Укажите сумму');
      return;
    }
    addCashOperation({
      id: generateId(),
      organizationId: activeOrg.id,
      shiftId: openShift.id,
      createdAt: new Date().toISOString(),
      employeeName: actorName,
      performedBy: actorName,
      amount: Math.round(opAmount),
      direction: opDirection,
      type: opType,
      paymentMethod: opPaymentMethod,
      description: opDescription.trim() || OP_TYPE_LABELS[opType],
    });
    setOpAmount(0);
    setOpDescription('');
    setShowOperationModal(false);
    refresh();
  };

  const handleOpTypeChange = (nextType: CashOperationType) => {
    setOpType(nextType);
    const preset = CASH_OP_OPTIONS.find(option => option.type === nextType);
    if (preset && nextType !== 'correction') {
      setOpDirection(preset.direction);
    }
  };

  const exportOperationsCSV = () => {
    const headers = ['Дата', 'Время', 'Сотрудник', 'Тип', 'Направление', 'Сумма', 'Способ оплаты', 'Заказ', 'Описание', 'Прибыль', 'Кто изменил', 'Основание'];
    const rows = filteredOperations.map(op => [
      format(new Date(op.createdAt), 'dd.MM.yyyy'),
      format(new Date(op.createdAt), 'HH:mm'),
      op.employeeName,
      OP_TYPE_LABELS[op.type],
      op.direction === 'income' ? 'Приход' : 'Расход',
      String(op.amount),
      getOperationPaymentLabel(op),
      op.orderNumber || '',
      op.description || '',
      String(op.direction === 'income' ? op.amount : -op.amount),
      op.performedBy || op.employeeName,
      op.correctionReason || '',
    ]);

    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash_journal_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logCashExport('Экспорт журнала кассовых операций (CSV)', openShift?.id || activeOrg.id);
  };

  const exportOperationsPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Журнал кассовых операций — ${activeOrg.name}`, 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Дата', 'Сотрудник', 'Тип', 'Напр.', 'Сумма', 'Способ', 'Заказ', 'Комментарий']],
      body: filteredOperations.map(op => [
        format(new Date(op.createdAt), 'dd.MM.yyyy HH:mm'),
        op.employeeName,
        OP_TYPE_LABELS[op.type],
        op.direction === 'income' ? 'Приход' : 'Расход',
        String(op.amount),
        getOperationPaymentLabel(op),
        op.orderNumber || '',
        op.description || '',
      ]),
      theme: 'grid',
      styles: { fontSize: 8 },
    });
    doc.save(`cash_journal_${format(now, 'yyyyMMdd_HHmm')}.pdf`);
    logCashExport('Экспорт журнала кассовых операций (PDF)', openShift?.id || activeOrg.id);
  };

  const exportOperationsExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const rows = filteredOperations.map(op => ({
      Дата: format(new Date(op.createdAt), 'dd.MM.yyyy HH:mm'),
      Сотрудник: op.employeeName,
      Тип: OP_TYPE_LABELS[op.type],
      Направление: op.direction === 'income' ? 'Приход' : 'Расход',
      Сумма: op.amount,
      Способ: getOperationPaymentLabel(op),
      Заказ: op.orderNumber || '',
      Комментарий: op.description || '',
    }));
    createWorksheetFromObjects(workbook, 'Журнал', rows, [18, 20, 20, 15, 12, 25, 15, 30], [4]);
    await downloadWorkbook(workbook, `cash_journal_${format(now, 'yyyyMMdd_HHmm')}.xlsx`);
    logCashExport('Экспорт журнала кассовых операций (Excel)', openShift?.id || activeOrg.id);
  };

  const logCashExport = (description: string, targetId: string) => {
    addActionLog({
      id: generateId(),
      organizationId: activeOrg.id,
      performedBy: actorName,
      action: 'cash_operation',
      targetType: 'shift',
      targetId,
      description,
      createdAt: new Date().toISOString(),
    });
  };

  const getShiftExportRows = (shiftForReport: typeof shifts[number], metrics: ReturnType<typeof getCashShiftMetrics>) => ([
    ['Кассир', shiftForReport.cashierName],
    ['Открытие', format(new Date(shiftForReport.openedAt), 'dd.MM.yyyy HH:mm')],
    ['Закрытие', shiftForReport.closedAt ? format(new Date(shiftForReport.closedAt), 'dd.MM.yyyy HH:mm') : '—'],
    ['Комментарий открытия', shiftForReport.openingComment || '—'],
    ['Комментарий закрытия', shiftForReport.closingComment || '—'],
    ['Начальная сумма', shiftForReport.openingCash],
    ['Наличные', metrics.cashIncome],
    ['Карта', metrics.cardIncome],
    ['QR', metrics.qrIncome],
    ['Перевод', metrics.transferIncome],
    ['Бонусы', metrics.bonusIncome || 0],
    ['Возвраты', metrics.refunds || 0],
    ['Скидки', metrics.discounts || 0],
    ['Чеков', metrics.checksCount || 0],
    ['Средний чек', metrics.averageCheck || 0],
    ['Оборот', metrics.turnover || 0],
  ]);

  const exportShiftCsv = () => {
    const shiftForReport = openShift || shifts.slice().sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())[0];
    if (!shiftForReport) return;
    const metrics = getCashShiftMetrics(activeOrg.id, shiftForReport.id);
    const rows = getShiftExportRows(shiftForReport, metrics);
    const csv = rows.map(row => row.map(cell => `"${String(cell)}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash_shift_${shiftForReport.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logCashExport('Экспорт кассовой смены (CSV)', shiftForReport.id);
  };

  const exportShiftExcel = async () => {
    const shiftForReport = openShift || shifts.slice().sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())[0];
    if (!shiftForReport) return;
    const metrics = getCashShiftMetrics(activeOrg.id, shiftForReport.id);
    const workbook = new ExcelJS.Workbook();
    createWorksheetFromRowArrays(workbook, 'Смена', getShiftExportRows(shiftForReport, metrics));
    await downloadWorkbook(workbook, `cash_shift_${shiftForReport.id}.xlsx`);
    logCashExport('Экспорт кассовой смены (Excel)', shiftForReport.id);
  };

  const exportShiftPdf = () => {
    const shiftForReport = openShift || shifts.slice().sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())[0];
    if (!shiftForReport) {
      alert('Нет смен для экспорта');
      return;
    }
    const metrics = getCashShiftMetrics(activeOrg.id, shiftForReport.id);
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Кассовая смена — ${activeOrg.name}`, 14, 16);
    autoTable(doc, {
      startY: 24,
      head: [['Показатель', 'Значение']],
      body: [
        ['Кассир', shiftForReport.cashierName],
        ['Открытие', format(new Date(shiftForReport.openedAt), 'dd.MM.yyyy HH:mm')],
        ['Закрытие', shiftForReport.closedAt ? format(new Date(shiftForReport.closedAt), 'dd.MM.yyyy HH:mm') : '—'],
        ['Начальная сумма', `${shiftForReport.openingCash.toLocaleString('ru-RU')} ${activeOrg.currency}`],
        ['Наличные', `${metrics.cashIncome.toLocaleString('ru-RU')} ${activeOrg.currency}`],
        ['Карта', `${metrics.cardIncome.toLocaleString('ru-RU')} ${activeOrg.currency}`],
        ['QR', `${metrics.qrIncome.toLocaleString('ru-RU')} ${activeOrg.currency}`],
        ['Перевод', `${metrics.transferIncome.toLocaleString('ru-RU')} ${activeOrg.currency}`],
        ['Бонусы', `${(metrics.bonusIncome || 0).toLocaleString('ru-RU')} ${activeOrg.currency}`],
        ['Возвраты', `${(metrics.refunds || 0).toLocaleString('ru-RU')} ${activeOrg.currency}`],
        ['Скидки', `${(metrics.discounts || 0).toLocaleString('ru-RU')} ${activeOrg.currency}`],
        ['Чеков', String(metrics.checksCount || 0)],
        ['Средний чек', `${(metrics.averageCheck || 0).toLocaleString('ru-RU')} ${activeOrg.currency}`],
        ['Оборот', `${(metrics.turnover || 0).toLocaleString('ru-RU')} ${activeOrg.currency}`],
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
    });
    doc.save(`cash_shift_${shiftForReport.id}.pdf`);
    logCashExport('Экспорт кассовой смены (PDF)', shiftForReport.id);
  };

  const exportReportCsv = () => {
    const rows = [
      ['Период', `${format(new Date(report.fromISO), 'dd.MM.yyyy')} - ${format(new Date(report.toISO), 'dd.MM.yyyy')}`],
      ['Кассир', report.cashierName || 'Все'],
      ['Оборот', report.summary.turnover],
      ['Выручка', report.summary.income],
      ['Наличные', report.summary.cashIncome],
      ['Карта', report.summary.cardIncome],
      ['QR', report.summary.qrIncome],
      ['Перевод', report.summary.transferIncome],
      ['Бонусы', report.summary.bonusIncome],
      ['Возвраты', report.summary.refunds],
      ['Скидки', report.summary.discounts],
      ['Чеки', report.summary.checksCount],
      ['Средний чек', report.summary.averageCheck],
    ];
    const csv = rows.map(row => row.map(cell => `"${String(cell)}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash_report_${format(now, 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logCashExport('Экспорт кассового отчёта (CSV)', openShift?.id || activeOrg.id);
  };

  const exportReportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const rows = [
      { Показатель: 'Период', Значение: `${format(new Date(report.fromISO), 'dd.MM.yyyy')} - ${format(new Date(report.toISO), 'dd.MM.yyyy')}` },
      { Показатель: 'Кассир', Значение: report.cashierName || 'Все' },
      { Показатель: 'Оборот', Значение: report.summary.turnover },
      { Показатель: 'Выручка', Значение: report.summary.income },
      { Показатель: 'Наличные', Значение: report.summary.cashIncome },
      { Показатель: 'Карта', Значение: report.summary.cardIncome },
      { Показатель: 'QR', Значение: report.summary.qrIncome },
      { Показатель: 'Перевод', Значение: report.summary.transferIncome },
      { Показатель: 'Бонусы', Значение: report.summary.bonusIncome },
      { Показатель: 'Возвраты', Значение: report.summary.refunds },
      { Показатель: 'Скидки', Значение: report.summary.discounts },
      { Показатель: 'Чеки', Значение: report.summary.checksCount },
      { Показатель: 'Средний чек', Значение: report.summary.averageCheck },
    ];
    createWorksheetFromObjects(workbook, 'Отчёт', rows, [25, 20]);
    await downloadWorkbook(workbook, `cash_report_${format(now, 'yyyyMMdd_HHmm')}.xlsx`);
    logCashExport('Экспорт кассового отчёта (Excel)', openShift?.id || activeOrg.id);
  };

  const exportReportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Кассовый отчёт — ${activeOrg.name}`, 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Показатель', 'Значение']],
      body: [
        ['Период', `${format(new Date(report.fromISO), 'dd.MM.yyyy')} - ${format(new Date(report.toISO), 'dd.MM.yyyy')}`],
        ['Кассир', report.cashierName || 'Все'],
        ['Оборот', String(report.summary.turnover)],
        ['Выручка', String(report.summary.income)],
        ['Наличные', String(report.summary.cashIncome)],
        ['Карта', String(report.summary.cardIncome)],
        ['QR', String(report.summary.qrIncome)],
        ['Перевод', String(report.summary.transferIncome)],
        ['Бонусы', String(report.summary.bonusIncome)],
        ['Возвраты', String(report.summary.refunds)],
        ['Скидки', String(report.summary.discounts)],
        ['Чеки', String(report.summary.checksCount)],
        ['Средний чек', String(report.summary.averageCheck)],
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
    });
    doc.save(`cash_report_${format(now, 'yyyyMMdd_HHmm')}.pdf`);
    logCashExport('Экспорт кассового отчёта (PDF)', openShift?.id || activeOrg.id);
  };

  const printShiftReport = () => {
    const shiftForReport = openShift || shifts.slice().sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())[0];
    if (!shiftForReport) {
      alert('Нет смен для печати');
      return;
    }
    const m = getCashShiftMetrics(activeOrg.id, shiftForReport.id);
    const expected = shiftForReport.expectedCash ?? Math.round(shiftForReport.openingCash + m.cashIncome - m.expense);
    const fact = shiftForReport.factCash ?? expected;
    const diff = shiftForReport.difference ?? (fact - expected);

    const html = `
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Отчёт смены</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #111827; }
          h1 { margin: 0 0 6px; font-size: 20px; }
          .muted { color: #6b7280; font-size: 12px; }
          .line { margin: 8px 0; font-size: 14px; }
          .total { margin-top: 12px; font-weight: 700; font-size: 16px; }
          .sign { margin-top: 32px; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <h1>${activeOrg.name}</h1>
        <div class="muted">Отчёт кассовой смены</div>
        <div class="line">Открыта: ${format(new Date(shiftForReport.openedAt), 'dd.MM.yyyy HH:mm')}</div>
        <div class="line">Закрыта: ${shiftForReport.closedAt ? format(new Date(shiftForReport.closedAt), 'dd.MM.yyyy HH:mm') : '—'}</div>
        <div class="line">Сумма на начало: ${shiftForReport.openingCash.toLocaleString('ru-RU')} ${activeOrg.currency}</div>
        <div class="line">Продажи наличными: ${m.cashIncome.toLocaleString('ru-RU')} ${activeOrg.currency}</div>
        <div class="line">Продажи картой: ${m.cardIncome.toLocaleString('ru-RU')} ${activeOrg.currency}</div>
        <div class="line">Продажи QR: ${m.qrIncome.toLocaleString('ru-RU')} ${activeOrg.currency}</div>
        <div class="line">Переводы: ${m.transferIncome.toLocaleString('ru-RU')} ${activeOrg.currency}</div>
        <div class="line">Расходы: ${m.expense.toLocaleString('ru-RU')} ${activeOrg.currency}</div>
        <div class="line">Ожидаемая наличность: ${expected.toLocaleString('ru-RU')} ${activeOrg.currency}</div>
        <div class="line">Фактическая наличность: ${fact.toLocaleString('ru-RU')} ${activeOrg.currency}</div>
        <div class="total">${diff >= 0 ? 'Излишек' : 'Недостача'}: ${Math.abs(diff).toLocaleString('ru-RU')} ${activeOrg.currency}</div>
        <div class="sign">
          <div>Ответственный: __________________</div>
          <div>Подпись: __________________</div>
        </div>
      </body>
      </html>
    `;

    const w = window.open('', '_blank', 'width=560,height=760');
    if (!w) {
      alert('Не удалось открыть окно печати. Разрешите всплывающие окна.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  if (!canViewCash) {
    return <div className="glass rounded-xl p-6 text-slate-400">Нет доступа к разделу кассы.</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Касса</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportOperationsCSV} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canExportCash}>Журнал CSV</button>
          <button onClick={exportOperationsExcel} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canExportCash}>Журнал Excel</button>
          <button onClick={exportOperationsPdf} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canExportCash}>Журнал PDF</button>
          <button onClick={exportShiftCsv} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canExportCash}>Смена CSV</button>
          <button onClick={exportShiftExcel} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canExportCash}>Смена Excel</button>
          <button onClick={exportShiftPdf} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canExportCash}>Смена PDF</button>
          <button onClick={() => setShowReportModal(true)} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canViewCashReports}>Отчёты</button>
          <button onClick={printShiftReport} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canExportCash}>Печать</button>
        </div>
      </div>

      {!canManageCashShift && (
        <div className="glass rounded-xl p-3 text-xs text-slate-400 border border-cyan-500/15">
          Роль администратора: просмотр кассы и приём оплаты. Корректировки, расходы и закрытие смены доступны только управляющему.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-slate-400">Смена</p>
          <p className="text-lg font-bold text-white">{openShift ? 'Открыта' : 'Закрыта'}</p>
          <p className="text-[10px] text-slate-500 mt-1">{openShift ? format(new Date(openShift.openedAt), 'dd.MM HH:mm') : '—'}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-slate-400">Кассир</p>
          <p className="text-lg font-bold text-white">{openShift?.cashierName || '—'}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-slate-400">Текущая наличность</p>
          <p className="text-lg font-bold text-cyan-400">{expectedCashNow.toLocaleString('ru-RU')} {activeOrg.currency}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-slate-400">Приход за день</p>
          <p className="text-lg font-bold text-green-400">{daySummary.income.toLocaleString('ru-RU')} {activeOrg.currency}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-slate-400">Расход за день</p>
          <p className="text-lg font-bold text-red-400">{daySummary.expense.toLocaleString('ru-RU')} {activeOrg.currency}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-slate-400">Чеков / средний чек</p>
          <p className="text-lg font-bold text-white">{daySummary.checksCount || 0} / {(daySummary.averageCheck || 0).toLocaleString('ru-RU')}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-slate-400">Оборот</p>
          <p className="text-lg font-bold text-white">{turnoverNow.toLocaleString('ru-RU')} {activeOrg.currency}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Выручка по дням</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashDailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2} />
                <Line type="monotone" dataKey="refunds" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Способы оплаты</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentMethodChart} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45}>
                  {paymentMethodChart.map(item => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-sm font-semibold text-white">Кассовая смена</h2>
          <div className="flex gap-2">
            {!openShift && (
              <button onClick={() => setShowOpenShift(true)} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canManageCashShift}>Открыть смену</button>
            )}
            {openShift && (
              <button onClick={() => { setFactCash(expectedCashNow); setShowCloseShift(true); }} className="btn-success rounded-lg px-4 py-2 text-sm" disabled={!canManageCashShift}>
                Закрыть смену
              </button>
            )}
            <button onClick={() => setShowOperationModal(true)} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canManageCashOps || !openShift}>Операция</button>
          </div>
        </div>

        {openShift ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg bg-white/3 border border-white/5 p-3">
              <p className="text-xs text-slate-400">Открыл</p>
              <p className="text-white font-medium">{openShift.cashierName}</p>
            </div>
            <div className="rounded-lg bg-white/3 border border-white/5 p-3">
              <p className="text-xs text-slate-400">Начальная сумма</p>
              <p className="text-cyan-400 font-medium">{openShift.openingCash.toLocaleString('ru-RU')} {activeOrg.currency}</p>
            </div>
            <div className="rounded-lg bg-white/3 border border-white/5 p-3">
              <p className="text-xs text-slate-400">Ожидается сейчас</p>
              <p className="text-white font-medium">{expectedCashNow.toLocaleString('ru-RU')} {activeOrg.currency}</p>
            </div>
            <div className="rounded-lg bg-white/3 border border-white/5 p-3">
              <p className="text-xs text-slate-400">Бонусы / возвраты / скидки</p>
              <p className="text-white font-medium">{(openShiftMetrics.bonuses || 0).toLocaleString('ru-RU')} / {(openShiftMetrics.refunds || 0).toLocaleString('ru-RU')} / {(openShiftMetrics.discounts || 0).toLocaleString('ru-RU')}</p>
            </div>
            <div className="rounded-lg bg-white/3 border border-white/5 p-3">
              <p className="text-xs text-slate-400">Чеков / средний чек</p>
              <p className="text-white font-medium">{openShiftMetrics.checksCount || 0} / {(openShiftMetrics.averageCheck || 0).toLocaleString('ru-RU')}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Смена не открыта</p>
        )}
      </div>

      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Отчёт по кассе</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg bg-white/3 border border-white/5 p-4">
            <p className="text-xs text-slate-400 mb-2">За день</p>
            <p className="text-xs text-slate-400">Выручка: <span className="text-white">{daySummary.income.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Наличные: <span className="text-white">{daySummary.cashIncome.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Карта: <span className="text-white">{daySummary.cardIncome.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">QR: <span className="text-white">{daySummary.qrIncome.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Перевод: <span className="text-white">{daySummary.transferIncome.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Бонусы: <span className="text-white">{(daySummary.bonusIncome || 0).toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Возвраты: <span className="text-red-400">{(daySummary.refunds || 0).toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Скидки: <span className="text-red-400">{(daySummary.discounts || 0).toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Расходы: <span className="text-red-400">{daySummary.expense.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Итог: <span className="text-cyan-400">{daySummary.result.toLocaleString('ru-RU')}</span></p>
          </div>

          <div className="rounded-lg bg-white/3 border border-white/5 p-4">
            <p className="text-xs text-slate-400 mb-2">За месяц</p>
            <p className="text-xs text-slate-400">Выручка: <span className="text-white">{monthSummary.income.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Наличные: <span className="text-white">{monthSummary.cashIncome.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Карта: <span className="text-white">{monthSummary.cardIncome.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">QR: <span className="text-white">{monthSummary.qrIncome.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Перевод: <span className="text-white">{monthSummary.transferIncome.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Бонусы: <span className="text-white">{(monthSummary.bonusIncome || 0).toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Возвраты: <span className="text-red-400">{(monthSummary.refunds || 0).toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Скидки: <span className="text-red-400">{(monthSummary.discounts || 0).toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Расходы: <span className="text-red-400">{monthSummary.expense.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Чистая прибыль: <span className="text-green-400">{monthSummary.result.toLocaleString('ru-RU')}</span></p>
          </div>
          <div className="rounded-lg bg-white/3 border border-white/5 p-4">
            <p className="text-xs text-slate-400 mb-2">Текущая смена</p>
            <p className="text-xs text-slate-400">Чеков: <span className="text-white">{openShiftMetrics.checksCount || 0}</span></p>
            <p className="text-xs text-slate-400">Средний чек: <span className="text-white">{(openShiftMetrics.averageCheck || 0).toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Оборот: <span className="text-white">{(openShiftMetrics.turnover || 0).toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Выручка: <span className="text-cyan-400">{openShiftMetrics.income.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Расходы: <span className="text-red-400">{openShiftMetrics.expense.toLocaleString('ru-RU')}</span></p>
            <p className="text-xs text-slate-400">Остаток: <span className="text-cyan-400">{expectedCashNow.toLocaleString('ru-RU')}</span></p>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Поиск и фильтры операций</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <input type="text" value={searchOrder} onChange={e => setSearchOrder(e.target.value)} placeholder="Номер заказа / госномер" className="input-neon rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm" />
          <select value={filterPaymentMethod} onChange={e => setFilterPaymentMethod(e.target.value as 'all' | CashPaymentMethod)} className="input-neon rounded-lg px-3 py-2 text-sm">
            <option value="all">Все способы</option>
            <option value="Наличные">Наличные</option>
            <option value="Банковская карта">Карта</option>
            <option value="QR">QR</option>
            <option value="Перевод">Перевод</option>
            <option value="Бонусы">Бонусы</option>
            <option value="Смешанная">Смешанная</option>
            <option value="Другой">Другой</option>
          </select>
          <select value={filterDirection} onChange={e => setFilterDirection(e.target.value as 'all' | 'income' | 'expense')} className="input-neon rounded-lg px-3 py-2 text-sm">
            <option value="all">Приход/расход</option>
            <option value="income">Только приход</option>
            <option value="expense">Только расход</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'date' | 'amount' | 'type')} className="input-neon rounded-lg px-3 py-2 text-sm">
            <option value="date">Сортировка: дата</option>
            <option value="amount">Сортировка: сумма</option>
            <option value="type">Сортировка: тип</option>
          </select>
          <button onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')} className="btn-neon rounded-lg px-3 py-2 text-sm">{sortDirection === 'asc' ? '↑' : '↓'}</button>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">История кассовых операций</h3>
          <span className="text-xs text-slate-500">Удаление операций запрещено. Используйте корректировки.</span>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Дата/время</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Сотрудник</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Тип</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Способ</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Заказ</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Аудит</th>
                <th className="px-4 py-3 text-right text-xs text-slate-400 font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {filteredOperations.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Операций по фильтру нет</td></tr>
              ) : paginatedOperations.map(op => (
                <tr key={op.id} className="border-b border-white/3">
                  <td className="px-4 py-3 text-slate-300 text-xs">{format(new Date(op.createdAt), 'dd.MM.yyyy HH:mm')}</td>
                  <td className="px-4 py-3 text-slate-300">{op.employeeName}</td>
                  <td className="px-4 py-3 text-slate-300">{OP_TYPE_LABELS[op.type]}</td>
                  <td className="px-4 py-3 text-slate-300">{getOperationPaymentLabel(op)}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{op.orderNumber || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-[11px]">
                    {op.performedBy || op.employeeName}
                    {op.isCorrection && op.correctionReason ? <div className="text-amber-400">{op.correctionReason}</div> : null}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${op.direction === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {op.direction === 'income' ? '+' : '-'}{op.amount.toLocaleString('ru-RU')} {activeOrg.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-slate-500">Страница {page} из {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} className="btn-neon rounded-lg px-3 py-1.5 text-xs" disabled={page <= 1}>Назад</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn-neon rounded-lg px-3 py-1.5 text-xs" disabled={page >= totalPages}>Далее</button>
          </div>
        </div>
      </div>

      {showOpenShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={() => setShowOpenShift(false)}>
          <div className="modal-panel rounded-2xl p-6 w-full max-w-md mx-4 animate-fadeIn neon-glow" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">Открыть кассовую смену</h2>
            <div className="space-y-3">
              <input type="text" value={cashierName} onChange={e => setCashierName(e.target.value)} placeholder="Кто открывает" className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
              <input type="datetime-local" value={openAtLocal} onChange={e => setOpenAtLocal(e.target.value)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
              <input type="number" value={openingCash} onChange={e => setOpeningCash(Number(e.target.value))} placeholder="Начальная сумма" className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
              <input type="text" value={openingComment} onChange={e => setOpeningComment(e.target.value)} placeholder="Комментарий" className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
              <div className="text-xs text-slate-500">Дата/время открытия будет зафиксирована в журнале</div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowOpenShift(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Отмена</button>
                <button onClick={openCashShift} className="btn-neon rounded-lg px-6 py-2 text-sm">Открыть</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCloseShift && openShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={() => setShowCloseShift(false)}>
          <div className="modal-panel rounded-2xl p-6 w-full max-w-lg mx-4 animate-fadeIn neon-glow" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">Закрыть кассовую смену</h2>
            <div className="space-y-3 text-sm">
              <p className="text-slate-300">Начальная сумма: <span className="text-white">{openShift.openingCash.toLocaleString('ru-RU')}</span></p>
              <p className="text-slate-300">Продажи наличными: <span className="text-green-400">{openShiftMetrics.cashIncome.toLocaleString('ru-RU')}</span></p>
              <p className="text-slate-300">Продажи картой: <span className="text-white">{openShiftMetrics.cardIncome.toLocaleString('ru-RU')}</span></p>
              <p className="text-slate-300">Продажи QR: <span className="text-white">{openShiftMetrics.qrIncome.toLocaleString('ru-RU')}</span></p>
              <p className="text-slate-300">Переводы: <span className="text-white">{openShiftMetrics.transferIncome.toLocaleString('ru-RU')}</span></p>
              <p className="text-slate-300">Расходы: <span className="text-red-400">{openShiftMetrics.expense.toLocaleString('ru-RU')}</span></p>
              <p className="text-slate-300">Ожидаемая наличность: <span className="text-cyan-400">{expectedCashNow.toLocaleString('ru-RU')}</span></p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Фактическая наличность</label>
                <input type="number" value={factCash} onChange={e => setFactCash(Number(e.target.value))} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Комментарий при расхождении</label>
                <input type="text" value={closingComment} onChange={e => setClosingComment(e.target.value)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" placeholder="Обязательно при недостаче/излишке" />
              </div>
              <p className="text-slate-300">{(factCash - expectedCashNow) >= 0 ? 'Излишек' : 'Недостача'}: <span className={(factCash - expectedCashNow) >= 0 ? 'text-green-400' : 'text-red-400'}>{Math.abs(factCash - expectedCashNow).toLocaleString('ru-RU')}</span></p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCloseShift(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Отмена</button>
                <button onClick={handleCloseShift} className="btn-success rounded-lg px-6 py-2 text-sm" disabled={!canManageCashShift}>Закрыть смену</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOperationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={() => setShowOperationModal(false)}>
          <div className="modal-panel rounded-2xl p-6 w-full max-w-md mx-4 animate-fadeIn neon-glow" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">Кассовая операция</h2>
            <div className="space-y-3">
              <select value={opType} onChange={e => handleOpTypeChange(e.target.value as CashOperationType)} className="w-full input-neon rounded-lg px-3 py-2 text-sm">
                {CASH_OP_OPTIONS.map(option => (
                  <option key={`${option.type}-${option.label}`} value={option.type}>{option.label}</option>
                ))}
              </select>
              {opType === 'correction' ? (
                <select value={opDirection} onChange={e => setOpDirection(e.target.value as 'income' | 'expense')} className="w-full input-neon rounded-lg px-3 py-2 text-sm">
                  <option value="income">Приход</option>
                  <option value="expense">Расход</option>
                </select>
              ) : (
                <div className="text-xs text-slate-400 rounded-lg border border-white/10 px-3 py-2">
                  Направление операции: {opDirection === 'income' ? 'Приход' : 'Расход'}
                </div>
              )}
              <input type="number" value={opAmount} onChange={e => setOpAmount(Number(e.target.value))} className="w-full input-neon rounded-lg px-3 py-2 text-sm" placeholder="Сумма" />
              <select value={opPaymentMethod} onChange={e => setOpPaymentMethod(e.target.value as CashPaymentMethod)} className="w-full input-neon rounded-lg px-3 py-2 text-sm">
                <option value="Наличные">Наличные</option>
                <option value="Банковская карта">Банковская карта</option>
                <option value="QR">QR</option>
                <option value="Перевод">Перевод</option>
                <option value="Бонусы">Бонусы</option>
                <option value="Другой">Другой</option>
              </select>
              <input type="text" value={opDescription} onChange={e => setOpDescription(e.target.value)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" placeholder="Комментарий" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowOperationModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Отмена</button>
                <button onClick={submitManualOperation} className="btn-neon rounded-lg px-6 py-2 text-sm">Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-panel rounded-2xl p-6 w-full max-w-2xl mx-4 animate-fadeIn neon-glow" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">Кассовый отчёт</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <select value={reportRange} onChange={e => setReportRange(e.target.value as 'day' | 'week' | 'month' | 'custom')} className="w-full input-neon rounded-lg px-3 py-2 text-sm">
                <option value="day">За день</option>
                <option value="week">За неделю</option>
                <option value="month">За месяц</option>
                <option value="custom">Произвольный период</option>
              </select>
              <input type="text" value={reportCashier} onChange={e => setReportCashier(e.target.value)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" placeholder="Фильтр по кассиру" />
              {reportRange === 'custom' && (
                <>
                  <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
                  <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className="w-full input-neon rounded-lg px-3 py-2 text-sm" />
                </>
              )}
            </div>
            <div className="rounded-lg bg-white/3 border border-white/5 p-4 text-sm text-slate-300 space-y-1">
              <p>Период: {format(new Date(report.fromISO), 'dd.MM.yyyy')} — {format(new Date(report.toISO), 'dd.MM.yyyy')}</p>
              <p>Оборот: <span className="text-white">{report.summary.turnover.toLocaleString('ru-RU')} {activeOrg.currency}</span></p>
              <p>Выручка: <span className="text-cyan-400">{report.summary.income.toLocaleString('ru-RU')} {activeOrg.currency}</span></p>
              <p>Возвраты: <span className="text-red-400">{report.summary.refunds.toLocaleString('ru-RU')} {activeOrg.currency}</span></p>
              <p>Скидки: <span className="text-red-400">{report.summary.discounts.toLocaleString('ru-RU')} {activeOrg.currency}</span></p>
              <p>Бонусы: <span className="text-white">{report.summary.bonusIncome.toLocaleString('ru-RU')} {activeOrg.currency}</span></p>
              <p>Чеки: <span className="text-white">{report.summary.checksCount}</span></p>
              <p>Средний чек: <span className="text-white">{report.summary.averageCheck.toLocaleString('ru-RU')} {activeOrg.currency}</span></p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={exportReportCsv} className="btn-neon rounded-lg px-4 py-2 text-sm">CSV</button>
              <button onClick={exportReportExcel} className="btn-neon rounded-lg px-4 py-2 text-sm">Excel</button>
              <button onClick={exportReportPdf} className="btn-neon rounded-lg px-4 py-2 text-sm">PDF</button>
              <button onClick={() => setShowReportModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {shifts.length > 0 && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Последние кассовые смены</h3>
          <div className="space-y-2 text-xs">
            {shifts.slice().sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()).slice(0, 8).map(shift => (
              <div key={shift.id} className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-slate-300">{format(new Date(shift.openedAt), 'dd.MM.yyyy HH:mm')} — {shift.cashierName}</span>
                <span className="text-slate-400">{shift.closedAt ? `Закрыта (${format(new Date(shift.closedAt), 'HH:mm')})` : 'Открыта'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
