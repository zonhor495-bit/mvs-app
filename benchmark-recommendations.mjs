import { performance } from 'perf_hooks';

// Simulate getClientRecommendationsStructured pattern
function generateClientData() {
  const clients = Array(5000).fill(0).map((_, i) => ({
    id: `client-${i}`,
    totalVisits: Math.floor(Math.random() * 50),
    totalSpent: Math.random() * 10000,
    lastVisitAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  let getClientsCallCount = 0;
  const getClients = () => {
    getClientsCallCount++;
    return clients;
  };

  const notifications = Array(100).fill(0).map((_, i) => ({
    key: `notif-${i}`,
    clientId: `client-${i}`,
    title: `Notification ${i}`,
  }));

  return { clients, getClients, notifications, getClientsCallCount: () => getClientsCallCount };
}

// BEFORE: getClients() called twice per notification
function processNotificationsBefore(getClients, notifications) {
  let callCount = 0;
  return notifications.map(notif => {
    callCount++;
    const client = getClients().find(c => c.id === notif.clientId);
    if (!client) return null;

    const daysAgo = client.lastVisitAt ? Math.round((Date.now() - new Date(client.lastVisitAt).getTime()) / (1000*60*60*24)) : 0;
    
    callCount++;
    const clients = getClients();
    const avgSpent = clients.length ? Math.round(clients.reduce((s, c) => s + (c.totalSpent || 0), 0) / clients.length) : 0;
    
    return { notif, daysAgo, avgSpent, callCount: 2 };
  });
}

// AFTER: getClients() called once, reused
function processNotificationsAfter(getClients, notifications) {
  const clients = getClients(); // Single call
  const avgSpent = clients.length ? Math.round(clients.reduce((s, c) => s + (c.totalSpent || 0), 0) / clients.length) : 0;
  
  return notifications.map(notif => {
    const client = clients.find(c => c.id === notif.clientId);
    if (!client) return null;

    const daysAgo = client.lastVisitAt ? Math.round((Date.now() - new Date(client.lastVisitAt).getTime()) / (1000*60*60*24)) : 0;
    
    return { notif, daysAgo, avgSpent, callCount: 1 };
  });
}

const { clients, getClients, notifications, getClientsCallCount } = generateClientData();

console.log('\n📊 BENCHMARK: getClientRecommendationsStructured Pattern\n');
console.log(`Clients: ${clients.length}, Notifications: ${notifications.length}\n`);

// Warmup
for (let i = 0; i < 10; i++) {
  processNotificationsBefore(getClients, notifications.slice(0, 10));
  processNotificationsAfter(getClients, notifications.slice(0, 10));
}

// Measure BEFORE
const beforeStart = performance.now();
for (let i = 0; i < 100; i++) {
  processNotificationsBefore(getClients, notifications);
}
const beforeTime = performance.now() - beforeStart;

// Measure AFTER
const afterStart = performance.now();
for (let i = 0; i < 100; i++) {
  processNotificationsAfter(getClients, notifications);
}
const afterTime = performance.now() - afterStart;

const improvement = ((beforeTime - afterTime) / beforeTime * 100).toFixed(2);

console.log(`BEFORE (${notifications.length * 100} calls × 2 getClients): ${beforeTime.toFixed(2)}ms`);
console.log(`AFTER (${notifications.length * 100} calls × 1 getClients):  ${afterTime.toFixed(2)}ms`);
console.log(`IMPROVEMENT: ${improvement}%\n`);

console.log(`Redundant getClients() calls saved: ${notifications.length * 100}\n`);

if (improvement > 5) {
  console.log(`✅ Significant improvement of ${improvement}%`);
} else {
  console.log('❌ Improvement < 5%');
}
