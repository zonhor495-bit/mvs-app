import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Organization } from '../types';
import { addActionLog, calculateIncome, calculateExpenses, calculateProfit, getExpenseRecords, getPayrollRecords } from '../store';
import { generateId } from '../types';
import { createSheet, createWorksheetFromObjects, downloadWorkbook } from './excelUtils';

// @ts-ignore - saveCsv may be used in future CSV exports
function saveCsv(fileName: string, rows: Array<Array<string | number>>) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function logExport(org: Organization, title: string) {
  addActionLog({
    id: generateId(),
    organizationId: org.id,
    performedBy: 'Система',
    action: 'export_report',
    targetType: 'report',
    targetId: org.id,
    targetName: title,
    description: title,
    createdAt: new Date().toISOString(),
  });
}


export async function exportFinanceJournalExcel(org: Organization, fromISO: string, toISO: string, fileName?: string) {
  const workbook = new ExcelJS.Workbook();
  const period = `${fromISO.slice(0,10)} - ${toISO.slice(0,10)}`;

  const income = calculateIncome(org.id, fromISO, toISO);
  const expenses = calculateExpenses(org.id, fromISO, toISO);
  const profit = calculateProfit(org.id, fromISO, toISO);

  const summaryRows = [
    ['Показатель', 'Значение'],
    ['Доходы', income],
    ['Расходы', expenses],
    ['Чистая прибыль', profit],
    ['Рентабельность (%)', income > 0 ? Math.round((profit / income) * 100) : 0],
  ];
  createSheet(workbook, 'Сводка', 'Финансовый журнал', period, ['Показатель', 'Значение'], summaryRows.slice(1), [1]);

  const expenseRecords = getExpenseRecords(org.id).filter(e => {
    const eTime = new Date(e.date).getTime();
    const fromTime = new Date(fromISO).getTime();
    const toTime = new Date(toISO).getTime();
    return eTime >= fromTime && eTime <= toTime;
  });

  const expenseRows = expenseRecords.map(e => ({
    Дата: e.date.slice(0, 10),
    Категория: e.category,
    Комментарий: e.comment || '—',
    Сотрудник: e.employeeName || '—',
    Сумма: e.amount,
  }));

  const expenseCategoryTotals: Record<string, number> = {};
  expenseRecords.forEach(e => {
    expenseCategoryTotals[e.category] = (expenseCategoryTotals[e.category] || 0) + e.amount;
  });

  const categoryRows = Object.entries(expenseCategoryTotals).map(([cat, amount]) => ({
    Категория: cat,
    Итого: amount,
  }));

  createWorksheetFromObjects(workbook, 'Расходы', expenseRows, [15, 20, 25, 20, 12], [4]);
  createWorksheetFromObjects(workbook, 'По категориям', categoryRows, [20, 12], [1]);

  const payrollRecords = getPayrollRecords(org.id).filter(p => {
    const pTime = new Date(p.createdAt).getTime();
    const fromTime = new Date(fromISO).getTime();
    const toTime = new Date(toISO).getTime();
    return pTime >= fromTime && pTime <= toTime;
  });

  const payrollRows = payrollRecords.map(p => ({
    Сотрудник: p.employeeName,
    'Период с': p.periodFrom.slice(0, 10),
    'Период по': p.periodTo.slice(0, 10),
    'Выполнено работ': p.completedWorksCount,
    'Выручка': p.revenue,
    'Процент': p.percent,
    'Начислено': p.accrued,
    'Выплачено': p.paid,
    'Статус': p.paidAt ? 'Выплачена' : 'К выплате',
  }));

  createWorksheetFromObjects(workbook, 'Зарплаты', payrollRows, [20, 15, 15, 12, 12, 12, 12, 12, 12]);

  const name = fileName || `finance_journal_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.xlsx`;
  await downloadWorkbook(workbook, name);
  logExport(org, `Экспорт финансового журнала ${fromISO} - ${toISO}`);
}

