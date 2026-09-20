import test from 'node:test';
import assert from 'node:assert/strict';
process.env.HERMES_API_TOKEN='analytics-test-token';
async function req(path:string,method='GET',body?:unknown){const {handle}=await import('../src/lib/backend');const r=await handle(new Request('http://localhost/api/'+path,{method,headers:{authorization:'Bearer analytics-test-token','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}));return {status:r.status,data:await r.json()};}
let budgetId:string;
test('monthly expense budget CRUD computes actual percentage and status',async()=>{
 const categories=(await req('categories')).data.categories;const categoryId=categories.find((c:any)=>c.name==='Makan').id;const incomeId=categories.find((c:any)=>c.name==='Gaji').id;
 assert.equal((await req('budgets','POST',{categoryId:incomeId,month:9,year:2026,amount:100000})).status,400);
 const made=await req('budgets','POST',{categoryId,month:9,year:2026,amount:100000});assert.equal(made.status,201);budgetId=made.data.budget.id;assert.equal(made.data.budget.spent,0);assert.equal(made.data.budget.status,'Safe');
 assert.equal((await req('budgets','POST',{categoryId,month:9,year:2026,amount:1})).status,409);
 assert.equal((await req('budgets','POST',{categoryId,month:13,year:2026,amount:1})).status,400);
 assert.equal((await req('budgets','PATCH',{})).status,404);
 for(const [amount,date,description] of [[85000,'2026-09-04','Lunch'],[9000,'2026-08-04','Earlier lunch']] as const)assert.equal((await req('transactions','POST',{type:'expense',amount,transactionDate:date,description,account:'BRI',category:'Makan'})).status,201);
 const budget=(await req('budgets?month=9&year=2026')).data.budgets[0];assert.equal(budget.spent,85000);assert.equal(budget.percentage,85);assert.equal(budget.status,'Approaching Limit');
 const updated=await req('budgets/'+budgetId,'PATCH',{amount:80000});assert.equal(updated.status,200);assert.equal(updated.data.budget.status,'Over Budget');
 assert.equal((await req('budgets/'+budgetId,'PATCH',{categoryId:incomeId})).status,400);
 assert.equal((await req('budgets?month=8&year=2026')).data.budgets.length,0);
});
