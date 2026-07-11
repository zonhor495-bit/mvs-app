import { useMemo, useState, memo } from 'react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { Organization, WarehouseMovementType, ServiceMaterialUsage, generateId } from '../types';
import {
  getOrders,
  getServices,
  getWarehouseCategories,
  addWarehouseCategory,
  getWarehouseItems,
  addWarehouseItem,
  addWarehouseIncoming,
  addWarehouseWriteoff,
  getWarehouseMovements,
  getServiceMaterialUsages,
  upsertServiceMaterialUsage,
  removeServiceMaterialUsage,
  getSuppliers,
  addSupplier,
  getSupplierPurchaseTotals,
  getWarehouseForecast,
  getPurchases,
  getInventories,
  calculateOrderCostBreakdown,
  getWashers,
} from '../store';
import { exportWarehousePdf } from '../utils/crmExport';
import PaginationControl from './PaginationControl';
import { calculatePagination } from '../utils/pagination';

function getUnitPriceLabel(quantity: number, purchasePrice: number, unit: string) {
  const safeQuantity = Math.max(0, quantity);
  const safePrice = Math.max(0, purchasePrice);
  if (safeQuantity <= 0) {
    return { perUnit: 0, perLiter: 0, perMilliliter: 0 };
  }

  const normalizedUnit = unit.trim().toLowerCase();
  const perUnit = safePrice / safeQuantity;

  if (normalizedUnit === 'л' || normalizedUnit === 'l' || normalizedUnit === 'liter' || normalizedUnit === 'litre') {
    return { perUnit, perLiter: perUnit, perMilliliter: perUnit / 1000 };
  }

  if (normalizedUnit === 'мл' || normalizedUnit === 'ml') {
    return { perUnit, perLiter: perUnit * 1000, perMilliliter: perUnit };
  }

  return { perUnit, perLiter: perUnit, perMilliliter: perUnit };
}

interface WarehouseProps {
  activeOrg: Organization;
  userRole: 'admin' | 'manager';
}

const MOVEMENT_LABELS: Record<WarehouseMovementType, string> = {
  incoming: 'Приход',
  consumption: 'Использовано в работе',
  writeoff: 'Списание',
  correction: 'Корректировка',
  inventory: 'Инвентаризация',
  return_supplier: 'Возврат поставщику',
};

