import { Organization, Supplier, CarType, Service, PriceEntry, Washer, Order, BatchOrder, Shift, Box, WasherShiftDay, WasherCurrentStatus, WorkerTimelog, WasherAnalyticsData, CashShift, CashOperation, CashOperationType, CashPaymentMethod, WarehouseCategory, WarehouseItem, WarehouseMovement, WarehouseMovementType, ServiceMaterialUsage, ActionLog, WorkerNotification, generateId, FinanceCalculationMode, OrganizationFinancialSettings, Client, Vehicle, LoyaltySettings, LoyaltyLevel, Recommendation, BonusOperation, DiscountHistoryEntry, VipStatusHistoryEntry, Permission, User, CashShiftComputedMetrics, CashReport, PaymentPart, AuthSession, Purchase, Inventory, InventoryRecord, ExpenseRecord, PayrollRecord, BackupMetadata, BackupSettings, BackupLog, IntegrityCheckResult } from './types';

const KEYS = {
  organizations: 'wd_organizations',
  carTypes: 'wd_car_types',
  services: 'wd_services',
  prices: 'wd_prices',
  washers: 'wd_washers',
  orders: 'wd_orders',
  batches: 'wd_batches',
  shifts: 'wd_shifts',
  boxes: 'wd_boxes',
  washerShiftDays: 'wd_washer_shift_days',
  washerCurrentStatus: 'wd_washer_current_status',
  workerTimelogs: 'wd_worker_timelogs',
  cashShifts: 'wd_cash_shifts',
  cashOperations: 'wd_cash_operations',
  warehouseCategories: 'wd_warehouse_categories',
  warehouseItems: 'wd_warehouse_items',
  warehouseMovements: 'wd_warehouse_movements',
  serviceMaterialUsages: 'wd_service_material_usages',
  suppliers: 'wd_suppliers',
  purchases: 'wd_purchases',
  inventories: 'wd_inventories',
  actionLogs: 'wd_action_logs',
  notifications: 'wd_worker_notifications',
  clients: 'wd_clients',
  vehicles: 'wd_vehicles',
  loyaltySettings: 'wd_loyalty_settings',
  expenses: 'wd_expenses',
  payrolls: 'wd_payrolls',
  activeOrg: 'wd_active_org',
  users: 'wd_users',
  session: 'wd_session',
  seeded: 'wd_seeded',
};

function getTodayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(KEYS.session);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: AuthSession | null): void {
  if (!session) {
    localStorage.removeItem(KEYS.session);
    localStorage.removeItem(KEYS.activeOrg);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('wd-store-changed'));
    return;
  }
  localStorage.setItem(KEYS.session, JSON.stringify(session));
  if (session.activeOrgId) localStorage.setItem(KEYS.activeOrg, session.activeOrgId);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('wd-store-changed'));
}

function getUsersRaw(): User[] {
  return get<User>(KEYS.users);
}

function saveUsersRaw(data: User[]): void {
  set(KEYS.users, data);
}

function getCurrentUserId(): string | null {
  return getSession()?.userId || null;
}

function getOrganizationsRaw(): Organization[] {
  return get<Organization>(KEYS.organizations);
}

function claimLegacyOrganizations(userId: string): void {
  const organizations = getOrganizationsRaw();
  if (organizations.length === 0) return;
  const alreadyOwned = organizations.some(org => org.ownerId);
  if (alreadyOwned) return;
  saveOrganizations(organizations.map(org => ({ ...org, ownerId: userId, updatedAt: new Date().toISOString() })));
}

export function initializeEmptyWorkspace(): void {
  if (localStorage.getItem(KEYS.seeded)) return;

  // On first run, create an absolutely empty workspace: overwrite all relevant keys
  // with empty arrays so there are no demo/test records present.
  [
    KEYS.organizations,
    KEYS.carTypes,
    KEYS.services,
    KEYS.prices,
    KEYS.washers,
    KEYS.orders,
    KEYS.batches,
    KEYS.shifts,
    KEYS.boxes,
    KEYS.washerShiftDays,
    KEYS.washerCurrentStatus,
    KEYS.workerTimelogs,
    KEYS.cashShifts,
    KEYS.cashOperations,
    KEYS.warehouseCategories,
    KEYS.warehouseItems,
    KEYS.warehouseMovements,
    KEYS.serviceMaterialUsages,
    KEYS.suppliers,
    KEYS.actionLogs,
    KEYS.notifications,
    KEYS.clients,
    KEYS.vehicles,
    KEYS.loyaltySettings,
    KEYS.users,
  ].forEach(key => {
    localStorage.setItem(key, '[]');
  });

  localStorage.setItem(KEYS.seeded, 'true');
}

export function upsertGoogleUser(profile: { googleId: string; email: string; name?: string; photoUrl?: string }): User {
  initializeEmptyWorkspace();
  const users = getUsersRaw();
  const now = new Date().toISOString();
  const existing = users.find(user => user.googleId === profile.googleId || (user.email || '').toLowerCase() === profile.email.toLowerCase());
  const user: User = existing
    ? {
        ...existing,
        email: profile.email,
        name: profile.name || existing.name,
        photoUrl: profile.photoUrl || existing.photoUrl,
        updatedAt: now,
        lastLoginAt: now,
      }
    : {
        id: generateId(),
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        photoUrl: profile.photoUrl,
        role: 'admin',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };
  if (existing) {
    saveUsersRaw(users.map(item => item.id === user.id ? user : item));
  } else {
    users.push(user);
    saveUsersRaw(users);
  }
  claimLegacyOrganizations(user.id || '');
  return user;
}

export function updateUserProfile(userId: string, patch: Partial<User>): User | null {
  const users = getUsersRaw();
  const existing = users.find(user => user.id === userId);
  if (!existing) return null;
  const updated: User = {
    ...existing,
    ...patch,
    id: existing.id,
    googleId: existing.googleId,
    email: existing.email,
    updatedAt: new Date().toISOString(),
  };
  saveUsersRaw(users.map(user => user.id === userId ? updated : user));
  return updated;
}

export function startSession(user: User, activeOrgId?: string): void {
  const now = new Date().toISOString();
  saveSession({
    userId: user.id || '',
    activeOrgId,
    createdAt: getSession()?.createdAt || now,
    updatedAt: now,
  });
}

export function clearSession(): void {
  saveSession(null);
}

export function getCurrentUser(): User | null {
  const userId = getCurrentUserId();
  if (!userId) return null;
  return getUsersRaw().find(user => user.id === userId) || null;
}

export function restoreSession(): { user: User; activeOrgId?: string } | null {
  initializeEmptyWorkspace();
  const session = getSession();
  if (!session) return null;
  const user = getUsersRaw().find(item => item.id === session.userId);
  if (!user) {
    clearSession();
    return null;
  }
  return { user, activeOrgId: session.activeOrgId };
}

export function getOrganizationsForUser(userId: string): Organization[] {
  return getOrganizationsRaw().filter(org => org.ownerId === userId);
}

const storeCache = new Map<string, unknown>();

function get<T>(key: string): T[] {
  if (storeCache.has(key)) {
    return storeCache.get(key) as T[];
  }

  try {
    const d = localStorage.getItem(key);
    const parsed = d ? JSON.parse(d) : [];
    storeCache.set(key, parsed);
    return parsed;
  } catch {
    const empty: T[] = [];
    storeCache.set(key, empty);
    return empty;
  }
}

function set<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
  storeCache.set(key, data);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('wd-store-changed'));
  }
}

function roundMoney(value: number): number {
  return Math.round(value);
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function getOrganizationById(id: string): Organization | undefined {
  return getOrganizations().find(org => org.id === id);
}

export function getSuppliers(orgId: string): Supplier[] {
  return get<Supplier>(KEYS.suppliers).filter(s => s.organizationId === orgId);
}

export function saveSuppliers(data: Supplier[]): void { set(KEYS.suppliers, data); }

export function addSupplier(supplier: Supplier): void {
  const data = get<Supplier>(KEYS.suppliers);
  data.push(supplier);
  saveSuppliers(data);
}

export function updateSupplier(supplier: Supplier): void {
  saveSuppliers(get<Supplier>(KEYS.suppliers).map(s => s.id === supplier.id ? supplier : s));
}

export function getSupplierPurchaseTotals(orgId: string): Record<string, { count: number; total: number }> {
  const movements = getWarehouseMovements(orgId).filter(m => m.type === 'incoming');
  const totals: Record<string, { count: number; total: number }> = {};
  movements.forEach(m => {
    const key = m.supplierId || m.supplierName || 'unknown';
    if (!totals[key]) totals[key] = { count: 0, total: 0 };
    totals[key].count += 1;
    totals[key].total += m.totalCost || 0;
  });
  return totals;
}

export function getPurchases(orgId: string): Purchase[] {
  return get<Purchase>(KEYS.purchases).filter(p => p.organizationId === orgId).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function savePurchases(data: Purchase[]): void { set(KEYS.purchases, data); }

export function addPurchase(purchase: Purchase): void {
  const data = get<Purchase>(KEYS.purchases);
  data.push(purchase);
  savePurchases(data);
  // Apply incoming movements for each item
  purchase.items.forEach(it => {
    addWarehouseIncoming({
      orgId: purchase.organizationId,
      itemId: it.itemId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      employeeName: purchase.createdBy,
      supplierId: purchase.supplierId,
      supplier: purchase.supplierName,
      note: `Закупка ${purchase.id}`,
    });
  });
  addActionLog({
    id: generateId(),
    organizationId: purchase.organizationId,
    performedBy: purchase.createdBy,
    action: 'cash_operation',
    targetType: 'item',
    targetId: '',
    targetName: `Закупка ${purchase.id}`,
    description: `Создана закупка ${purchase.items.length} позиций, сумма ${purchase.total}`,
    createdAt: new Date().toISOString(),
  });
}


export function getFinancialSettings(orgId: string): OrganizationFinancialSettings {
  const org = getOrganizationById(orgId);
  const employeePercent = clampPercent(org?.financialSettings?.employeePercent ?? org?.washerPercent ?? 45);
  const organizationPercent = clampPercent(org?.financialSettings?.organizationPercent ?? (100 - employeePercent));
  return {
    calculationMode: org?.financialSettings?.calculationMode || 'percent',
    employeePercent,
    organizationPercent,
    salaryAmount: org?.financialSettings?.salaryAmount ?? 0,
    fixedOrderAmount: org?.financialSettings?.fixedOrderAmount ?? 0,
  };
}

export function saveFinancialSettings(orgId: string, settings: OrganizationFinancialSettings): void {
  const org = getOrganizationById(orgId);
  if (!org) return;
  const normalized: OrganizationFinancialSettings = {
    calculationMode: settings.calculationMode,
    employeePercent: clampPercent(settings.employeePercent),
    organizationPercent: clampPercent(settings.organizationPercent || (100 - settings.employeePercent)),
    salaryAmount: roundMoney(settings.salaryAmount || 0),
    fixedOrderAmount: roundMoney(settings.fixedOrderAmount || 0),
  };
  updateOrganization({
    ...org,
    financialSettings: normalized,
    washerPercent: normalized.employeePercent,
  });
}

function getOrderWorkers(order: Order, workers: Washer[]): Washer[] {
  const ids = order.washerIds?.length ? order.washerIds : order.washerId ? [order.washerId] : [];
  if (workers.length === 0 || ids.length === 0) return [];
  const byId = new Map<string, Washer>();
  for (const w of workers) byId.set(w.id, w);
  return ids.map(id => byId.get(id)).filter((w): w is Washer => Boolean(w));
}

interface OrderFinancialWorkerBreakdown {
  washerId: string;
  washerName: string;
  mode: FinanceCalculationMode;
  amount: number;
}

interface OrderFinancialBreakdown {
  totalAmount: number;
  employeeTotal: number;
  organizationShare: number;
  workers: OrderFinancialWorkerBreakdown[];
}

function calculateWorkerAmount(
  mode: FinanceCalculationMode,
  baseShare: number,
  washer: Washer,
  orgSettings: OrganizationFinancialSettings
): number {
  const percent = clampPercent(washer.payPercent ?? orgSettings.employeePercent);
  const salaryAmount = roundMoney(washer.paySalaryAmount ?? orgSettings.salaryAmount);
  const fixedAmount = roundMoney(washer.payFixedAmount ?? orgSettings.fixedOrderAmount);

  switch (mode) {
    case 'percent':
      return roundMoney(baseShare * percent / 100);
    case 'salary':
      return salaryAmount;
    case 'mixed':
      return roundMoney(baseShare * percent / 100) + salaryAmount;
    case 'fixed':
      return fixedAmount;
    default:
      return baseShare;
  }
}

export function calculateOrderFinancialBreakdown(order: Order, orgId: string, workers: Washer[]): OrderFinancialBreakdown {
  const orgSettings = getFinancialSettings(orgId);
  const orderWorkers = getOrderWorkers(order, workers);
  const totalAmount = roundMoney(order.totalAmount || 0);
  if (orderWorkers.length === 0 || totalAmount <= 0) {
    return { totalAmount, employeeTotal: 0, organizationShare: totalAmount, workers: [] };
  }

  const sharedPool = roundMoney(totalAmount * clampPercent(orgSettings.employeePercent) / 100);
  const baseShare = roundMoney(sharedPool / orderWorkers.length);
  const workersBreakdown = orderWorkers.map((washer) => {
    const mode = washer.payMode || orgSettings.calculationMode;
    const amount = calculateWorkerAmount(mode, baseShare, washer, orgSettings);

    return {
      washerId: washer.id,
      washerName: washer.name,
      mode,
      amount: roundMoney(amount),
    };
  });

  const allPercent = orderWorkers.every(washer => (washer.payMode || orgSettings.calculationMode) === 'percent');
  if (allPercent && workersBreakdown.length > 0) {
    const sumExceptLast = workersBreakdown.slice(0, -1).reduce((sum, item) => sum + item.amount, 0);
    workersBreakdown[workersBreakdown.length - 1].amount = Math.max(0, sharedPool - sumExceptLast);
  }

  const workersBreakdownSum = workersBreakdown.reduce((sum, item) => sum + item.amount, 0);
  const organizationShare = Math.max(0, roundMoney(totalAmount - workersBreakdownSum));

  return {
    totalAmount,
    employeeTotal: workersBreakdownSum,
    organizationShare,
    workers: workersBreakdown,
  };
}

export function calculateOrderCostBreakdown(order: Order, orgId: string, workers: Washer[]): {
  materialsCost: number;
  workersCost: number;
  organizationProfit: number;
} {
  const payroll = calculateOrderFinancialBreakdown(order, orgId, workers);
  const materialsCost = getWarehouseMovements(orgId)
    .filter(m => m.orderId === order.id && m.source === 'order_auto')
    .reduce((sum, movement) => sum + (movement.totalCost || 0), 0);
  const workersCost = payroll.employeeTotal;
  const organizationProfit = Math.max(0, roundMoney((order.totalAmount || 0) - materialsCost - workersCost));

  return { materialsCost, workersCost, organizationProfit };
}

export function recalculateOrderCostFields(order: Order, orgId: string, workers: Washer[]): Order {
  const costBreakdown = calculateOrderCostBreakdown(order, orgId, workers);
  return {
    ...order,
    materialsCost: costBreakdown.materialsCost,
    workersCost: costBreakdown.workersCost,
    organizationProfit: costBreakdown.organizationProfit,
    costCalculatedAt: new Date().toISOString(),
  };
}

function buildWorkerTimelogs(
  order: Order,
  orgId: string,
  workers: Washer[],
  recordType: 'accrual' | 'adjustment',
  previousOrderAmount?: number
): WorkerTimelog[] {
  const currentBreakdown = calculateOrderFinancialBreakdown(order, orgId, workers);
  const previousBreakdown = previousOrderAmount == null
    ? null
    : calculateOrderFinancialBreakdown({ ...order, totalAmount: previousOrderAmount }, orgId, workers);
  const date = (order.completedAt || order.createdAt).slice(0, 10);
  const startTime = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false }) : '00:00';
  const endTime = order.completedAt ? new Date(order.completedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false }) : undefined;
  const boxName = order.boxName;
  const coworkers = currentBreakdown.workers.map(w => w.washerName);

  return currentBreakdown.workers.map(worker => {
    const previousWorkerAmount = previousBreakdown?.workers.find(w => w.washerId === worker.washerId)?.amount ?? 0;
    const deltaOrderAmount = previousOrderAmount == null ? undefined : roundMoney(currentBreakdown.totalAmount - previousOrderAmount);
    const deltaWorkerAmount = previousBreakdown ? roundMoney(worker.amount - previousWorkerAmount) : undefined;
    const previousOrganizationShare = previousBreakdown?.organizationShare ?? 0;
    const deltaOrganizationShare = previousBreakdown ? roundMoney(currentBreakdown.organizationShare - previousOrganizationShare) : undefined;

    return {
      id: generateId(),
      orderId: order.id,
      orderNumber: order.orderNumber || order.id,
      washerId: worker.washerId,
      washerName: worker.washerName,
      organizationId: orgId,
      date,
      startTime,
      endTime,
      durationMinutes: order.completedAt && order.createdAt
        ? Math.max(1, Math.round((new Date(order.completedAt).getTime() - new Date(order.createdAt).getTime()) / 60000))
        : undefined,
      licensePlate: order.licensePlate,
      carTypeName: order.carTypeName,
      dirtLevel: order.dirtLevel,
      services: order.services.map(s => s.serviceName),
      orderAmount: currentBreakdown.totalAmount,
      washerShare: previousBreakdown ? deltaWorkerAmount || 0 : worker.amount,
      organizationShare: previousBreakdown ? deltaOrganizationShare || 0 : currentBreakdown.organizationShare,
      calculationMode: worker.mode,
      boxName,
      coworkers: coworkers.filter(name => name && name !== worker.washerName),
      recordType,
      previousOrderAmount,
      deltaOrderAmount,
    };
  });
}

