import ExcelJS from 'exceljs';

export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MVS';
  workbook.created = new Date();
  return workbook;
}

export function applySheetLayout(sheet: ExcelJS.Worksheet, header: any[], currencyCols: number[] = []) {
  if (header.length > 0) {
    sheet.views = [{ state: 'frozen', ySplit: 4 }];
    sheet.autoFilter = { from: { row: 4, col: 1 }, to: { row: 4, col: header.length } };
  }

  sheet.columns = header.map((h, index) => ({
    header: String(h),
    key: `col${index}`,
    width: Math.min(Math.max(String(h).length + 5, 12), 40),
  }));

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 5) {
      currencyCols.forEach(colIndex => {
        const cell = row.getCell(colIndex + 1);
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0 "₸"';
        }
      });
    }
  });
}

export function createSheet(workbook: ExcelJS.Workbook, name: string, title: string, period: string, header: any[], rows: any[][], currencyCols: number[] = []) {
  const sheet = workbook.addWorksheet(name);
  const aoa = [[title], ['Период', period], [], header, ...rows];
  sheet.addRows(aoa);
  applySheetLayout(sheet, header, currencyCols);
  return sheet;
}

export function createWorksheetFromRowArrays(workbook: ExcelJS.Workbook, name: string, rows: Array<Array<any>>, widths: number[] = []) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRows(rows);
  if (widths.length > 0) {
    sheet.columns = sheet.columns.map((column, index) => ({ ...column, width: widths[index] || 20 }));
  }
  return sheet;
}

export function createWorksheetFromObjects(workbook: ExcelJS.Workbook, name: string, rows: Array<Record<string, any>>, widths: number[] = [], currencyCols: number[] = []) {
  const sheet = workbook.addWorksheet(name);
  if (rows.length === 0) {
    sheet.addRow(['No data']);
    return sheet;
  }
  const keys = Object.keys(rows[0]);
  sheet.columns = keys.map((key, index) => ({
    header: key,
    key,
    width: widths[index] || 20,
    style: currencyCols.includes(index) ? { numFmt: '#,##0 "₸"' } : undefined,
  }));
  rows.forEach(row => sheet.addRow(row));
  return sheet;
}
