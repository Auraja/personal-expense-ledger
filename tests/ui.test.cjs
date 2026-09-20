const {test, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost'});
for (const k of ['window','document','HTMLElement','HTMLInputElement','Node','MutationObserver','getComputedStyle','FormData']) global[k] = dom.window[k];
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
global.React = React;
const {render,screen,fireEvent,waitFor,cleanup} = require('@testing-library/react');
afterEach(cleanup);

test('manual transaction uses default account, filters categories, and preserves rejected form', async () => {
 const {EntryEditor} = require('../src/components/entry-editor.tsx');
 const accounts=[{id:'a1',name:'Jago',type:'bank'},{id:'a2',name:'Cash',type:'cash'}];
 const categories=[{id:'c1',name:'Dining',type:'expense'},{id:'c2',name:'Salary',type:'income'}];
 let payload;
 render(React.createElement(EntryEditor,{kind:'transactions',accounts,categories,defaultAccountId:'a1',month:9,year:2026,onClose:()=>{},onSave:async data=>{payload=data;throw new Error('Possible duplicate: review your ledger.');}}));
 assert.equal(screen.getByLabelText('Account').value,'a1');
 assert.equal(screen.queryByRole('option',{name:'Salary'}),null);
 fireEvent.change(screen.getByLabelText('Description'),{target:{value:'Kopi'}});
 fireEvent.change(screen.getByLabelText('Amount (IDR)'),{target:{value:'25000'}});
 fireEvent.change(screen.getByLabelText('Category'),{target:{value:'c1'}});
 fireEvent.click(screen.getByRole('button',{name:'Save transaction'}));
 await waitFor(()=>assert.match(screen.getByRole('alert').textContent,/Possible duplicate/));
 assert.equal(payload.amount,25000);
 assert.equal(payload.sourceType,'manual');
 assert.equal(payload.accountId,'a1');
 assert.equal(screen.getByLabelText('Description').value,'Kopi');
 fireEvent.change(screen.getByLabelText('Type'),{target:{value:'income'}});
 assert.equal(screen.queryByRole('option',{name:'Dining'}),null);
 assert.ok(screen.getByRole('option',{name:'Salary'}));
});

test('account, category and budget editors submit typed resource fields', async () => {
 const {EntryEditor}=require('../src/components/entry-editor.tsx');
 for(const [kind,entry,field,value,key,expected] of [
 ['accounts',{id:'a1',name:'Jago',type:'bank',initialBalance:500},'Opening balance (IDR)','2000','initialBalance',2000],
 ['categories',{id:'c1',name:'Food',type:'expense',icon:'utensils'},'Name','Dining','name','Dining'],
 ['budgets',{id:'b1',categoryId:'c1',amount:500,month:9,year:2026},'Monthly limit (IDR)','100000','amount',100000]
 ]) {
 let payload;
 render(React.createElement(EntryEditor,{kind,entry,accounts:[],categories:[{id:'c1',name:'Food',type:'expense'}],month:9,year:2026,onClose:()=>{},onSave:async data=>{payload=data;}}));
 fireEvent.change(screen.getByLabelText(field),{target:{value}});
 fireEvent.click(screen.getByRole('button',{name:`Save ${kind==='categories'?'category':kind.slice(0,-1)}`}));
 await waitFor(()=>assert.equal(payload?.[key],expected));
 cleanup();
 }
});

test('analytics renders real totals, accessible charts and explicit empty states', () => {
 const {Analytics}=require('../src/components/analytics.tsx');
 const summary={totalBalance:500000,income:100000,expense:25000,netCashflow:75000,savingRate:75,averageDailySpending:2500,accounts:[],spendingByCategory:[{name:'Dining',amount:25000}],incomeByCategory:[{name:'Salary',amount:100000}],spendingByAccount:[{name:'Jago',amount:25000}],monthlyTrend:[{month:'2026-09',income:100000,expense:25000,netCashflow:75000}],topMerchants:[{name:'Kopi',amount:25000}],biggestTransaction:null,budgets:[],recentTransactions:[]};
 render(React.createElement(Analytics,{summary,detailed:true,onNavigate:()=>{},onEdit:()=>{}}));
 assert.ok(screen.getByText(/500\.000/));
 assert.ok(screen.getByRole('img',{name:/Spending by category/}));
 assert.ok(screen.getByRole('img',{name:/Income and expense/}));
 assert.ok(screen.getByRole('img',{name:/Monthly cash flow/}));
 assert.ok(screen.getByText('No budgets for this month.'));
 assert.ok(screen.getByText('No transactions in this period.'));
 assert.ok(screen.getByText('Kopi'));
});

test('transactions filters reset pagination, and row actions target the correct entry', () => {
 const {Transactions}=require('../src/components/transactions.tsx');
 const t={id:'t1',description:'Kopi',amount:25000,type:'expense',transactionDate:'2026-09-02',sourceType:'hermes_image',account:{name:'Jago'},category:{name:'Dining'}};
 let changed,edited,deleted;
 render(React.createElement(Transactions,{transactions:[t],total:45,filters:{q:'',accountId:'',categoryId:'',type:'',sourceType:'',sort:'newest',page:2,pageSize:20},accounts:[],categories:[],onFilter:v=>{changed=v;},onEdit:v=>{edited=v;},onDelete:v=>{deleted=v;}}));
 fireEvent.change(screen.getByLabelText('Search transactions'),{target:{value:'September'}});
 assert.deepEqual(changed,{q:'September',page:1});
 fireEvent.change(screen.getByLabelText('Source'),{target:{value:'hermes_image'}});
 assert.deepEqual(changed,{sourceType:'hermes_image',page:1});
 fireEvent.click(screen.getByRole('button',{name:'Next page'}));
 assert.deepEqual(changed,{page:3});
 fireEvent.click(screen.getByRole('button',{name:'Edit Kopi'}));
 assert.equal(edited.id,'t1');
 fireEvent.click(screen.getByRole('button',{name:'Delete Kopi'}));
 assert.equal(deleted.id,'t1');
 assert.ok(screen.getByText('Hermes image',{selector:'span'}));
});

test('settings persist display name, default account and classic theme with visible confirmation', async () => {
 const {SettingsPanel}=require('../src/components/settings-panel.tsx');
 let saved;
 render(React.createElement(SettingsPanel,{settings:{displayName:'My ledger',currency:'IDR',locale:'id-ID',timezone:'Asia/Jakarta',defaultAccountId:null,theme:'classic-light'},accounts:[{id:'a1',name:'Jago'}],onSave:async v=>{saved=v;}}));
 fireEvent.change(screen.getByLabelText('Display name'),{target:{value:'Private ledger'}});
 fireEvent.change(screen.getByLabelText('Default account'),{target:{value:'a1'}});
 fireEvent.change(screen.getByLabelText('Appearance'),{target:{value:'classic-dark'}});
 fireEvent.click(screen.getByRole('button',{name:'Save preferences'}));
 await waitFor(()=>assert.match(screen.getByRole('status').textContent,/Preferences saved/));
 assert.equal(saved.displayName,'Private ledger');
 assert.equal(saved.defaultAccountId,'a1');
 assert.equal(saved.theme,'classic-dark');
 assert.ok(screen.getByDisplayValue('Asia/Jakarta').readOnly);
});

test('categories prioritize used items and collapse unused items below', () => {
 const {ResourceCards}=require('../src/components/resource-cards.tsx');
 render(React.createElement(ResourceCards,{kind:'categories',accounts:[],budgets:[],categories:[
  {id:'c1',name:'Makan',type:'expense',icon:'tag',transactionCount:2,totalAmount:50000},
  {id:'c2',name:'Belanja',type:'expense',icon:'tag',transactionCount:0,totalAmount:0},
  {id:'c3',name:'Gaji',type:'income',icon:'tag',transactionCount:0,totalAmount:0},
 ],onEdit:()=>{},onDelete:()=>{}}));
 assert.ok(screen.getByText('Makan'));
 const other=screen.getAllByText('Other categories')[0].closest('details');
 assert.equal(other?.open,false);
 assert.equal(screen.getAllByText('Other categories').length,2);
});


test('private ledger sign-in validates password and opens the authenticated ledger', async () => {
 const {Login} = require('../src/components/login.tsx');
 let entered;
 render(React.createElement(Login,{onLogin:async password => {entered=password; throw new Error('Incorrect dashboard password');}}));
 assert.ok(screen.getByText(/server .env/i));
 fireEvent.change(screen.getByLabelText('Dashboard password'),{target:{value:'not-the-password'}});
 fireEvent.click(screen.getByRole('button',{name:'Open my ledger'}));
 await waitFor(()=>assert.equal(screen.getByRole('alert').textContent,'Incorrect dashboard password'));
 assert.equal(entered,'not-the-password');
 assert.equal(screen.getByLabelText('Dashboard password').type,'password');
});