export function recordOrderFinancialAccrual(order: Order, orgId: string): void {
  const workers = getWashers(orgId);
  const existing = get<WorkerTimelog>(KEYS.workerTimelogs).filter(
    timelog => timelog.organizationId === orgId && timelog.orderId === order.id && timelog.recordType === 'accrual'
  );
  if (existing.length > 0) return;

  const entries = buildWorkerTimelogs(order, orgId, workers, 'accrual');
  const data = get<WorkerTimelog>(KEYS.workerTimelogs);
  data.push(...entries);
  saveWorkerTimelogs(data);
}

export function recordOrderFinancialAdjustment(order: Order, previousOrderAmount: number, orgId: string): void {
  const workers = getWashers(orgId);
  const entries = buildWorkerTimelogs(order, orgId, workers, 'adjustment', previousOrderAmount);
  const data = get<WorkerTimelog>(KEYS.workerTimelogs);
  data.push(...entries);
  saveWorkerTimelogs(data);
}

export function getFinancialTimelogsForOrder(orgId: string, orderId: string): WorkerTimelog[] {
  return get<WorkerTimelog>(KEYS.workerTimelogs).filter(t => t.organizationId === orgId && t.orderId === orderId);
}

// Cash shifts
export function getCashShifts(orgId: string): CashShift[] {
  return get<CashShift>(KEYS.cashShifts).filter(s => s.organizationId === orgId);
}
export function saveCashShifts(data: CashShift[]): void { set(KEYS.cashShifts, data); }
export function addCashShift(shift: CashShift): void {
  const existingOpen = get<CashShift>(KEYS.cashShifts).find(s => s.organizationId === shift.organizationId && !s.closedAt);
  if (existingOpen) return;
  const data = get<CashShift>(KEYS.cashShifts);
  data.push(shift);
  saveCashShifts(data);
  addActionLog({
    id: generateId(),
    organizationId: shift.organizationId,
    performedBy: shift.cashierName,
    action: 'open_cash_shift',
    targetType: 'shift',
    targetId: shift.id,
    targetName: shift.cashierName,
    description: `Открыта кассовая смена (${shift.cashierName})`,
    createdAt: new Date().toISOString(),
  });
}
export function updateCashShift(shift: CashShift): void {
  saveCashShifts(get<CashShift>(KEYS.cashShifts).map(s => s.id === shift.id ? shift : s));
}
export function getOpenCashShift(orgId: string): CashShift | undefined {
  return getCashShifts(orgId).find(s => !s.closedAt);
}

// Cash operations
export function getCashOperations(orgId: string): CashOperation[] {
  return get<CashOperation>(KEYS.cashOperations).filter(o => o.organizationId === orgId);
}
export function saveCashOperations(data: CashOperation[]): void { set(KEYS.cashOperations, data); }

export function normalizePaymentMethod(method?: CashPaymentMethod): CashPaymentMethod {
  switch (method) {
    case 'cash': return 'Наличные';
    case 'card':
    case 'Card':
    case 'Kaspi':
      return 'Банковская карта';
    case 'qr': return 'QR';
    case 'transfer': return 'Перевод';
    case 'Бонусы': return 'Бонусы';
    case 'Смешанная': return 'Смешанная';
    case 'other': return 'Другой';
    default:
      return method || 'Другой';
  }
}

function normalizePaymentParts(parts?: PaymentPart[]): PaymentPart[] | undefined {
  if (!parts || parts.length === 0) return undefined;
  return parts
    .filter(part => part.amount > 0)
    .map(part => ({ method: normalizePaymentMethod(part.method) as Exclude<CashPaymentMethod, 'Смешанная'>, amount: Math.max(0, Math.round(part.amount)) }));
}

function getMethodTotalsFromIncome(ops: CashOperation[]): Record<string, number> {
  const totals: Record<string, number> = {
    'Наличные': 0,
    'Банковская карта': 0,
    QR: 0,
    'Перевод': 0,
    'Бонусы': 0,
    'Смешанная': 0,
    'Другой': 0,
  };

  ops.forEach(op => {
    if (op.direction !== 'income') return;
    if (op.paymentParts && op.paymentParts.length > 0) {
      totals['Смешанная'] += op.amount;
      op.paymentParts.forEach(part => {
        const method = normalizePaymentMethod(part.method) as Exclude<CashPaymentMethod, 'Смешанная'>;
        totals[method] = (totals[method] || 0) + Math.max(0, Math.round(part.amount));
      });
      return;
    }
    const method = normalizePaymentMethod(op.paymentMethod);
    totals[method] = (totals[method] || 0) + op.amount;
  });

  return totals;
}

function getKaspiIncomeFromIncome(ops: CashOperation[]): number {
  return ops.reduce((sum, op) => {
    if (op.direction !== 'income') return sum;
    if (op.paymentParts && op.paymentParts.length > 0) {
      return sum + op.paymentParts
        .filter(part => part.method === 'Kaspi')
        .reduce((partSum, part) => partSum + Math.max(0, Math.round(part.amount)), 0);
    }
    return sum + (op.paymentMethod === 'Kaspi' ? op.amount : 0);
  }, 0);
}

function getExpenseBuckets(ops: CashOperation[]) {
  const expenseOps = ops.filter(op => op.direction === 'expense');
  return {
    expense: expenseOps.reduce((sum, op) => sum + op.amount, 0),
    refunds: expenseOps
      .filter(op => op.type === 'refund' || op.type === 'expense_payout' || (op.description || '').toLowerCase().includes('возврат'))
      .reduce((sum, op) => sum + op.amount, 0),
    discounts: expenseOps
      .filter(op => (op.description || '').toLowerCase().includes('скидк'))
      .reduce((sum, op) => sum + op.amount, 0),
    bonuses: expenseOps
      .filter(op => normalizePaymentMethod(op.paymentMethod) === 'Бонусы' || (op.description || '').toLowerCase().includes('бонус'))
      .reduce((sum, op) => sum + op.amount, 0),
  };
}

export function addCashOperation(operation: CashOperation): void {
  const data = get<CashOperation>(KEYS.cashOperations);
  const prepared = {
    ...operation,
    paymentMethod: normalizePaymentMethod(operation.paymentMethod),
    amount: Math.max(0, Math.round(operation.amount)),
    performedBy: operation.performedBy || operation.employeeName,
    paymentParts: normalizePaymentParts(operation.paymentParts),
  };
  data.push(prepared);
  saveCashOperations(data);
  addActionLog({
    id: generateId(),
    organizationId: prepared.organizationId,
    performedBy: prepared.performedBy || prepared.employeeName,
    action: 'cash_operation',
    targetType: 'shift',
    targetId: prepared.shiftId || prepared.id,
    targetName: prepared.orderNumber || prepared.licensePlate,
    description: `Кассовая операция: ${prepared.type} (${prepared.direction === 'income' ? 'приход' : 'расход'})`,
    createdAt: prepared.createdAt,
  });
}

// Action logs
export function getActionLogs(orgId: string): ActionLog[] {
  return get<ActionLog>(KEYS.actionLogs).filter(l => l.organizationId === orgId);
}
export function saveActionLogs(data: ActionLog[]): void { set(KEYS.actionLogs, data); }
export function addActionLog(log: ActionLog): void {
  const data = get<ActionLog>(KEYS.actionLogs);
  data.push(log);
  saveActionLogs(data);
}

export function userHasPermission(user: User | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (user.permissions && user.permissions.includes(permission)) return true;
  // Role-based defaults
  if (user.role === 'admin') return true;
  if (user.role === 'manager') {
    switch (permission) {
      case 'canViewClients':
      case 'canEditClients':
      case 'canManageBonuses':
      case 'canManageDiscounts':
      case 'canViewCRM':
      case 'canExportCRM':
      case 'canViewCash':
      case 'canManageCashShift':
      case 'canManageCashOperations':
      case 'canViewCashReports':
      case 'canExportCash':
        return true;
      default:
        return false;
    }
  }
  return false;
}

// Worker notifications
export function getWorkerNotifications(orgId: string): WorkerNotification[] {
  return get<WorkerNotification>(KEYS.notifications).filter(n => n.organizationId === orgId);
}
export function saveWorkerNotifications(data: WorkerNotification[]): void { set(KEYS.notifications, data); }
export function addWorkerNotification(notification: WorkerNotification): void {
  const data = get<WorkerNotification>(KEYS.notifications);
  data.push(notification);
  saveWorkerNotifications(data);
}
export function markWorkerNotificationRead(notificationId: string): void {
  const data = get<WorkerNotification>(KEYS.notifications).map(n => n.id === notificationId ? { ...n, read: true } : n);
  saveWorkerNotifications(data);
}

// Clients (CRM)
export function getClients(orgId: string): Client[] {
  return get<Client>(KEYS.clients).filter(c => c.organizationId === orgId && !c.archivedAt);
}
export function saveClients(data: Client[]): void { set(KEYS.clients, data); }
function normalizePhone(phone?: string): string {
  return (phone || '').replace(/\D/g, '');
}

export function addClient(client: Client): void {
  const data = get<Client>(KEYS.clients);
  const normalized = normalizePhone(client.phone);
  if (normalized && data.some(c => c.organizationId === client.organizationId && normalizePhone(c.phone) === normalized)) {
    return;
  }
  data.push(client);
  saveClients(data);
  addActionLog({
    id: generateId(),
    organizationId: client.organizationId,
    performedBy: 'Система',
    action: 'modify_client',
    targetType: 'client',
    targetId: client.id,
    targetName: client.fullName,
    description: `Создан клиент ${client.fullName}`,
    createdAt: new Date().toISOString(),
  });
}
export function updateClient(client: Client): void {
  const allClients = get<Client>(KEYS.clients);
  const prev = allClients.find(c => c.id === client.id);
  saveClients(allClients.map(c => c.id === client.id ? client : c));
  if (prev) {
    addActionLog({
      id: generateId(),
      organizationId: client.organizationId,
      performedBy: 'Система',
      action: 'modify_client',
      targetType: 'client',
      targetId: client.id,
      targetName: client.fullName,
      description: `Обновлены данные клиента ${client.fullName}`,
      changes: {
        fullName: { oldValue: prev.fullName, newValue: client.fullName },
        phone: { oldValue: prev.phone || '', newValue: client.phone || '' },
        notes: { oldValue: prev.notes || '', newValue: client.notes || '' },
      },
      createdAt: new Date().toISOString(),
    });
  }
}
export function deleteClient(clientId: string): void {
  const allClients = get<Client>(KEYS.clients);
  const client = allClients.find(c => c.id === clientId);
  if (!client) return;
  const hasOrders = get<Order>(KEYS.orders).some(order => order.organizationId === client.organizationId && order.clientId === clientId);
  if (hasOrders) {
    saveClients(allClients.map(item => item.id === clientId ? { ...item, archivedAt: new Date().toISOString() } : item));
    addActionLog({
      id: generateId(),
      organizationId: client.organizationId,
      performedBy: 'Система',
      action: 'modify_client',
      targetType: 'client',
      targetId: clientId,
      targetName: client.fullName,
      description: 'Клиент архивирован',
      createdAt: new Date().toISOString(),
    });
    return;
  }
  saveClients(allClients.filter(c => c.id !== clientId));
  addActionLog({
    id: generateId(),
    organizationId: client.organizationId,
    performedBy: 'Система',
    action: 'modify_client',
    targetType: 'client',
    targetId: clientId,
    targetName: client.fullName,
    description: 'Клиент удалён',
    createdAt: new Date().toISOString(),
  });
}
export function findClientByPhone(orgId: string, phone?: string): Client | undefined {
  if (!phone) return undefined;
  const normalized = phone.replace(/\D/g, '');
  return get<Client>(KEYS.clients).find(c => c.organizationId === orgId && (c.phone || '').replace(/\D/g, '') === normalized);
}

// Vehicles
export function getVehicles(orgId: string): Vehicle[] {
  return get<Vehicle>(KEYS.vehicles).filter(v => v.organizationId === orgId && !v.archivedAt);
}
export function saveVehicles(data: Vehicle[]): void { set(KEYS.vehicles, data); }
export function addVehicle(vehicle: Vehicle): void {
  const data = get<Vehicle>(KEYS.vehicles);
  // prevent duplicate licensePlate within organization
  const exists = data.some(v => v.organizationId === vehicle.organizationId && v.licensePlate.trim().toLowerCase() === vehicle.licensePlate.trim().toLowerCase());
  if (exists) return;
  data.push(vehicle);
  saveVehicles(data);
  addActionLog({
    id: generateId(),
    organizationId: vehicle.organizationId,
    performedBy: 'Система',
    action: 'merge_vehicles',
    targetType: 'vehicle',
    targetId: vehicle.id,
    targetName: vehicle.licensePlate,
    description: `Создан автомобиль ${vehicle.licensePlate}`,
    createdAt: new Date().toISOString(),
  });
}
export function updateVehicle(vehicle: Vehicle): void {
  const allVehicles = get<Vehicle>(KEYS.vehicles);
  const prev = allVehicles.find(v => v.id === vehicle.id);
  saveVehicles(allVehicles.map(v => v.id === vehicle.id ? vehicle : v));
  if (prev) {
    addActionLog({
      id: generateId(),
      organizationId: vehicle.organizationId,
      performedBy: 'Система',
      action: 'merge_vehicles',
      targetType: 'vehicle',
      targetId: vehicle.id,
      targetName: vehicle.licensePlate,
      description: `Обновлён автомобиль ${vehicle.licensePlate}`,
      changes: {
        clientId: { oldValue: prev.clientId, newValue: vehicle.clientId },
        make: { oldValue: prev.make || '', newValue: vehicle.make || '' },
        model: { oldValue: prev.model || '', newValue: vehicle.model || '' },
        color: { oldValue: prev.color || '', newValue: vehicle.color || '' },
      },
      createdAt: new Date().toISOString(),
    });
  }
}
export function deleteVehicle(vehicleId: string): void {
  const allVehicles = get<Vehicle>(KEYS.vehicles);
  const vehicle = allVehicles.find(v => v.id === vehicleId);
  if (!vehicle) return;
  saveVehicles(allVehicles.map(v => v.id === vehicleId ? { ...v, archivedAt: new Date().toISOString() } : v));
  addActionLog({
    id: generateId(),
    organizationId: vehicle.organizationId,
    performedBy: 'Система',
    action: 'merge_vehicles',
    targetType: 'vehicle',
    targetId: vehicle.id,
    targetName: vehicle.licensePlate,
    description: `Автомобиль ${vehicle.licensePlate} архивирован`,
    createdAt: new Date().toISOString(),
  });
}
export function findVehicleByPlate(orgId: string, licensePlate: string): Vehicle | undefined {
  if (!licensePlate) return undefined;
  const normalized = licensePlate.trim().toLowerCase();
  return get<Vehicle>(KEYS.vehicles).find(v => v.organizationId === orgId && v.licensePlate.trim().toLowerCase() === normalized);
}

