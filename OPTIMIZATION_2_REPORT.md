# Оптимизация #2: Box Analysis N×M Problem → Pre-grouping

## Проблема
В [src/components/Analytics.tsx](src/components/Analytics.tsx) в `boxesRevenueAnalytics` и `boxesAnalytics` было **N×M фильтрование**:
```tsx
boxes.map(box => {
  const boxOrders = filteredCompletedOrders.filter(order => order.boxId === box.id);
  // ... использование boxOrders
})
```

Это означает:
- Для каждого бокса (N=50)
- Полный проход по всем заказам (M=5000)
- **Total: 50×5000 = 250,000 операций фильтрации**

## Решение
Один раз сгруппировать заказы по `boxId` в Map, затем использовать готовые группы:

### BEFORE:
```tsx
const boxesRevenueAnalytics = useMemo(() => {
  return boxes.map(box => {
    const boxOrders = filteredCompletedOrders.filter(order => order.boxId === box.id);
    // ...
  })
}, [boxes, filteredCompletedOrders, range]);
```

### AFTER:
```tsx
const boxesRevenueAnalytics = useMemo(() => {
  // Pre-group: single pass O(M)
  const ordersByBox = new Map<string, typeof filteredCompletedOrders>();
  for (const order of filteredCompletedOrders) {
    if (!order.boxId) continue;
    if (!ordersByBox.has(order.boxId)) {
      ordersByBox.set(order.boxId, []);
    }
    ordersByBox.get(order.boxId)!.push(order);
  }

  // Then map: O(N) with O(1) lookup
  return boxes.map(box => {
    const boxOrders = ordersByBox.get(box.id) || [];
    // ...
  })
}, [boxes, filteredCompletedOrders, range]);
```

## Измерения

| Метрика | BEFORE | AFTER | Улучшение |
|---------|--------|-------|-----------|
| Benchmark (500 итераций) | 949.46ms | 79.26ms | **91.65%** ✅ |
| Build | 2,511.22 kB | 2,511.42 kB | Без изменений |
| TypeScript check | ✅ Pass | ✅ Pass | N/A |

## Изменения сложности
- **BEFORE**: O(N × M) = O(50 × 5000) = 250,000 операций
- **AFTER**: O(M + N) = O(5000 + 50) = 5,050 операций
- **Speedup**: ~49.5× ускорение в худшем случае

## Применено
- ✅ Оптимизирована `boxesRevenueAnalytics` (две копии N×M фильтра → одна группировка)
- ✅ Оптимизирована `boxesAnalytics` (ещё одна копия N×M фильтра → одна группировка)

## Статус
**✅ ПРИНЯТО** — выигрыш 91.65%, код верифицирован (tsc, build).
