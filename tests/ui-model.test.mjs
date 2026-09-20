import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/components/ledger-model.ts';
const {request}=model;

test('ledger filters preserve universal search and custom ranges without conflicting month constraints', () => {
 assert.equal(typeof model.queryString,'function');
 const q=new URLSearchParams(model.queryString({month:'9',year:'2026',from:'2026-08-01',to:'2026-09-30',q:'Kopi Jago September 25000',accountId:'a1',categoryId:'c1',type:'expense',sourceType:'hermes_image',sort:'largest',page:2,pageSize:20}));
 assert.equal(q.get('month'),null);
 assert.equal(q.get('from'),'2026-08-01');
 assert.equal(q.get('q'),'Kopi Jago September 25000');
 assert.equal(q.get('sourceType'),'hermes_image');
 assert.equal(q.get('page'),'2');
 assert.match(model.money(25000),/25\.000/);
 assert.equal(model.jakartaToday(new Date('2026-09-01T18:00:00Z')),'2026-09-02');
 assert.equal(model.dateLabel('2026-09-02'),'02 Sep 2026');
});

test('requests use a session cookie and surface server failures', async () => {
  const original = global.fetch;
  let init;
  global.fetch = async (_url, options) => { init = options; return new Response(JSON.stringify({error:'Incorrect dashboard password'}), {status:401}); };
  try {
    await assert.rejects(() => request('/api/session', {method:'POST', body:JSON.stringify({password:'wrong'})}), /Incorrect dashboard password/);
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.headers['Content-Type'], 'application/json');
  } finally { global.fetch = original; }
});
