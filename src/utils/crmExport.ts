import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ActionLog, Client, Order, Organization, Recommendation, Vehicle, Purchase } from '../types';
import { addActionLog, calculateCashSummary } from '../store';
import { generateId } from '../types';
import {
  createSheet,
  createWorksheetFromObjects,
  createWorksheetFromRowArrays,
  downloadWorkbook,
} from './excelUtils';

function saveCsv(fileName: string, rows: Array<Array<string | number>>) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function logExport(org: Organization, title: string, targetId: string, targetName?: string) {
  addActionLog({
    id: generateId(),
    organizationId: org.id,
    performedBy: 'Система',
    action: 'export_report',
    targetType: 'report',
    targetId,
    targetName,
    description: title,
    createdAt: new Date().toISOString(),
  });
}

export function exportClientCsv(org: Organization, client: Client, vehicles: Vehicle[], orders: Order[], recommendations: Recommendation[], logs: ActionLog[]) {
  saveCsv(`${client.fullName.replace(/\s+/g, '_')}_client.csv`, [
    ['Поле', 'Значение'],
    ['Клиент', client.fullName],
    ['Телефон', client.phone || '—'],
    ['Автомобили', vehicles.map(vehicle => vehicle.licensePlate).join('; ') || '—'],
    ['Визиты', client.totalVisits || 0],
    ['Потрачено', client.totalSpent || 0],
    ['Средний чек', client.averageCheck || 0],
    ['Бонусы', client.bonusPoints || 0],
    ['Скидка', client.discountPercent || 0],
    ['VIP', client.isVip ? 'Да' : 'Нет'],
    ['Рекомендации', recommendations.map(item => item.title).join('; ') || '—'],
    ['ActionLog', logs.map(item => `${item.createdAt}: ${item.description || item.action}`).join(' | ') || '—'],
    ['Заказы', orders.map(item => `${item.licensePlate} ${item.totalAmount}`).join(' | ') || '—'],
  ]);
  logExport(org, `Экспорт карточки клиента ${client.fullName} в CSV`, client.id, client.fullName);
}

export async function exportClientExcel(org: Organization, client: Client, vehicles: Vehicle[], orders: Order[], recommendations: Recommendation[], logs: ActionLog[]) {
  const workbook = new ExcelJS.Workbook();
  createWorksheetFromRowArrays(workbook, 'Профиль', [
    ['Поле', 'Значение'],
    ['Клиент', client.fullName],
    ['Телефон', client.phone || '—'],
    ['Автомобили', vehicles.map(vehicle => vehicle.licensePlate).join(', ') || '—'],
    ['Визиты', client.totalVisits || 0],
    ['Потрачено', client.totalSpent || 0],
    ['Средний чек', client.averageCheck || 0],
    ['Бонусы', client.bonusPoints || 0],
    ['Скидка', client.discountPercent || 0],
    ['VIP', client.isVip ? 'Да' : 'Нет'],
  ]);
  createWorksheetFromObjects(workbook, 'Заказы', orders.map(order => ({
    Дата: order.completedAt || order.createdAt,
    Госномер: order.licensePlate,
    Услуги: order.services.map(service => service.serviceName).join(', '),
    Сумма: order.totalAmount,
    Мойщик: order.washerName || '',
    Бокс: order.boxName || '',
  })), [20, 15, 40, 15, 20, 15], [3]);
  createWorksheetFromObjects(workbook, 'Рекомендации', recommendations.map(item => ({ Приоритет: item.priority, Заголовок: item.title, Описание: item.description || '' })), [15, 30, 40]);
  createWorksheetFromObjects(workbook, 'ActionLog', logs.map(item => ({ Дата: item.createdAt, Действие: item.description || item.action, Кто: item.performedBy })), [20, 40, 20]);
  await downloadWorkbook(workbook, `${client.fullName.replace(/\s+/g, '_')}_client.xlsx`);
  logExport(org, `Экспорт карточки клиента ${client.fullName} в Excel`, client.id, client.fullName);
}

