import { performance } from 'perf_hooks';

function generateStressData() {
  const orgId = 'test-org-stress';

  const washers = [];
  for (let i = 0; i < 300; i++) {
    washers.push({
      id: `washer-${i}`,
      organizationId: orgId,
      name: `Мойщик ${i + 1}`,
      phone: `+7700${String(i).padStart(6, '0')}`,
      hourlyRate: 1500 + Math.random() * 500,
      primaryBoxId: `box-${i % 10}`,
      isActive: Math.random() > 0.1,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const clients = [];
  for (let i = 0; i < 5000; i++) {
    clients.push({
      id: `client-${i}`,
      organizationId: orgId,
      fullName: `Клиент ${i + 1}`,
      phone: `+77010${String(i).padStart(6, '0')}`,
      isVip: Math.random() > 0.9,
      discountPercent: Math.random() > 0.8 ? Math.floor(Math.random() * 20) : 0,
      bonusPoints: Math.floor(Math.random() * 5000),
      totalVisits: Math.floor(Math.random() * 100),
      totalSpent: Math.floor(Math.random() * 1000000),
      crmScore: Math.floor(Math.random() * 100),
      lastVisitAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const vehicles = [];
  for (let i = 0; i < 5000; i++) {
    vehicles.push({
      id: `vehicle-${i}`,
      organizationId: orgId,
      clientId: `client-${i}`,
      licensePlate: `${String(i).padStart(4, '0')}KZA`,
      make: 'Toyota',
      model: 'Corolla',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const services = ['Стандартная мойка', 'Премиум мойка', 'Экспресс мойка', 'Полировка', 'Кондиционирование'].map((name, i) => ({
    id: `service-${i}`,
    organizationId: orgId,
    name,
    basePrice: (i + 1) * 1000,
    createdAt: new Date().toISOString(),
  }));

  const orders = [];
  for (let i = 0; i < 10000; i++) {
    const client = clients[(Math.floor(i / 2) % clients.length)];
    const washer = washers[i % washers.length];
    const service = services[i % services.length];
    const createdDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    orders.push({
      id: `order-${i}`,
      organizationId: orgId,
      orderNumber: `#${String(i).padStart(6, '0')}`,
      clientId: client.id,
      clientPhone: client.phone,
      clientName: client.fullName,
      licensePlate: `${String(i % 5000).padStart(4, '0')}KZA`,
      carTypeName: ['Sedan', 'SUV', 'Minivan', 'Truck'][i % 4],
      boxId: `box-${washer.id}`,
      boxName: `Бокс ${i % 10 + 1}`,
      washerId: washer.id,
      washerName: washer.name,
      washerIds: [washer.id],
      washerNames: [washer.name],
      services: [{ serviceId: service.id, serviceName: service.name, price: service.basePrice }],
      totalAmount: service.basePrice,
      status: ['waiting', 'in_progress', 'completed', 'cancelled'][i % 4],
      paymentStatus: i % 3 === 0 ? 'unpaid' : 'paid',
      paymentMethod: ['Наличные', 'Карта', 'QR'][i % 3],
      discountAmount: i % 10 === 0 ? Math.floor(Math.random() * 5000) : 0,
      bonusApplied: i % 20 === 0 ? Math.floor(Math.random() * 10000) : 0,
      dirtLevel: ['light', 'medium', 'heavy'][i % 3],
      createdAt: createdDate.toISOString(),
      completedAt: i % 4 === 2 ? new Date(createdDate.getTime() + 30 * 60 * 1000).toISOString() : undefined,
      paidAt: i % 3 === 0 ? undefined : new Date().toISOString(),
      receivedAmount: i % 3 === 0 ? 0 : service.basePrice + 10000,
      changeAmount: i % 3 === 0 ? 0 : 10000,
      updatedAt: new Date().toISOString(),
    });
  }

  const items = [];
  for (let i = 0; i < 3000; i++) {
    items.push({
      id: `item-${i}`,
      organizationId: orgId,
      name: `Товар ${i + 1}`,
      categoryId: `cat-${i % 10}`,
      categoryName: `Категория ${(i % 10) + 1}`,
      unit: i % 3 === 0 ? 'л' : i % 3 === 1 ? 'шт' : 'кг',
      quantity: Math.floor(Math.random() * 1000),
      minQuantity: 50 + Math.floor(Math.random() * 200),
      purchasePrice: 1000 + Math.floor(Math.random() * 50000),
      supplier: `Поставщик ${i % 5 + 1}`,
      createdAt: new Date().toISOString(),
    });
  }

  return { orgId, washers, clients, vehicles, services, orders, items };
}

function buildVehicleIndex(vehicles) {
  const map = new Map();
  vehicles.forEach(v => {
    const key = v.clientId;
    const plate = (v.licensePlate || '').toLowerCase();
    const list = map.get(key);
    if (list) list.push(plate);
    else map.set(key, [plate]);
  });
  return map;
}

function filterClientsNaive(clients, vehicles, query) {
  const q = query.toLowerCase();
  return clients.filter(client => {
    if (!q) return true;
    const phone = (client.phone || '').toLowerCase();
    const matchesVehicle = vehicles.some(v => v.clientId === client.id && (v.licensePlate || '').toLowerCase().includes(q));
    return (client.fullName || '').toLowerCase().includes(q) || phone.includes(q) || matchesVehicle;
  });
}

function filterClientsIndexed(clients, vehiclesIndex, query) {
  const q = query.toLowerCase();
  return clients.filter(client => {
    if (!q) return true;
    const phone = (client.phone || '').toLowerCase();
    const plates = vehiclesIndex.get(client.id) || [];
    const matchesVehicle = plates.some(plate => plate.includes(q));
    return (client.fullName || '').toLowerCase().includes(q) || phone.includes(q) || matchesVehicle;
  });
}

function buildClientRecsNaive(clients) {
  const avgSpent = clients.length
    ? Math.round(clients.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / clients.length)
    : 0;
  const now = Date.now();
  const recs = [];
  clients.forEach(client => {
    const last = client.lastVisitAt ? new Date(client.lastVisitAt).getTime() : 0;
    const daysAgo = last ? Math.round((now - last) / (1000 * 60 * 60 * 24)) : undefined;
    const totalVisits = client.totalVisits || 0;
    const totalSpent = client.totalSpent || 0;
    if (totalVisits >= 10) {
      recs.push({ priority: 80 });
    }
    if (daysAgo !== undefined) {
      if (daysAgo >= 90) recs.push({ priority: 95 });
      else if (daysAgo >= 60) recs.push({ priority: 80 });
      else if (daysAgo >= 30) recs.push({ priority: 70 });
    }
    if (totalSpent > avgSpent * 1.5 && totalSpent > 0) recs.push({ priority: 85 });
    if (totalVisits >= 5 && totalVisits < 10) recs.push({ priority: 60 });
  });
  return recs.sort((a, b) => b.priority - a.priority).slice(0, 6);
}

function buildClientRecsIndexed(clients) {
  const avgSpent = clients.length
    ? Math.round(clients.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / clients.length)
    : 0;
  const now = Date.now();
  const recs = [];
  clients.forEach(client => {
    const last = client.lastVisitAt ? new Date(client.lastVisitAt).getTime() : 0;
    const daysAgo = last ? Math.round((now - last) / (1000 * 60 * 60 * 24)) : undefined;
    const totalVisits = client.totalVisits || 0;
    const totalSpent = client.totalSpent || 0;
    if (totalVisits >= 10) {
      recs.push({ priority: 80 });
    }
    if (daysAgo !== undefined) {
      if (daysAgo >= 90) recs.push({ priority: 95 });
      else if (daysAgo >= 60) recs.push({ priority: 80 });
      else if (daysAgo >= 30) recs.push({ priority: 70 });
    }
    if (totalSpent > avgSpent * 1.5 && totalSpent > 0) recs.push({ priority: 85 });
    if (totalVisits >= 5 && totalVisits < 10) recs.push({ priority: 60 });
  });
  return recs.sort((a, b) => b.priority - a.priority).slice(0, 6);
}

function measure(label, fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`${label}: ${(end - start).toFixed(2)}ms`);
  return { duration: end - start, result };
}

function runBenchmark() {
  console.log('>>> GENERATING DATA');
  const gen = measure('Generate stress dataset', () => generateStressData());
  const { clients, vehicles } = gen.result;
  console.log(`  clients=${clients.length}, vehicles=${vehicles.length}`);

  console.log('\n>>> CLIENT SEARCH BENCHMARK');
  const vehiclesIndex = measure('Build vehicle index', () => buildVehicleIndex(vehicles)).result;
  measure('Search naive: Клиент 100', () => filterClientsNaive(clients, vehicles, 'Клиент 100'));
  measure('Search indexed: Клиент 100', () => filterClientsIndexed(clients, vehiclesIndex, 'Клиент 100'));
  measure('Search naive: +77010000500', () => filterClientsNaive(clients, vehicles, '+77010000500'));
  measure('Search indexed: +77010000500', () => filterClientsIndexed(clients, vehiclesIndex, '+77010000500'));

  console.log('\n>>> CLIENT RECOMMENDATION BENCHMARK');
  measure('Recommendations naive', () => buildClientRecsNaive(clients));
  measure('Recommendations optimized', () => buildClientRecsIndexed(clients));

  console.log('\n>>> SORT BENCHMARK');
  measure('Sort clients by totalSpent', () => [...clients].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)));

  console.log('\n>>> COMPLEX FILTER BENCHMARK');
  measure('Complex filter', () => clients
    .filter(c => (c.fullName || '').toLowerCase().includes('1'))
    .filter(c => c.isVip || (c.discountPercent || 0) > 0)
    .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
    .slice(0, 25));

  console.log('\n>>> ORDER WORKER LOOKUP BENCHMARK');
  function buildWasherIndex(washers) {
    const m = new Map();
    for (const w of washers) m.set(w.id, w);
    return m;
  }

  function getOrderWorkersNaive(order, washers) {
    const ids = order.washerIds && order.washerIds.length ? order.washerIds : order.washerId ? [order.washerId] : [];
    return ids.map(id => washers.find(w => w.id === id)).filter(Boolean);
  }

  function getOrderWorkersIndexed(order, washersIndex) {
    const ids = order.washerIds && order.washerIds.length ? order.washerIds : order.washerId ? [order.washerId] : [];
    return ids.map(id => washersIndex.get(id)).filter(Boolean);
  }

  const washersIndex = measure('Build washer index', () => buildWasherIndex(gen.result.washers)).result;
  // sample 1000 orders
  const sampleOrders = gen.result.orders.slice(0, 1000);
  measure('Order worker lookup naive (1000 orders)', () => {
    for (const o of sampleOrders) getOrderWorkersNaive(o, gen.result.washers);
  });
  measure('Order worker lookup indexed (1000 orders)', () => {
    for (const o of sampleOrders) getOrderWorkersIndexed(o, washersIndex);
  });

  console.log('\n>>> CLIENT CARD ORDER FILTER BENCHMARK');
  function buildOrdersByClient(orders) {
    const map = new Map();
    for (const o of orders) {
      const list = map.get(o.clientId) || [];
      list.push(o);
      map.set(o.clientId, list);
    }
    return map;
  }
  function buildOrdersByVehicle(orders) {
    const map = new Map();
    for (const o of orders) {
      if (!o.vehicleId) continue;
      const list = map.get(o.vehicleId) || [];
      list.push(o);
      map.set(o.vehicleId, list);
    }
    return map;
  }
  function buildClientOrdersNaive(client, orders, vehicles) {
    return orders.filter(o => o.clientId === client.id || vehicles.some(v => v.id === o.vehicleId));
  }
  function buildClientOrdersIndexed(client, ordersByClient, ordersByVehicle, vehiclesByClientId) {
    const clientOrders = ordersByClient.get(client.id) || [];
    const vehicleIds = vehiclesByClientId.get(client.id) || [];
    const orderSet = new Set(clientOrders);
    const result = [...clientOrders];
    for (const vehicleId of vehicleIds) {
      const vehicleOrders = ordersByVehicle.get(vehicleId) || [];
      for (const order of vehicleOrders) {
        if (!orderSet.has(order)) {
          orderSet.add(order);
          result.push(order);
        }
      }
    }
    return result;
  }
  const sampleClient = gen.result.clients[0];
  const vehiclesByClientId = measure('Build vehicles by client id', () => {
    const map = new Map();
    for (const v of gen.result.vehicles) {
      const list = map.get(v.clientId) || [];
      list.push(v.id);
      map.set(v.clientId, list);
    }
    return map;
  }).result;
  const ordersByClient = measure('Build orders by client', () => buildOrdersByClient(gen.result.orders)).result;
  const ordersByVehicle = measure('Build orders by vehicle', () => buildOrdersByVehicle(gen.result.orders)).result;
  measure('Client orders naive (1 client)', () => buildClientOrdersNaive(sampleClient, gen.result.orders, gen.result.vehicles));
  measure('Client orders indexed (1 client)', () => buildClientOrdersIndexed(sampleClient, ordersByClient, ordersByVehicle, vehiclesByClientId));

  console.log('\n>>> CLIENT CARD PER-VEHICLE ORDER FILTER BENCHMARK');
  function buildPerVehicleOrdersNaive(vehicles, orders) {
    return vehicles.map(vehicle => ({
      id: vehicle.id,
      orders: orders.filter(o => o.vehicleId === vehicle.id || o.licensePlate === vehicle.licensePlate),
    }));
  }
  function buildPerVehicleOrdersIndexed(vehicles, ordersByVehicleId, ordersByPlate) {
    return vehicles.map(vehicle => {
      const vehicleOrders = ordersByVehicleId.get(vehicle.id) || [];
      const plateOrders = ordersByPlate.get((vehicle.licensePlate || '').toLowerCase()) || [];
      const orderSet = new Set(vehicleOrders);
      const combined = [...vehicleOrders];
      for (const order of plateOrders) {
        if (!orderSet.has(order)) {
          orderSet.add(order);
          combined.push(order);
        }
      }
      return { id: vehicle.id, orders: combined };
    });
  }
  function buildOrdersByPlate(orders) {
    const map = new Map();
    for (const o of orders) {
      const plateKey = (o.licensePlate || '').toLowerCase();
      if (!plateKey) continue;
      const list = map.get(plateKey) || [];
      list.push(o);
      map.set(plateKey, list);
    }
    return map;
  }
  const clientVehicles = Array.from({ length: 100 }, (_, i) => ({ id: `vehicle-${i}`, clientId: sampleClient.id, licensePlate: `${String(i).padStart(4, '0')}KZA` }));
  const clientOrders = Array.from({ length: 10000 }, (_, i) => ({ id: `order-${i}`, clientId: sampleClient.id, vehicleId: `vehicle-${i % 100}`, licensePlate: `${String(i % 100).padStart(4, '0')}KZA`, totalAmount: 1000 }));
  const ordersByVehicleId2 = measure('Build client orders by vehicle id', () => buildOrdersByVehicle(clientOrders)).result;
  const ordersByPlate = measure('Build client orders by plate', () => buildOrdersByPlate(clientOrders)).result;
  measure('Per-vehicle orders naive (100 vehicles)', () => buildPerVehicleOrdersNaive(clientVehicles, clientOrders));
  measure('Per-vehicle orders indexed (100 vehicles)', () => buildPerVehicleOrdersIndexed(clientVehicles, ordersByVehicleId2, ordersByPlate));

  console.log('\n>>> WASHER-ORDER AGGREGATION BENCHMARK');
  function aggregateNaive(washers, orders) {
    return washers.map(w => ({ washer: w, orders: orders.filter(o => o.washerId === w.id || (o.washerIds || []).includes(w.id)) }));
  }
  function aggregateGrouped(washers, orders) {
    const map = new Map();
    for (const o of orders) {
      const ids = o.washerIds && o.washerIds.length ? o.washerIds : o.washerId ? [o.washerId] : [];
      for (const id of ids) {
        const list = map.get(id) || (map.set(id, []).get(id));
        list.push(o);
      }
    }
    return washers.map(w => ({ washer: w, orders: map.get(w.id) || [] }));
  }

  measure('Aggregate naive (washers x orders)', () => aggregateNaive(gen.result.washers, gen.result.orders));
  measure('Aggregate grouped (build map)', () => aggregateGrouped(gen.result.washers, gen.result.orders));
}

runBenchmark();