// Loyalty settings per organization
export function getLoyaltySettings(orgId: string): LoyaltySettings | undefined {
  return get<LoyaltySettings>(KEYS.loyaltySettings).find(s => s.organizationId === orgId);
}
export function saveLoyaltySettings(settings: LoyaltySettings): void {
  const data = get<LoyaltySettings>(KEYS.loyaltySettings).filter(s => s.organizationId !== settings.organizationId);
  data.push(settings);
  set(KEYS.loyaltySettings, data);
  addActionLog({
    id: generateId(),
    organizationId: settings.organizationId,
    performedBy: 'Система',
    action: 'modify_loyalty_settings',
    targetType: 'item',
    targetId: settings.organizationId,
    description: 'Обновлены настройки лояльности',
    createdAt: new Date().toISOString(),
  });
}

// --- Bonus operations: accrue, spend, cancel, refund ---
export function accrueBonus(orgId: string, clientId: string, amount: number, performedBy?: string, reason?: string): BonusOperation | undefined {
  if (!amount || amount <= 0) return undefined;
  const clients = getClients(orgId);
  const client = clients.find(c => c.id === clientId);
  if (!client) return undefined;
  const prev = client.bonusPoints || 0;
  const newBalance = prev + amount;
  const op: BonusOperation = {
    id: generateId(),
    clientId,
    organizationId: orgId,
    amount: amount,
    reason: reason,
    type: 'accrual',
    createdAt: new Date().toISOString(),
    performedBy,
    balanceAfter: newBalance,
  };
  client.bonusHistory = client.bonusHistory || [];
  client.bonusHistory.push(op);
  client.bonusPoints = newBalance;
  updateClient(client);
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: performedBy || 'Система',
    action: 'modify_bonus',
    targetType: 'client',
    targetId: clientId,
    targetName: client.fullName,
    changes: { bonusPoints: { oldValue: prev, newValue: newBalance } },
    description: `Начислены бонусы ${amount}`,
    createdAt: new Date().toISOString(),
  });
  return op;
}

export function spendBonus(orgId: string, clientId: string, amount: number, performedBy?: string, reason?: string): BonusOperation | undefined {
  if (!amount || amount <= 0) return undefined;
  const clients = getClients(orgId);
  const client = clients.find(c => c.id === clientId);
  if (!client) return undefined;
  const prev = client.bonusPoints || 0;
  if (prev < amount) return undefined; // insufficient
  const newBalance = prev - amount;
  const op: BonusOperation = {
    id: generateId(),
    clientId,
    organizationId: orgId,
    amount: -Math.abs(amount),
    reason,
    type: 'spend',
    createdAt: new Date().toISOString(),
    performedBy,
    balanceAfter: newBalance,
  };
  client.bonusHistory = client.bonusHistory || [];
  client.bonusHistory.push(op);
  client.bonusPoints = newBalance;
  updateClient(client);
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: performedBy || 'Система',
    action: 'modify_bonus',
    targetType: 'client',
    targetId: clientId,
    targetName: client.fullName,
    changes: { bonusPoints: { oldValue: prev, newValue: newBalance } },
    description: `Списаны бонусы ${amount}`,
    createdAt: new Date().toISOString(),
  });
  return op;
}

export function cancelBonusOperation(orgId: string, clientId: string, operationId: string, performedBy?: string, reason?: string): BonusOperation | undefined {
  const client = getClients(orgId).find(c => c.id === clientId);
  if (!client || !client.bonusHistory) return undefined;
  const original = client.bonusHistory.find(b => b.id === operationId);
  if (!original) return undefined;
  // create a reversing operation
  const reverseAmount = -original.amount;
  const newBalance = (client.bonusPoints || 0) + reverseAmount;
  const op: BonusOperation = {
    id: generateId(),
    clientId,
    organizationId: orgId,
    amount: reverseAmount,
    reason: reason || `Cancel ${original.id}`,
    type: 'cancel',
    createdAt: new Date().toISOString(),
    performedBy,
    balanceAfter: newBalance,
    originalOperationId: original.id,
  };
  client.bonusHistory.push(op);
  client.bonusPoints = newBalance;
  updateClient(client);
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: performedBy || 'Система',
    action: 'modify_bonus',
    targetType: 'client',
    targetId: clientId,
    targetName: client.fullName,
    changes: { bonusPoints: { oldValue: newBalance - reverseAmount, newValue: newBalance } },
    description: `Отменена бонусная операция ${original.id}`,
    createdAt: new Date().toISOString(),
  });
  return op;
}

export function refundBonus(orgId: string, clientId: string, amount: number, performedBy?: string, reason?: string): BonusOperation | undefined {
  if (!amount || amount <= 0) return undefined;
  const client = getClients(orgId).find(c => c.id === clientId);
  if (!client) return undefined;
  const newBalance = (client.bonusPoints || 0) + amount;
  const op: BonusOperation = {
    id: generateId(),
    clientId,
    organizationId: orgId,
    amount: amount,
    reason,
    type: 'refund',
    createdAt: new Date().toISOString(),
    performedBy,
    balanceAfter: newBalance,
  };
  client.bonusHistory = client.bonusHistory || [];
  client.bonusHistory.push(op);
  const previousBalance = client.bonusPoints || 0;
  client.bonusPoints = newBalance;
  updateClient(client);
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: performedBy || 'Система',
    action: 'modify_bonus',
    targetType: 'client',
    targetId: clientId,
    targetName: client.fullName,
    changes: { bonusPoints: { oldValue: previousBalance, newValue: newBalance } },
    description: `Возвращены бонусы ${amount}`,
    createdAt: new Date().toISOString(),
  });
  return op;
}

export function getOrderBonusAmount(order: Order, orgId: string): number {
  const settings = getLoyaltySettings(orgId);
  if (!settings || !settings.enabled || !settings.useBonuses || !order.totalAmount) return 0;
  const paidAmount = Math.max(0, order.totalAmount - (order.discountAmount || 0) - (order.bonusApplied || 0));
  const points = Math.floor(paidAmount * (settings.bonusValuePerCurrencyUnit || 0));
  return points;
}

export function applyOrderBonuses(order: Order, orgId: string, performedBy?: string): void {
  const clientId = order.clientId;
  if (!clientId) return;
  const settings = getLoyaltySettings(orgId);
  if (!settings || !settings.enabled) return;
  if (order.bonusApplied && order.bonusApplied > 0) {
    spendBonus(orgId, clientId, Math.max(0, Math.round(order.bonusApplied)), performedBy || 'Система', `Списание бонусов за заказ ${order.orderNumber || order.id}`);
  }
  const points = getOrderBonusAmount(order, orgId);
  if (points > 0) {
    accrueBonus(orgId, clientId, points, performedBy || 'Система', `Начисление бонусов за заказ ${order.orderNumber || order.id}`);
  }
}

// --- Discount history management ---
export function setClientDiscount(orgId: string, clientId: string, newPercent: number, changedBy?: string, reason?: string): DiscountHistoryEntry | undefined {
  const client = getClients(orgId).find(c => c.id === clientId);
  if (!client) return undefined;
  const old = client.discountPercent || 0;
  const entry: DiscountHistoryEntry = {
    id: generateId(),
    clientId,
    organizationId: orgId,
    oldPercent: old,
    newPercent: newPercent,
    reason,
    changedAt: new Date().toISOString(),
    changedBy,
  };
  client.discountHistory = client.discountHistory || [];
  client.discountHistory.push(entry);
  client.discountPercent = newPercent;
  updateClient(client);
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: changedBy || 'Система',
    action: 'apply_discount',
    targetType: 'client',
    targetId: clientId,
    targetName: client.fullName,
    changes: { discountPercent: { oldValue: old, newValue: newPercent } },
    description: reason || `Скидка изменена с ${old}% на ${newPercent}%`,
    createdAt: new Date().toISOString(),
  });
  return entry;
}

// --- VIP history management ---
export function setClientVip(orgId: string, clientId: string, newIsVip: boolean, changedBy?: string, reason?: string): VipStatusHistoryEntry | undefined {
  const client = getClients(orgId).find(c => c.id === clientId);
  if (!client) return undefined;
  const old = !!client.isVip;
  const entry: VipStatusHistoryEntry = {
    id: generateId(),
    clientId,
    organizationId: orgId,
    oldIsVip: old,
    newIsVip,
    reason,
    changedAt: new Date().toISOString(),
    changedBy,
  };
  client.vipHistory = client.vipHistory || [];
  client.vipHistory.push(entry);
  client.isVip = newIsVip;
  updateClient(client);
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: changedBy || 'Система',
    action: 'modify_vip',
    targetType: 'client',
    targetId: clientId,
    targetName: client.fullName,
    changes: { isVip: { oldValue: old, newValue: newIsVip } },
    description: reason || `${newIsVip ? 'Назначен VIP' : 'Снят VIP'}`,
    createdAt: new Date().toISOString(),
  });
  return entry;
}

// --- CRM Dashboard service helpers ---
export function getNewClients(orgId: string, days = 30): Client[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return getClients(orgId).filter(c => new Date(c.createdAt).getTime() >= cutoff);
}

export function getBestClients(orgId: string, top = 10): Client[] {
  return getClients(orgId).slice().sort((a,b)=> (b.totalSpent||0)-(a.totalSpent||0)).slice(0, top);
}

export function getLostClients(orgId: string, inactiveDays = 90): Client[] {
  const cutoff = Date.now() - inactiveDays * 24 * 60 * 60 * 1000;
  return getClients(orgId).filter(c => c.lastVisitAt ? new Date(c.lastVisitAt).getTime() <= cutoff : true);
}

export function getRegularClients(orgId: string, minVisits = 5): Client[] {
  return getClients(orgId).filter(c => (c.totalVisits || 0) >= minVisits);
}

export function getClientsWithDiscounts(orgId: string): Client[] {
  return getClients(orgId).filter(c => (c.discountPercent || 0) > 0);
}

export function getClientsWithBonuses(orgId: string): Client[] {
  return getClients(orgId).filter(c => (c.bonusPoints || 0) > 0);
}

export function getClientsWithRecommendations(orgId: string): Client[] {
  return getClients(orgId).filter(c => getClientRecommendationsStructured(orgId, c.id).length > 0);
}

export function getHighCrmScoreClients(orgId: string, threshold = 75): Client[] {
  return getClients(orgId).filter(c => (c.crmScore || 0) >= threshold).sort((a,b)=> (b.crmScore||0)-(a.crmScore||0));
}

export function getClientsApproachingNextLevel(orgId: string, withinPercent = 0.1): Client[] {
  const settings = getLoyaltySettings(orgId);
  if (!settings) return [];
  const clients = getClients(orgId);
  const thresholds = [
    { level: 'Silver', value: settings.thresholdSilver || 0 },
    { level: 'Gold', value: settings.thresholdGold || 0 },
    { level: 'Platinum', value: settings.thresholdPlatinum || 0 },
    { level: 'VIP', value: settings.thresholdVip || 0 },
  ];
  return clients.filter(c => {
    const spent = c.totalSpent || 0;
    for (const t of thresholds) {
      if (t.value <= 0) continue;
      if (spent < t.value && (t.value - spent) / t.value <= withinPercent) return true;
    }
    return false;
  });
}

// UI-facing helpers
export function getClientBonusHistory(orgId: string, clientId: string): BonusOperation[] {
  const c = getClients(orgId).find(x => x.id === clientId);
  return c?.bonusHistory || [];
}

export function getClientDiscountHistory(orgId: string, clientId: string): DiscountHistoryEntry[] {
  const c = getClients(orgId).find(x => x.id === clientId);
  return c?.discountHistory || [];
}

export function getClientVipHistory(orgId: string, clientId: string): VipStatusHistoryEntry[] {
  const c = getClients(orgId).find(x => x.id === clientId);
  return c?.vipHistory || [];
}

function getShiftRange(orgId: string, shiftId: string): { from: number; to: number } | null {
  const shift = getCashShifts(orgId).find(s => s.id === shiftId);
  if (!shift) return null;
  const from = new Date(shift.openedAt).getTime();
  const to = shift.closedAt ? new Date(shift.closedAt).getTime() : Number.MAX_SAFE_INTEGER;
  return { from, to };
}

export function getCashShiftOperations(orgId: string, shiftId: string): CashOperation[] {
  const range = getShiftRange(orgId, shiftId);
  if (!range) return [];
  return getCashOperations(orgId).filter(op => {
    const time = new Date(op.createdAt).getTime();
    if (op.shiftId) return op.shiftId === shiftId;
    return time >= range.from && time <= range.to;
  });
}

export function getCashShiftMetrics(orgId: string, shiftId: string) {
  const ops = getCashShiftOperations(orgId, shiftId);
  const incomeOps = ops.filter(op => op.direction === 'income');
  const { expense, refunds, discounts, bonuses } = getExpenseBuckets(ops);
  const checksCount = incomeOps.filter(op => op.type === 'order_payment').length;
  const methodTotals = getMethodTotalsFromIncome(incomeOps);

  const byMethod = (method: CashPaymentMethod) =>
    methodTotals[normalizePaymentMethod(method)] || 0;

  const income = incomeOps.reduce((sum, op) => sum + op.amount, 0);
  const averageCheck = checksCount > 0 ? Math.round(income / checksCount) : 0;

  return {
    cashIncome: byMethod('Наличные'),
    cardIncome: byMethod('Банковская карта'),
    kaspiIncome: getKaspiIncomeFromIncome(incomeOps),
    qrIncome: byMethod('QR'),
    transferIncome: byMethod('Перевод'),
    bonusIncome: byMethod('Бонусы'),
    mixedIncome: byMethod('Смешанная'),
    otherIncome: byMethod('Другой'),
    refunds,
    discounts,
    bonuses,
    checksCount,
    averageCheck,
    expense,
    income,
    turnover: income + expense,
  };
}