export default memo(function Warehouse({ activeOrg, userRole }: WarehouseProps) {
  const [version, setVersion] = useState(0);
  const [newCategory, setNewCategory] = useState('');
  const [itemsCurrentPage, setItemsCurrentPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(25);

  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemUnit, setItemUnit] = useState('л');
  const [itemQuantity, setItemQuantity] = useState(0);
  const [itemMinQuantity, setItemMinQuantity] = useState(0);
  const [itemPurchasePrice, setItemPurchasePrice] = useState(0);
  const [itemSupplier, setItemSupplier] = useState('');

  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierContactPerson, setSupplierContactPerson] = useState('');

  const [incomingItemId, setIncomingItemId] = useState('');
  const [incomingQty, setIncomingQty] = useState(0);
  const [incomingPrice, setIncomingPrice] = useState(0);
  const [incomingSupplier, setIncomingSupplier] = useState('');
  const [incomingSupplierId, setIncomingSupplierId] = useState('');

  const [writeoffItemId, setWriteoffItemId] = useState('');
  const [writeoffQty, setWriteoffQty] = useState(0);
  const [writeoffReason, setWriteoffReason] = useState('Использовано в работе');
  const [writeoffType, setWriteoffType] = useState<WarehouseMovementType>('consumption');

  const [usageServiceId, setUsageServiceId] = useState('');
  const [usageItemId, setUsageItemId] = useState('');
  const [usageQty, setUsageQty] = useState(0);
  const [editingUsageId, setEditingUsageId] = useState<string | null>(null);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [historySearch, setHistorySearch] = useState('');
  const [historyType, setHistoryType] = useState<'all' | WarehouseMovementType>('all');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');

  const refresh = () => setVersion(v => v + 1);
  const canEdit = userRole === 'manager';
  const canView = userRole === 'manager' || activeOrg.warehouseAdminView !== false;
  const actorName = userRole === 'manager' ? 'Управляющий' : 'Администратор';

  const categories = useMemo(() => getWarehouseCategories(activeOrg.id), [activeOrg.id, version]);
  const items = useMemo(() => getWarehouseItems(activeOrg.id), [activeOrg.id, version]);
  const suppliers = useMemo(() => getSuppliers(activeOrg.id), [activeOrg.id, version]);
  const movements = useMemo(
    () => getWarehouseMovements(activeOrg.id).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [activeOrg.id, version]
  );
  const services = useMemo(() => getServices(activeOrg.id), [activeOrg.id]);
  const orders = useMemo(() => getOrders(activeOrg.id), [activeOrg.id]);
  const washers = useMemo(() => getWashers(activeOrg.id), [activeOrg.id]);
  const serviceUsages = useMemo(() => getServiceMaterialUsages(activeOrg.id), [activeOrg.id, version]);
  const forecasts = useMemo(() => getWarehouseForecast(activeOrg.id), [activeOrg.id, version]);
  const purchaseTotals = useMemo(() => getSupplierPurchaseTotals(activeOrg.id), [activeOrg.id, version]);

  const lowItems = useMemo(() => items.filter(i => i.quantity > 0 && i.quantity <= i.minQuantity), [items]);
  const outItems = useMemo(() => items.filter(i => i.quantity <= 0), [items]);
  const stockCost = useMemo(() => items.reduce((sum, i) => sum + i.quantity * i.purchasePrice, 0), [items]);

  const dayRange = { from: startOfDay(new Date()), to: endOfDay(new Date()) };
  const monthRange = { from: startOfMonth(new Date()), to: endOfMonth(new Date()) };

  const calcMovementStats = (from: Date, to: Date) => {
    const list = movements.filter(m => {
      const d = new Date(m.createdAt);
      return d >= from && d <= to;
    });
    const incoming = list.filter(m => m.type === 'incoming').reduce((s, m) => s + (m.totalCost || 0), 0);
    const used = list.filter(m => m.type === 'consumption' || m.type === 'writeoff').reduce((s, m) => s + (m.totalCost || 0), 0);
    return { list, incoming, used };
  };

  const dayStats = calcMovementStats(dayRange.from, dayRange.to);
  const monthStats = calcMovementStats(monthRange.from, monthRange.to);

  const filteredMovements = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const fromTs = historyFrom ? startOfDay(new Date(historyFrom)).getTime() : Number.MIN_SAFE_INTEGER;
    const toTs = historyTo ? endOfDay(new Date(historyTo)).getTime() : Number.MAX_SAFE_INTEGER;

    return movements.filter(m => {
      const ts = new Date(m.createdAt).getTime();
      if (ts < fromTs || ts > toTs) return false;
      if (historyType !== 'all' && m.type !== historyType) return false;
      if (q) {
        const hay = `${m.itemName} ${m.orderNumber || ''} ${m.reason || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [movements, historySearch, historyType, historyFrom, historyTo]);

  const addCategory = () => {
    if (!canEdit) return;
    if (!newCategory.trim()) return;
    addWarehouseCategory({
      id: generateId(),
      organizationId: activeOrg.id,
      name: newCategory.trim(),
      createdAt: new Date().toISOString(),
    });
    setNewCategory('');
    refresh();
  };

  const addNewSupplier = () => {
    if (!canEdit) return;
    if (!supplierName.trim()) return;
    addSupplier({
      id: generateId(),
      organizationId: activeOrg.id,
      name: supplierName.trim(),
      phone: supplierPhone.trim() || undefined,
      contactPerson: supplierContactPerson.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    setSupplierName('');
    setSupplierPhone('');
    setSupplierContactPerson('');
    refresh();
  };

  const addItem = () => {
    if (!canEdit) return;
    if (!itemName.trim()) return;
    const category = categories.find(c => c.id === itemCategoryId);
    addWarehouseItem({
      id: generateId(),
      organizationId: activeOrg.id,
      name: itemName.trim(),
      categoryId: itemCategoryId || undefined,
      categoryName: category?.name || 'Другое',
      quantity: Math.max(0, itemQuantity),
      unit: itemUnit.trim() || 'шт',
      minQuantity: Math.max(0, itemMinQuantity),
      purchasePrice: Math.max(0, Math.round(itemPurchasePrice)),
      supplier: itemSupplier.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    setItemName('');
    setItemQuantity(0);
    setItemMinQuantity(0);
    setItemPurchasePrice(0);
    setItemSupplier('');
    refresh();
  };

  const addIncoming = () => {
    if (!canEdit) return;
    const movement = addWarehouseIncoming({
      orgId: activeOrg.id,
      itemId: incomingItemId,
      quantity: incomingQty,
      unitPrice: incomingPrice,
      employeeName: actorName,
      supplierId: incomingSupplierId || undefined,
      supplier: incomingSupplier.trim() || undefined,
      note: 'Закупка материалов',
    });
    if (!movement) {
      alert('Не удалось добавить приход');
      return;
    }
    setIncomingQty(0);
    setIncomingPrice(0);
    refresh();
  };

  const addWriteoff = () => {
    if (!canEdit) return;
    const movement = addWarehouseWriteoff({
      orgId: activeOrg.id,
      itemId: writeoffItemId,
      quantity: writeoffQty,
      type: writeoffType,
      employeeName: actorName,
      reason: writeoffReason.trim() || 'Списание',
      source: 'manual',
    });
    if (!movement) {
      alert('Не удалось списать (проверьте остаток)');
      return;
    }
    setWriteoffQty(0);
    setWriteoffReason('Использовано в работе');
    refresh();
  };

  const addUsageRule = () => {
    if (!canEdit) return;
    const service = services.find(s => s.id === usageServiceId);
    const item = items.find(i => i.id === usageItemId);
    if (!service || !item || usageQty <= 0) return;

    const usage: ServiceMaterialUsage = {
      id: editingUsageId || generateId(),
      organizationId: activeOrg.id,
      serviceId: service.id,
      serviceName: service.name,
      itemId: item.id,
      itemName: item.name,
      quantityPerService: usageQty,
      unit: item.unit,
    };
    upsertServiceMaterialUsage(usage);
    setUsageQty(0);
    setUsageItemId('');
    setUsageServiceId('');
    setEditingUsageId(null);
    refresh();
  };

  const editUsage = (u: ServiceMaterialUsage) => {
    setEditingUsageId(u.id);
    setUsageServiceId(u.serviceId);
    setUsageItemId(u.itemId);
    setUsageQty(u.quantityPerService);
  };

  const openItemCard = (itemId: string) => { setSelectedItemId(itemId); };

  const closeItemCard = () => setSelectedItemId(null);

  const exportItemCsv = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const movementsForItem = getWarehouseMovements(activeOrg.id).filter(m => m.itemId === itemId);
    const purchases = getPurchases(activeOrg.id).filter(p => p.items.some((it: any) => it.itemId === itemId));
    const rows: string[][] = [];
    rows.push(['Товар', item.name]);
    rows.push(['Остаток', String(item.quantity)]);
    rows.push([]);
    rows.push(['Движения']);
    rows.push(['Дата', 'Операция', 'Кол-во', 'Ед.', 'Сумма', 'Причина']);
    movementsForItem.forEach(m => rows.push([m.createdAt, m.type, String(m.quantity), m.unit, String(m.totalCost || 0), m.reason || '']));
    rows.push([]);
    rows.push(['Закупки']);
    rows.push(['Дата', 'Поставщик', 'Кол-во', 'Цена', 'Сумма']);
    purchases.forEach(p => {
      p.items.filter((it: any) => it.itemId === itemId).forEach((it: any) => {
        rows.push([p.createdAt, p.supplierName || '—', String(it.quantity), String(it.unitPrice), String(it.quantity * it.unitPrice)]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `item_${item.name.replace(/\s+/g,'_')}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportItemPdf = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const movementsForItem = getWarehouseMovements(activeOrg.id).filter(m => m.itemId === itemId);
    const purchases = getPurchases(activeOrg.id).filter(p => p.items.some((it: any) => it.itemId === itemId));
    exportWarehousePdf(activeOrg, [item], movementsForItem, purchases);
  };

  const exportItemExcel = async (itemId: string) => {
    if (!window.electron?.exportReport) { alert('Экспорт Excel недоступен'); return; }
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const movementsForItem = getWarehouseMovements(activeOrg.id).filter(m => m.itemId === itemId);
    const purchases = getPurchases(activeOrg.id).filter(p => p.items.some((it: any) => it.itemId === itemId));
    const result = await window.electron.exportReport({
      fileName: `item_${item.name.replace(/\s+/g,'_')}.xlsx`,
      orders: [],
      from: monthRange.from.toISOString(),
      to: monthRange.to.toISOString(),
      warehouse: { items: [item], movements: movementsForItem, purchases },
    });
    if (!result?.canceled) alert(`Отчёт сохранён: ${result?.filePath}`);
  };

  const exportInventoriesCsv = () => {
    const invs = getInventories(activeOrg.id);
    const rows: string[][] = [['Инвентория ID','Дата','Кто','Записи']];
    invs.forEach(inv => rows.push([inv.id, inv.createdAt, inv.createdBy, (inv.records || []).map(r => `${r.itemName}:${r.countedQuantity}`).join('; ')]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `inventories_${format(new Date(),'yyyyMMdd_HHmm')}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportPurchasesCsv = () => {
    const purchases = getPurchases(activeOrg.id);
    const rows: string[][] = [['ID','Дата','Поставщик','Товары','Сумма']];
    purchases.forEach(p => rows.push([p.id, p.createdAt, p.supplierName || '-', p.items.map((it:any) => (it.itemName + 'x' + it.quantity)).join('; '), String(p.total || 0)]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `purchases_${format(new Date(),'yyyyMMdd_HHmm')}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headersItems = ['Товар', 'Категория', 'Остаток', 'Ед.', 'Мин.остаток', 'Цена', 'Цена за 1 л', 'Цена за 1 мл', 'Поставщик'];
    const rowsItems = items.map(i => {
      const prices = getUnitPriceLabel(i.quantity, i.purchasePrice, i.unit);
      return [
        i.name,
        i.categoryName,
        String(i.quantity),
        i.unit,
        String(i.minQuantity),
        String(i.purchasePrice),
        String(Math.round(prices.perLiter)),
        String(Math.round(prices.perMilliliter)),
        i.supplier || '',
      ];
    });

    const headersMoves = ['Дата', 'Товар', 'Операция', 'Кол-во', 'Ед.', 'Стоимость', 'Причина', 'Сотрудник', 'Заказ'];
    const rowsMoves = filteredMovements.map(m => [
      format(new Date(m.createdAt), 'dd.MM.yyyy HH:mm'),
      m.itemName,
      MOVEMENT_LABELS[m.type],
      String(m.quantity),
      m.unit,
      String(m.totalCost || 0),
      m.reason || '',
      m.employeeName,
      m.orderNumber || '',
    ]);

    const csvBlock = (title: string, headers: string[], rows: string[][]) => [title, headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')), ''].join('\n');
    const csv = '\uFEFF' + [csvBlock('Товары', headersItems, rowsItems), csvBlock('Движения', headersMoves, rowsMoves)].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    if (!window.electron?.exportReport) {
      alert('Экспорт Excel недоступен в этой среде');
      return;
    }
    const purchaseRows = filteredMovements
      .filter(m => m.type === 'incoming')
      .map(m => ({
        date: m.createdAt,
        supplier: m.supplierName || '—',
        item: m.itemName,
        quantity: `${m.quantity} ${m.unit}`,
        amount: m.totalCost || 0,
        employee: m.employeeName,
      }));

    const movementRows = filteredMovements.map(m => ({
      date: m.createdAt,
      item: m.itemName,
      operation: MOVEMENT_LABELS[m.type],
      quantity: `${m.quantity} ${m.unit}`,
      amount: m.totalCost || 0,
      reason: m.reason || '',
      employee: m.employeeName,
    }));

    const costRows = orders.filter(o => o.status === 'completed').map(order => {
      const cost = calculateOrderCostBreakdown(order, activeOrg.id, washers);
      return {
        orderNumber: order.orderNumber || order.id,
        date: order.completedAt || order.createdAt,
        totalAmount: order.totalAmount,
        materialsCost: cost.materialsCost,
        workersCost: cost.workersCost,
        profit: cost.organizationProfit,
      };
    });

    const itemRows = items.map(i => ({
      name: i.name,
      category: i.categoryName,
      quantity: i.quantity,
      unit: i.unit,
      minQuantity: i.minQuantity,
      price: i.purchasePrice,
      pricePerLiter: Math.round(getUnitPriceLabel(i.quantity, i.purchasePrice, i.unit).perLiter),
      pricePerMilliliter: Math.round(getUnitPriceLabel(i.quantity, i.purchasePrice, i.unit).perMilliliter),
      supplier: i.supplier || '—',
    }));

    const result = await window.electron.exportReport({
      orders: movementRows.map((row, index) => ({
        id: index + 1,
        date: row.date,
        service: row.operation,
        amount: row.amount,
        paymentMethod: '-',
        washer: row.employee,
        licensePlate: row.reason || '-',
        item: row.item,
      })),
      from: monthRange.from.toISOString(),
      to: monthRange.to.toISOString(),
      fileName: `warehouse_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`,
      warehouse: {
        items: itemRows,
        movements: movementRows,
        purchases: purchaseRows,
        expenses: purchaseRows,
        cost: costRows,
      },
    });
    if (!result?.canceled) alert(`Отчёт сохранён: ${result?.filePath}`);
  };

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto glass rounded-xl p-6 text-slate-300">
        Доступ к складу для администратора отключён в настройках организации.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Склад</h1>
          <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-neon rounded-lg px-4 py-2 text-sm">CSV</button>
          <button onClick={exportExcel} className="btn-neon rounded-lg px-4 py-2 text-sm">Excel</button>
          <button onClick={exportPurchasesCsv} className="btn-neon rounded-lg px-4 py-2 text-sm">Закупки CSV</button>
          <button onClick={exportInventoriesCsv} className="btn-neon rounded-lg px-4 py-2 text-sm">Инв. CSV</button>
        </div>
      </div>

      {!canEdit && <div className="glass rounded-xl p-3 text-xs text-slate-400">Режим просмотра: редактирование, закупки и списания доступны только управляющему.</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Всего товаров</p><p className="text-xl font-bold text-white">{items.length}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Товаров мало</p><p className="text-xl font-bold text-amber-400">{lowItems.length}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Закончились</p><p className="text-xl font-bold text-red-400">{outItems.length}</p></div>
        <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400">Стоимость склада</p><p className="text-xl font-bold text-cyan-400">{Math.round(stockCost).toLocaleString('ru-RU')} {activeOrg.currency}</p></div>
      </div>

      {(lowItems.length > 0 || outItems.length > 0) && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Уведомления</h3>
          <div className="space-y-2 text-sm">
            {lowItems.map(i => <div key={`low-${i.id}`} className="text-amber-300">{i.name} заканчивается: {i.quantity} {i.unit} (минимум {i.minQuantity} {i.unit})</div>)}
            {outItems.map(i => <div key={`out-${i.id}`} className="text-red-300">{i.name} закончился: 0 {i.unit} (минимум {i.minQuantity} {i.unit})</div>)}
          </div>
        </div>
      )}

      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Прогноз остатков</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {forecasts.slice(0, 6).map(f => {
            const tone = f.level === 'critical' ? 'text-red-400' : f.level === 'warning' ? 'text-amber-400' : 'text-green-400';
            return (
              <div key={f.itemId} className="rounded-lg border border-white/5 bg-white/3 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white font-medium">{f.itemName}</span>
                  <span className={`text-xs ${tone}`}>{f.level === 'critical' ? 'Критично' : f.level === 'warning' ? 'Мало' : 'Норма'}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Остаток: <span className="text-white">{f.quantity} {f.unit}</span></p>
                <p className="text-xs text-slate-400">Средний расход: <span className="text-white">{f.avgDaily.toFixed(2)} {f.unit}/день</span></p>
                <p className="text-xs text-slate-400">Хватит примерно: <span className={tone}>{f.daysLeft ? `${Math.max(0, Math.round(f.daysLeft))} дн.` : '—'}</span></p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Поставщики</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Название" className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
          <input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} placeholder="Телефон" className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
          <input value={supplierContactPerson} onChange={e => setSupplierContactPerson(e.target.value)} placeholder="Контактное лицо" className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
          <button onClick={addNewSupplier} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canEdit}>Добавить поставщика</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map(supplier => {
            const totals = purchaseTotals[supplier.id] || purchaseTotals[supplier.name] || { count: 0, total: 0 };
            return (
              <div key={supplier.id} className="rounded-lg bg-white/3 border border-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white font-medium">{supplier.name}</span>
                  <span className="text-xs text-slate-500">{totals.count} закупок</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Тел.: {supplier.phone || '—'}</p>
                <p className="text-xs text-slate-400">Контакт: {supplier.contactPerson || '—'}</p>
                <p className="text-xs text-cyan-400 mt-2">Сумма закупок: {Math.round(totals.total).toLocaleString('ru-RU')} {activeOrg.currency}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Категории расходников</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => <span key={c.id} className="px-2 py-1 rounded bg-white/5 text-xs text-slate-300">{c.name}</span>)}
          </div>
          <div className="flex gap-2">
            <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Новая категория" className="input-neon rounded-lg px-3 py-2 text-sm flex-1" disabled={!canEdit} />
            <button onClick={addCategory} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canEdit}>Добавить</button>
          </div>
        </div>

        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Новый товар</h3>
          <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Название" className="input-neon rounded-lg px-3 py-2 text-sm w-full" disabled={!canEdit} />
          <div className="grid grid-cols-2 gap-2">
            <select value={itemCategoryId} onChange={e => setItemCategoryId(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit}>
              <option value="">Категория</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={itemUnit} onChange={e => setItemUnit(e.target.value)} placeholder="Ед. изм." className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={itemQuantity} onChange={e => setItemQuantity(Number(e.target.value))} placeholder="Кол-во" className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
            <input type="number" value={itemMinQuantity} onChange={e => setItemMinQuantity(Number(e.target.value))} placeholder="Мин." className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
            <input type="number" value={itemPurchasePrice} onChange={e => setItemPurchasePrice(Number(e.target.value))} placeholder="Цена" className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
          </div>
          <input value={itemSupplier} onChange={e => setItemSupplier(e.target.value)} placeholder="Поставщик" className="input-neon rounded-lg px-3 py-2 text-sm w-full" disabled={!canEdit} />
          <button onClick={addItem} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canEdit}>Сохранить товар</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Приход товара</h3>
          <select value={incomingItemId} onChange={e => setIncomingItemId(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm w-full" disabled={!canEdit}>
            <option value="">Выберите товар</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select value={incomingSupplierId} onChange={e => setIncomingSupplierId(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm w-full" disabled={!canEdit}>
            <option value="">Выберите поставщика</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={incomingQty} onChange={e => setIncomingQty(Number(e.target.value))} placeholder="Количество" className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
            <input type="number" value={incomingPrice} onChange={e => setIncomingPrice(Number(e.target.value))} placeholder="Цена закупки" className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
          </div>
          <input value={incomingSupplier} onChange={e => setIncomingSupplier(e.target.value)} placeholder="Поставщик" className="input-neon rounded-lg px-3 py-2 text-sm w-full" disabled={!canEdit} />
          <button onClick={addIncoming} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canEdit}>Оформить приход</button>
        </div>

        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Списание материалов</h3>
          <select value={writeoffItemId} onChange={e => setWriteoffItemId(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm w-full" disabled={!canEdit}>
            <option value="">Выберите товар</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={writeoffQty} onChange={e => setWriteoffQty(Number(e.target.value))} placeholder="Количество" className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
            <select value={writeoffType} onChange={e => setWriteoffType(e.target.value as WarehouseMovementType)} className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit}>
              <option value="consumption">Использовано в работе</option>
              <option value="writeoff">Потеря/испорчено</option>
              <option value="correction">Корректировка</option>
            </select>
          </div>
          <input value={writeoffReason} onChange={e => setWriteoffReason(e.target.value)} placeholder="Причина" className="input-neon rounded-lg px-3 py-2 text-sm w-full" disabled={!canEdit} />
          <button onClick={addWriteoff} className="btn-danger rounded-lg px-4 py-2 text-sm" disabled={!canEdit}>Списать</button>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">История закупок</h3>
          <span className="text-xs text-slate-500">Поставщик, дата, товары, количество, сумма, кто добавил</span>
        </div>
        <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs text-slate-400">Дата</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Поставщик</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Товар</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Кол-во</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Сумма</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Кто добавил</th>
              </tr>
            </thead>
            <tbody>
              {movements.filter(m => m.type === 'incoming').length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Закупок пока нет</td></tr>
              ) : movements.filter(m => m.type === 'incoming').map(m => (
                <tr key={m.id} className="border-b border-white/3">
                  <td className="px-4 py-3 text-slate-300 text-xs">{format(new Date(m.createdAt), 'dd.MM.yyyy HH:mm')}</td>
                  <td className="px-4 py-3 text-white">{m.supplierName || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{m.itemName}</td>
                  <td className="px-4 py-3 text-slate-300">{m.quantity} {m.unit}</td>
                  <td className="px-4 py-3 text-cyan-400">{Math.round(m.totalCost || 0).toLocaleString('ru-RU')} {activeOrg.currency}</td>
                  <td className="px-4 py-3 text-slate-300">{m.employeeName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Расход материалов на услугу</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select value={usageServiceId} onChange={e => setUsageServiceId(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit}>
            <option value="">Услуга</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={usageItemId} onChange={e => setUsageItemId(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit}>
            <option value="">Товар</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input type="number" value={usageQty} onChange={e => setUsageQty(Number(e.target.value))} placeholder="Кол-во на услугу" className="input-neon rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
          <button onClick={addUsageRule} className="btn-neon rounded-lg px-4 py-2 text-sm" disabled={!canEdit}>Сохранить</button>
        </div>
        <div className="space-y-2 text-sm">
          {serviceUsages.length === 0 ? <p className="text-slate-500">Правила пока не настроены</p> : serviceUsages.map(u => (
            <div key={u.id} className="flex items-center justify-between rounded bg-white/3 p-2">
              <span className="text-slate-300">{u.serviceName}: {u.itemName} — {u.quantityPerService} {u.unit}</span>
              <div className="flex items-center gap-2">
                {canEdit && <button onClick={() => { editUsage(u); }} className="text-xs text-amber-300">Редактировать</button>}
                {canEdit && <button onClick={() => { if (confirm('Удалить правило расхода?')) { removeServiceMaterialUsage(activeOrg.id, u.serviceId, u.itemId); refresh(); } }} className="text-xs text-red-400">Удалить</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Отчёты склада</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded bg-white/3 p-3 border border-white/5">
            <p className="text-slate-400">За день</p>
            <p className="text-white">Движений: {dayStats.list.length}</p>
            <p className="text-white">Списано (стоимость): {Math.round(dayStats.used).toLocaleString('ru-RU')} {activeOrg.currency}</p>
            <p className="text-white">Закуплено: {Math.round(dayStats.incoming).toLocaleString('ru-RU')} {activeOrg.currency}</p>
          </div>
          <div className="rounded bg-white/3 p-3 border border-white/5">
            <p className="text-slate-400">За месяц</p>
            <p className="text-white">Движений: {monthStats.list.length}</p>
            <p className="text-white">Списано (стоимость): {Math.round(monthStats.used).toLocaleString('ru-RU')} {activeOrg.currency}</p>
            <p className="text-white">Закуплено: {Math.round(monthStats.incoming).toLocaleString('ru-RU')} {activeOrg.currency}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Товары</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs text-slate-400">Название</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Категория</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Остаток</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Мин.</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Цена</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">1 л</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">1 мл</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Поставщик</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const { items: paginatedItems } = calculatePagination(items, itemsPageSize, itemsCurrentPage);
                if (paginatedItems.length === 0) {
                  return (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      {items.length === 0 ? 'Товаров пока нет' : 'Нет товаров на этой странице'}
                    </td></tr>
                  );
                }
                return paginatedItems.map(i => (
                  <tr key={i.id} className="border-b border-white/3" onClick={() => openItemCard(i.id)} style={{ cursor: 'pointer' }}>
                    <td className="px-4 py-3 text-white">{i.name}</td>
                    <td className="px-4 py-3 text-slate-300">{i.categoryName}</td>
                    <td className={`px-4 py-3 ${i.quantity <= 0 ? 'text-red-400' : i.quantity <= i.minQuantity ? 'text-amber-400' : 'text-green-400'}`}>{i.quantity} {i.unit}</td>
                    <td className="px-4 py-3 text-slate-300">{i.minQuantity} {i.unit}</td>
                    <td className="px-4 py-3 text-slate-300">{i.purchasePrice.toLocaleString('ru-RU')}</td>
                    <td className="px-4 py-3 text-slate-300">{Math.round(getUnitPriceLabel(i.quantity, i.purchasePrice, i.unit).perLiter).toLocaleString('ru-RU')}</td>
                    <td className="px-4 py-3 text-slate-300">{Math.round(getUnitPriceLabel(i.quantity, i.purchasePrice, i.unit).perMilliliter).toLocaleString('ru-RU')}</td>
                    <td className="px-4 py-3 text-slate-300">{i.supplier || '—'}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
        
        {/* Pagination for items */}
        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-white/10">
            <PaginationControl
              currentPage={itemsCurrentPage}
              totalPages={Math.ceil(items.length / itemsPageSize)}
              onPageChange={setItemsCurrentPage}
              pageSize={itemsPageSize}
              onPageSizeChange={setItemsPageSize}
              totalItems={items.length}
            />
          </div>
        )}
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 space-y-2">
          <h3 className="text-sm font-semibold text-white">История склада</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Поиск товар/заказ/причина" className="input-neon rounded-lg px-3 py-2 text-sm" />
            <select value={historyType} onChange={e => setHistoryType(e.target.value as 'all' | WarehouseMovementType)} className="input-neon rounded-lg px-3 py-2 text-sm">
              <option value="all">Все операции</option>
              <option value="incoming">Приход</option>
              <option value="consumption">Использовано</option>
              <option value="writeoff">Списание</option>
              <option value="correction">Корректировка</option>
            </select>
            <input type="date" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={historyTo} onChange={e => setHistoryTo(e.target.value)} className="input-neon rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs text-slate-400">Дата</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Товар</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Операция</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Количество</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Стоимость</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Причина</th>
                <th className="px-4 py-3 text-left text-xs text-slate-400">Кто сделал</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Движений нет</td></tr>
              ) : filteredMovements.map(m => (
                <tr key={m.id} className="border-b border-white/3">
                  <td className="px-4 py-3 text-slate-300 text-xs">{format(new Date(m.createdAt), 'dd.MM.yyyy HH:mm')}</td>
                  <td className="px-4 py-3 text-white">{m.itemName}</td>
                  <td className="px-4 py-3 text-slate-300">{MOVEMENT_LABELS[m.type]}</td>
                  <td className="px-4 py-3 text-slate-300">{m.quantity} {m.unit}</td>
                  <td className="px-4 py-3 text-slate-300">{Math.round(m.totalCost || 0).toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{m.reason || '—'} {m.orderNumber ? `(${m.orderNumber})` : ''}</td>
                  <td className="px-4 py-3 text-slate-300">{m.employeeName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedItemId ? (() => {
        const item = items.find(it => it.id === selectedItemId);
        if (!item) return null;
        const itemMovements = getWarehouseMovements(activeOrg.id).filter(m => m.itemId === item.id).slice().sort((a,b)=> new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
        const purchases = getPurchases(activeOrg.id).filter(p => p.items.some((it:any)=>it.itemId === item.id));
        const inventories = getInventories(activeOrg.id).filter(inv => inv.records.some(r => r.itemId === item.id));
        const now = new Date();
        const days = Array.from({ length: 30 }).map(() => 0);
        itemMovements.forEach(m => {
          if (!(m.type === 'consumption' || m.type === 'writeoff' || m.type === 'correction')) return;
          const d = new Date(m.createdAt);
          const diff = Math.floor((now.getTime() - d.getTime()) / (24*60*60*1000));
          if (diff >= 0 && diff < 30) days[29 - diff] += m.quantity;
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={closeItemCard} />
            <div className="relative w-[90%] max-w-4xl bg-white/5 rounded-xl p-5 glass">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg text-white font-semibold">{item.name}</h3>
                  <p className="text-sm text-slate-400">Остаток: <span className="text-white">{item.quantity} {item.unit}</span> | Мин.: {item.minQuantity} | Рекоменд.: {item.recommendedQuantity || '—'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => exportItemCsv(item.id)} className="btn-neon px-3 py-1 text-sm">CSV</button>
                  <button onClick={() => exportItemExcel(item.id)} className="btn-neon px-3 py-1 text-sm">Excel</button>
                  <button onClick={() => exportItemPdf(item.id)} className="btn-neon px-3 py-1 text-sm">PDF</button>
                  <button onClick={closeItemCard} className="btn-neon px-3 py-1 text-sm">Закрыть</button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                <div className="col-span-2 rounded bg-white/3 p-3">
                  <h4 className="text-sm text-white mb-2">История движений</h4>
                  <div className="max-h-64 overflow-y-auto text-sm text-slate-300">
                    {itemMovements.map(m => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/3">
                        <div className="text-xs text-slate-400">{format(new Date(m.createdAt), 'dd.MM.yyyy HH:mm')}</div>
                        <div className="flex-1 px-3">{MOVEMENT_LABELS[m.type]} — {m.quantity} {m.unit} {m.orderNumber ? `(заказ ${m.orderNumber})` : ''}</div>
                        <div className="text-xs text-cyan-400">{Math.round(m.totalCost||0)} {activeOrg.currency}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded bg-white/3 p-3">
                  <h4 className="text-sm text-white mb-2">График расхода (30 дней)</h4>
                  <div className="w-full h-24 flex items-end gap-1">
                    {days.map((val, idx) => {
                      const max = Math.max(...days) || 1;
                      const h = Math.round((val / max) * 100);
                      return <div key={idx} title={`${val} ${item.unit}`} style={{ height: `${h}%` }} className={`flex-1 bg-white/20 rounded-sm`} />;
                    })}
                  </div>
                  <div className="mt-3 text-xs text-slate-400">Прогноз: {item.quantity > 0 && (() => { const avg = days.reduce((s,n)=>s+n,0)/30; const daysLeft = avg>0 ? Math.round(item.quantity/avg) : '—'; return `${daysLeft} дн.`; })()}</div>
                  <div className="mt-3">
                    <h5 className="text-xs text-white mb-1">Закупки</h5>
                    <div className="text-sm text-slate-300 max-h-28 overflow-y-auto">
                      {purchases.map(p => (
                        <div key={p.id} className="py-1 border-b border-white/3">{format(new Date(p.createdAt), 'dd.MM.yyyy')} — {p.supplierName || '—'} — {p.items.filter((it:any)=>it.itemId===item.id).map((it:any)=>`${it.quantity}${item.unit} по ${it.unitPrice}`).join(', ')}</div>
                      ))}
                      {purchases.length === 0 && <div className="text-slate-500">Нет закупок</div>}
                    </div>
                  </div>

                  <div className="mt-3">
                    <h5 className="text-xs text-white mb-1">Инвентаризации</h5>
                    <div className="text-sm text-slate-300 max-h-28 overflow-y-auto">
                      {inventories.map(inv => (
                        <div key={inv.id} className="py-1 border-b border-white/3">{format(new Date(inv.createdAt), 'dd.MM.yyyy')} — {inv.createdBy}</div>
                      ))}
                      {inventories.length === 0 && <div className="text-slate-500">Нет инвентаризаций</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
});
