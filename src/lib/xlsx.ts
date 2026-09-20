import { filteredTransactions, publicTransaction } from './transactions';

const exportHeaders = ['type', 'amount', 'description', 'category', 'account', 'transactionDate', 'transactionTime', 'notes', 'referenceNumber', 'sourceType'];
const dangerousCell = /^[=+\-@]/;

type CellValue = string | number | null;
type ZipEntry = { name: string; data: Buffer };

function safeCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const text = String(value);
  return dangerousCell.test(text) ? `'${text}` : text;
}

function xml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(value: number) { const b = Buffer.alloc(2); b.writeUInt16LE(value); return b; }
function u32(value: number) { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0); return b; }
function zip(entries: ZipEntry[]) {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const crc = crc32(entry.data);
    const header = Buffer.concat([Buffer.from('PK\x03\x04', 'binary'), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), name]);
    local.push(header, entry.data);
    central.push(Buffer.concat([Buffer.from('PK\x01\x02', 'binary'), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += header.length + entry.data.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = Buffer.concat([Buffer.from('PK\x05\x06', 'binary'), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralSize), u32(offset), u16(0)]);
  return Buffer.concat([...local, ...central, end]);
}

function inlineCell(address: string, value: string) {
  return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}
function cell(address: string, value: CellValue) {
  if (value === null) return '';
  return typeof value === 'number' ? `<c r="${address}"><v>${value}</v></c>` : inlineCell(address, value);
}
function columnName(index: number) {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}

function workbookBuffer(rows: CellValue[][]) {
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => rowIndex === 0 ? inlineCell(`${columnName(columnIndex)}${rowIndex + 1}`, String(value ?? '')) : cell(`${columnName(columnIndex)}${rowIndex + 1}`, value)).join('')}</row>`).join('');
  const widths = exportHeaders.map((header, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.max(header.length + 2, 16)}" customWidth="1"/>`).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:J${rows.length}"/></worksheet>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Transactions" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes) },
    { name: '_rels/.rels', data: Buffer.from(rootRels) },
    { name: 'xl/workbook.xml', data: Buffer.from(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels) },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet) },
  ]);
}

export async function exportXlsx(req: Request) {
  const { transactions } = await filteredTransactions(new URL(req.url).searchParams);
  const rows: CellValue[][] = [exportHeaders];
  for (const transaction of transactions) {
    const visible = publicTransaction(transaction);
    rows.push([
      safeCell(visible.type), safeCell(visible.amount), safeCell(visible.description), safeCell(transaction.category.name), safeCell(transaction.account.name),
      safeCell(visible.transactionDate), safeCell(visible.transactionTime), safeCell(visible.notes), safeCell(visible.referenceNumber), safeCell(visible.sourceType),
    ]);
  }
  return new Response(workbookBuffer(rows), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="personal-expense-ledger.xlsx"',
    },
  });
}

export async function xlsxRoute(req: Request, path: string) {
  if (path === 'xlsx/export' && req.method === 'GET') return exportXlsx(req);
}
