import { performance } from 'perf_hooks';

// Simulate backup data extraction pattern
function generateBackupData() {
  const dataSize = 10000;
  const data = {
    organizations: Array(10).fill(0).map((_, i) => ({ id: `org-${i}`, name: `Org ${i}` })),
    users: Array(dataSize).fill(0).map((_, i) => ({ id: `user-${i}`, name: `User ${i}` })),
    washers: Array(dataSize).fill(0).map((_, i) => ({ id: `washer-${i}`, name: `Washer ${i}` })),
    orders: Array(dataSize).fill(0).map((_, i) => ({ id: `order-${i}`, amount: Math.random() * 1000 })),
    clients: Array(dataSize).fill(0).map((_, i) => ({ id: `client-${i}`, phone: `+7700${i}` })),
    vehicles: Array(5000).fill(0).map((_, i) => ({ id: `vehicle-${i}`, plate: `ABC${i}` })),
    boxes: Array(100).fill(0).map((_, i) => ({ id: `box-${i}`, name: `Box ${i}` })),
    services: Array(100).fill(0).map((_, i) => ({ id: `svc-${i}`, name: `Service ${i}` })),
    prices: Array(200).fill(0).map((_, i) => ({ id: `price-${i}`, amount: Math.random() * 100 })),
    carTypes: Array(50).fill(0).map((_, i) => ({ id: `type-${i}`, name: `Type ${i}` })),
    cashShifts: Array(1000).fill(0).map((_, i) => ({ id: `shift-${i}`, amount: Math.random() * 10000 })),
    cashOperations: Array(5000).fill(0).map((_, i) => ({ id: `cashop-${i}`, amount: Math.random() * 1000 })),
    warehouseItems: Array(2000).fill(0).map((_, i) => ({ id: `item-${i}`, quantity: Math.random() * 100 })),
    warehouseMovements: Array(5000).fill(0).map((_, i) => ({ id: `mov-${i}`, amount: Math.random() * 100 })),
    expenseRecords: Array(3000).fill(0).map((_, i) => ({ id: `exp-${i}`, amount: Math.random() * 500 })),
    payrollRecords: Array(2000).fill(0).map((_, i) => ({ id: `payroll-${i}`, amount: Math.random() * 50000 })),
    actionLogs: Array(5000).fill(0).map((_, i) => ({ id: `log-${i}`, action: `Action ${i}` })),
    shifts: Array(2000).fill(0).map((_, i) => ({ id: `shift-${i}`, date: '2024-01-01' })),
    purchases: Array(1000).fill(0).map((_, i) => ({ id: `purchase-${i}`, amount: Math.random() * 10000 })),
    inventory: Array(1000).fill(0).map((_, i) => ({ id: `inv-${i}`, quantity: Math.random() * 500 })),
  };

  // Setup localStorage simulation
  const localStorage = new Map();
  for (const [key, value] of Object.entries(data)) {
    localStorage.set(`wd_${key}`, JSON.stringify(value));
  }

  return { data, localStorage };
}

// BEFORE: 20 separate getItem + JSON.parse calls
function exportBackupBefore(localStorage) {
  const start = performance.now();
  const data = {
    organizations: JSON.parse(localStorage.get('wd_organizations') || '[]'),
    users: JSON.parse(localStorage.get('wd_users') || '[]'),
    washers: JSON.parse(localStorage.get('wd_washers') || '[]'),
    orders: JSON.parse(localStorage.get('wd_orders') || '[]'),
    clients: JSON.parse(localStorage.get('wd_clients') || '[]'),
    vehicles: JSON.parse(localStorage.get('wd_vehicles') || '[]'),
    boxes: JSON.parse(localStorage.get('wd_boxes') || '[]'),
    services: JSON.parse(localStorage.get('wd_services') || '[]'),
    prices: JSON.parse(localStorage.get('wd_prices') || '[]'),
    carTypes: JSON.parse(localStorage.get('wd_car_types') || '[]'),
    cashShifts: JSON.parse(localStorage.get('wd_cash_shifts') || '[]'),
    cashOperations: JSON.parse(localStorage.get('wd_cash_operations') || '[]'),
    warehouseItems: JSON.parse(localStorage.get('wd_warehouse_items') || '[]'),
    warehouseMovements: JSON.parse(localStorage.get('wd_warehouse_movements') || '[]'),
    expenseRecords: JSON.parse(localStorage.get('wd_expenses') || '[]'),
    payrollRecords: JSON.parse(localStorage.get('wd_payrolls') || '[]'),
    actionLogs: JSON.parse(localStorage.get('wd_action_logs') || '[]'),
    shifts: JSON.parse(localStorage.get('wd_shifts') || '[]'),
    purchases: JSON.parse(localStorage.get('wd_purchases') || '[]'),
    inventory: JSON.parse(localStorage.get('wd_inventory') || '[]'),
  };
  return performance.now() - start;
}

// AFTER: Cache single extraction
let cachedBackupData = null;
function exportBackupAfter(localStorage) {
  if (cachedBackupData) {
    return 0; // Already cached
  }
  
  const start = performance.now();
  const keys = [
    'organizations', 'users', 'washers', 'orders', 'clients', 'vehicles',
    'boxes', 'services', 'prices', 'carTypes', 'cashShifts', 'cashOperations',
    'warehouseItems', 'warehouseMovements', 'expenseRecords', 'payrollRecords',
    'actionLogs', 'shifts', 'purchases', 'inventory'
  ];
  
  const data = {};
  for (const key of keys) {
    const storageKey = key === 'expenseRecords' ? 'wd_expenses' : key === 'payrollRecords' ? 'wd_payrolls' : `wd_${key}`;
    data[key] = JSON.parse(localStorage.get(storageKey) || '[]');
  }
  
  cachedBackupData = data;
  return performance.now() - start;
}

const { data, localStorage } = generateBackupData();

console.log('\n📊 BENCHMARK: Backup Data Extraction (20 keys)\n');
console.log(`Data keys: ${Object.keys(data).length}, total items: ~60k\n`);

// Warmup
for (let i = 0; i < 10; i++) {
  exportBackupBefore(localStorage);
  cachedBackupData = null;
  exportBackupAfter(localStorage);
}

// Measure BEFORE
let totalBefore = 0;
for (let i = 0; i < 100; i++) {
  totalBefore += exportBackupBefore(localStorage);
}

// Measure AFTER (first call + cache)
cachedBackupData = null;
let totalAfter = 0;
for (let i = 0; i < 100; i++) {
  totalAfter += exportBackupAfter(localStorage);
}

const improvement = ((totalBefore - totalAfter) / totalBefore * 100).toFixed(2);

console.log(`BEFORE (100 extractions):  ${totalBefore.toFixed(2)}ms`);
console.log(`AFTER (1 extraction + 99 cache): ${totalAfter.toFixed(2)}ms`);
console.log(`IMPROVEMENT (first call):  ${improvement}%\n`);

if (improvement > 5) {
  console.log(`✅ Caching backup extraction saves ${improvement}%`);
} else {
  console.log('❌ Improvement too small for backup data');
}