export function exportClientPdf(org: Organization, client: Client, vehicles: Vehicle[], orders: Order[], recommendations: Recommendation[], logs: ActionLog[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Client CRM: ${client.fullName}`, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [['Поле', 'Значение']],
    body: [
      ['Телефон', client.phone || '—'],
      ['Автомобили', vehicles.map(vehicle => vehicle.licensePlate).join(', ') || '—'],
      ['Визиты', String(client.totalVisits || 0)],
      ['Потрачено', String(client.totalSpent || 0)],
      ['Средний чек', String(client.averageCheck || 0)],
      ['Бонусы', String(client.bonusPoints || 0)],
      ['Скидка', `${client.discountPercent || 0}%`],
      ['VIP', client.isVip ? 'Да' : 'Нет'],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Дата', 'Госномер', 'Сумма']],
    body: orders.slice(0, 10).map(order => [order.completedAt || order.createdAt, order.licensePlate, String(order.totalAmount)]),
    theme: 'grid',
    styles: { fontSize: 8 },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Рекомендация', 'Описание']],
    body: recommendations.slice(0, 5).map(item => [item.title, item.description || '—']),
    theme: 'grid',
    styles: { fontSize: 8 },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Дата', 'ActionLog']],
    body: logs.slice(0, 8).map(item => [item.createdAt, item.description || item.action]),
    theme: 'grid',
    styles: { fontSize: 8 },
  });
  doc.save(`${client.fullName.replace(/\s+/g, '_')}_client.pdf`);
  logExport(org, `Экспорт карточки клиента ${client.fullName} в PDF`, client.id, client.fullName);
}

export function exportVehicleCsv(org: Organization, vehicle: Vehicle, orders: Order[], ownerName?: string) {
  saveCsv(`${vehicle.licensePlate}_vehicle.csv`, [
    ['Поле', 'Значение'],
    ['Госномер', vehicle.licensePlate],
    ['Владелец', ownerName || '—'],
    ['Визиты', vehicle.visitsCount || 0],
    ['Потрачено', vehicle.totalSpent || 0],
    ['Последний визит', vehicle.lastVisitAt || '—'],
    ['Заказы', orders.map(order => `${order.completedAt || order.createdAt} ${order.totalAmount}`).join(' | ') || '—'],
  ]);
  logExport(org, `Экспорт автомобиля ${vehicle.licensePlate} в CSV`, vehicle.id, vehicle.licensePlate);
}

export async function exportVehicleExcel(org: Organization, vehicle: Vehicle, orders: Order[], ownerName?: string) {
  const workbook = new ExcelJS.Workbook();
  createWorksheetFromRowArrays(workbook, 'Автомобиль', [
    ['Поле', 'Значение'],
    ['Госномер', vehicle.licensePlate],
    ['Владелец', ownerName || '—'],
    ['Визиты', vehicle.visitsCount || 0],
    ['Потрачено', vehicle.totalSpent || 0],
    ['Последний визит', vehicle.lastVisitAt || '—'],
  ]);
  createWorksheetFromObjects(workbook, 'История', orders.map(order => ({
    Дата: order.completedAt || order.createdAt,
    Услуги: order.services.map(service => service.serviceName).join(', '),
    Сумма: order.totalAmount,
    Мойщик: order.washerName || '',
    Бокс: order.boxName || '',
  })), [20, 40, 15, 20, 15], [2]);
  await downloadWorkbook(workbook, `${vehicle.licensePlate}_vehicle.xlsx`);
  logExport(org, `Экспорт автомобиля ${vehicle.licensePlate} в Excel`, vehicle.id, vehicle.licensePlate);
}

export function exportVehiclePdf(org: Organization, vehicle: Vehicle, orders: Order[], ownerName?: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Vehicle CRM: ${vehicle.licensePlate}`, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [['Поле', 'Значение']],
    body: [
      ['Владелец', ownerName || '—'],
      ['Визиты', String(vehicle.visitsCount || 0)],
      ['Потрачено', String(vehicle.totalSpent || 0)],
      ['Последний визит', vehicle.lastVisitAt || '—'],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Дата', 'Услуги', 'Сумма']],
    body: orders.slice(0, 10).map(order => [order.completedAt || order.createdAt, order.services.map(service => service.serviceName).join(', '), String(order.totalAmount)]),
    theme: 'grid',
    styles: { fontSize: 8 },
  });
  doc.save(`${vehicle.licensePlate}_vehicle.pdf`);
  logExport(org, `Экспорт автомобиля ${vehicle.licensePlate} в PDF`, vehicle.id, vehicle.licensePlate);
}