export async function exportProfitReportExcel(org: Organization, fromISO: string, toISO: string, fileName?: string) {
  const workbook = new ExcelJS.Workbook();
  const period = `${fromISO.slice(0,10)} - ${toISO.slice(0,10)}`;

  const income = calculateIncome(org.id, fromISO, toISO);
  const expenses = calculateExpenses(org.id, fromISO, toISO);
  const profit = calculateProfit(org.id, fromISO, toISO);

  const summaryRows = [
    ['Показатель', 'Сумма (₸)', 'Процент (%)'],
    ['Доходы', income, 100],
    ['Расходы', expenses, expenses > 0 ? Math.round((expenses / income) * 100) : 0],
    ['Чистая прибыль', profit, profit > 0 ? Math.round((profit / income) * 100) : 0],
  ];

  createSheet(workbook, 'Прибыль', 'Отчёт о прибыли', period, ['Показатель', 'Сумма (₸)', 'Процент (%)'], summaryRows.slice(1), [1]);

  const expenseRecords = getExpenseRecords(org.id).filter(e => {
    const eTime = new Date(e.date).getTime();
    const fromTime = new Date(fromISO).getTime();
    const toTime = new Date(toISO).getTime();
    return eTime >= fromTime && eTime <= toTime;
  });

  const expenseCategoryTotals: Record<string, number> = {};
  expenseRecords.forEach(e => {
    expenseCategoryTotals[e.category] = (expenseCategoryTotals[e.category] || 0) + e.amount;
  });

  const categoryRows = Object.entries(expenseCategoryTotals)
    .map(([cat, amount]) => [cat, amount, Math.round((amount / expenses) * 100)])
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  createSheet(workbook, 'Структура расходов', 'Структура расходов', period, ['Категория', 'Сумма (₸)', 'Доля (%)'], categoryRows, [1]);

  const name = fileName || `profit_report_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.xlsx`;
  await downloadWorkbook(workbook, name);
  logExport(org, `Экспорт отчёта о прибыли ${fromISO} - ${toISO}`);
}

export async function exportPayrollReportExcel(org: Organization, fromISO: string, toISO: string, fileName?: string) {
  const workbook = new ExcelJS.Workbook();
  const period = `${fromISO.slice(0,10)} - ${toISO.slice(0,10)}`;

  const payrollRecords = getPayrollRecords(org.id).filter(p => {
    const pTime = new Date(p.createdAt).getTime();
    const fromTime = new Date(fromISO).getTime();
    const toTime = new Date(toISO).getTime();
    return pTime >= fromTime && pTime <= toTime;
  });

  const payrollRows = payrollRecords.map(p => [
    p.employeeName,
    p.periodFrom.slice(0, 10),
    p.periodTo.slice(0, 10),
    p.completedWorksCount,
    p.revenue,
    p.percent,
    p.accrued,
    p.paid,
    p.paidAt ? 'Выплачена' : 'К выплате',
  ]);

  createSheet(workbook, 'Зарплаты', 'Отчёт по зарплатам', period,
    ['Сотрудник', 'Период с', 'Период по', 'Работ', 'Выручка', '%', 'Начислено', 'Выплачено', 'Статус'],
    payrollRows,
    [4, 5, 6, 7]
  );

  const employeeStats: Record<string, { accrued: number; paid: number; count: number }> = {};
  payrollRecords.forEach(p => {
    if (!employeeStats[p.employeeName]) {
      employeeStats[p.employeeName] = { accrued: 0, paid: 0, count: 0 };
    }
    employeeStats[p.employeeName].accrued += p.accrued;
    employeeStats[p.employeeName].paid += p.paid;
    employeeStats[p.employeeName].count += 1;
  });

  const summaryRows = Object.entries(employeeStats).map(([name, stats]) => [
    name,
    stats.count,
    stats.accrued,
    stats.paid,
    stats.accrued - stats.paid,
  ]);

  createSheet(workbook, 'Итоги', 'Итоги по сотрудникам', period,
    ['Сотрудник', 'Периодов', 'Начислено', 'Выплачено', 'К выплате'],
    summaryRows,
    [2, 3, 4]
  );

  const name = fileName || `payroll_report_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.xlsx`;
  await downloadWorkbook(workbook, name);
  logExport(org, `Экспорт отчёта по зарплатам ${fromISO} - ${toISO}`);
}

