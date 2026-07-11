export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export interface Organization {
  id: string;
  name: string;
  ownerId?: string;
  // Optional remote id for future cloud sync
  remoteId?: string;
  logo?: string;
  contacts?: string;
  currency: string;
  timezone?: string;
  language?: string;
  createdAt: string;
  updatedAt?: string;
  washerPercent?: number;
  financialSettings?: OrganizationFinancialSettings;
  warehouseAdminView?: boolean;
  analyticsAdminView?: boolean;
}

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  phone?: string;
  contactPerson?: string;
  createdAt: string;
}

export type FinanceCalculationMode = 'percent' | 'salary' | 'mixed' | 'fixed';

export interface OrganizationFinancialSettings {
  calculationMode: FinanceCalculationMode;
  employeePercent: number;
  organizationPercent: number;
  salaryAmount: number;
  fixedOrderAmount: number;
}

export interface CarType {
  id: string;
  name: string;
  organizationId: string;
}

export interface Service {
  id: string;
  name: string;
  organizationId: string;
  category?: string;
}

export interface PriceEntry {
  id: string;
  serviceId: string;
  carTypeId: string;
  price: number;
  organizationId: string;
}

export interface Washer {
  id: string;
  name: string;
  phone?: string;
  organizationId: string;
  dailyRate: number;
  createdAt: string;
  primaryBoxId?: string;
  payMode?: FinanceCalculationMode;
  payPercent?: number;
  paySalaryAmount?: number;
  payFixedAmount?: number;
}

export interface OrderService {
  serviceId: string;
  serviceName: string;
  price: number;
}

export type OrderStatus = 'waiting' | 'in_progress' | 'completed' | 'cancelled';
export type OrderPaymentStatus = 'unpaid' | 'paid';

export type DirtLevel = 'light' | 'medium' | 'heavy';

export const dirtLevelLabels: Record<DirtLevel, string> = {
  light: 'Лёгкая',
  medium: 'Средняя',
  heavy: 'Сильная',
};

export interface Box {
  id: string;
  name: string;
  organizationId: string;
  isActive: boolean;
}

export interface Order {
  id: string;
  orderNumber?: string;
  organizationId: string;
  carTypeId: string;
  carTypeName: string;
  licensePlate: string;
  vehicleId?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  services: OrderService[];
  status: OrderStatus;
  washerId?: string;
  washerName?: string;
  washerIds?: string[];
  washerNames?: string[];
  washerSalaries?: { washerId: string; washerName: string; amount: number }[];
  boxId?: string;
  boxName?: string;
  dirtLevel?: DirtLevel;
  paymentMethod?: CashPaymentMethod;
  paymentParts?: PaymentPart[];
  paymentStatus?: OrderPaymentStatus;
  receivedAmount?: number;
  changeAmount?: number;
  paidAt?: string;
  discountAmount?: number;
  bonusApplied?: number;
  refundAmount?: number;
  comment?: string;
  totalAmount: number;
  materialsCost?: number;
  workersCost?: number;
  organizationProfit?: number;
  costCalculatedAt?: string;
  createdAt: string;
  completedAt?: string;
  batchId?: string;
}

export type WasherStatus = 'free' | 'working' | 'break' | 'absent' | 'vacation' | 'sick';
export type ShiftStatus = 'working' | 'absent' | 'vacation' | 'sick';

export interface WasherShiftDay {
  id: string;
  washerId: string;
  washerName: string;
  organizationId: string;
  date: string; // yyyy-MM-dd
  status: ShiftStatus;
  startedAt?: string;
  endedAt?: string;
}

export interface WasherCurrentStatus {
  id: string;
  washerId: string;
  organizationId: string;
  date: string; // yyyy-MM-dd
  status: WasherStatus;
  currentOrderId?: string; // Если в работе
  currentBoxId?: string; // Текущий бокс (может отличаться от основного)
  updatedAt: string;
}

export interface WorkerTimelog {
  id: string;
  orderId: string;
  orderNumber?: string;
  washerId: string;
  washerName: string;
  organizationId: string;
  date: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  durationMinutes?: number;
  licensePlate: string;
  carTypeName: string;
  dirtLevel?: DirtLevel;
  services: string[]; // Service names
  orderAmount: number;
  washerShare: number;
  organizationShare: number;
  calculationMode: FinanceCalculationMode;
  boxName?: string;
  coworkers: string[]; // Имена других мойщиков на этом заказе
  recordType?: 'accrual' | 'adjustment';
  previousOrderAmount?: number;
  deltaOrderAmount?: number;
}