export function exportWarehousePdf(org: Organization, items: any[], movements: any[], purchases: Purchase[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Warehouse Report: ${org.name}`, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [['Товар', 'Категория', 'Остаток', 'Ед.', 'Мин.остаток', 'Цена']],
    body: items.slice(0, 100).map(i => [i.name, i.categoryName || '—', String(i.quantity), i.unit, String(i.minQuantity || 0), String(i.purchasePrice || 0)]),
    theme: 'grid',
    styles: { fontSize: 8 },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Дата', 'Товар', 'Операция', 'Кол-во', 'Ед.', 'Сумма', 'Причина']],
    body: movements.slice(0, 200).map(m => [m.createdAt, m.itemName, m.type, String(m.quantity), m.unit, String(m.totalCost || 0), m.reason || '']),
    theme: 'grid',
    styles: { fontSize: 8 },
  });
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Дата', 'Поставщик', 'Товар', 'Кол-во', 'Цена', 'Сумма']],
    body: purchases.slice(0, 200).map(p => [p.createdAt, p.supplierName || '—', p.items.map((it: any) => it.itemName).join(', '), p.items.map((it: any) => String(it.quantity)).join(', '), p.items.map((it: any) => String(it.unitPrice)).join(', '), String(p.total)]),
    theme: 'grid',
    styles: { fontSize: 8 },
  });
  doc.save(`warehouse_${org.id}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.pdf`);
  addActionLog({
    id: generateId(),
    organizationId: org.id,
    performedBy: 'Система',
    action: 'export_report',
    targetType: 'report',
    targetId: org.id,
    targetName: 'Warehouse report',
    description: 'Экспорт отчёта склада в PDF',
    createdAt: new Date().toISOString(),
  });
}

export async function exportClientsList(org: Organization, clients: Client[], vehicles: Vehicle[], formatType: 'csv' | 'xlsx' | 'pdf') {
  const rows = clients.map(client => ({
    Клиент: client.fullName,
    Телефон: client.phone || '—',
    Госномер: vehicles.filter(vehicle => vehicle.clientId === client.id).map(vehicle => vehicle.licensePlate).join(', '),
    Визиты: client.totalVisits || 0,
    Потрачено: client.totalSpent || 0,
    CRMScore: client.crmScore || 0,
  }));
  if (formatType === 'csv') {
    saveCsv(`clients_${org.id}.csv`, [['Клиент', 'Телефон', 'Госномер', 'Визиты', 'Потрачено', 'CRM Score'], ...rows.map(row => [row.Клиент, row.Телефон, row.Госномер, row.Визиты, row.Потрачено, row.CRMScore])]);
  } else if (formatType === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    createWorksheetFromObjects(workbook, 'Клиенты', rows, [25, 20, 20, 15, 15, 15], [2, 4]);
    await downloadWorkbook(workbook, `clients_${org.id}.xlsx`);
  } else {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Clients CRM', 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Клиент', 'Телефон', 'Госномер', 'Визиты', 'Потрачено', 'CRM Score']],
      body: rows.map(row => [row.Клиент, row.Телефон, row.Госномер, String(row.Визиты), String(row.Потрачено), String(row.CRMScore)]),
      theme: 'grid',
      styles: { fontSize: 8 },
    });
    doc.save(`clients_${org.id}.pdf`);
  }
  logExport(org, `Экспорт списка клиентов (${formatType.toUpperCase()})`, org.id, org.name);
}

export async function exportClientHistory(org: Organization, clients: Client[], orders: Order[], formatType: 'csv' | 'xlsx' | 'pdf') {
  const clientMap = new Map(clients.map(client => [client.id, client]));
  const rows = orders.map(order => {
    const client = clientMap.get(order.clientId || '');
    return {
      Клиент: order.clientName || client?.fullName || '—',
      Телефон: client?.phone || order.clientPhone || '—',
      Госномер: order.licensePlate || '—',
      Дата: order.completedAt || order.createdAt,
      Услуги: order.services.map(service => service.serviceName).join(', '),
      Сумма: order.totalAmount,
      Скидка: order.discountAmount || 0,
      Бонусы: order.bonusApplied || 0,
      Оплата: order.paymentMethod || '—',
      Статус: order.status,
      Мойщик: order.washerName || '—',
      Бокс: order.boxName || '—',
    };
  });

  if (formatType === 'csv') {
    saveCsv(`client_history_${org.id}.csv`, [
      ['Клиент', 'Телефон', 'Госномер', 'Дата', 'Услуги', 'Сумма', 'Скидка', 'Бонусы', 'Оплата', 'Статус', 'Мойщик', 'Бокс'],
      ...rows.map(row => [row.Клиент, row.Телефон, row.Госномер, row.Дата, row.Услуги, row.Сумма, row.Скидка, row.Бонусы, row.Оплата, row.Статус, row.Мойщик, row.Бокс]),
    ]);
  } else if (formatType === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    createWorksheetFromObjects(workbook, 'История заказов', rows, [20, 15, 15, 20, 35, 12, 12, 12, 15, 12, 15, 15]);
    const clientRows = clients.map(client => ({
      Клиент: client.fullName,
      Телефон: client.phone || '—',
      Визиты: client.totalVisits || 0,
      Потрачено: client.totalSpent || 0,
      Бонусы: client.bonusPoints || 0,
      Скидка: client.discountPercent || 0,
      VIP: client.isVip ? 'Да' : 'Нет',
    }));
    createWorksheetFromObjects(workbook, 'Клиенты', clientRows, [25, 20, 12, 12, 12, 12, 10]);
    await downloadWorkbook(workbook, `client_history_${org.id}.xlsx`);
  } else {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Client History', 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Клиент', 'Телефон', 'Госномер', 'Дата', 'Сумма', 'Бонусы', 'Оплата', 'Статус']],
      body: rows.slice(0, 50).map(row => [row.Клиент, row.Телефон, row.Госномер, row.Дата, String(row.Сумма), String(row.Бонусы), row.Оплата, row.Статус]),
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
    });
    doc.save(`client_history_${org.id}.pdf`);
  }
  logExport(org, `Экспорт истории клиентов (${formatType.toUpperCase()})`, org.id, org.name);
}

export async function exportRecommendations(org: Organization, recommendations: Array<{ clientName: string; title: string; priority: number; description?: string }>, formatType: 'csv' | 'xlsx' | 'pdf') {
  if (formatType === 'csv') {
    saveCsv(`crm_recommendations_${org.id}.csv`, [['Клиент', 'Приоритет', 'Рекомендация', 'Описание'], ...recommendations.map(item => [item.clientName, item.priority, item.title, item.description || ''])]);
  } else if (formatType === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    createWorksheetFromObjects(workbook, 'Рекомендации', recommendations, [20, 12, 25, 40]);
    await downloadWorkbook(workbook, `crm_recommendations_${org.id}.xlsx`);
  } else {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('CRM Recommendations', 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Клиент', 'Приоритет', 'Рекомендация', 'Описание']],
      body: recommendations.map(item => [item.clientName, String(item.priority), item.title, item.description || '']),
      theme: 'grid',
      styles: { fontSize: 8 },
    });
    doc.save(`crm_recommendations_${org.id}.pdf`);
  }
  logExport(org, `Экспорт рекомендаций CRM (${formatType.toUpperCase()})`, org.id, org.name);
}

export async function exportDashboard(org: Organization, rows: Array<{ metric: string; value: string | number }>, formatType: 'csv' | 'xlsx' | 'pdf') {
  if (formatType === 'csv') {
    saveCsv(`crm_dashboard_${org.id}.csv`, [['Показатель', 'Значение'], ...rows.map(item => [item.metric, item.value])]);
  } else if (formatType === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    createWorksheetFromObjects(workbook, 'Dashboard', rows, [30, 20]);
    await downloadWorkbook(workbook, `crm_dashboard_${org.id}.xlsx`);
  } else {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('CRM Dashboard', 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Показатель', 'Значение']],
      body: rows.map(item => [item.metric, String(item.value)]),
      theme: 'grid',
      styles: { fontSize: 9 },
    });
    doc.save(`crm_dashboard_${org.id}.pdf`);
  }
  logExport(org, `Экспорт CRM dashboard (${formatType.toUpperCase()})`, org.id, org.name);
}

export async function exportCashJournalExcel(org: Organization, orders: Order[], fromISO: string, toISO: string, fileName?: string) {
  const workbook = new ExcelJS.Workbook();
  const period = `${fromISO.slice(0,10)} - ${toISO.slice(0,10)}`;
  const detailHeader = ['№', 'Дата', 'Время', 'Номер заказа', 'Клиент', 'Автомобиль', 'Сотрудник', 'Услуга', 'Сумма', 'Скидка', 'Бонусы', 'Итог', 'Kaspi QR', 'Наличные', 'Банковская карта', 'Перевод', 'Прочие', 'Способ оплаты'];

  const normalize = (s?: string) => (s || '').toString().toLowerCase();
  const detailRows: Array<Array<string | number>> = orders.map((o, idx) => {
    const date = new Date(o.completedAt || o.createdAt);
    const dateOnly = date.toISOString().slice(0, 10);
    const timeOnly = date.toTimeString().slice(0, 5);
    let kaspi = 0, cash = 0, card = 0, transfer = 0, other = 0;
    if (o.paymentParts && o.paymentParts.length > 0) {
      o.paymentParts.forEach(p => {
        const m = normalize(p.method);
        if (m.includes('kaspi') || m.includes('qr')) kaspi += p.amount;
        else if (m.includes('нал') || m.includes('cash')) cash += p.amount;
        else if (m.includes('card') || m.includes('карта')) card += p.amount;
        else if (m.includes('transfer') || m.includes('перевод')) transfer += p.amount;
        else other += p.amount;
      });
    } else {
      const m = normalize(o.paymentMethod);
      if (m.includes('kaspi') || m.includes('qr')) kaspi = o.totalAmount;
      else if (m.includes('нал') || m.includes('cash')) cash = o.totalAmount;
      else if (m.includes('card') || m.includes('карта')) card = o.totalAmount;
      else if (m.includes('transfer') || m.includes('перевод')) transfer = o.totalAmount;
      else other = o.totalAmount;
    }
    const final = o.totalAmount - (o.discountAmount || 0) - (o.refundAmount || 0);
    return [
      idx + 1,
      dateOnly,
      timeOnly,
      o.orderNumber || o.id,
      o.clientName || '-',
      o.licensePlate || '-',
      o.washerName || '-',
      o.services.map(s => s.serviceName).join(', '),
      o.totalAmount,
      o.discountAmount || 0,
      o.bonusApplied || 0,
      final,
      kaspi,
      cash,
      card,
      transfer,
      other,
      o.paymentMethod || '-',
    ];
  });

  createSheet(workbook, 'Детализация операций', 'Детализация операций', period, detailHeader, detailRows, [8,9,10,11,12,13,14,15,16]);

  const paymentTotals: Record<string, number> = {};
  orders.forEach(o => {
    if (o.paymentParts && o.paymentParts.length > 0) {
      o.paymentParts.forEach(p => {
        const method = p.method || 'Прочие';
        paymentTotals[method] = (paymentTotals[method] || 0) + p.amount;
      });
    } else {
      const method = o.paymentMethod || 'Прочие';
      paymentTotals[method] = (paymentTotals[method] || 0) + o.totalAmount;
    }
  });
  const paymentRows = Object.entries(paymentTotals).map(([method, amount]) => [method, amount]);
  createSheet(workbook, 'Итоги по способам оплаты', 'Итоги по способам оплаты', period, ['Способ оплаты', 'Сумма'], paymentRows, [1]);

  const dayRows: Array<Array<string | number>> = [];
  const from = new Date(fromISO);
  const to = new Date(toISO);
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    const cs = calculateCashSummary(org.id, start.toISOString(), end.toISOString());
    const revenue = cs.income || 0;
    const ordersCount = cs.checksCount || 0;
    const avg = ordersCount ? Math.round(revenue / ordersCount) : 0;
    dayRows.push([start.toISOString().slice(0, 10), revenue, ordersCount, avg, cs.cashIncome || 0, cs.kaspiIncome || 0, cs.cardIncome || 0, cs.transferIncome || 0, cs.discounts || 0, cs.bonusIncome || 0, cs.refunds || 0, cs.expense || 0, revenue - (cs.expense || 0)]);
  }
  createSheet(workbook, 'По дням', 'По дням', period, ['Дата', 'Выручка', 'Заказов', 'Средний чек', 'Наличные', 'Kaspi QR', 'Карта', 'Перевод', 'Скидки', 'Бонусы', 'Возвраты', 'Расходы', 'Чистая прибыль'], dayRows, [1,4,5,6,7,8,9,10,11,12]);

  const monthRows: Array<Array<string | number>> = [];
  const monthCursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (monthCursor <= to) {
    const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const cs = calculateCashSummary(org.id, monthStart.toISOString(), monthEnd.toISOString());
    const revenue = cs.income || 0;
    const ordersCount = cs.checksCount || 0;
    const avg = ordersCount ? Math.round(revenue / ordersCount) : 0;
    monthRows.push([`${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`, revenue, ordersCount, avg, cs.cashIncome || 0, cs.kaspiIncome || 0, cs.cardIncome || 0, cs.transferIncome || 0, cs.discounts || 0, cs.bonusIncome || 0, cs.refunds || 0, cs.expense || 0, revenue - (cs.expense || 0)]);
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }
  createSheet(workbook, 'По месяцам', 'По месяцам', period, ['Месяц', 'Выручка', 'Заказов', 'Средний чек', 'Наличные', 'Kaspi QR', 'Карта', 'Перевод', 'Скидки', 'Бонусы', 'Возвраты', 'Расходы', 'Чистая прибыль'], monthRows, [1,4,5,6,7,8,9,10,11,12]);

  const name = fileName || `cash_journal_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.xlsx`;
  await downloadWorkbook(workbook, name);
  addActionLog({
    id: generateId(),
    organizationId: org.id,
    performedBy: 'Система',
    action: 'export_report',
    targetType: 'report',
    targetId: org.id,
    targetName: 'Cash journal',
    description: `Экспорт кассового журнала ${fromISO} - ${toISO}`,
    createdAt: new Date().toISOString(),
  });
}

export async function exportCashSummaryExcel(org: Organization, summary: any, fromISO: string, toISO: string, fileName?: string) {
  const workbook = new ExcelJS.Workbook();
  const period = `${fromISO.slice(0,10)} - ${toISO.slice(0,10)}`;
  const summaryRows = [
    ['Показатель', 'Значение'],
    ['Период', period],
    ['Оборот', summary.turnover || 0],
    ['Выручка', summary.income || 0],
    ['Наличные', summary.cashIncome || 0],
    ['Kaspi QR', summary.kaspiIncome || 0],
    ['Карта', summary.cardIncome || 0],
    ['QR', summary.qrIncome || 0],
    ['Перевод', summary.transferIncome || 0],
    ['Смешанная', summary.mixedIncome || 0],
    ['Бонусы', summary.bonusIncome || 0],
    ['Возвраты', summary.refunds || 0],
    ['Скидки', summary.discounts || 0],
    ['Расходы', summary.expense || 0],
    ['Чеки', summary.checksCount || 0],
    ['Средний чек', summary.averageCheck || 0],
    ['Чистая касса', summary.result || ((summary.income || 0) - (summary.expense || 0))],
  ];
  createSheet(workbook, 'Сводка', 'Сводка', period, ['Показатель', 'Значение'], summaryRows.slice(2), [1]);

  const methodRows = [
    ['Kaspi QR', summary.kaspiIncome || 0],
    ['Наличные', summary.cashIncome || 0],
    ['Банковская карта', summary.cardIncome || 0],
    ['QR', summary.qrIncome || 0],
    ['Перевод', summary.transferIncome || 0],
    ['Смешанная', summary.mixedIncome || 0],
    ['Бонусы', summary.bonusIncome || 0],
    ['Возвраты', summary.refunds || 0],
    ['Скидки', summary.discounts || 0],
    ['Расходы', summary.expense || 0],
  ];
  createSheet(workbook, 'Итоги по способам оплаты', 'Итоги по способам оплаты', period, ['Способ оплаты', 'Сумма'], methodRows, [1]);

  const from = new Date(fromISO);
  const to = new Date(toISO);
  const dayRows: Array<Array<string | number>> = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const start = new Date(d); start.setHours(0,0,0,0);
    const end = new Date(d); end.setHours(23,59,59,999);
    const cs = calculateCashSummary(org.id, start.toISOString(), end.toISOString());
    const revenue = cs.income || 0;
    const ordersCount = cs.checksCount || 0;
    const avg = ordersCount ? Math.round(revenue / ordersCount) : 0;
    dayRows.push([start.toISOString().slice(0,10), revenue, ordersCount, avg, cs.cashIncome || 0, cs.kaspiIncome || 0, cs.cardIncome || 0, cs.transferIncome || 0, cs.discounts || 0, cs.bonusIncome || 0, cs.refunds || 0, cs.expense || 0, revenue - (cs.expense || 0)]);
  }
  createSheet(workbook, 'По дням', 'По дням', period, ['Дата', 'Выручка', 'Заказов', 'Средний чек', 'Наличные', 'Kaspi QR', 'Карта', 'Перевод', 'Скидки', 'Бонусы', 'Возвраты', 'Расходы', 'Чистая прибыль'], dayRows, [1,4,5,6,7,8,9,10,11,12]);

  const monthRows: Array<Array<string | number>> = [];
  const monthCursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (monthCursor <= to) {
    const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const cs = calculateCashSummary(org.id, monthStart.toISOString(), monthEnd.toISOString());
    const revenue = cs.income || 0;
    const ordersCount = cs.checksCount || 0;
    const avg = ordersCount ? Math.round(revenue / ordersCount) : 0;
    monthRows.push([`${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`, revenue, ordersCount, avg, cs.cashIncome || 0, cs.kaspiIncome || 0, cs.cardIncome || 0, cs.transferIncome || 0, cs.discounts || 0, cs.bonusIncome || 0, cs.refunds || 0, cs.expense || 0, revenue - (cs.expense || 0)]);
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }
  createSheet(workbook, 'По месяцам', 'По месяцам', period, ['Месяц', 'Выручка', 'Заказов', 'Средний чек', 'Наличные', 'Kaspi QR', 'Карта', 'Перевод', 'Скидки', 'Бонусы', 'Возвраты', 'Расходы', 'Чистая прибыль'], monthRows, [1,4,5,6,7,8,9,10,11,12]);

  const name = fileName || `cash_summary_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.xlsx`;
  await downloadWorkbook(workbook, name);
  addActionLog({
    id: generateId(),
    organizationId: org.id,
    performedBy: 'Система',
    action: 'export_report',
    targetType: 'report',
    targetId: org.id,
    targetName: 'Cash summary',
    description: `Экспорт кассовой сводки ${fromISO} - ${toISO}`,
    createdAt: new Date().toISOString(),
  });
}

export function exportCashPdf(org: Organization, orders: Order[], summary: any, fromISO: string, toISO: string, fileName?: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Кассовый отчёт: ${org.name}`, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [['Показатель', 'Значение']],
    body: [
      ['Период', `${fromISO.slice(0,10)} - ${toISO.slice(0,10)}`],
      ['Оборот', String(summary.turnover || 0)],
      ['Выручка', String(summary.income || 0)],
      ['Наличные', String(summary.cashIncome || 0)],
      ['Карта', String(summary.cardIncome || 0)],
      ['QR', String(summary.qrIncome || 0)],
      ['Перевод', String(summary.transferIncome || 0)],
      ['Смешанная', String(summary.mixedIncome || 0)],
      ['Бонусы', String(summary.bonusIncome || 0)],
      ['Возвраты', String(summary.refunds || 0)],
      ['Скидки', String(summary.discounts || 0)],
      ['Чеки', String(summary.checksCount || 0)],
      ['Средний чек', String(summary.averageCheck || 0)],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Дата', 'Номер', 'Госномер', 'Услуги', 'Мойщик', 'Сумма', 'Способ', 'Детали']],
    body: orders.slice(0, 500).map(o => [
      o.completedAt || o.createdAt,
      o.orderNumber || o.id,
      o.licensePlate || '-',
      o.services.map(s => s.serviceName).join(', '),
      o.washerName || '-',
      String(o.totalAmount),
      o.paymentMethod || '-',
      o.paymentParts && o.paymentParts.length > 0 ? o.paymentParts.map(p => `${p.method}: ${p.amount}`).join('; ') : (o.paymentMethod || '-'),
    ]),
    theme: 'grid',
    styles: { fontSize: 8 },
  });

  const name = fileName || `cash_report_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.pdf`;
  doc.save(name);
  addActionLog({
    id: generateId(),
    organizationId: org.id,
    performedBy: 'Система',
    action: 'export_report',
    targetType: 'report',
    targetId: org.id,
    targetName: 'Cash PDF',
    description: `Экспорт кассового PDF отчёта ${fromISO} - ${toISO}`,
    createdAt: new Date().toISOString(),
  });
}

export async function exportEmployeeReportExcel(org: Organization, orders: Order[], fromISO: string, toISO: string, fileName?: string) {
  const workbook = new ExcelJS.Workbook();
  const map: Record<string, { name: string; count: number; revenue: number }> = {};
  orders.forEach(o => {
    const name = o.washerName || 'Не указан';
    if (!map[name]) map[name] = { name, count: 0, revenue: 0 };
    map[name].count++;
    map[name].revenue += o.totalAmount;
  });
  const rows = Object.values(map).map(m => ({ Мойщик: m.name, Заказов: m.count, Выручка: m.revenue, 'Средний чек': m.count ? Math.round(m.revenue / m.count) : 0, 'Процент зарплаты': org.washerPercent || 0, 'Зарплата (расч.)': Math.round((org.washerPercent || 0) / 100 * m.revenue) }));
  createWorksheetFromObjects(workbook, 'Мойщики', rows, [20, 10, 15, 15, 15, 20], [2, 5]);
  await downloadWorkbook(workbook, fileName || `employees_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.xlsx`);
  addActionLog({ id: generateId(), organizationId: org.id, performedBy: 'Система', action: 'export_report', targetType: 'report', targetId: org.id, targetName: 'Employee report', description: `Экспорт отчёта по сотрудникам ${fromISO} - ${toISO}`, createdAt: new Date().toISOString() });
}

export async function exportServiceReportExcel(org: Organization, orders: Order[], fromISO: string, toISO: string, fileName?: string) {
  const workbook = new ExcelJS.Workbook();
  const map: Record<string, { name: string; count: number; revenue: number }> = {};
  orders.forEach(o => {
    o.services.forEach(s => {
      if (!map[s.serviceName]) map[s.serviceName] = { name: s.serviceName, count: 0, revenue: 0 };
      map[s.serviceName].count++;
      map[s.serviceName].revenue += s.price;
    });
  });
  const rows = Object.values(map).map(m => ({ Услуга: m.name, Количество: m.count, 'Сумма': m.revenue }));
  rows.sort((a,b) => b['Сумма'] - a['Сумма']);
  createWorksheetFromObjects(workbook, 'Услуги', rows, [30, 12, 15], [2]);
  await downloadWorkbook(workbook, fileName || `services_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.xlsx`);
  addActionLog({ id: generateId(), organizationId: org.id, performedBy: 'Система', action: 'export_report', targetType: 'report', targetId: org.id, targetName: 'Service report', description: `Экспорт отчёта по услугам ${fromISO} - ${toISO}`, createdAt: new Date().toISOString() });
}

export function exportEmployeeReportPdf(org: Organization, orders: Order[], fromISO: string, toISO: string) {
  const map: Record<string, { name: string; count: number; revenue: number }> = {};
  orders.forEach(o => {
    const name = o.washerName || 'Не указан';
    if (!map[name]) map[name] = { name, count: 0, revenue: 0 };
    map[name].count++;
    map[name].revenue += o.totalAmount;
  });
  const rows = Object.values(map).map(m => [m.name, String(m.count), String(m.revenue), String(m.count ? Math.round(m.revenue / m.count) : 0), String(org.washerPercent || 0), String(Math.round((org.washerPercent || 0) / 100 * m.revenue))]);
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Отчёт по сотрудникам`, 14, 16);
  autoTable(doc, { startY: 22, head: [['Мойщик','Заказов','Выручка','Средний чек','Процент зарплаты','Зарплата']], body: rows, theme: 'grid', styles: { fontSize: 9 } });
  doc.save(`employees_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.pdf`);
  addActionLog({ id: generateId(), organizationId: org.id, performedBy: 'Система', action: 'export_report', targetType: 'report', targetId: org.id, targetName: 'Employee PDF', description: `Экспорт PDF отчёта по сотрудникам ${fromISO} - ${toISO}`, createdAt: new Date().toISOString() });
}

export function exportServiceReportPdf(org: Organization, orders: Order[], fromISO: string, toISO: string) {
  const map: Record<string, { name: string; count: number; revenue: number }> = {};
  orders.forEach(o => {
    o.services.forEach(s => {
      if (!map[s.serviceName]) map[s.serviceName] = { name: s.serviceName, count: 0, revenue: 0 };
      map[s.serviceName].count++;
      map[s.serviceName].revenue += s.price;
    });
  });
  const rows = Object.values(map).map(m => [m.name, String(m.count), String(m.revenue)]).sort((a,b) => Number(b[2]) - Number(a[2]));
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Отчёт по услугам`, 14, 16);
  autoTable(doc, { startY: 22, head: [['Услуга','Количество','Сумма']], body: rows, theme: 'grid', styles: { fontSize: 9 } });
  doc.save(`services_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.pdf`);
  addActionLog({ id: generateId(), organizationId: org.id, performedBy: 'Система', action: 'export_report', targetType: 'report', targetId: org.id, targetName: 'Service PDF', description: `Экспорт PDF отчёта по услугам ${fromISO} - ${toISO}`, createdAt: new Date().toISOString() });
}