export function exportFinanceReportPdf(org: Organization, fromISO: string, toISO: string) {
  const doc = new jsPDF();

  const income = calculateIncome(org.id, fromISO, toISO);
  const expenses = calculateExpenses(org.id, fromISO, toISO);
  const profit = calculateProfit(org.id, fromISO, toISO);

  doc.setFontSize(16);
  doc.text(`Финансовый отчёт: ${org.name}`, 14, 16);

  autoTable(doc, {
    startY: 22,
    head: [['Показатель', 'Значение', '%']],
    body: [
      ['Доходы', String(income), '100%'],
      ['Расходы', String(expenses), `${Math.round((expenses / income) * 100)}%`],
      ['Чистая прибыль', String(profit), `${Math.round((profit / income) * 100)}%`],
    ],
    theme: 'grid',
    styles: { fontSize: 10 },
  });

  const expenseRecords = getExpenseRecords(org.id).filter(e => {
    const eTime = new Date(e.date).getTime();
    const fromTime = new Date(fromISO).getTime();
    const toTime = new Date(toISO).getTime();
    return eTime >= fromTime && eTime <= toTime;
  });

  const expenseCategoryTotals: Record<string, number> = {};
  expenseRecords.forEach(e => {
    expenseCategoryTotals[e.category] = (expenseCategoryTotals[e.category] || 0) + e.amount;
  });

  const categoryRows = Object.entries(expenseCategoryTotals)
    .map(([cat, amount]) => [cat, String(amount), `${Math.round((amount / expenses) * 100)}%`])
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Категория расходов', 'Сумма (₸)', 'Доля']],
    body: categoryRows.slice(0, 15),
    theme: 'grid',
    styles: { fontSize: 9 },
  });

  const payrollRecords = getPayrollRecords(org.id).filter(p => {
    const pTime = new Date(p.createdAt).getTime();
    const fromTime = new Date(fromISO).getTime();
    const toTime = new Date(toISO).getTime();
    return pTime >= fromTime && pTime <= toTime;
  });

  const payrollRows = payrollRecords.slice(0, 20).map(p => [
    p.employeeName,
    String(p.accrued),
    p.paidAt ? 'Выплачена' : 'К выплате',
  ]);

  if (payrollRows.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Сотрудник', 'Начислено (₸)', 'Статус']],
      body: payrollRows,
      theme: 'grid',
      styles: { fontSize: 9 },
    });
  }

  doc.save(`finance_report_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.pdf`);
  logExport(org, `Экспорт финансового отчёта PDF ${fromISO} - ${toISO}`);
}

export function exportPayrollReportPdf(org: Organization, fromISO: string, toISO: string) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`Отчёт по зарплатам: ${org.name}`, 14, 16);

  const payrollRecords = getPayrollRecords(org.id).filter(p => {
    const pTime = new Date(p.createdAt).getTime();
    const fromTime = new Date(fromISO).getTime();
    const toTime = new Date(toISO).getTime();
    return pTime >= fromTime && pTime <= toTime;
  });

  const payrollRows = payrollRecords.map(p => [
    p.employeeName,
    p.periodFrom.slice(0, 10),
    p.periodTo.slice(0, 10),
    String(p.accrued),
    String(p.paid),
    p.paidAt ? 'Выплачена' : 'К выплате',
  ]);

  autoTable(doc, {
    startY: 22,
    head: [['Сотрудник', 'Период с', 'Период по', 'Начислено (₸)', 'Выплачено (₸)', 'Статус']],
    body: payrollRows,
    theme: 'grid',
    styles: { fontSize: 9 },
  });

  const employeeStats: Record<string, { accrued: number; paid: number }> = {};
  payrollRecords.forEach(p => {
    if (!employeeStats[p.employeeName]) {
      employeeStats[p.employeeName] = { accrued: 0, paid: 0 };
    }
    employeeStats[p.employeeName].accrued += p.accrued;
    employeeStats[p.employeeName].paid += p.paid;
  });

  const summaryRows = Object.entries(employeeStats).map(([name, stats]) => [
    name,
    String(stats.accrued),
    String(stats.paid),
    String(stats.accrued - stats.paid),
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Сотрудник', 'Всего начислено (₸)', 'Всего выплачено (₸)', 'Остаток (₸)']],
    body: summaryRows,
    theme: 'grid',
    styles: { fontSize: 9 },
  });

  doc.save(`payroll_report_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.pdf`);
  logExport(org, `Экспорт отчёта по зарплатам PDF ${fromISO} - ${toISO}`);
}

export async function exportFinanceSummaryExcel(org: Organization, fromISO: string, toISO: string, fileName?: string) {
  const workbook = new ExcelJS.Workbook();
  const period = `${fromISO.slice(0,10)} - ${toISO.slice(0,10)}`;

  const income = calculateIncome(org.id, fromISO, toISO);
  const expenses = calculateExpenses(org.id, fromISO, toISO);
  const profit = calculateProfit(org.id, fromISO, toISO);

  const summaryData = [
    ['Организация', org.name],
    ['Период', period],
    ['Доходы', income],
    ['Расходы', expenses],
    ['Чистая прибыль', profit],
    ['Рентабельность (%)', income > 0 ? Math.round((profit / income) * 100) : 0],
    ['Соотношение доход/расход', expenses > 0 ? (income / expenses).toFixed(2) : '—'],
  ];

  createSheet(workbook, 'Сводка', 'Краткая финансовая сводка для владельца', period, ['Показатель', 'Значение'], summaryData);

  const name = fileName || `finance_summary_${fromISO.slice(0,10)}_${toISO.slice(0,10)}.xlsx`;
  await downloadWorkbook(workbook, name);
  logExport(org, `Экспорт краткой финансовой сводки ${fromISO} - ${toISO}`);
}