export interface WasherAnalyticsData {
  washerId: string;
  washerName: string;
  organizationId: string;
  date: string; // Дата, за которую считаем (yyyy-MM-dd)
  totalOrdersCount: number;
  totalCarsCount: number;
  lightCarsCount: number;
  mediumCarsCount: number;
  heavyCarsCount: number;
  totalWorkMinutes: number;
  totalEarnings: number;
  coworkOrdersCount: number;
  averageOrderTime: number; // в минутах
}

export interface BatchOrder {
  id: string;
  organizationId: string;
  name: string;
  orderIds: string[];
  createdAt: string;
}

export interface Shift {
  id: string;
  washerId: string;
  washerName: string;
  organizationId: string;
  date: string;
  dailyRate: number;
  bonus: number;
  penalty: number;
  ordersCompleted: number;
}

export type UserRole = 'admin' | 'manager';

export type CashPaymentMethod =
  | 'Наличные'
  | 'Банковская карта'
  | 'QR'
  | 'Перевод'
  | 'Бонусы'
  | 'Смешанная'
  | 'Другой'
  | 'Kaspi'
  | 'Card'
  | 'cash'
  | 'card'
  | 'qr'
  | 'transfer'
  | 'other';
export type CashOperationType = 'order_payment' | 'cash_in' | 'expense_supply' | 'expense_payout' | 'expense_other' | 'cash_collection' | 'refund' | 'correction';
export type CashOperationDirection = 'income' | 'expense';

export interface PaymentPart {
  method: Exclude<CashPaymentMethod, 'Смешанная'>;
  amount: number;
}

export interface CashShift {
  id: string;
  organizationId: string;
  cashierName: string;
  openedAt: string;
  openingCash: number;
  openingComment?: string;
  closedAt?: string;
  closedBy?: string;
  factCash?: number;
  expectedCash?: number;
  difference?: number;
  closingComment?: string;
  metrics?: CashShiftComputedMetrics;
}

export interface CashShiftComputedMetrics {
  cashIncome: number;
  cardIncome: number;
  kaspiIncome?: number;
  qrIncome: number;
  transferIncome: number;
  bonusIncome: number;
  mixedIncome: number;
  otherIncome: number;
  refunds: number;
  discounts: number;
  bonuses: number;
  checksCount: number;
  averageCheck: number;
  expense: number;
  income: number;
  turnover: number;
}

export interface CashOperation {
  id: string;
  organizationId: string;
  shiftId?: string;
  createdAt: string;
  employeeName: string;
  performedBy?: string;
  amount: number;
  direction: CashOperationDirection;
  type: CashOperationType;
  paymentMethod?: CashPaymentMethod;
  paymentParts?: PaymentPart[];
  orderId?: string;
  orderNumber?: string;
  licensePlate?: string;
  description?: string;
  isCorrection?: boolean;
  originalOperationId?: string;
  correctionReason?: string;
}

export interface CashReport {
  fromISO: string;
  toISO: string;
  cashierName?: string;
  summary: CashShiftComputedMetrics;
}

export interface WarehouseCategory {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
}

export interface WarehouseItem {
  id: string;
  organizationId: string;
  name: string;
  // Артикул / SKU
  sku?: string;
  // Штрихкод
  barcode?: string;
  categoryId?: string;
  categoryName: string;
  quantity: number;
  unit: string;
  // Производитель
  manufacturer?: string;
  // Поставщик (имя)
  supplier?: string;
  minQuantity: number;
  // Рекомендуемый остаток
  recommendedQuantity?: number;
  // Место хранения
  location?: string;
  // Комментарий
  comment?: string;
  // Ссылки на фото
  photos?: string[];
  purchasePrice: number;
  createdAt: string;
  updatedAt?: string;
}

export type WarehouseMovementType = 'incoming' | 'consumption' | 'writeoff' | 'correction' | 'inventory' | 'return_supplier';

export interface WarehouseMovement {
  id: string;
  organizationId: string;
  itemId: string;
  itemName: string;
  type: WarehouseMovementType;
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalCost?: number;
  reason?: string;
  employeeName: string;
  supplierId?: string;
  supplierName?: string;
  createdAt: string;
  orderId?: string;
  orderNumber?: string;
  serviceId?: string;
  serviceName?: string;
  // Source: 'manual' | 'order_auto' | 'inventory' | 'purchase'
  source?: string;
}

export interface PurchaseItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalCost?: number;
}

