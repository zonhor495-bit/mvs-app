const XLSX = require('xlsx');
const path = require('path');
const outPath = path.resolve(__dirname, '..', 'electron', 'template.xlsx');
const wb = XLSX.utils.book_new();
const ws = {};

const setCell = (r, c, value, opts = {}) => {
  const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
  const cell = typeof value === 'number' ? { v: value, t: 'n' } : { v: value, t: 's' };
  if (opts.style) cell.s = opts.style;
  if (opts.f) cell.f = opts.f;
  ws[addr] = cell;
};

const headerStyle = {
  font: { bold: true, sz: 12 },
  alignment: { horizontal: 'center', vertical: 'center' },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFCCFFCC' } },
};
const labelStyle = {
  font: { bold: true },
  alignment: { horizontal: 'left', vertical: 'center' },
};

setCell(1, 2, 'Отчёт по заказам', { style: headerStyle });
setCell(2, 2, 'Компания:', { style: labelStyle });
setCell(2, 3, 'Wash&Drive');
setCell(3, 2, 'Период:', { style: labelStyle });
setCell(3, 3, '');

setCell(4, 2, '№', { style: headerStyle });
setCell(4, 3, 'Услуга', { style: headerStyle });
setCell(4, 4, 'Сумма', { style: headerStyle });
setCell(4, 5, 'Оплата', { style: headerStyle });
setCell(4, 6, 'Исполнитель', { style: headerStyle });

setCell(5, 8, 'Напитки', { style: labelStyle });
setCell(6, 8, 'KASPI', { style: labelStyle });
setCell(7, 8, 'НАЛИЧНЫЕ', { style: labelStyle });
setCell(8, 8, 'ЗП', { style: labelStyle });
setCell(9, 8, 'сотрудники', { style: labelStyle });
setCell(10, 8, 'РАСХОДЫ', { style: labelStyle });
setCell(11, 8, 'ОСТАТОК', { style: labelStyle });
setCell(6, 9, null, { f: 'SUMIF(E5:E500, "Kaspi", D5:D500)' });
setCell(7, 9, null, { f: 'SUMIF(E5:E500, "Наличные", D5:D500)' });
setCell(11, 9, null, { f: 'SUM(D5:D500)-SUM(I6:I10)' });

ws['!cols'] = [
  { wch: 5 },
  { wch: 5 },
  { wch: 30 },
  { wch: 12 },
  { wch: 15 },
  { wch: 20 },
  { wch: 5 },
  { wch: 15 },
  { wch: 15 },
];
ws['!merges'] = [
  { s: { r: 0, c: 1 }, e: { r: 0, c: 5 } },
  { s: { r: 4, c: 1 }, e: { r: 4, c: 5 } },
];
ws['!ref'] = 'A1:I500';
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
XLSX.writeFile(wb, outPath, { bookType: 'xlsx', cellStyles: true });
console.log('Created', outPath);
