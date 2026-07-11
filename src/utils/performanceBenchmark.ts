// Тест производительности фильтрации в больших списках
export function benchmarkFiltering() {
  const clients = generateLargeClientList(5000);
  const orders = generateLargeOrderList(10000);
  
  console.log('\n⚙️  БЕНЧМАРК ФИЛЬТРАЦИИ И СОРТИРОВКИ\n');
  
  // Тест 1: Простой поиск в 5000 клиентов
  console.log('--- Тест 1: Поиск в 5000 клиентов ---');
  const searches = ['Клиент 1', 'Клиент 100', 'Клиент 4999'];
  searches.forEach(query => {
    const t1 = performance.now();
    const q = query.toLowerCase();
    const result = clients.filter(c => c.fullName.toLowerCase().includes(q));
    const t2 = performance.now();
    console.log(`  "${query}": ${(t2 - t1).toFixed(3)}ms (${result.length} результатов)`);
  });
  
  // Тест 2: Фильтрация по статусу (как в Clients component)
  console.log('\n--- Тест 2: Фильтрация по VIP статусу ---');
  const t1 = performance.now();
  const vipClients = clients.filter(c => c.isVip);
  const t2 = performance.now();
  console.log(`  VIP фильтр: ${(t2 - t1).toFixed(3)}ms (${vipClients.length} VIP клиентов)`);
  
  // Тест 3: Сортировка + фильтрация (как в реальном компоненте)
  console.log('\n--- Тест 3: Комбо фильтрация + сортировка + пагинация (как в Clients) ---');
  const t3 = performance.now();
  const filtered = clients
    .filter(c => c.totalVisits > 5)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 25);
  const t4 = performance.now();
  console.log(`  Комплекс операция: ${(t4 - t3).toFixed(3)}ms (${filtered.length} на первой странице)`);
  
  // Тест 4: Поиск в 10000 заказов
  console.log('\n--- Тест 4: Поиск в 10000 заказов ---');
  const orderSearches = ['0001', '5000', '9999'];
  orderSearches.forEach(query => {
    const t1 = performance.now();
    const result = orders.filter(o => o.licensePlate.includes(query) || o.carTypeName.includes(query));
    const t2 = performance.now();
    console.log(`  "${query}": ${(t2 - t1).toFixed(3)}ms (${result.length} результатов)`);
  });
  
  // Тест 5: Сложная фильтрация заказов (как в Orders component)
  console.log('\n--- Тест 5: Сложная фильтрация заказов ---');
  const t5 = performance.now();
  const statusFilter = 'completed';
  const complexOrders = orders
    .filter(o => o.status === statusFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 25);
  const t6 = performance.now();
  console.log(`  Статус фильтр + сорт: ${(t6 - t5).toFixed(3)}ms (${complexOrders.length} заказов)`);
  
  // Тест 6: Multiple filters (как пользователь - фильтр + поиск + пагинация)
  console.log('\n--- Тест 6: Множественные фильтры (как реальный юзер) ---');
  const t7 = performance.now();
  const q = 'клиент 1';
  const multiFiltered = clients
    .filter(c => c.fullName.toLowerCase().includes(q))
    .filter(c => c.isVip || c.discountPercent > 0)
    .filter(c => c.totalVisits > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 50);
  const t8 = performance.now();
  console.log(`  Множество фильтров: ${(t8 - t7).toFixed(3)}ms (${multiFiltered.length} результатов)`);
  
  console.log('\n✅ БЕНЧМАРК ЗАВЕРШЕН\n');
}

function generateLargeClientList(count: number) {
  const clients = [];
  for (let i = 0; i < count; i++) {
    clients.push({
      id: `client-${i}`,
      fullName: `Клиент ${i + 1}`,
      phone: `+77010${String(i).padStart(6, '0')}`,
      isVip: Math.random() > 0.9,
      discountPercent: Math.random() > 0.8 ? Math.floor(Math.random() * 20) : 0,
      totalVisits: Math.floor(Math.random() * 100),
      totalSpent: Math.floor(Math.random() * 1000000),
    });
  }
  return clients;
}

function generateLargeOrderList(count: number) {
  const orders = [];
  const statuses = ['waiting', 'in_progress', 'completed', 'cancelled'];
  for (let i = 0; i < count; i++) {
    orders.push({
      id: `order-${i}`,
      licensePlate: `${String(i % 5000).padStart(4, '0')}KZA`,
      carTypeName: ['Sedan', 'SUV', 'Truck'][i % 3],
      status: statuses[i % 4],
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return orders;
}

export function testMemoryUsage() {
  console.log('\n🧠 ТЕСТ ИСПОЛЬЗОВАНИЯ ПАМЯТИ\n');
  
  if (typeof window !== 'undefined' && (performance as any).memory) {
    const mem = (performance as any).memory;
    const used = mem.usedJSHeapSize / 1048576;
    const limit = mem.jsHeapSizeLimit / 1048576;
    const percent = ((used / limit) * 100).toFixed(1);
    
    console.log(`Использовано: ${used.toFixed(1)}MB из ${limit.toFixed(1)}MB (${percent}%)`);
    
    // Создаем большие объекты
    const largeData = generateLargeClientList(10000);
    const afterCreate = (performance as any).memory;
    const usedAfter = afterCreate.usedJSHeapSize / 1048576;
    
    console.log(`После создания 10000 объектов: ${usedAfter.toFixed(1)}MB (+${(usedAfter - used).toFixed(1)}MB)`);
    
    // Очищаем
    largeData.length = 0;
    console.log('Данные очищены');
  } else {
    console.log('⚠️  performance.memory недоступен в текущем браузере');
  }
}
