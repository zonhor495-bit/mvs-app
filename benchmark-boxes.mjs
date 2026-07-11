import { performance } from 'perf_hooks';

// Simulate N×M problem from boxesRevenueAnalytics
function generateTestData2() {
  const boxes = Array.from({ length: 50 }, (_, i) => ({ id: `box-${i}`, name: `Box ${i}` }));
  
  const orders = [];
  for (let i = 0; i < 5000; i++) {
    orders.push({
      id: `order-${i}`,
      boxId: `box-${Math.floor(Math.random() * 50)}`,
      totalAmount: Math.random() * 1000,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
  }

  return { boxes, orders };
}

// BEFORE: N×M filter for each box
function analyzeBefore(boxes, orders) {
  return boxes.map(box => {
    const boxOrders = orders.filter(order => order.boxId === box.id);
    const revenue = boxOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const count = boxOrders.length;
    return { boxId: box.id, revenue, count };
  });
}

// AFTER: Single pass to group, then map
function analyzeAfter(boxes, orders) {
  // Single pass: group orders by boxId
  const ordersByBox = new Map();
  for (const order of orders) {
    if (!ordersByBox.has(order.boxId)) {
      ordersByBox.set(order.boxId, []);
    }
    ordersByBox.get(order.boxId).push(order);
  }

  // Then map boxes using pre-grouped data
  return boxes.map(box => {
    const boxOrders = ordersByBox.get(box.id) || [];
    const revenue = boxOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const count = boxOrders.length;
    return { boxId: box.id, revenue, count };
  });
}

const { boxes, orders } = generateTestData2();

console.log('\n📊 BENCHMARK: Box Analysis N×M Problem\n');
console.log(`Data: ${boxes.length} boxes × ${orders.length} orders\n`);

// Warmup
for (let i = 0; i < 50; i++) {
  analyzeBefore(boxes, orders);
  analyzeAfter(boxes, orders);
}

// Measure BEFORE
const beforeStart = performance.now();
for (let i = 0; i < 500; i++) {
  analyzeBefore(boxes, orders);
}
const beforeTime = performance.now() - beforeStart;

// Measure AFTER
const afterStart = performance.now();
for (let i = 0; i < 500; i++) {
  analyzeAfter(boxes, orders);
}
const afterTime = performance.now() - afterStart;

const improvement = ((beforeTime - afterTime) / beforeTime * 100).toFixed(2);

console.log(`BEFORE (N×M filter):       ${beforeTime.toFixed(2)}ms`);
console.log(`AFTER (single pass group): ${afterTime.toFixed(2)}ms`);
console.log(`IMPROVEMENT:               ${improvement}%\n`);

if (improvement < 5) {
  console.log('❌ Improvement < 5%, might not be worth it');
} else {
  console.log(`✅ Significant improvement of ${improvement}%`);
}