export interface Purchase {
  id: string;
  organizationId: string;
  supplierId?: string;
  supplierName?: string;
  items: PurchaseItem[];
  total: number;
  createdAt: string;
  createdBy: string;
  note?: string;
}

export interface InventoryRecord {
  itemId: string;
  itemName: string;
  countedQuantity: number;
}

export interface Inventory {
  id: string;
  organizationId: string;
  createdAt: string;
  createdBy: string;
  records: InventoryRecord[];
  finalizedAt?: string;
  finalizedBy?: string;
  note?: string;
}

export interface ServiceMaterialUsage {
  id: string;
  organizationId: string;
  serviceId: string;
  serviceName: string;
  itemId: string;
  itemName: string;
  quantityPerService: number;
  unit: string;
}



export type Page = 'dashboard' | 'orders' | 'pricing' | 'washers' | 'warehouse' | 'analytics' | 'reports' | 'cashier' | 'clients' | 'settings' | 'finance_income' | 'finance_expenses' | 'finance_profit' | 'finance_payroll' | 'finance_cashflow' | 'finance_analytics';

// Financial pages
export type FinancialPage = 'finance_income' | 'finance_expenses' | 'finance_profit' | 'finance_payroll' | 'finance_cashflow' | 'finance_analytics';

// Extend Page union to include financial pages via helper type alias
export type AppPage = Page | FinancialPage;

// === Новые типы для Задания №7 ===

export type PaymentScheme = 'percent' | 'fixed' | 'mixed';

export interface WasherPaymentSettings {
  id: string;
  washerId: string;
  organizationId: string;
  scheme: PaymentScheme;
  percent?: number; // % от заказа
  fixedAmount?: number; // Фиксированная ставка
  minAmount?: number; // Минимум за заказ
  bonusPercent?: number; // Бонус за повторных клиентов
  updatedAt: string;
  updatedBy?: string;
}

export interface SalaryHistoryEntry {
  id: string;
  washerId: string;
  organizationId: string;
  fieldChanged: 'percent' | 'fixedAmount' | 'scheme' | 'dailyRate';
  oldValue: number | string;
  newValue: number | string;
  changedBy?: string;
  changedAt: string;
  reason?: string;
}

export interface BoxAssignment {
  id: string;
  washerId: string;
  organizationId: string;
  boxId: string;
  assignedAt: string;
  unassignedAt?: string;
  assignmentType: 'permanent' | 'temporary';
  assignedBy?: string;
}

export interface PerformanceRating {
  id: string;
  washerId: string;
  organizationId: string;
  date: string; // yyyy-MM-dd
  totalCars: number;
  totalTime: number; // в минутах
  avgTimePerCar: number; // в минутах
  totalIncome: number;
  repeatCustomers: number; // Повторные клиенты
  efficiency: number; // (totalCars / totalTime) * 100
  rating: number; // 1-5 звёзд
  notes?: string;
  calculatedAt: string;
}

export interface ActionLog {
  id: string;
  organizationId: string;
  performedBy: string;
  action: 'create_order' | 'update_order' | 'apply_discount' | 'change_payment' | 'adjust_salary' | 'writeoff_item' | 'create_shift' | 'close_shift' | 'create_worker' | 'update_worker' | 'delete_worker' | 'assign_box' | 'salary_payout' | 'modify_bonus' | 'modify_vip' | 'modify_loyalty_settings' | 'modify_client' | 'merge_clients' | 'merge_vehicles' | 'export_crm' | 'export_report' | 'open_cash_shift' | 'close_cash_shift' | 'cash_operation';
  targetType: 'order' | 'worker' | 'item' | 'shift' | 'client' | 'vehicle' | 'report';
  targetId: string;
  targetName?: string;
  changes?: Record<string, { oldValue: any; newValue: any }>;
  description?: string;
  createdAt: string;
}

export type Permission =
  | 'canViewClients'
  | 'canEditClients'
  | 'canDeleteClients'
  | 'canManageBonuses'
  | 'canManageDiscounts'
  | 'canManageVip'
  | 'canViewCRM'
  | 'canExportCRM'
  | 'canViewCash'
  | 'canManageCashShift'
  | 'canManageCashOperations'
  | 'canViewCashReports'
  | 'canExportCash';

export interface User {
  id?: string;
  googleId?: string;
  // Optional remote id for future cloud sync
  remoteId?: string;
  role: UserRole;
  email?: string;
  name?: string;
  photoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  permissions?: Permission[];
}

