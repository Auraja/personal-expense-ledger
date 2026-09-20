import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

process.env.HERMES_API_TOKEN = 'xlsx-test-token';

async function req(path: string, method = 'GET', body?: unknown) {
  const { handle } = await import('../src/lib/backend');
  const headers: Record<string, string> = { authorization: 'Bearer xlsx-test-token' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await handle(new Request(`http://localhost/api/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { status: response.status, headers: response.headers, body: Buffer.from(await response.arrayBuffer()) };
}

test('Excel report export returns a readable workbook and old CSV routes are gone', async () => {
  const created = await req('transactions', 'POST', {
    type: 'expense', amount: 25000, description: 'Kopi Excel', category: 'Makan', account: 'BRI',
    transactionDate: '2026-09-07', sourceType: 'manual',
  });
  assert.equal(created.status, 201);

  const report = await req('xlsx/export');
  assert.equal(report.status, 200);
  assert.match(report.headers.get('content-type') ?? '', /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/);
  assert.match(report.headers.get('content-disposition') ?? '', /\.xlsx/);
  const workbook = XLSX.read(report.body, { type: 'buffer' });
  assert.deepEqual(workbook.SheetNames, ['Transactions']);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Transactions);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, 'Kopi Excel');
  assert.equal(rows[0].account, 'BRI');

  assert.equal((await req('csv/export')).status, 404);
  assert.equal((await req('csv/template')).status, 404);
  assert.equal((await req('csv/import', 'POST')).status, 404);
});
