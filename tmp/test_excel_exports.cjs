const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function crmTest() {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Клиенты');
  sheet.columns = [
    { header: 'Клиент', key: 'name', width: 30 },
    { header: 'Телефон', key: 'phone', width: 20 },
  ];
  sheet.addRow({ name: 'Иван Иванов', phone: '+77001234567' });
  sheet.addRow({ name: 'Петр Петров', phone: '+77007654321' });
  const out = path.resolve(__dirname, 'crm_test.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('crm_test written', out);

  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(out);
  const s2 = wb2.getWorksheet('Клиенты');
  const headers = s2.getRow(1).values.slice(1);
  console.log('crm headers:', headers);
}

async function financeTest() {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Finance');
  sheet.columns = [
    { header: 'Период', key: 'period', width: 15 },
    { header: 'Сумма', key: 'amount', width: 15 },
  ];
  const r = sheet.addRow({ period: '2026-07', amount: 12345.67 });
  r.getCell(2).numFmt = '0.00';
  const out = path.resolve(__dirname, 'finance_test.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('finance_test written', out);

  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(out);
  const s2 = wb2.getWorksheet('Finance');
  const val = s2.getRow(2).getCell(2).value;
  console.log('finance amount cell raw:', val);
}

async function templateBasedTest() {
  const templatePath = path.resolve(__dirname, '..', 'electron', 'template.xlsx');
  if (!fs.existsSync(templatePath)) {
    console.error('template not found:', templatePath);
    return;
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const sheet = wb.worksheets[0];
  const startRow = 5;
  const endRow = 10; // shorter for test
  for (let row = startRow; row <= endRow; row++) {
    for (let col = 2; col <= 6; col++) {
      sheet.getCell(row, col).value = null;
    }
  }
  // add one date header row merged 2..6
  const writeRow = startRow;
  sheet.getCell(writeRow, 2).value = '28 июля 2026';
  sheet.getCell(writeRow, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  sheet.getCell(writeRow, 2).font = { bold: true };
  try {
    sheet.mergeCells(writeRow, 2, writeRow, 6);
  } catch (e) {
    // already merged in template — ignore
  }
  // add one data row
  const r2 = writeRow + 1;
  sheet.getCell(r2, 2).value = 1; // id
  sheet.getCell(r2, 3).value = 'Мойка';
  sheet.getCell(r2, 4).value = 1200;
  sheet.getCell(r2, 5).value = 'Kaspi';
  sheet.getCell(r2, 6).value = 'Алексей';

  const out = path.resolve(__dirname, 'template_test.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('template_test written', out);

  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(out);
  const s2 = wb2.worksheets[0];
  console.log('template sheet ref:', s2.dimensions);
  const merged = s2._merges && Object.keys(s2._merges).length;
  console.log('template merged count (approx):', merged);
  console.log('D' + r2 + ':', s2.getCell(r2, 4).value);
}

(async () => {
  try {
    await crmTest();
    await financeTest();
    await templateBasedTest();
    console.log('All tests done');
  } catch (e) {
    console.error('Test error', e);
    process.exit(1);
  }
})();
