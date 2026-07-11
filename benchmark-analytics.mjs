import { performance } from 'perf_hooks';

// Simulate the problematic patterns from Analytics.tsx
function generateTestData() {
  const movements = [];
  for (let i = 0; i < 10000; i++) {
    movements.push({
      id: `mov-${i}`,
      type: ['consumption', 'writeoff', 'incoming', 'reserve'][Math.floor(Math.random() * 4)],
      totalCost: Math.random() * 1000,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  const cashOps = [];
  for (let i = 0; i < 2000; i++) {
    cashOps.push({
      id: `cashop-${i}`,
      direction: Math.random() > 0.5 ? 'income' : 'expense',
      type: ['expense_supply', 'salary', 'other'][Math.floor(Math.random() * 3)],
      amount: Math.random() * 5000,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  const timelogs = [];
  for (let i = 0; i < 5000; i++) {
    timelogs.push({
      id: `timelog-${i}`,
      washerShare: Math.random() * 500,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }

  return { movements, cashOps, timelogs };
}

// BEFORE: Multiple filter() calls on same array
function calculateBefore(movements, cashOps, timelogs) {
  const isSameDay = (date1, date2) => date1.toDateString() === date2.toDateString();
  const isInRange = () => true; // simplified

  // Line 181-182: Multiple separate filters
  const periodMaterials = movements
    .filter(m => m.type === 'consumption' || m.type === 'writeoff')
    .reduce((sum, movement) => sum + (movement.totalCost || 0), 0);

  const periodPurchases = movements
    .filter(m => m.type === 'incoming')
    .reduce((sum, movement) => sum + (movement.totalCost || 0), 0);

  const periodOtherExpenses = cashOps
    .filter(op => op.direction === 'expense' && op.type !== 'expense_supply')
    .reduce((sum, op) => sum + op.amount, 0);

  return { periodMaterials, periodPurchases, periodOtherExpenses };
}

// AFTER: Single pass with combined logic
function calculateAfter(movements, cashOps, timelogs) {
  let periodMaterials = 0;
  let periodPurchases = 0;
  
  // Single pass through movements
  for (const m of movements) {
    if (m.type === 'consumption' || m.type === 'writeoff') {
      periodMaterials += m.totalCost || 0;
    } else if (m.type === 'incoming') {
      periodPurchases += m.totalCost || 0;
    }
  }

  // Single pass through cashOps
  let periodOtherExpenses = 0;
  for (const op of cashOps) {
    if (op.direction === 'expense' && op.type !== 'expense_supply') {
      periodOtherExpenses += op.amount;
    }
  }

  return { periodMaterials, periodPurchases, periodOtherExpenses };
}

const { movements, cashOps, timelogs } = generateTestData();

console.log('\n📊 BENCHMARK: Analytics Multiple Filter Calls\n');
console.log(`Data size: movements=${movements.length}, cashOps=${cashOps.length}, timelogs=${timelogs.length}\n`);

// Warmup
for (let i = 0; i < 100; i++) {
  calculateBefore(movements, cashOps, timelogs);
  calculateAfter(movements, cashOps, timelogs);
}

// Measure BEFORE
const beforeStart = performance.now();
for (let i = 0; i < 1000; i++) {
  calculateBefore(movements, cashOps, timelogs);
}
const beforeTime = performance.now() - beforeStart;

// Measure AFTER
const afterStart = performance.now();
for (let i = 0; i < 1000; i++) {
  calculateAfter(movements, cashOps, timelogs);
}
const afterTime = performance.now() - afterStart;

const improvement = ((beforeTime - afterTime) / beforeTime * 100).toFixed(2);

console.log(`BEFORE (multiple filter calls): ${beforeTime.toFixed(2)}ms`);
console.log(`AFTER (single pass loops):      ${afterTime.toFixed(2)}ms`);
console.log(`IMPROVEMENT:                     ${improvement}%\n`);

if (improvement < 5) {
  console.log('❌ Improvement < 5%, might not be worth it');
} else {
  console.log(`✅ Significant improvement of ${improvement}%`);
}
