const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const templatePath = path.resolve(__dirname, '..', 'electron', 'template.xlsx');
console.log('templatePath', templatePath);
console.log('exists', fs.existsSync(templatePath));
if (!fs.existsSync(templatePath)) process.exit(1);

const workbook = XLSX.readFile(templatePath, { cellStyles: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
console.log('template ref', sheet['!ref']);
console.log('template merges', sheet['!merges']);

const orders = [
  { id: 1, date: '2026-06-28T10:00:00.000Z', service: 'Мойка', amount: 1200, paymentMethod: 'Kaspi', washer: 'Алексей', licensePlate: 'A777AA' },
  { id: 2, date: '2026-06-28T12:00:00.000Z', service: 'Полировка', amount: 2400, paymentMethod: 'Наличные', washer: 'Иван', licensePlate: 'B888BB' },
];

const sheetClone = JSON.parse(JSON.stringify(sheet));
const originalRange = sheetClone['!ref'] ? XLSX.utils.decode_range(sheetClone['!ref']) : { s: { c: 0, r: 0 }, e: { c: 5, r: 499 } };
const startRow = 5;
const endRow = 500;
for (let row = startRow; row <= endRow; row += 1) {
  for (let col = 1; col <= 5; col += 1) {
    delete sheetClone[XLSX.utils.encode_cell({ c: col, r: row - 1 })];
  }
}
if (!sheetClone['!merges']) sheetClone['!merges'] = [];
sheetClone['!merges'] = sheetClone['!merges'].filter(m => m.s.r < startRow - 1 || m.s.c > 5);

const rowsByDay = orders.reduce((acc, order) => {
  const dateKey = new Date(order.date).toISOString().slice(0, 10);
  if (!acc[dateKey]) acc[dateKey] = [];
  acc[dateKey].push(order);
  return acc;
}, {});
const sortedDates = Object.keys(rowsByDay).sort();
let writeRow = startRow;
for (const dateKey of sortedDates) {
  const ordersByDate = rowsByDay[dateKey];
  const dateLabel = `${new Date(dateKey).getDate()} ${new Date(dateKey).toLocaleString('ru-RU', { month: 'long' })}`;
  sheetClone[XLSX.utils.encode_cell({ c: 1, r: writeRow - 1 })] = { v: dateLabel, t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } }, font: { bold: true }, alignment: { horizontal: 'left', vertical: 'center' } } };
  for (let col = 2; col <= 5; col += 1) {
    sheetClone[XLSX.utils.encode_cell({ c: col, r: writeRow - 1 })] = { v: '', t: 's' };
  }
  sheetClone['!merges'].push({ s: { c: 1, r: writeRow - 1 }, e: { c: 5, r: writeRow - 1 } });
  writeRow += 1;
  ordersByDate.forEach(order => {
    const cells = [order.id, order.service, order.amount, order.paymentMethod, order.washer];
    cells.forEach((value, idx) => {
      const address = XLSX.utils.encode_cell({ c: idx + 1, r: writeRow - 1 });
      const cell = typeof value === 'number' ? { v: value, t: 'n' } : { v: value, t: 's' };
      if (idx === 2) cell.z = '0.00';
      sheetClone[address] = cell;
    });
    writeRow += 1;
  });
}
const lastRow = Math.max(writeRow, startRow + 1);
const outputRange = { s: { c: originalRange.s.c, r: originalRange.s.r }, e: { c: Math.max(originalRange.e.c, 5), r: Math.max(originalRange.e.r, lastRow - 1) } };
sheetClone['!ref'] = XLSX.utils.encode_range(outputRange);
workbook.Sheets[workbook.SheetNames[0]] = sheetClone;
const outPath = path.resolve(__dirname, '..', 'tmp-export.xlsx');
XLSX.writeFile(workbook, outPath, { bookType: 'xlsx', cellStyles: true });
console.log('wrote', outPath);
const wb2 = XLSX.readFile(outPath, { cellStyles: true });
const sh2 = wb2.Sheets[wb2.SheetNames[0]];
console.log('out ref', sh2['!ref']);
console.log('out merges count', sh2['!merges']?.length);
console.log('D5', sh2['D5']);
console.log('I6', sh2['I6']);