export function addCashOperationCorrection(params: {
  orgId: string;
  baseOperationId: string;
  direction: 'income' | 'expense';
  amount: number;
  paymentMethod: CashPaymentMethod;
  employeeName: string;
  reason: string;
}): CashOperation | null {
  const data = get<CashOperation>(KEYS.cashOperations);
  const base = data.find(op => op.organizationId === params.orgId && op.id === params.baseOperationId);
  if (!base) return null;

  const correction: CashOperation = {
    id: generateId(),
    organizationId: params.orgId,
    shiftId: getOpenCashShift(params.orgId)?.id,
    createdAt: new Date().toISOString(),
    employeeName: params.employeeName,
    performedBy: params.employeeName,
    amount: Math.max(0, Math.round(params.amount)),
    direction: params.direction,
    type: 'correction',
    paymentMethod: normalizePaymentMethod(params.paymentMethod),
    orderId: base.orderId,
    orderNumber: base.orderNumber,
    licensePlate: base.licensePlate,
    description: `Корректировка: ${params.reason}`,
    isCorrection: true,
    originalOperationId: base.id,
    correctionReason: params.reason,
  };

  if (correction.amount <= 0) return null;
  addCashOperation(correction);
  return correction;
}

export function upsertOrderPaymentOperation(order: Order, orgId: string, employeeName: string): void {
  const data = get<CashOperation>(KEYS.cashOperations);
  const orderOps = data.filter(o => o.organizationId === orgId && o.orderId === order.id);
  const paymentOps = orderOps.filter(op => !(op.type === 'refund' || (op.type === 'correction' && (op.description || '').includes('[order:'))));
  const orderNumber = order.orderNumber || order.id;
  const now = new Date().toISOString();
  const openShift = getOpenCashShift(orgId);
  const bonusAmount = Math.max(0, Math.round(order.bonusApplied || 0));
  const discountAmount = Math.max(0, Math.round(order.discountAmount || 0));
  const refundAmount = Math.max(0, Math.round(order.refundAmount || 0));

  const ensureSingleMetaExpense = (type: CashOperationType, amount: number, description: string, paymentMethod: CashPaymentMethod = 'Наличные') => {
    if (amount <= 0) return;
    const marker = `${description} [order:${order.id}]`;
    const existing = data.find(op => op.organizationId === orgId && op.orderId === order.id && op.type === type && op.description === marker);
    if (existing) {
      if (existing.amount === amount) return;
      existing.amount = amount;
      existing.createdAt = now;
      existing.shiftId = openShift?.id;
      existing.employeeName = employeeName;
      existing.performedBy = employeeName;
      existing.paymentMethod = normalizePaymentMethod(paymentMethod);
      existing.direction = 'expense';
      return;
    }
    data.push({
      id: generateId(),
      organizationId: orgId,
      shiftId: openShift?.id,
      createdAt: now,
      employeeName,
      performedBy: employeeName,
      amount,
      direction: 'expense',
      type,
      paymentMethod: normalizePaymentMethod(paymentMethod),
      orderId: order.id,
      orderNumber,
      licensePlate: order.licensePlate,
      description: marker,
    });
  };

  const clearMetaExpenses = () => {
    for (let i = data.length - 1; i >= 0; i -= 1) {
      const op = data[i];
      if (op.organizationId !== orgId || op.orderId !== order.id) continue;
      if (op.type === 'refund' || (op.type === 'correction' && (op.description || '').includes('[order:'))) {
        data.splice(i, 1);
      }
    }
  };

  if (order.status !== 'completed') {
    const effective = paymentOps.reduce((sum, op) => sum + (op.direction === 'income' ? op.amount : -op.amount), 0);
    if (effective > 0) {
      addCashOperation({
        id: generateId(),
        organizationId: orgId,
        shiftId: openShift?.id,
        createdAt: now,
        employeeName,
        performedBy: employeeName,
        amount: Math.round(effective),
        direction: 'expense',
        type: 'refund',
        paymentMethod: 'Наличные',
        orderId: order.id,
        orderNumber,
        licensePlate: order.licensePlate,
        description: 'Возврат/отмена оплаты заказа',
        isCorrection: true,
        originalOperationId: paymentOps[0]?.id,
        correctionReason: 'Заказ отменён или переведён из завершённого статуса',
      });
    }
    clearMetaExpenses();
    saveCashOperations(data);
    return;
  }

  const effectiveByMethod = new Map<CashPaymentMethod, number>();
  paymentOps.forEach(op => {
    const method = normalizePaymentMethod(op.paymentMethod);
    const signed = op.direction === 'income' ? op.amount : -op.amount;
    effectiveByMethod.set(method, (effectiveByMethod.get(method) || 0) + signed);
  });
  const totalEffective = Array.from(effectiveByMethod.values()).reduce((sum, value) => sum + value, 0);

  const parts = (order.paymentParts || []).filter(part => part.amount > 0);
  const hasMixed = parts.length > 1;
  const targetMethod = hasMixed ? 'Смешанная' : normalizePaymentMethod(order.paymentMethod);
  const targetAmount = Math.max(0, Math.round(order.totalAmount));

  if (paymentOps.length === 0) {
    const operation: CashOperation = {
      id: generateId(),
      organizationId: orgId,
      shiftId: openShift?.id,
      createdAt: order.paidAt || order.completedAt || now,
      employeeName,
      performedBy: employeeName,
      amount: targetAmount,
      direction: 'income',
      type: 'order_payment',
      paymentMethod: targetMethod,
      paymentParts: hasMixed ? parts : undefined,
      orderId: order.id,
      orderNumber: order.orderNumber || order.id,
      licensePlate: order.licensePlate,
      description: 'Оплата заказа',
    };
    data.push(operation);
    ensureSingleMetaExpense('correction', bonusAmount, 'Списание бонусов по заказу', 'Бонусы');
    ensureSingleMetaExpense('correction', discountAmount, 'Скидка по заказу', 'Наличные');
    ensureSingleMetaExpense('refund', refundAmount, 'Возврат по заказу', normalizePaymentMethod(order.paymentMethod));
    saveCashOperations(data);
    return;
  }

  const sameMethodOnly = Array.from(effectiveByMethod.entries()).every(([method, amount]) => {
    if (amount === 0) return true;
    return method === targetMethod;
  });
  if (sameMethodOnly && totalEffective === targetAmount) {
    return;
  }

  const baseOp = paymentOps.find(op => op.type === 'order_payment') || paymentOps[0];
  const corrections: CashOperation[] = [];

  effectiveByMethod.forEach((amount, method) => {
    if (amount > 0 && method !== targetMethod) {
      corrections.push({
        id: generateId(),
        organizationId: orgId,
        shiftId: openShift?.id,
        createdAt: now,
        employeeName,
        performedBy: employeeName,
        amount: amount,
        direction: 'expense',
        type: 'correction',
        paymentMethod: method,
        orderId: order.id,
        orderNumber: order.orderNumber || order.id,
        licensePlate: order.licensePlate,
        description: 'Корректировка оплаты заказа (перенос способа оплаты)',
        isCorrection: true,
        originalOperationId: baseOp.id,
        correctionReason: 'Изменение способа оплаты/суммы после оплаты',
      });
    }
  });

  const currentTarget = effectiveByMethod.get(targetMethod) || 0;
  const delta = targetAmount - currentTarget;
  if (delta !== 0) {
    corrections.push({
      id: generateId(),
      organizationId: orgId,
      shiftId: openShift?.id,
      createdAt: now,
      employeeName,
      performedBy: employeeName,
      amount: Math.abs(delta),
      direction: delta > 0 ? 'income' : 'expense',
      type: 'correction',
      paymentMethod: targetMethod,
      paymentParts: hasMixed ? parts : undefined,
      orderId: order.id,
      orderNumber: order.orderNumber || order.id,
      licensePlate: order.licensePlate,
      description: 'Корректировка оплаты заказа (изменение суммы)',
      isCorrection: true,
      originalOperationId: baseOp.id,
      correctionReason: 'Изменение способа оплаты/суммы после оплаты',
    });
  }

  if (corrections.length > 0) {
    data.push(...corrections);
  }

  ensureSingleMetaExpense('correction', bonusAmount, 'Списание бонусов по заказу', 'Бонусы');
  ensureSingleMetaExpense('correction', discountAmount, 'Скидка по заказу', 'Наличные');
  ensureSingleMetaExpense('refund', refundAmount, 'Возврат по заказу', normalizePaymentMethod(order.paymentMethod));

  saveCashOperations(data);
}

export function calculateCashSummary(orgId: string, fromISO?: string, toISO?: string) {
  const from = fromISO ? new Date(fromISO).getTime() : Number.MIN_SAFE_INTEGER;
  const to = toISO ? new Date(toISO).getTime() : Number.MAX_SAFE_INTEGER;
  const ops = getCashOperations(orgId).filter(op => {
    const time = new Date(op.createdAt).getTime();
    return time >= from && time <= to;
  });

  const incomeOps = ops.filter(op => op.direction === 'income');
  const methodTotals = getMethodTotalsFromIncome(incomeOps);
  const byMethod = (method: CashPaymentMethod) => methodTotals[normalizePaymentMethod(method)] || 0;

  const income = incomeOps.reduce((sum, op) => sum + op.amount, 0);
  const { expense, refunds, discounts, bonuses } = getExpenseBuckets(ops);
  const checksCount = incomeOps.filter(op => op.type === 'order_payment').length;

  return {
    income,
    expense,
    cashIncome: byMethod('Наличные'),
    cardIncome: byMethod('Банковская карта'),
    kaspiIncome: getKaspiIncomeFromIncome(incomeOps),
    qrIncome: byMethod('QR'),
    transferIncome: byMethod('Перевод'),
    otherIncome: byMethod('Другой'),
    bonusIncome: byMethod('Бонусы'),
    mixedIncome: byMethod('Смешанная'),
    refunds,
    discounts,
    bonuses,
    checksCount,
    averageCheck: checksCount > 0
      ? Math.round(income / checksCount)
      : 0,
    turnover: income + expense,
    result: income - expense,
  };
}

export function closeCashShift(orgId: string, shiftId: string, closedBy: string, factCash: number, closingComment?: string): CashShift | null {
  const shift = getCashShifts(orgId).find(s => s.id === shiftId);
  if (!shift || shift.closedAt) return null;

  const metrics = getCashShiftMetrics(orgId, shiftId) as CashShiftComputedMetrics;

  const expectedCash = Math.round(shift.openingCash + metrics.cashIncome - metrics.expense);
  const fact = Math.round(factCash);
  const difference = fact - expectedCash;
  if (difference !== 0 && !closingComment?.trim()) return null;

  const updated: CashShift = {
    ...shift,
    closedAt: new Date().toISOString(),
    closedBy,
    factCash: fact,
    expectedCash,
    difference,
    closingComment: closingComment?.trim(),
    metrics,
  };

  updateCashShift(updated);
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: closedBy,
    action: 'close_cash_shift',
    targetType: 'shift',
    targetId: shiftId,
    targetName: shift.cashierName,
    description: `Закрыта кассовая смена (${shift.cashierName})`,
    changes: {
      expectedCash: { oldValue: shift.expectedCash || 0, newValue: expectedCash },
      factCash: { oldValue: shift.factCash || 0, newValue: fact },
      difference: { oldValue: shift.difference || 0, newValue: difference },
    },
    createdAt: new Date().toISOString(),
  });
  return updated;
}

export function calculateCashReport(orgId: string, fromISO: string, toISO: string, cashierName?: string): CashReport {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  const operations = getCashOperations(orgId).filter(op => {
    const time = new Date(op.createdAt).getTime();
    if (time < from || time > to) return false;
    if (cashierName && op.employeeName !== cashierName && op.performedBy !== cashierName) return false;
    return true;
  });

  const incomeOps = operations.filter(op => op.direction === 'income');
  const income = incomeOps.reduce((sum, op) => sum + op.amount, 0);
  const methodTotals = getMethodTotalsFromIncome(incomeOps);
  const byMethod = (method: CashPaymentMethod) => methodTotals[normalizePaymentMethod(method)] || 0;
  const checksCount = incomeOps.filter(op => op.type === 'order_payment').length;
  const { expense, refunds, discounts, bonuses } = getExpenseBuckets(operations);

  const summary: CashShiftComputedMetrics = {
    cashIncome: byMethod('Наличные'),
    cardIncome: byMethod('Банковская карта'),
    kaspiIncome: getKaspiIncomeFromIncome(incomeOps),
    qrIncome: byMethod('QR'),
    transferIncome: byMethod('Перевод'),
    bonusIncome: byMethod('Бонусы'),
    mixedIncome: byMethod('Смешанная'),
    otherIncome: byMethod('Другой'),
    refunds,
    discounts,
    bonuses,
    checksCount,
    averageCheck: checksCount > 0 ? Math.round(income / checksCount) : 0,
    expense,
    income,
    turnover: income + expense,
  };

  return {
    fromISO,
    toISO,
    cashierName,
    summary,
  };
}

function getDefaultWarehouseCategoryNames(): string[] {
  return [
    'Автохимия',
    'Шампуни',
    'Воски',
    'Чернение шин',
    'Салонная химия',
    'Тряпки',
    'Губки',
    'Перчатки',
    'Оборудование',
    'Другое',
  ];
}

export function getWarehouseCategories(orgId: string): WarehouseCategory[] {
  const categories = get<WarehouseCategory>(KEYS.warehouseCategories).filter(c => c.organizationId === orgId);
  if (categories.length > 0) return categories;
  const defaults = getDefaultWarehouseCategoryNames().map(name => ({
    id: generateId(),
    organizationId: orgId,
    name,
    createdAt: new Date().toISOString(),
  }));
  const all = get<WarehouseCategory>(KEYS.warehouseCategories);
  all.push(...defaults);
  set(KEYS.warehouseCategories, all);
  return defaults;
}

export function saveWarehouseCategories(data: WarehouseCategory[]): void { set(KEYS.warehouseCategories, data); }

export function addWarehouseCategory(category: WarehouseCategory): void {
  const data = get<WarehouseCategory>(KEYS.warehouseCategories);
  data.push(category);
  saveWarehouseCategories(data);
}

export function getWarehouseItems(orgId: string): WarehouseItem[] {
  return get<WarehouseItem>(KEYS.warehouseItems).filter(i => i.organizationId === orgId);
}

export function saveWarehouseItems(data: WarehouseItem[]): void { set(KEYS.warehouseItems, data); }

export function addWarehouseItem(item: WarehouseItem): void {
  const data = get<WarehouseItem>(KEYS.warehouseItems);
  data.push({ ...item, quantity: Math.max(0, item.quantity) });
  saveWarehouseItems(data);
  addActionLog({
    id: generateId(),
    organizationId: item.organizationId,
    performedBy: 'Система',
    action: 'create_worker',
    targetType: 'item',
    targetId: item.id,
    targetName: item.name,
    description: `Создан товар: ${item.name}`,
    createdAt: new Date().toISOString(),
  });
}

export function updateWarehouseItem(item: WarehouseItem): void {
  saveWarehouseItems(get<WarehouseItem>(KEYS.warehouseItems).map(i => i.id === item.id ? { ...item, quantity: Math.max(0, item.quantity), updatedAt: new Date().toISOString() } : i));
  addActionLog({
    id: generateId(),
    organizationId: item.organizationId,
    performedBy: 'Система',
    action: 'update_worker',
    targetType: 'item',
    targetId: item.id,
    targetName: item.name,
    description: `Обновлён товар: ${item.name}`,
    createdAt: new Date().toISOString(),
  });
}

