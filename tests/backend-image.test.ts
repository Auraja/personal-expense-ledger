import test from 'node:test';
import assert from 'node:assert/strict';
process.env.HERMES_API_TOKEN='image-test-token';
async function req(body:unknown,method='POST',id='') { const {handle}=await import('../src/lib/backend');const r=await handle(new Request('http://localhost/api/transactions'+id,{method,headers:{authorization:'Bearer image-test-token','content-type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()}; }
const base={type:'expense',amount:12345,description:'Image extraction test',account:'BRI',category:'Makan',transactionDate:'2026-08-22',sourceType:'hermes_image'};
test('image extraction requires confirmed successful complete evidence and explicit amount certainty',async()=>{
  assert.equal((await req(base)).status,422);
  for(const extraction of [ {status:'pending',amountCertain:true,complete:true}, {status:'failed',amountCertain:true,complete:true}, {status:'success',amountCertain:false,complete:true}, {status:'success',amountCertain:true,complete:false} ]) {const r=await req({...base,extraction});assert.equal(r.status,422);assert.equal(r.data.status,'needs_clarification');}
  const made=await req({...base,caption:'Correct amount is 15000',extraction:{status:'success',amountCertain:false,complete:true},corrections:{amount:15000}});assert.equal(made.status,201);assert.equal(made.data.transaction.amount,15000);assert.equal(made.data.transaction.extraction,undefined);assert.equal(made.data.transaction.caption,undefined);
  assert.equal((await req({notes:'edited'},'PATCH','/'+made.data.transaction.id)).status,200);
  assert.equal((await req({...base,image:'data:image/png;base64,abc',extraction:{status:'success',amountCertain:true,complete:true}})).status,400);
  const {db}=await import('../src/lib/backend');await db.transaction.delete({where:{id:made.data.transaction.id}});
});