export interface AuthSession {
  userId: string;
  activeOrgId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerNotification {
  id: string;
  workerId?: string;
  organizationId: string;
  type: 'absent' | 'free_box' | 'no_activity' | 'overload' | 'payment_issue' | 'warehouse_alert';
  message: string;
  severity: 'info' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

// === CRM: клиенты и автомобили (Задание №8) ===

export interface Vehicle {
  id: string;
  clientId: string;
  ownerClientId?: string; // alias for backward compat
  organizationId: string;
  make?: string;
  model?: string;
  licensePlate: string;
  color?: string;
  year?: string;
  vin?: string;
  comment?: string;
  bodyType?: string;
  createdAt: string;
  firstVisitAt?: string;
  lastVisitAt?: string;
  visitsCount?: number;
  totalSpent?: number;
  orderIds?: string[];
  popularServices?: string[];
  photos?: string[];
  archivedAt?: string;
}

export interface Client {
  id: string;
  organizationId: string;
  fullName: string;
  phone?: string;
  createdAt: string;
  // Aggregated stats
  firstVisitAt?: string;
  lastVisitAt?: string;
  totalVisits?: number;
  totalOrders?: number;
  totalSpent?: number;
  averageCheck?: number;

  // Preferences / analytics
  favoriteWasherId?: string;
  favoriteBoxId?: string;
  favoriteServices?: string[];
  favoritePackage?: string;
  averageVisitIntervalDays?: number;

  // Extended stats
  avgLast30Days?: number;
  distinctWashers?: number;
  distinctBoxes?: number;
  distinctVehicles?: number;
  percentReturn?: number;
  crmScore?: number;

  // Loyalty
  loyaltyLevel?: LoyaltyLevel;
  isVip?: boolean;
  discountPercent?: number;
  bonusPoints?: number;

  // Histories
  orderIds?: string[];
  vehicleIds?: string[];
  bonusHistory?: BonusOperation[];
  discountHistory?: DiscountHistoryEntry[];
  vipHistory?: VipStatusHistoryEntry[];
  notes?: string;
  archivedAt?: string;
}

export interface LoyaltySettings {
  // Core switches
  organizationId: string;
  enabled: boolean;
  useDiscounts: boolean;
  useBonuses: boolean;
  autoVip: boolean;

  // Thresholds (amounts in smallest currency unit, e.g. cents)
  thresholdSilver?: number;
  thresholdGold?: number;
  thresholdPlatinum?: number;
  thresholdVip?: number;

  // Discount / bonus config
  maxDiscountPercent?: number;
  bonusValuePerCurrencyUnit?: number; // how many bonus points per 1 unit of currency
  bonusValidityDays?: number; // number of days bonuses are valid
}

export type LoyaltyLevel = 'Standard' | 'Silver' | 'Gold' | 'Platinum' | 'VIP';

export type BonusOperationType = 'accrual' | 'spend' | 'cancel' | 'refund';

export interface BonusOperation {
  id: string;
  clientId: string;
  organizationId: string;
  amount: number; // positive for accrual, negative for spend
  reason?: string;
  type: BonusOperationType;
  createdAt: string; // ISO
  performedBy?: string; // user who performed
  balanceAfter: number; // client.bonusPoints after this op
  originalOperationId?: string; // if this op cancels/refunds another
}

export interface DiscountHistoryEntry {
  id: string;
  clientId: string;
  organizationId: string;
  oldPercent?: number;
  newPercent: number;
  reason?: string;
  changedAt: string;
  changedBy?: string;
}

export interface VipStatusHistoryEntry {
  id: string;
  clientId: string;
  organizationId: string;
  oldIsVip: boolean;
  newIsVip: boolean;
  reason?: string;
  changedAt: string;
  changedBy?: string;
}

export interface Recommendation {
  type: 'discount' | 'vip' | 'bonus' | 'become_regular' | 'churn_risk' | 'high_spender' | 'new_service' | 'custom';
  priority: number; // higher = more important
  title: string;
  description?: string;
  action?: { type: 'offer_discount' | 'assign_bonus' | 'notify' | 'review' | 'none'; payload?: any };
}

export interface CRMOverview {
  newClients: string[]; // clientIds
  lostClients: string[]; // clientIds
  vipClients: string[];
  bestClientsBySpent: string[];
  clientsWithRecommendations: string[];
  clientsWithDiscounts: string[];
  clientsWithBonuses: string[];
  inactiveClientsOlderThanDays: (days: number) => string[];
}

export interface WorkerProfile {
  washer: Washer;
  paymentSettings: WasherPaymentSettings;
  currentStatus?: WasherCurrentStatus;
  todayStats: {
    carsCount: number;
    earnings: number;
    startTime?: string;
  };
  monthStats: {
    carsCount: number;
    earnings: number;
    workDays: number;
  };
  performance: {
    efficiency: number;
    rating: number;
    repeatCustomers: number;
  };
}
// === Financial module types (Задание №13) ===

export type ExpenseCategory =
  | 'химия'
  | 'зарплата'
  | 'аренда'
  | 'коммунальные'
  | 'оборудование'
  | 'ремонт'
  | 'реклама'
  | 'прочее';

export interface ExpenseRecord {
  id: string;
  organizationId: string;
  date: string; // ISO
  amount: number;
  category: ExpenseCategory;
  comment?: string;
  employeeId?: string;
  employeeName?: string;
  createdAt: string;
}

export interface PayrollRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName: string;
  periodFrom: string; // ISO
  periodTo: string; // ISO
  completedWorksCount: number;
  revenue: number; // revenue generated by employee
  percent: number; // percent or payout calculation
  accrued: number; // amount calculated
  paid: number; // amount paid
  paidAt?: string;
  createdAt: string;
  comment?: string;
}

export interface CashMovementJournalEntry {
  id: string;
  organizationId: string;
  date: string; // ISO
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  description?: string;
  amountIn?: number;
  amountOut?: number;
  balanceAfter?: number;
  relatedOperationId?: string; // links to CashOperation or ExpenseRecord or PayrollRecord
}

// Backup & Restore types
export interface BackupMetadata {
  id: string;
  createdAt: string;
  createdBy: string;
  appVersion: string;
  carwinVersion: string;
  organizationId?: string;
  organizationName?: string;
  comment?: string;
  fileName: string;
  fileSize: number; // bytes
  isEncrypted: boolean;
  checksum: string;
  integrityStatus: 'valid' | 'invalid' | 'unchecked';
  sections: BackupSection[];
}

export interface BackupSection {
  name: string;
  recordCount: number;
  size: number;
  status: 'included' | 'excluded' | 'partial';
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  autoBackupSchedule: 'daily' | 'weekly' | 'manual';
  maxBackupCount: number;
  encryptionEnabled: boolean;
  encryptionPassword?: string;
  backupPath: string;
  createBeforeUpdate: boolean;
  createBeforeMigration: boolean;
  createBeforeMassImport: boolean;
}

export interface RestoreOption {
  name: string;
  section: string;
  count: number;
  included: boolean;
}

export interface IntegrityCheckResult {
  id: string;
  timestamp: string;
  backupId: string;
  isValid: boolean;
  errors: IntegrityError[];
  warnings: string[];
  recordsChecked: number;
  orphanedRecords: number;
  duplicateRecords: number;
  missingReferences: number;
}

export interface IntegrityError {
  type: 'corrupted_record' | 'broken_link' | 'missing_organization' | 'duplicate' | 'missing_reference';
  section: string;
  recordId: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface BackupLog {
  id: string;
  timestamp: string;
  operation: 'create' | 'restore' | 'delete' | 'verify';
  performedBy: string;
  backupId: string;
  backupName?: string;
  status: 'success' | 'failed' | 'partial';
  recordsAffected: number;
  duration: number; // milliseconds
  errorMessage?: string;
  restoredSections?: string[];
}

// ==================== Cloud Sync Architecture ====================
export type CloudProvider = 'google-drive' | 'onedrive' | 'dropbox' | 'custom-server';

export interface CloudSyncConfig {
  provider: CloudProvider;
  enabled: boolean;
  authToken?: string;
  folder?: string;
  autoSync: boolean;
  syncInterval?: number; // milliseconds
  uploadCompressionEnabled: boolean;
}

export interface CloudSyncStatus {
  provider: CloudProvider;
  isConnected: boolean;
  lastSyncAt?: string;
  lastError?: string;
  pendingSyncs: number;
  storageLimitBytes?: number;
  usedStorageBytes?: number;
}

export interface CloudFile {
  id: string;
  name: string;
  size: number;
  modifiedAt: string;
  provider: CloudProvider;
  isEncrypted: boolean;
  checksum?: string;
  remoteId?: string;
}

export interface CloudSyncLog {
  id: string;
  timestamp: string;
  provider: CloudProvider;
  operation: 'upload' | 'download' | 'sync' | 'auth' | 'delete';
  status: 'success' | 'failed' | 'pending';
  fileId?: string;
  fileName?: string;
  bytesTransferred?: number;
  duration?: number;
  errorMessage?: string;
}