export function getWarehouseForecast(orgId: string) {
  const items = getWarehouseItems(orgId);
  const movements = getWarehouseMovements(orgId);
  const today = new Date();
  const dayStart = new Date(today);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  return items.map(item => {
    const consumedWeek = movements.filter(m => m.itemId === item.id && (m.type === 'consumption' || m.type === 'writeoff') && new Date(m.createdAt) >= weekStart)
      .reduce((sum, m) => sum + m.quantity, 0);
    const avgDaily = consumedWeek / 7;
    const daysLeft = avgDaily > 0 ? item.quantity / avgDaily : null;
    return {
      itemId: item.id,
      itemName: item.name,
      quantity: item.quantity,
      unit: item.unit,
      minQuantity: item.minQuantity,
      avgDaily,
      daysLeft,
      level: item.quantity <= item.minQuantity ? 'critical' : item.quantity <= item.minQuantity * 1.5 ? 'warning' : 'ok' as const,
    };
  });
}

export function getWarehouseMovements(orgId: string): WarehouseMovement[] {
  return get<WarehouseMovement>(KEYS.warehouseMovements).filter(m => m.organizationId === orgId);
}

export function saveWarehouseMovements(data: WarehouseMovement[]): void { set(KEYS.warehouseMovements, data); }

export function addWarehouseMovement(movement: WarehouseMovement): void {
  const data = get<WarehouseMovement>(KEYS.warehouseMovements);
  data.push(movement);
  saveWarehouseMovements(data);
}

