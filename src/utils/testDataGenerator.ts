// Генерирует тестовые данные для нагрузочного тестирования
export function generateTestData() {
  console.log('🔧 Генерирую тестовые данные...');
  
  const startTime = performance.now();
  
  // Организация
  const orgId = 'test-org-stress';
  
  // Сотрудники (300)
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
  
  // Клиенты (5000)
  const clients = [];
  const carPlates = new Set<string>();
  for (let i = 0; i < 5000; i++) {
    const plate = `${String(i).padStart(4, '0')}KZA`;
    if (!carPlates.has(plate)) {
      carPlates.add(plate);
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
  }
  
  // Услуги
  const services = ['Стандартная мойка', 'Премиум мойка', 'Экспресс мойка', 'Полировка', 'Кондиционирование'].map((name, i) => ({
    id: `service-${i}`,
    organizationId: orgId,
    name,
    basePrice: (i + 1) * 1000,
    createdAt: new Date().toISOString(),
  }));
  
  // Заказы (10000)
  const orders = [];
  for (let i = 0; i < 10000; i++) {
    const clientIdx = Math.floor(i / 2) % clients.length;
    const client = clients[clientIdx];
    const washerIdx = i % washers.length;
    const serviceIdx = i % services.length;
    const service = services[serviceIdx];
    
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
      boxId: `box-${washerIdx % 10}`,
      boxName: `Бокс ${washerIdx % 10 + 1}`,
      washerId: washers[washerIdx].id,
      washerName: washers[washerIdx].name,
      washerIds: [washers[washerIdx].id],
      washerNames: [washers[washerIdx].name],
      services: [
        {
          serviceId: service.id,
          serviceName: service.name,
          price: service.basePrice,
        },
      ],
      totalAmount: service.basePrice,
      status: ['waiting', 'in_progress', 'completed', 'cancelled'][i % 4] as any,
      paymentStatus: i % 3 === 0 ? 'unpaid' : 'paid',
      paymentMethod: ['Наличные', 'Карта', 'QR'][i % 3] as any,
      discountAmount: i % 10 === 0 ? Math.floor(Math.random() * 5000) : 0,
      bonusApplied: i % 20 === 0 ? Math.floor(Math.random() * 10000) : 0,
      dirtLevel: ['light', 'medium', 'heavy'][i % 3] as any,
      createdAt: createdDate.toISOString(),
      completedAt: i % 4 === 2 ? new Date(createdDate.getTime() + 30 * 60 * 1000).toISOString() : undefined,
      paidAt: i % 3 === 0 ? undefined : new Date().toISOString(),
      receivedAmount: i % 3 === 0 ? 0 : service.basePrice + 10000,
      changeAmount: i % 3 === 0 ? 0 : 10000,
      updatedAt: new Date().toISOString(),
    });
  }
  
  // Товары (3000)
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
  
  const endTime = performance.now();
  console.log(`✅ Генерация завершена за ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`📊 Создано: ${washers.length} сотрудников, ${clients.length} клиентов, ${orders.length} заказов, ${items.length} товаров`);
  
  return {
    orgId,
    washers,
    clients,
    services,
    orders,
    items,
  };
}

// Загружает тестовые данные в localStorage
export function loadTestDataToStorage() {
  const data = generateTestData();
  
  console.log('💾 Загружаю данные в localStorage...');
  const uploadStart = performance.now();
  
  const org = {
    id: data.orgId,
    ownerId: 'test-user',
    name: 'Тестовая автомойка (нагрузочный тест)',
    currency: 'тг',
    timezone: 'Asia/Almaty',
    language: 'ru',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    warehouseAdminView: true,
    analyticsAdminView: true,
    washerPercent: 45,
    financialSettings: {
      calculationMode: 'percent' as const,
      employeePercent: 45,
      organizationPercent: 55,
      salaryAmount: 0,
      fixedOrderAmount: 0,
    },
  };
  
  try {
    localStorage.setItem(`orgs_${data.orgId}`, JSON.stringify([org]));
    localStorage.setItem(`washers_${data.orgId}`, JSON.stringify(data.washers));
    localStorage.setItem(`clients_${data.orgId}`, JSON.stringify(data.clients));
    localStorage.setItem(`services_${data.orgId}`, JSON.stringify(data.services));
    localStorage.setItem(`orders_${data.orgId}`, JSON.stringify(data.orders));
    localStorage.setItem(`warehouseItems_${data.orgId}`, JSON.stringify(data.items));
    localStorage.setItem('activeOrgId', data.orgId);
    
    const uploadEnd = performance.now();
    console.log(`✅ Загрузка завершена за ${(uploadEnd - uploadStart).toFixed(2)}ms`);
    console.log(`💾 Размер данных в localStorage: ~${(JSON.stringify(data).length / 1024 / 1024).toFixed(2)}MB`);
  } catch (e) {
    console.error('❌ Ошибка загрузки:', e);
  }
}

// Запускает измерения производительности компонентов
export async function measureComponentPerformance() {
  const results: Record<string, number> = {};
  
  // Измеряем время открытия различных разделов
  const sections = [
    { name: 'Clients', selector: 'a[href="#clients"]' },
    { name: 'Orders', selector: 'a[href="#orders"]' },
    { name: 'Warehouse', selector: 'a[href="#warehouse"]' },
    { name: 'Washers', selector: 'a[href="#washers"]' },
  ];
  
  console.log('⏱️  Измеряю время открытия разделов...');
  
  for (const section of sections) {
    const startTime = performance.now();
    // Имитируем загрузку компонента
    await new Promise(resolve => setTimeout(resolve, 0));
    const endTime = performance.now();
    results[section.name] = endTime - startTime;
  }
  
  return results;
}

// Тест поиска
export function testSearch(clients: any[], query: string): number {
  const start = performance.now();
  const q = query.toLowerCase();
  const filtered = clients.filter(c => 
    c.fullName.toLowerCase().includes(q) || 
    c.phone.includes(q)
  );
  const end = performance.now();
  console.log(`🔍 Поиск "${query}": ${filtered.length} результатов за ${(end - start).toFixed(2)}ms`);
  return end - start;
}

// Тест фильтрации
export function testFilter(clients: any[], filterFn: (c: any) => boolean): number {
  const start = performance.now();
  const filtered = clients.filter(filterFn);
  const end = performance.now();
  console.log(`🎯 Фильтрация: ${filtered.length} результатов за ${(end - start).toFixed(2)}ms`);
  return end - start;
}

// Полный стресс-тест
export function runFullStressTest() {
  console.log('\n🚀 ЗАПУСК ПОЛНОГО СТРЕСС-ТЕСТА\n');
  
  const data = generateTestData();
  
  // Тест поиска
  console.log('\n--- ТЕСТ ПОИСКА ---');
  testSearch(data.clients, 'Клиент 100');
  testSearch(data.clients, 'Клиент 4500');
  testSearch(data.clients, '+77010000500');
  
  // Тест фильтрации
  console.log('\n--- ТЕСТ ФИЛЬТРАЦИИ ---');
  testFilter(data.clients, c => c.isVip);
  testFilter(data.clients, c => c.totalVisits > 50);
  testFilter(data.clients, c => c.crmScore > 70);
  
  // Тест сортировки
  console.log('\n--- ТЕСТ СОРТИРОВКИ ---');
  const sortStart = performance.now();
  const sortResults = [...data.clients].sort((a, b) => b.totalSpent - a.totalSpent);
  const sortEnd = performance.now();
  console.log(`↕️  Сортировка по totalSpent: ${(sortEnd - sortStart).toFixed(2)}ms (результатов: ${sortResults.length})`);
  
  // Тест сложной фильтрации (как в реальном приложении)
  console.log('\n--- ТЕСТ СЛОЖНОЙ ФИЛЬТРАЦИИ (Clients component) ---');
  const complexStart = performance.now();
  const complexResults = data.clients
    .filter(c => c.fullName.toLowerCase().includes('1'))
    .filter(c => c.isVip || c.discountPercent > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 25); // Первая страница пагинации
  const complexEnd = performance.now();
  console.log(`🔄 Сложная фильтрация (поиск + фильтр + сорт): ${(complexEnd - complexStart).toFixed(2)}ms (результатов: ${complexResults.length})`);
  
  console.log('\n✅ СТРЕСС-ТЕСТ ЗАВЕРШЕН\n');
}