function applyWarehouseDelta(orgId: string, itemId: string, quantityDelta: number): WarehouseItem | null {
  const items = get<WarehouseItem>(KEYS.warehouseItems);
  const idx = items.findIndex(i => i.organizationId === orgId && i.id === itemId);
  if (idx < 0) return null;
  const prevQty = items[idx].quantity;
  const nextQty = Math.max(0, Number((items[idx].quantity + quantityDelta).toFixed(3)));
  items[idx] = { ...items[idx], quantity: nextQty, updatedAt: new Date().toISOString() };
  saveWarehouseItems(items);
  // Threshold notifications: if we crossed below or hit zero, create notification
  try {
    const item = items[idx];
    if (prevQty > item.minQuantity && item.quantity <= item.minQuantity) {
      addWorkerNotification({
        id: generateId(),
        workerId: undefined,
        organizationId: orgId,
        type: 'warehouse_alert',
        message: `${item.name} на складе меньше или равен минимальному остатку (${item.quantity} ${item.unit})`,
        severity: 'warning',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
    if (prevQty > 0 && item.quantity === 0) {
      addWorkerNotification({
        id: generateId(),
        workerId: undefined,
        organizationId: orgId,
        type: 'warehouse_alert',
        message: `${item.name} закончилcя на складе`,
        severity: 'error',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    // ignore notification errors
  }
  return items[idx];
}

export function addWarehouseIncoming(params: {
  orgId: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  employeeName: string;
  supplierId?: string;
  supplier?: string;
  note?: string;
}): WarehouseMovement | null {
  if (params.quantity <= 0) return null;
  const item = getWarehouseItems(params.orgId).find(i => i.id === params.itemId);
  if (!item) return null;

  const updated = applyWarehouseDelta(params.orgId, params.itemId, params.quantity);
  if (!updated) return null;
  if (params.supplier) {
    updateWarehouseItem({ ...updated, supplier: params.supplier });
  }

  const totalCost = roundMoney(params.quantity * params.unitPrice);
  const supplierRecord = params.supplierId ? getSuppliers(params.orgId).find(s => s.id === params.supplierId) : undefined;
  const movement: WarehouseMovement = {
    id: generateId(),
    organizationId: params.orgId,
    itemId: item.id,
    itemName: item.name,
    type: 'incoming',
    quantity: Number(params.quantity.toFixed(3)),
    unit: item.unit,
    unitPrice: roundMoney(params.unitPrice),
    totalCost,
    reason: params.note || 'Закупка материалов',
    employeeName: params.employeeName,
    supplierId: supplierRecord?.id,
    supplierName: supplierRecord?.name || params.supplier,
    createdAt: new Date().toISOString(),
    source: 'manual',
  };

  addWarehouseMovement(movement);

  addCashOperation({
    id: generateId(),
    organizationId: params.orgId,
    shiftId: getOpenCashShift(params.orgId)?.id,
    createdAt: movement.createdAt,
    employeeName: params.employeeName,
    performedBy: params.employeeName,
    amount: totalCost,
    direction: 'expense',
    type: 'expense_supply',
    paymentMethod: 'Наличные',
    description: `Закупка материалов: ${item.name}`,
  });

  addActionLog({
    id: generateId(),
    organizationId: params.orgId,
    performedBy: params.employeeName,
    action: 'cash_operation',
    targetType: 'item',
    targetId: item.id,
    targetName: item.name,
    description: `Приход ${params.quantity} ${item.unit} по цене ${params.unitPrice}`,
    createdAt: new Date().toISOString(),
  });

  return movement;
}

export function addWarehouseWriteoff(params: {
  orgId: string;
  itemId: string;
  quantity: number;
  type?: WarehouseMovementType;
  employeeName: string;
  reason: string;
  orderId?: string;
  orderNumber?: string;
  serviceId?: string;
  serviceName?: string;
  source?: 'manual' | 'order_auto';
}): WarehouseMovement | null {
  if (params.quantity <= 0) return null;
  const item = getWarehouseItems(params.orgId).find(i => i.id === params.itemId);
  if (!item) return null;
  if (item.quantity < params.quantity) return null;

  const updated = applyWarehouseDelta(params.orgId, params.itemId, -params.quantity);
  if (!updated) return null;
  const totalCost = roundMoney(params.quantity * item.purchasePrice);

  const movement: WarehouseMovement = {
    id: generateId(),
    organizationId: params.orgId,
    itemId: item.id,
    itemName: item.name,
    type: params.type || 'writeoff',
    quantity: Number(params.quantity.toFixed(3)),
    unit: item.unit,
    unitPrice: item.purchasePrice,
    totalCost,
    reason: params.reason,
    employeeName: params.employeeName,
    createdAt: new Date().toISOString(),
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    serviceId: params.serviceId,
    serviceName: params.serviceName,
    source: params.source || 'manual',
  };
  addWarehouseMovement(movement);
  addActionLog({
    id: generateId(),
    organizationId: params.orgId,
    performedBy: params.employeeName,
    action: params.type === 'writeoff' ? 'writeoff_item' : 'adjust_salary',
    targetType: 'item',
    targetId: item.id,
    targetName: item.name,
    description: movement.reason || 'Списание',
    createdAt: new Date().toISOString(),
  });
  return movement;
}

export function getServiceMaterialUsages(orgId: string): ServiceMaterialUsage[] {
  return get<ServiceMaterialUsage>(KEYS.serviceMaterialUsages).filter(u => u.organizationId === orgId);
}

// Inventories
export function getInventories(orgId: string): Inventory[] {
  return get<Inventory>(KEYS.inventories).filter(i => i.organizationId === orgId).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function saveInventories(data: Inventory[]): void { set(KEYS.inventories, data); }

export function createInventory(orgId: string, createdBy: string, note?: string): Inventory {
  const inv: Inventory = { id: generateId(), organizationId: orgId, createdAt: new Date().toISOString(), createdBy, records: [], note };
  const data = get<Inventory>(KEYS.inventories);
  data.push(inv);
  saveInventories(data);
  addActionLog({ id: generateId(), organizationId: orgId, performedBy: createdBy, action: 'modify_client', targetType: 'item', targetId: inv.id, targetName: 'Инвентаризация', description: `Открыта инвентаризация ${inv.id}`, createdAt: new Date().toISOString() });
  return inv;
}

export function finalizeInventory(invId: string, finalizedBy: string, records: InventoryRecord[]): { corrections: WarehouseMovement[] } {
  const all = get<Inventory>(KEYS.inventories);
  const inv = all.find(i => i.id === invId);
  if (!inv) return { corrections: [] };
  inv.finalizedAt = new Date().toISOString();
  inv.finalizedBy = finalizedBy;
  inv.records = records;
  saveInventories(all.map(i => i.id === invId ? inv : i));

  const corrections: WarehouseMovement[] = [];
  const orgId = inv.organizationId;
  records.forEach(r => {
    const current = getWarehouseItems(orgId).find(it => it.id === r.itemId);
    const currentQty = current ? current.quantity : 0;
    const delta = Number((r.countedQuantity - currentQty).toFixed(3));
    if (Math.abs(delta) > 0.0001) {
      // create correction movement and apply delta
      const movement: WarehouseMovement = {
        id: generateId(),
        organizationId: orgId,
        itemId: r.itemId,
        itemName: r.itemName,
        type: 'correction',
        quantity: Math.abs(delta),
        unit: current?.unit || 'шт',
        unitPrice: current?.purchasePrice,
        totalCost: current ? Math.round(Math.abs(delta) * (current.purchasePrice || 0)) : 0,
        reason: `Инвентаризация ${inv.id}`,
        employeeName: finalizedBy,
        createdAt: new Date().toISOString(),
        source: 'inventory',
      };
      // negative delta -> decrease stock (writeoff), positive -> incoming
      addWarehouseMovement(movement);
      applyWarehouseDelta(orgId, r.itemId, delta);
      corrections.push(movement);
    }
  });

  addActionLog({ id: generateId(), organizationId: orgId, performedBy: finalizedBy, action: 'modify_client', targetType: 'item', targetId: inv.id, targetName: 'Инвентаризация', description: `Финализирована инвентаризация ${inv.id}`, createdAt: new Date().toISOString() });
  return { corrections };
}

export function saveServiceMaterialUsages(data: ServiceMaterialUsage[]): void { set(KEYS.serviceMaterialUsages, data); }

export function upsertServiceMaterialUsage(usage: ServiceMaterialUsage): void {
  const data = get<ServiceMaterialUsage>(KEYS.serviceMaterialUsages);
  const idx = data.findIndex(u => u.organizationId === usage.organizationId && u.serviceId === usage.serviceId && u.itemId === usage.itemId);
  if (idx >= 0) data[idx] = usage; else data.push(usage);
  saveServiceMaterialUsages(data);
}

export function removeServiceMaterialUsage(orgId: string, serviceId: string, itemId: string): void {
  saveServiceMaterialUsages(get<ServiceMaterialUsage>(KEYS.serviceMaterialUsages).filter(u => !(u.organizationId === orgId && u.serviceId === serviceId && u.itemId === itemId)));
}

export function consumeMaterialsForOrder(order: Order, orgId: string, employeeName: string): WarehouseMovement[] {
  if (order.status !== 'completed') return [];
  const usages = getServiceMaterialUsages(orgId);
  if (usages.length === 0) return [];

  const existing = getWarehouseMovements(orgId).filter(m => m.orderId === order.id && m.source === 'order_auto');
  if (existing.length > 0) return existing;

  const serviceIds = new Set(order.services.map(s => s.serviceId));
  const applicable = usages.filter(u => serviceIds.has(u.serviceId));
  const created: WarehouseMovement[] = [];

  applicable.forEach(u => {
    const movement = addWarehouseWriteoff({
      orgId,
      itemId: u.itemId,
      quantity: u.quantityPerService,
      type: 'consumption',
      employeeName,
      reason: `Списание по заказу ${order.orderNumber || order.id}`,
      orderId: order.id,
      orderNumber: order.orderNumber || order.id,
      serviceId: u.serviceId,
      serviceName: u.serviceName,
      source: 'order_auto',
    });
    if (movement) created.push(movement);
  });

  return created;
}

// Seed default data
export function seedData(): void {
  initializeEmptyWorkspace();
}

// Organizations
export function getOrganizations(): Organization[] {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return [];
  return getOrganizationsForUser(currentUserId);
}
export function saveOrganizations(data: Organization[]): void { set(KEYS.organizations, data); }
export function addOrganization(org: Organization): void {
  const currentUserId = getCurrentUserId();
  const data = getOrganizationsRaw();
  data.push({
    ...org,
    ownerId: org.ownerId || currentUserId || org.ownerId,
    updatedAt: new Date().toISOString(),
  });
  saveOrganizations(data);
}
export function updateOrganization(org: Organization): void {
  const data = getOrganizationsRaw().map(o => o.id === org.id ? { ...org, updatedAt: new Date().toISOString() } : o);
  saveOrganizations(data);
}
export function deleteOrganization(id: string): void {
  saveOrganizations(getOrganizations().filter(o => o.id !== id));
  // Also delete related data
  set(KEYS.carTypes, get<CarType>(KEYS.carTypes).filter(c => c.organizationId !== id));
  set(KEYS.services, get<Service>(KEYS.services).filter(s => s.organizationId !== id));
  set(KEYS.prices, get<PriceEntry>(KEYS.prices).filter(p => p.organizationId !== id));
  set(KEYS.washers, get<Washer>(KEYS.washers).filter(w => w.organizationId !== id));
  set(KEYS.orders, get<Order>(KEYS.orders).filter(o => o.organizationId !== id));
  set(KEYS.batches, get<BatchOrder>(KEYS.batches).filter(b => b.organizationId !== id));
  set(KEYS.shifts, get<Shift>(KEYS.shifts).filter(s => s.organizationId !== id));
  set(KEYS.boxes, get<Box>(KEYS.boxes).filter(b => b.organizationId !== id));
  set(KEYS.washerShiftDays, get<WasherShiftDay>(KEYS.washerShiftDays).filter(w => w.organizationId !== id));
  set(KEYS.washerCurrentStatus, get<WasherCurrentStatus>(KEYS.washerCurrentStatus).filter(w => w.organizationId !== id));
  set(KEYS.workerTimelogs, get<WorkerTimelog>(KEYS.workerTimelogs).filter(w => w.organizationId !== id));
  set(KEYS.cashShifts, get<CashShift>(KEYS.cashShifts).filter(s => s.organizationId !== id));
  set(KEYS.cashOperations, get<CashOperation>(KEYS.cashOperations).filter(o => o.organizationId !== id));
  set(KEYS.suppliers, get<Supplier>(KEYS.suppliers).filter(s => s.organizationId !== id));
  set(KEYS.warehouseCategories, get<WarehouseCategory>(KEYS.warehouseCategories).filter(c => c.organizationId !== id));
  set(KEYS.warehouseItems, get<WarehouseItem>(KEYS.warehouseItems).filter(i => i.organizationId !== id));
  set(KEYS.warehouseMovements, get<WarehouseMovement>(KEYS.warehouseMovements).filter(m => m.organizationId !== id));
  set(KEYS.serviceMaterialUsages, get<ServiceMaterialUsage>(KEYS.serviceMaterialUsages).filter(u => u.organizationId !== id));
}
export function getActiveOrgId(): string | null {
  return getSession()?.activeOrgId || localStorage.getItem(KEYS.activeOrg);
}
export function setActiveOrgId(id: string): void {
  const session = getSession();
  if (session) {
    saveSession({ ...session, activeOrgId: id, updatedAt: new Date().toISOString() });
    return;
  }
  localStorage.setItem(KEYS.activeOrg, id);
}

// Car Types
export function getCarTypes(orgId: string): CarType[] {
  return get<CarType>(KEYS.carTypes).filter(c => c.organizationId === orgId);
}
export function saveCarTypes(data: CarType[]): void { set(KEYS.carTypes, data); }
export function addCarType(ct: CarType): void {
  const data = get<CarType>(KEYS.carTypes);
  data.push(ct);
  saveCarTypes(data);
}
export function updateCarType(ct: CarType): void {
  saveCarTypes(get<CarType>(KEYS.carTypes).map(c => c.id === ct.id ? ct : c));
}
export function deleteCarType(id: string): void {
  saveCarTypes(get<CarType>(KEYS.carTypes).filter(c => c.id !== id));
  set(KEYS.prices, get<PriceEntry>(KEYS.prices).filter(p => p.carTypeId !== id));
}

// Services
export function getServices(orgId: string): Service[] {
  return get<Service>(KEYS.services).filter(s => s.organizationId === orgId);
}
export function saveServices(data: Service[]): void { set(KEYS.services, data); }
export function addService(svc: Service): void {
  const data = get<Service>(KEYS.services);
  data.push(svc);
  saveServices(data);
}
export function updateService(svc: Service): void {
  saveServices(get<Service>(KEYS.services).map(s => s.id === svc.id ? svc : s));
}
export function deleteService(id: string): void {
  saveServices(get<Service>(KEYS.services).filter(s => s.id !== id));
  set(KEYS.prices, get<PriceEntry>(KEYS.prices).filter(p => p.serviceId !== id));
}

// Prices
export function getPrices(orgId: string): PriceEntry[] {
  return get<PriceEntry>(KEYS.prices).filter(p => p.organizationId === orgId);
}
export function savePrices(data: PriceEntry[]): void { set(KEYS.prices, data); }
export function getPrice(serviceId: string, carTypeId: string): PriceEntry | undefined {
  return get<PriceEntry>(KEYS.prices).find(p => p.serviceId === serviceId && p.carTypeId === carTypeId);
}
export function setPrice(entry: PriceEntry): void {
  const data = get<PriceEntry>(KEYS.prices);
  const idx = data.findIndex(p => p.serviceId === entry.serviceId && p.carTypeId === entry.carTypeId);
  if (idx >= 0) {
    data[idx] = entry;
  } else {
    data.push(entry);
  }
  savePrices(data);
}

// Washers
export function getWashers(orgId: string): Washer[] {
  return get<Washer>(KEYS.washers).filter(w => w.organizationId === orgId);
}
export function saveWashers(data: Washer[]): void { set(KEYS.washers, data); }
export function addWasher(w: Washer): void {
  const data = get<Washer>(KEYS.washers);
  data.push(w);
  saveWashers(data);
}
export function updateWasher(w: Washer): void {
  saveWashers(get<Washer>(KEYS.washers).map(x => x.id === w.id ? w : x));
}
export function deleteWasher(id: string): void {
  saveWashers(get<Washer>(KEYS.washers).filter(w => w.id !== id));
}

// Washer Shift Days
export function getWasherShiftDays(orgId: string): WasherShiftDay[] {
  return get<WasherShiftDay>(KEYS.washerShiftDays).filter(w => w.organizationId === orgId);
}
export function saveWasherShiftDays(data: WasherShiftDay[]): void { set(KEYS.washerShiftDays, data); }
export function addWasherShiftDay(w: WasherShiftDay): void {
  const data = get<WasherShiftDay>(KEYS.washerShiftDays);
  const existing = data.findIndex(x => x.washerId === w.washerId && x.date === w.date);
  if (existing >= 0) data[existing] = w; else data.push(w);
  saveWasherShiftDays(data);
}
export function updateWasherShiftDay(w: WasherShiftDay): void {
  const data = get<WasherShiftDay>(KEYS.washerShiftDays);
  const idx = data.findIndex(x => x.id === w.id);
  if (idx >= 0) data[idx] = w; else data.push(w);
  saveWasherShiftDays(data);
}
export function deleteWasherShiftDay(id: string): void {
  saveWasherShiftDays(get<WasherShiftDay>(KEYS.washerShiftDays).filter(w => w.id !== id));
}
export function getWasherShiftDaysForDate(orgId: string, date: string): WasherShiftDay[] {
  return get<WasherShiftDay>(KEYS.washerShiftDays).filter(w => w.organizationId === orgId && w.date === date);
}

// Washer Current Status
export function getWasherCurrentStatuses(orgId: string): WasherCurrentStatus[] {
  const today = getTodayKey();
  return get<WasherCurrentStatus>(KEYS.washerCurrentStatus).filter(w => w.organizationId === orgId && w.date === today);
}
export function saveWasherCurrentStatuses(data: WasherCurrentStatus[]): void { set(KEYS.washerCurrentStatus, data); }
export function addOrUpdateWasherCurrentStatus(w: WasherCurrentStatus): void {
  const data = get<WasherCurrentStatus>(KEYS.washerCurrentStatus);
  const idx = data.findIndex(x => x.washerId === w.washerId && x.date === w.date);
  if (idx >= 0) data[idx] = w; else data.push(w);
  saveWasherCurrentStatuses(data);
}
export function getWasherCurrentStatusForDate(orgId: string, washerId: string, date: string): WasherCurrentStatus | undefined {
  return get<WasherCurrentStatus>(KEYS.washerCurrentStatus).find(
    w => w.organizationId === orgId && w.washerId === washerId && w.date === date
  );
}

// Worker Timelogs
export function getWorkerTimelogs(orgId: string): WorkerTimelog[] {
  return get<WorkerTimelog>(KEYS.workerTimelogs).filter(w => w.organizationId === orgId);
}
export function saveWorkerTimelogs(data: WorkerTimelog[]): void { set(KEYS.workerTimelogs, data); }
export function addWorkerTimelog(w: WorkerTimelog): void {
  const data = get<WorkerTimelog>(KEYS.workerTimelogs);
  data.push(w);
  saveWorkerTimelogs(data);
}
export function updateWorkerTimelog(w: WorkerTimelog): void {
  const data = get<WorkerTimelog>(KEYS.workerTimelogs);
  const idx = data.findIndex(x => x.id === w.id);
  if (idx >= 0) data[idx] = w; else data.push(w);
  saveWorkerTimelogs(data);
}
export function getWorkerTimelogsForWasher(orgId: string, washerId: string, fromDate: string, toDate: string): WorkerTimelog[] {
  return get<WorkerTimelog>(KEYS.workerTimelogs).filter(
    w => w.organizationId === orgId && w.washerId === washerId && w.date >= fromDate && w.date <= toDate
  );
}

// Boxes
export function getBoxes(orgId: string): Box[] {
  return get<Box>(KEYS.boxes).filter(b => b.organizationId === orgId);
}
export function saveBoxes(data: Box[]): void { set(KEYS.boxes, data); }
export function addBox(b: Box): void {
  const data = get<Box>(KEYS.boxes);
  data.push(b);
  saveBoxes(data);
}
export function updateBox(b: Box): void {
  saveBoxes(get<Box>(KEYS.boxes).map(x => x.id === b.id ? b : x));
}
export function deleteBox(id: string): void {
  saveBoxes(get<Box>(KEYS.boxes).filter(b => b.id !== id));
}

// Orders
export function getOrders(orgId: string): Order[] {
  return get<Order>(KEYS.orders).filter(o => o.organizationId === orgId);
}
export function getAllOrders(): Order[] {
  return get<Order>(KEYS.orders);
}
export function saveOrders(data: Order[]): void { set(KEYS.orders, data); }
export function addOrder(order: Order): void {
  const data = get<Order>(KEYS.orders);
  data.push(order);
  saveOrders(data);
}
export function updateOrder(order: Order): void {
  saveOrders(get<Order>(KEYS.orders).map(o => o.id === order.id ? order : o));
}
export function deleteOrder(id: string): void {
  saveOrders(get<Order>(KEYS.orders).filter(o => o.id !== id));
}

// --- CRM integration helpers for orders ---
export function ensureClientAndVehicleOnOrder(order: Order, orgId: string): Order {
  let updated = { ...order } as Order;
  // Attach vehicle if exists
  const vehicle = findVehicleByPlate(orgId, (order.licensePlate || '').trim());
  if (vehicle) {
    updated.vehicleId = vehicle.id;
    // Also attach client from vehicle if available
    if (vehicle.clientId) {
      updated.clientId = vehicle.clientId;
      const client = getClients(orgId).find(c => c.id === vehicle.clientId);
      if (client) updated.clientName = client.fullName;
    }
  }

  // If order has clientPhone, try to find client
  if (!updated.clientId && order.clientPhone) {
    const found = findClientByPhone(orgId, order.clientPhone);
    if (found) {
      updated.clientId = found.id;
      updated.clientName = found.fullName;
    }
  }

  return updated;
}

export function createClientForOrderIfMissing(order: Order, orgId: string): Client | undefined {
  if (order.clientId) return getClients(orgId).find(c => c.id === order.clientId);
  // Prefer clientPhone
  if (order.clientPhone || order.clientName) {
    if (order.clientPhone) {
      const found = findClientByPhone(orgId, order.clientPhone);
      if (found) return found;
    }
    const now = new Date().toISOString();
    const veh = findVehicleByPlate(orgId, order.licensePlate || '');
    const vehClient = veh && veh.clientId ? getClients(orgId).find(c => c.id === veh.clientId) : undefined;
    if (vehClient) {
      return vehClient;
    }

    const client: Client = {
      id: generateId(),
      organizationId: orgId,
      fullName: order.clientName || order.clientPhone || 'Клиент',
      phone: order.clientPhone,
      createdAt: now,
      firstVisitAt: undefined,
      lastVisitAt: undefined,
      totalVisits: 0,
      totalOrders: 0,
      totalSpent: 0,
      averageCheck: 0,
      loyaltyLevel: undefined,
      isVip: false,
      discountPercent: 0,
      bonusPoints: 0,
      orderIds: [],
      vehicleIds: [],
      bonusHistory: [],
      discountHistory: [],
      vipHistory: [],
    };
    addClient(client);
    addActionLog({
      id: generateId(),
      organizationId: orgId,
      performedBy: 'Система',
      action: 'modify_client',
      targetType: 'client',
      targetId: client.id,
      targetName: client.fullName,
      description: `Создан клиент из заказа: ${client.fullName}`,
      createdAt: new Date().toISOString(),
    });
    return client;
  }

  // Try to attach by vehicle -> client
  const vehicle = findVehicleByPlate(orgId, order.licensePlate || '');
  if (vehicle && vehicle.clientId) {
    return getClients(orgId).find(c => c.id === vehicle.clientId);
  }
  return undefined;
}

// Merge two clients: keep `keepId`, merge data from `mergeId` then delete `mergeId`
export function mergeClients(orgId: string, keepId: string, mergeId: string): Client | undefined {
  if (keepId === mergeId) return getClients(orgId).find(c => c.id === keepId);
  const clients = getClients(orgId);
  const keep = clients.find(c => c.id === keepId);
  const merge = clients.find(c => c.id === mergeId);
  if (!keep || !merge) return keep || merge;

  // merge basic aggregates
  const totalVisits = (keep.totalVisits || 0) + (merge.totalVisits || 0);
  const totalOrders = (keep.totalOrders || 0) + (merge.totalOrders || 0);
  const totalSpent = (keep.totalSpent || 0) + (merge.totalSpent || 0);
  const orderIds = Array.from(new Set([...(keep.orderIds || []), ...(merge.orderIds || [])]));
  const vehicleIds = Array.from(new Set([...(keep.vehicleIds || []), ...(merge.vehicleIds || [])]));

  const bonusHistory = [...(keep.bonusHistory || []), ...(merge.bonusHistory || [])].filter((entry, index, array) => array.findIndex(item => item.id === entry.id) === index);
  const discountHistory = [...(keep.discountHistory || []), ...(merge.discountHistory || [])].filter((entry, index, array) => array.findIndex(item => item.id === entry.id) === index);
  const vipHistory = [...(keep.vipHistory || []), ...(merge.vipHistory || [])].filter((entry, index, array) => array.findIndex(item => item.id === entry.id) === index);
  const updated: Client = {
    ...keep,
    totalVisits,
    totalOrders,
    totalSpent,
    averageCheck: totalOrders > 0 ? Math.round(totalSpent / totalOrders) : keep.averageCheck,
    firstVisitAt: [keep.firstVisitAt, merge.firstVisitAt].filter(Boolean).sort()[0],
    lastVisitAt: [keep.lastVisitAt, merge.lastVisitAt].filter(Boolean).sort().slice(-1)[0],
    orderIds,
    vehicleIds,
    bonusHistory,
    discountHistory,
    vipHistory,
    bonusPoints: Math.max(keep.bonusPoints || 0, merge.bonusPoints || 0),
    discountPercent: Math.max(keep.discountPercent || 0, merge.discountPercent || 0),
    isVip: Boolean(keep.isVip || merge.isVip),
    notes: [keep.notes, merge.notes].filter(Boolean).join('\n\n').trim() || undefined,
  };

  // save updated keep in raw storage to avoid dropping other organizations
  saveClients(get<Client>(KEYS.clients).map(c => c.id === keepId ? updated : c));

  const vehicles = get<Vehicle>(KEYS.vehicles).reduce<Vehicle[]>((accumulator, vehicle) => {
    if (vehicle.organizationId !== orgId) {
      accumulator.push(vehicle);
      return accumulator;
    }
    if (vehicle.clientId === mergeId) {
      const duplicateIndex = accumulator.findIndex(item => item.organizationId === orgId && item.clientId === keepId && item.licensePlate.trim().toLowerCase() === vehicle.licensePlate.trim().toLowerCase());
      if (duplicateIndex >= 0) {
        const duplicate = accumulator[duplicateIndex];
        accumulator[duplicateIndex] = {
          ...duplicate,
          orderIds: Array.from(new Set([...(duplicate.orderIds || []), ...(vehicle.orderIds || [])])),
          totalSpent: (duplicate.totalSpent || 0) + (vehicle.totalSpent || 0),
          visitsCount: Math.max(duplicate.visitsCount || 0, vehicle.visitsCount || 0),
          firstVisitAt: [duplicate.firstVisitAt, vehicle.firstVisitAt].filter(Boolean).sort()[0],
          lastVisitAt: [duplicate.lastVisitAt, vehicle.lastVisitAt].filter(Boolean).sort().slice(-1)[0],
          photos: Array.from(new Set([...(duplicate.photos || []), ...(vehicle.photos || [])])),
        };
      } else {
        accumulator.push({ ...vehicle, clientId: keepId, ownerClientId: keepId });
      }
      return accumulator;
    }
    accumulator.push(vehicle);
    return accumulator;
  }, []);
  saveVehicles(vehicles);

  saveOrders(get<Order>(KEYS.orders).map(order => order.organizationId === orgId && order.clientId === mergeId ? { ...order, clientId: keepId, clientName: updated.fullName } : order));
  saveActionLogs(get<ActionLog>(KEYS.actionLogs).map(log => {
    if (log.organizationId !== orgId) return log;
    if (log.targetType === 'client' && log.targetId === mergeId) {
      return { ...log, targetId: keepId, targetName: updated.fullName };
    }
    if (log.targetType === 'vehicle' && merge.vehicleIds?.includes(log.targetId || '')) {
      return { ...log, targetName: log.targetName };
    }
    return log;
  }));

  saveClients(get<Client>(KEYS.clients).map(c => c.id === keepId ? updated : c.id === mergeId ? { ...c, archivedAt: new Date().toISOString() } : c));
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: 'Система',
    action: 'merge_clients',
    targetType: 'client',
    targetId: keepId,
    targetName: updated.fullName,
    description: `Клиент ${merge.fullName} объединён с ${keep.fullName}`,
    createdAt: new Date().toISOString(),
  });

  return updated;
}

export function createVehicleForOrderIfMissing(order: Order, clientId: string | undefined, orgId: string): Vehicle | undefined {
  const plate = (order.licensePlate || '').trim().toUpperCase();
  const existing = findVehicleByPlate(orgId, plate);
  if (existing) {
    // update owner if missing
    if ((!existing.clientId || existing.clientId === '') && clientId) {
      const updated = { ...existing, clientId, ownerClientId: clientId };
      updateVehicle(updated);
      addActionLog({
        id: generateId(),
        organizationId: orgId,
        performedBy: 'Система',
        action: 'merge_vehicles',
        targetType: 'vehicle',
        targetId: updated.id,
        targetName: updated.licensePlate,
        description: `Обновлён владелец автомобиля ${updated.licensePlate}`,
        createdAt: new Date().toISOString(),
      });
      // ensure client references vehicle
      const clients = getClients(orgId).map(c => c.id === clientId ? ({ ...c, vehicleIds: Array.from(new Set([...(c.vehicleIds||[]), updated.id])) }) : c);
      saveClients(clients);
    }
    return existing;
  }
  // create vehicle only if licensePlate present
  if (!order.licensePlate) return undefined;
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: generateId(),
    clientId: clientId || '',
    organizationId: orgId,
    make: undefined,
    model: undefined,
    licensePlate: order.licensePlate.trim().toUpperCase(),
    color: undefined,
    bodyType: undefined,
    createdAt: now,
    lastVisitAt: order.completedAt || order.createdAt,
    visitsCount: 1,
    totalSpent: order.totalAmount || 0,
  };
  addVehicle(vehicle);
  return vehicle;
}

export function updateClientStatsAfterOrderCompletion(order: Order, orgId: string): void {
  const client = createClientForOrderIfMissing(order, orgId);
  const clientId = client?.id || order.clientId;
  if (!clientId) return;

  const vehicle = createVehicleForOrderIfMissing(order, clientId, orgId) || findVehicleByPlate(orgId, order.licensePlate || '');
  const resolvedVehicleId = vehicle?.id || order.vehicleId;

  const clients = getClients(orgId).map(c => {
    if (c.id !== clientId) return c;
    const alreadyLinked = (c.orderIds || []).includes(order.id);
    const totalVisits = alreadyLinked ? (c.totalVisits || 0) : (c.totalVisits || 0) + 1;
    const totalOrders = alreadyLinked ? (c.totalOrders || 0) : (c.totalOrders || 0) + 1;
    const total = alreadyLinked ? (c.totalSpent || 0) : (c.totalSpent || 0) + (order.totalAmount || 0);
    const first = c.firstVisitAt || order.completedAt || order.createdAt;
    const last = order.completedAt || order.createdAt;
    const avg = totalOrders > 0 ? Math.round(total / totalOrders) : 0;
    const orderIds = Array.from(new Set([...(c.orderIds || []), order.id]));
    const vehicleIds = Array.from(new Set([...(c.vehicleIds || []), ...(resolvedVehicleId ? [resolvedVehicleId] : [])]));

    const updated: Client = {
      ...c,
      totalVisits,
      totalOrders,
      totalSpent: total,
      firstVisitAt: first,
      lastVisitAt: last,
      averageCheck: avg,
      orderIds,
      vehicleIds,
    };
    return updated;
  });
  saveClients(clients);

  if (vehicle) {
    const vs = getVehicles(orgId).map(v => v.id === vehicle.id ? {
      ...v,
      clientId: v.clientId || clientId,
      ownerClientId: v.clientId || clientId,
      firstVisitAt: v.firstVisitAt || order.completedAt || order.createdAt,
      visitsCount: (v.orderIds || []).includes(order.id) ? (v.visitsCount || 0) : (v.visitsCount || 0) + 1,
      totalSpent: (v.orderIds || []).includes(order.id) ? (v.totalSpent || 0) : (v.totalSpent || 0) + (order.totalAmount || 0),
      lastVisitAt: order.completedAt || order.createdAt,
      orderIds: Array.from(new Set([...(v.orderIds || []), order.id])),
    } : v);
    saveVehicles(vs);
  }

  applyOrderBonuses(order, orgId, 'Система');

  // Recompute preferences, loyalty and related aggregates
  recomputeClientPreferences(orgId, clientId);
}

export function recomputeClientPreferences(orgId: string, clientId?: string): void {
  if (!clientId) return;
  const allOrders = getOrders(orgId).filter(o => o.clientId === clientId || getVehicles(orgId).some(v => v.clientId === clientId && v.licensePlate === o.licensePlate));
  if (allOrders.length === 0) return;
  const serviceCounts: Record<string, number> = {};
  const washerCounts: Record<string, number> = {};
  const boxCounts: Record<string, number> = {};
  const intervals: number[] = [];
  const sorted = allOrders.slice().filter(o => o.completedAt).sort((a,b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime());
  for (let i = 0; i < sorted.length; i++) {
    const o = sorted[i];
    o.services.forEach(s => { serviceCounts[s.serviceName] = (serviceCounts[s.serviceName] || 0) + 1; });
    if (o.washerId) washerCounts[o.washerId] = (washerCounts[o.washerId] || 0) + 1;
    if (o.boxId) boxCounts[o.boxId] = (boxCounts[o.boxId] || 0) + 1;
    if (i > 0) {
      const prev = new Date(sorted[i-1].completedAt!).getTime();
      const curr = new Date(o.completedAt!).getTime();
      intervals.push(Math.round((curr - prev) / (1000*60*60*24)));
    }
  }
  const favoriteWasher = Object.entries(washerCounts).sort((a,b) => b[1]-a[1])[0]?.[0];
  const favoriteBox = Object.entries(boxCounts).sort((a,b) => b[1]-a[1])[0]?.[0];
  const avgInterval = intervals.length ? Math.round(intervals.reduce((s,n)=>s+n,0)/intervals.length) : undefined;

  const totalSpentCalc = allOrders.reduce((s,o)=>s + (o.totalAmount || 0), 0);
  const totalOrdersCalc = allOrders.length;
  const avg30DaysWindow = (() => {
    const now = Date.now();
    const cutoff = new Date(now - 30*24*60*60*1000).toISOString();
    const last30 = allOrders.filter(o => (o.completedAt || o.createdAt) >= cutoff);
    const spent = last30.reduce((s,o)=>s + (o.totalAmount||0),0);
    return { sum30: spent, avg30: last30.length ? Math.round(spent/last30.length) : undefined };
  })();

  const clients = getClients(orgId).map(c => {
    if (c.id !== clientId) return c;
    const favoriteServices = Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
    const totalOrders = totalOrdersCalc;
    const totalSpent = totalSpentCalc;
    const averageCheck = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : undefined;
    const loyaltyLevel = calculateLoyaltyLevel(totalSpent);
    const isVip = loyaltyLevel === 'VIP' || (c.isVip || false);
    const distinctWashers = Object.keys(washerCounts).length;
    const distinctBoxes = Object.keys(boxCounts).length;
    const distinctVehicles = new Set(allOrders.map(o=>o.licensePlate)).size;
    const percentReturn = totalOrders > 1 ? Math.round(((totalOrders - 1) / totalOrders) * 100) : 0;
    const crmScore = calculateCrmScore({ totalVisits: totalOrders, totalSpent, averageCheck: averageCheck || 0, avgIntervalDays: avgInterval });

    return { ...c,
      favoriteWasherId: favoriteWasher,
      favoriteBoxId: favoriteBox,
      favoriteServices,
      averageVisitIntervalDays: avgInterval,
      averageCheck,
      totalOrders,
      totalVisits: c.totalVisits || totalOrders,
      totalSpent,
      loyaltyLevel,
      isVip,
      // additional stats
      avgLast30Days: avg30DaysWindow.avg30,
      distinctWashers,
      distinctBoxes,
      distinctVehicles,
      percentReturn,
      crmScore,
    };
  });
  saveClients(clients);
}

export function calculateCrmScore(params: { totalVisits: number; totalSpent: number; averageCheck: number; avgIntervalDays?: number }): number {
  const { totalVisits, totalSpent, averageCheck, avgIntervalDays } = params;
  // Normalize components
  const visitsScore = Math.min(1, Math.log10(totalVisits + 1) / 2); // ~0..0.5
  const spentScore = Math.min(1, Math.log10(totalSpent + 1) / 6); // scale
  const checkScore = Math.min(1, Math.log10(averageCheck + 1) / 4);
  const regularityScore = avgIntervalDays ? Math.max(0, 1 - Math.min(1, avgIntervalDays / 90)) : 0;
  const score = Math.round((visitsScore * 25 + spentScore * 30 + checkScore * 20 + regularityScore * 25));
  return Math.max(0, Math.min(100, score));
}

export function getClientRecommendationsStructured(orgId: string, clientId: string): Recommendation[] {
  const recs: Recommendation[] = [];
  const clients = getClients(orgId); // Optimized: single call
  const client = clients.find(c => c.id === clientId);
  if (!client) return recs;
  const now = Date.now();
  const last = client.lastVisitAt ? new Date(client.lastVisitAt).getTime() : 0;
  const daysAgo = last ? Math.round((now - last) / (1000*60*60*24)) : undefined;
  if ((client.totalVisits || 0) >= 10) {
    recs.push({ type: 'discount', priority: 80, title: 'Долго лоялен', description: `Клиент посетил ${client.totalVisits} раз. Рекомендуется предложить постоянную скидку.`, action: { type: 'offer_discount', payload: { percent: 5 } } });
  }
  if (daysAgo !== undefined) {
    if (daysAgo >= 90) {
      recs.push({ type: 'churn_risk', priority: 95, title: 'Не приезжал 90+ дней', description: `Последний визит ${daysAgo} дней назад. Необходимо вернуть клиента.`, action: { type: 'notify' } });
    } else if (daysAgo >= 60) {
      recs.push({ type: 'churn_risk', priority: 80, title: 'Не приезжал 60+ дней', description: `Последний визит ${daysAgo} дней назад. Запустите напоминание.`, action: { type: 'notify' } });
    } else if (daysAgo >= 30) {
      recs.push({ type: 'churn_risk', priority: 70, title: 'Не приезжал 30+ дней', description: `Последний визит ${daysAgo} дней назад. Рекомендуется связаться.`, action: { type: 'notify' } });
    }
  }
  
  // Optimized: avgSpentAll now uses clients from above instead of calling getClients() again
  const avgSpentAll = clients.length ? Math.round(clients.reduce((s,c)=>s+(c.totalSpent||0),0)/clients.length) : 0;
  if ((client.totalSpent || 0) > avgSpentAll * 1.5 && (client.totalSpent || 0) > 0) {
    recs.push({ type: 'high_spender', priority: 85, title: 'Высокие траты', description: `Клиент тратит больше среднего (${client.totalSpent}). Рассмотрите VIP/акцию.`, action: { type: 'review' } });
  }
  if ((client.totalVisits || 0) >= 5 && (client.totalVisits || 0) < 10) {
    recs.push({ type: 'become_regular', priority: 60, title: 'Становится постоянным', description: 'Клиент регулярно посещает мойку. Рассмотрите программу лояльности.', action: { type: 'offer_discount', payload: { percent: 3 } } });
  }
  return recs.sort((a,b)=>b.priority - a.priority);
}

export function logCRMRecommendation(orgId: string, clientId: string, recommendation: Recommendation): void {
  const client = getClients(orgId).find(item => item.id === clientId);
  if (!client) return;
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: 'Система',
    action: 'modify_client',
    targetType: 'client',
    targetId: client.id,
    targetName: client.fullName,
    description: `CRM рекомендация: ${recommendation.title}`,
    createdAt: new Date().toISOString(),
  });
}

export function getCRMOverview(orgId: string) {
  const clients = getClients(orgId);
  const now = Date.now();
  const newClients = clients.filter(c => (Date.now() - new Date(c.createdAt).getTime()) <= 30*24*60*60*1000).map(c=>c.id);
  const vipClients = clients.filter(c => c.loyaltyLevel === 'VIP' || c.isVip).map(c=>c.id);
  const bestClientsBySpent = clients.slice().sort((a,b)=> (b.totalSpent||0)-(a.totalSpent||0)).slice(0,10).map(c=>c.id);
  const clientsWithDiscounts = clients.filter(c => (c.discountPercent || 0) > 0).map(c=>c.id);
  const clientsWithBonuses = clients.filter(c => (c.bonusPoints || 0) > 0).map(c=>c.id);
  const clientsWithRecommendations = clients.filter(c => getClientRecommendationsStructured(orgId, c.id).length > 0).map(c=>c.id);
  return {
    newClients,
    lostClients: clients.filter(c => { const last = c.lastVisitAt ? new Date(c.lastVisitAt).getTime() : 0; return last && (now - last) > 90*24*60*60*1000; }).map(c=>c.id),
    vipClients,
    bestClientsBySpent,
    clientsWithRecommendations,
    clientsWithDiscounts,
    clientsWithBonuses,
    inactiveClientsOlderThanDays: (days: number) => clients.filter(c => { const last = c.lastVisitAt ? new Date(c.lastVisitAt).getTime() : 0; return last && (now - last) > days*24*60*60*1000; }).map(c=>c.id),
  };
}

export function calculateLoyaltyLevel(totalSpent: number): LoyaltyLevel {
  // Simple thresholds (configurable later)
  if (totalSpent >= 250000) return 'VIP';
  if (totalSpent >= 100000) return 'Platinum';
  if (totalSpent >= 50000) return 'Gold';
  if (totalSpent >= 10000) return 'Silver';
  return 'Standard';
}

export function getClientRecommendations(orgId: string, clientId: string): { key: string; message: string }[] {
  const recs: { key: string; message: string }[] = [];
  const client = getClients(orgId).find(c => c.id === clientId);
  if (!client) return recs;
  const now = Date.now();
  const last = client.lastVisitAt ? new Date(client.lastVisitAt).getTime() : 0;
  const daysAgo = last ? Math.round((now - last) / (1000*60*60*24)) : undefined;
  if ((client.totalVisits || 0) >= 10) {
    recs.push({ key: 'ten_visits', message: `Клиент посетил автомойку ${(client.totalVisits || 0)} раз. Рекомендуется рассмотреть персональную скидку.` });
  }
  if (daysAgo !== undefined && daysAgo >= 30) {
    recs.push({ key: 'not_visited_30', message: `Клиент не приезжал ${daysAgo} дней. Рекомендуется связаться с клиентом.` });
  }
  // Compare to average spend across clients
  const clients = getClients(orgId);
  const avgSpent = clients.length ? Math.round(clients.reduce((s,c)=>s+(c.totalSpent||0),0)/clients.length) : 0;
  if ((client.totalSpent || 0) > avgSpent * 1.5 && (client.totalSpent || 0) > 0) {
    recs.push({ key: 'high_spender', message: `Клиент тратит больше среднего (всего ${(client.totalSpent||0)}). Рекомендуется VIP-предложение.` });
  }
  if ((client.totalVisits || 0) >= 5 && (client.totalVisits || 0) < 10) {
    recs.push({ key: 'becoming_regular', message: 'Клиент становится постоянным. Рассмотрите программу лояльности.' });
  }
  if (daysAgo !== undefined && daysAgo >= 60) {
    recs.push({ key: 'churn_risk', message: `Клиент давно не приезжал (${daysAgo} дней). Рекомендуется кампания возврата.` });
  }
  return recs;
}

// Batches
export function getBatches(orgId: string): BatchOrder[] {
  return get<BatchOrder>(KEYS.batches).filter(b => b.organizationId === orgId);
}
export function saveBatches(data: BatchOrder[]): void { set(KEYS.batches, data); }
export function addBatch(batch: BatchOrder): void {
  const data = get<BatchOrder>(KEYS.batches);
  data.push(batch);
  saveBatches(data);
}
export function updateBatch(batch: BatchOrder): void {
  saveBatches(get<BatchOrder>(KEYS.batches).map(b => b.id === batch.id ? batch : b));
}
export function deleteBatch(id: string): void {
  const batch = get<BatchOrder>(KEYS.batches).find(b => b.id === id);
  if (batch) {
    // Delete all orders in the batch
    const allOrders = get<Order>(KEYS.orders).filter(o => !batch.orderIds.includes(o.id));
    saveOrders(allOrders);
  }
  saveBatches(get<BatchOrder>(KEYS.batches).filter(b => b.id !== id));
}

// Shifts
export function getShifts(orgId: string): Shift[] {
  return get<Shift>(KEYS.shifts).filter(s => s.organizationId === orgId);
}
export function saveShifts(data: Shift[]): void { set(KEYS.shifts, data); }
export function addShift(shift: Shift): void {
  const data = get<Shift>(KEYS.shifts);
  data.push(shift);
  saveShifts(data);
}
export function updateShift(shift: Shift): void {
  saveShifts(get<Shift>(KEYS.shifts).map(s => s.id === shift.id ? shift : s));
}
export function deleteShift(id: string): void {
  saveShifts(get<Shift>(KEYS.shifts).filter(s => s.id !== id));
}

// Backup & Restore
export function exportBackup(): string {
  const backup = {
    organizations: getOrganizations(),
    carTypes: get<CarType>(KEYS.carTypes),
    services: get<Service>(KEYS.services),
    prices: get<PriceEntry>(KEYS.prices),
    washers: get<Washer>(KEYS.washers),
    boxes: get<Box>(KEYS.boxes),
    orders: get<Order>(KEYS.orders),
    batches: get<BatchOrder>(KEYS.batches),
    shifts: get<Shift>(KEYS.shifts),
    washerShiftDays: get<WasherShiftDay>(KEYS.washerShiftDays),
    washerCurrentStatus: get<WasherCurrentStatus>(KEYS.washerCurrentStatus),
    workerTimelogs: get<WorkerTimelog>(KEYS.workerTimelogs),
    cashShifts: get<CashShift>(KEYS.cashShifts),
    cashOperations: get<CashOperation>(KEYS.cashOperations),
    suppliers: get<Supplier>(KEYS.suppliers),
    warehouseCategories: get<WarehouseCategory>(KEYS.warehouseCategories),
    warehouseItems: get<WarehouseItem>(KEYS.warehouseItems),
    warehouseMovements: get<WarehouseMovement>(KEYS.warehouseMovements),
    serviceMaterialUsages: get<ServiceMaterialUsage>(KEYS.serviceMaterialUsages),
    activeOrg: getActiveOrgId(),
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };
  return JSON.stringify(backup, null, 2);
}

export function importBackup(json: string): boolean {
  try {
    const backup = JSON.parse(json);
    if (!backup.organizations) return false;
    set(KEYS.organizations, backup.organizations || []);
    set(KEYS.carTypes, backup.carTypes || []);
    set(KEYS.services, backup.services || []);
    set(KEYS.prices, backup.prices || []);
    set(KEYS.washers, backup.washers || []);
    set(KEYS.boxes, backup.boxes || []);
    set(KEYS.orders, backup.orders || []);
    set(KEYS.batches, backup.batches || []);
    set(KEYS.shifts, backup.shifts || []);
    set(KEYS.washerShiftDays, backup.washerShiftDays || []);
    set(KEYS.washerCurrentStatus, backup.washerCurrentStatus || []);
    set(KEYS.workerTimelogs, backup.workerTimelogs || []);
    set(KEYS.cashShifts, backup.cashShifts || []);
    set(KEYS.cashOperations, backup.cashOperations || []);
    set(KEYS.suppliers, backup.suppliers || []);
    set(KEYS.warehouseCategories, backup.warehouseCategories || []);
    set(KEYS.warehouseItems, backup.warehouseItems || []);
    set(KEYS.warehouseMovements, backup.warehouseMovements || []);
    set(KEYS.serviceMaterialUsages, backup.serviceMaterialUsages || []);
    if (backup.activeOrg) setActiveOrgId(backup.activeOrg);
    return true;
  } catch {
    return false;
  }
}

// Calculate analytics for washer
export function calcWasherAnalytics(washerId: string, fromDate: string, toDate: string, orgId: string): WasherAnalyticsData | null {
  const timelogs = getWorkerTimelogsForWasher(orgId, washerId, fromDate, toDate);
  if (timelogs.length === 0) return null;
  
  const washer = getWashers(orgId).find(w => w.id === washerId);
  if (!washer) return null;
  
  const orderIds = new Set(timelogs.map(t => t.orderId));
  const totalOrdersCount = orderIds.size;
  const totalCarsCount = new Set(timelogs.map(t => t.licensePlate)).size;
  const lightCarsCount = timelogs.filter(t => t.dirtLevel === 'light').length;
  const mediumCarsCount = timelogs.filter(t => t.dirtLevel === 'medium').length;
  const heavyCarsCount = timelogs.filter(t => t.dirtLevel === 'heavy').length;
  const totalWorkMinutes = timelogs.reduce((s, t) => s + (t.durationMinutes || 0), 0);
  const totalEarnings = timelogs.reduce((s, t) => s + t.washerShare, 0);
  const coworkOrdersCount = timelogs.filter(t => t.coworkers.length > 0).length;
  const averageOrderTime = totalOrdersCount > 0 ? Math.round(totalWorkMinutes / totalOrdersCount) : 0;

  return {
    washerId,
    washerName: washer.name,
    organizationId: orgId,
    date: toDate,
    totalOrdersCount,
    totalCarsCount,
    lightCarsCount,
    mediumCarsCount,
    heavyCarsCount,
    totalWorkMinutes,
    totalEarnings,
    coworkOrdersCount,
    averageOrderTime,
  };
}
// === Financial Module Functions (Задание №13) ===

// Expenses
export function getExpenseRecords(orgId: string): ExpenseRecord[] {
  return get<ExpenseRecord>(KEYS.expenses).filter(e => e.organizationId === orgId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
export function saveExpenseRecords(data: ExpenseRecord[]): void { set(KEYS.expenses, data); }
export function addExpenseRecord(expense: ExpenseRecord): void {
  const data = get<ExpenseRecord>(KEYS.expenses);
  data.push(expense);
  saveExpenseRecords(data);
  addActionLog({
    id: generateId(),
    organizationId: expense.organizationId,
    performedBy: expense.employeeName || 'Система',
    action: 'cash_operation',
    targetType: 'item',
    targetId: expense.id,
    targetName: expense.category,
    description: `Расход: ${expense.category} (${expense.amount}) - ${expense.comment || ''}`,
    createdAt: new Date().toISOString(),
  });
}

export function getExpensesByPeriod(orgId: string, from: string, to: string): ExpenseRecord[] {
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  return getExpenseRecords(orgId).filter(e => {
    const eTime = new Date(e.date).getTime();
    return eTime >= fromTime && eTime <= toTime;
  });
}

export function getExpensesByCategory(orgId: string, from: string, to: string): Record<string, number> {
  const expenses = getExpensesByPeriod(orgId, from, to);
  const result: Record<string, number> = {};
  expenses.forEach(e => {
    result[e.category] = (result[e.category] || 0) + e.amount;
  });
  return result;
}

// Payroll
export function getPayrollRecords(orgId: string): PayrollRecord[] {
  return get<PayrollRecord>(KEYS.payrolls).filter(p => p.organizationId === orgId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
export function savePayrollRecords(data: PayrollRecord[]): void { set(KEYS.payrolls, data); }
export function addPayrollRecord(payroll: PayrollRecord): void {
  const data = get<PayrollRecord>(KEYS.payrolls);
  data.push(payroll);
  savePayrollRecords(data);
}

export function markPayrollAsPaid(payrollId: string, orgId: string): void {
  const payrolls = getPayrollRecords(orgId);
  const payroll = payrolls.find(p => p.id === payrollId);
  if (!payroll) return;
  
  const now = new Date().toISOString();
  payroll.paidAt = now;
  payroll.paid = payroll.accrued;
  
  savePayrollRecords(payrolls);
  
  // Create expense record for payroll payout
  addExpenseRecord({
    id: generateId(),
    organizationId: orgId,
    date: now,
    amount: payroll.accrued,
    category: 'зарплата',
    comment: `Выплата зарплаты ${payroll.employeeName} за ${payroll.periodFrom} - ${payroll.periodTo}`,
    employeeId: payroll.employeeId,
    employeeName: payroll.employeeName,
    createdAt: now,
  });
  
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: 'Система',
    action: 'salary_payout',
    targetType: 'item',
    targetId: payrollId,
    targetName: payroll.employeeName,
    description: `Выплачена зарплата ${payroll.employeeName}: ${payroll.accrued}`,
    createdAt: now,
  });
}

// Financial analytics helpers
export function calculateIncome(orgId: string, from: string, to: string): number {
  const summary = calculateCashSummary(orgId, from, to);
  return summary.income || 0;
}

export function calculateExpenses(orgId: string, from: string, to: string): number {
  const expenses = getExpensesByPeriod(orgId, from, to);
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function calculateProfit(orgId: string, from: string, to: string): number {
  const income = calculateIncome(orgId, from, to);
  const expenses = calculateExpenses(orgId, from, to);
  return income - expenses;
}

export function getPayrollByPeriod(orgId: string, from: string, to: string): PayrollRecord[] {
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  return getPayrollRecords(orgId).filter(p => {
    const pTime = new Date(p.createdAt).getTime();
    return pTime >= fromTime && pTime <= toTime;
  });
}

export function getTotalPayrollAccrued(orgId: string, from: string, to: string): number {
  return getPayrollByPeriod(orgId, from, to).reduce((sum, p) => sum + p.accrued, 0);
}

export function getTotalPayrollPaid(orgId: string, from: string, to: string): number {
  return getPayrollByPeriod(orgId, from, to).reduce((sum, p) => sum + p.paid, 0);
}

// ============ BACKUP & RESTORE ============

const BACKUP_KEYS = {
  backups: 'carwin_backups',
  backupSettings: 'carwin_backup_settings',
  backupLogs: 'carwin_backup_logs',
};

export function getBackupSettings(): BackupSettings {
  const data = get<BackupSettings>(BACKUP_KEYS.backupSettings);
  return data.length > 0 ? data[0] : {
    autoBackupEnabled: false,
    autoBackupSchedule: 'manual',
    maxBackupCount: 10,
    encryptionEnabled: false,
    backupPath: 'backups',
    createBeforeUpdate: true,
    createBeforeMigration: true,
    createBeforeMassImport: true,
  };
}

export function updateBackupSettings(settings: BackupSettings): void {
  const data = get<BackupSettings>(BACKUP_KEYS.backupSettings);
  data[0] = settings;
  localStorage.setItem(BACKUP_KEYS.backupSettings, JSON.stringify(data));
}

export function getBackups(): BackupMetadata[] {
  return get<BackupMetadata>(BACKUP_KEYS.backups);
}

export function addBackup(backup: BackupMetadata): void {
  const data = get<BackupMetadata>(BACKUP_KEYS.backups);
  data.push(backup);
  localStorage.setItem(BACKUP_KEYS.backups, JSON.stringify(data));
}

export function deleteBackup(backupId: string): void {
  const data = get<BackupMetadata>(BACKUP_KEYS.backups);
  const filtered = data.filter(b => b.id !== backupId);
  localStorage.setItem(BACKUP_KEYS.backups, JSON.stringify(filtered));
}

export function updateBackupMetadata(backupId: string, updates: Partial<BackupMetadata>): void {
  const data = get<BackupMetadata>(BACKUP_KEYS.backups);
  const backup = data.find(b => b.id === backupId);
  if (backup) {
    Object.assign(backup, updates);
    localStorage.setItem(BACKUP_KEYS.backups, JSON.stringify(data));
  }
}

export function createBackup(orgId: string, comment?: string): BackupMetadata {
  const currentUser = getCurrentUser();
  const backup: BackupMetadata = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    createdBy: currentUser?.name || 'Система',
    appVersion: '0.0.1',
    carwinVersion: '0.4.7',
    organizationId: orgId,
    organizationName: getOrganizations().find(o => o.id === orgId)?.name,
    comment,
    fileName: `backup_${orgId}_${new Date().getTime()}.carwinbackup`,
    fileSize: 0,
    isEncrypted: getBackupSettings().encryptionEnabled,
    checksum: generateChecksum(),
    integrityStatus: 'unchecked',
    sections: [
      { name: 'Organizations', recordCount: getOrganizations().length, size: 0, status: 'included' },
      { name: 'Users', recordCount: getUsersRaw().length, size: 0, status: 'included' },
      { name: 'Washers', recordCount: getWashers(orgId).length, size: 0, status: 'included' },
      { name: 'Orders', recordCount: getOrders(orgId).length, size: 0, status: 'included' },
      { name: 'Clients', recordCount: getClients(orgId).length, size: 0, status: 'included' },
      { name: 'Vehicles', recordCount: getVehicles(orgId).length, size: 0, status: 'included' },
      { name: 'ExpenseRecords', recordCount: getExpenseRecords(orgId).length, size: 0, status: 'included' },
      { name: 'PayrollRecords', recordCount: getPayrollRecords(orgId).length, size: 0, status: 'included' },
      { name: 'CashOperations', recordCount: getCashOperations(orgId).length, size: 0, status: 'included' },
    ],
  };
  
  addBackup(backup);
  
  addActionLog({
    id: generateId(),
    organizationId: orgId,
    performedBy: currentUser?.name || 'Система',
    action: 'cash_operation',
    targetType: 'report',
    targetId: backup.id,
    targetName: backup.fileName,
    description: `Создана резервная копия: ${backup.fileName}`,
    createdAt: new Date().toISOString(),
  });
  
  return backup;
}

export function validateBackupCompatibility(backup: BackupMetadata): { compatible: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (backup.appVersion !== '0.0.1' && backup.appVersion !== 'unknown') {
    errors.push(`Версия приложения: требуется ${backup.appVersion}, установлена 0.0.1`);
  }
  
  if (!backup.sections || backup.sections.length === 0) {
    errors.push('Архив не содержит информации о разделах');
  }
  
  const requiredSections = ['Organizations', 'Users', 'Orders'];
  const missingSections = requiredSections.filter(
    rs => !backup.sections.some(s => s.name === rs)
  );
  
  if (missingSections.length > 0) {
    errors.push(`Отсутствуют обязательные разделы: ${missingSections.join(', ')}`);
  }
  
  return {
    compatible: errors.length === 0,
    errors,
  };
}

export function checkBackupIntegrity(backupId: string): IntegrityCheckResult {
  const backup = getBackups().find(b => b.id === backupId);
  if (!backup) {
    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      backupId,
      isValid: false,
      errors: [],
      warnings: [],
      recordsChecked: 0,
      orphanedRecords: 0,
      duplicateRecords: 0,
      missingReferences: 0,
    };
  }
  
  const errors: any[] = [];
  const warnings: string[] = [];
  let recordsChecked = 0;
  let orphanedRecords = 0;
  let duplicateRecords = 0;
  let missingReferences = 0;
  
  if (backup.integrityStatus === 'invalid') {
    errors.push({
      type: 'corrupted_record',
      section: 'Archive',
      recordId: backup.id,
      message: 'Архив отмечен как поврежденный',
      severity: 'error',
    });
  }
  
  const result: IntegrityCheckResult = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    backupId,
    isValid: errors.length === 0 && backup.checksum !== '',
    errors,
    warnings,
    recordsChecked,
    orphanedRecords,
    duplicateRecords,
    missingReferences,
  };
  
  return result;
}

export function getBackupLogs(): BackupLog[] {
  return get<BackupLog>(BACKUP_KEYS.backupLogs);
}

export function addBackupLog(log: BackupLog): void {
  const data = get<BackupLog>(BACKUP_KEYS.backupLogs);
  data.push(log);
  localStorage.setItem(BACKUP_KEYS.backupLogs, JSON.stringify(data));
}

function generateChecksum(): string {
  return 'chk_' + Math.random().toString(36).substr(2, 9);
}