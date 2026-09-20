import { z } from 'zod';
import { Prisma,Transaction } from '@prisma/client';
import { createHash } from 'node:crypto';
import { db,ApiError,json,readJson } from './backend';
import { validate } from './resources';
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===v&&v>='1900-01-01'&&v<='2200-12-31';},'Invalid calendar date');
const extractionSchema=z.object({status:z.enum(['pending','failed','success']),amountCertain:z.boolean(),complete:z.boolean()}).strict();
const correctionSchema=z.object({amount:z.number().int().positive().max(2147483647)}).strict();
const transactionSchema=z.object({type:z.enum(['income','expense']),amount:z.number().int().positive().max(2147483647),description:z.string().trim().min(1).max(500),categoryId:z.string().min(1).optional(),accountId:z.string().min(1).optional(),category:z.string().trim().min(1).max(100).optional(),account:z.string().trim().min(1).max(100).optional(),transactionDate:dateSchema,transactionTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),notes:z.string().max(5000).nullable().optional(),referenceNumber:z.string().trim().max(200).nullable().optional(),sourceType:z.enum(['manual','hermes_image','hermes_text']).optional(),caption:z.string().max(2000).optional(),extraction:extractionSchema.optional(),corrections:correctionSchema.optional()}).strict();
export const include={account:true,category:true} as const;
export type JoinedTransaction=Prisma.TransactionGetPayload<{include:typeof include}>;
export function publicTransaction<T extends Transaction>(t:T){const {referenceKey,duplicateKey,...visible}=t;void referenceKey;void duplicateKey;return visible;}
export const normalize=(v:string)=>v.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
function similar(a:string,b:string){a=normalize(a);b=normalize(b);if(a===b)return true;if(Math.min(a.length,b.length)>=6&&(a.includes(b)||b.includes(a)))return true;const prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let last=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const saved=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,last+(a[i-1]===b[j-1]?0:1));last=saved;}}return Math.min(a.length,b.length)>=5&&prev[b.length]/Math.max(a.length,b.length)<=0.15;}
function duplicate(t:JoinedTransaction):never{throw new ApiError(409,'Possible duplicate transaction',{status:'possible_duplicate',possibleDuplicate:publicTransaction(t)});}
let writeTail:Promise<unknown>=Promise.resolve();
export function serialized<T>(work:()=>Promise<T>):Promise<T>{const next=writeTail.then(work,work);writeTail=next.catch(()=>undefined);return next;}
export async function saveTransaction(raw:unknown,id?:string){return serialized(async()=>{
  const old=id?await db.transaction.findUnique({where:{id},include}):null;if(id&&!old)throw new ApiError(404,'Not found');
  let input=raw;
  if(old){const patch=validate(transactionSchema.partial(),raw);const {id:oldId,createdAt,updatedAt,account,category,...values}=publicTransaction(old);void oldId;void createdAt;void updatedAt;void account;void category;
    input={...values,...patch};if(patch.account&&!patch.accountId)delete (input as Record<string,unknown>).accountId;if(patch.category&&!patch.categoryId)delete (input as Record<string,unknown>).categoryId;}
  const data={...validate(transactionSchema,input)};
  if(data.sourceType==='hermes_image' && !old){
    const corrected=data.corrections?.amount;
    const extractionReady=data.extraction?.status==='success'&&data.extraction.amountCertain&&data.extraction.complete;
    if(corrected!==undefined) data.amount=corrected;
    else if(!extractionReady) throw new ApiError(422,'Image transaction needs clarification before it can be recorded',{status:'needs_clarification'});
  }
  const account=data.accountId?await db.account.findUnique({where:{id:data.accountId}}):data.account?await db.account.findFirst({where:{name:data.account}}):null;
  const category=data.categoryId?await db.category.findUnique({where:{id:data.categoryId}}):data.category?await db.category.findUnique({where:{name_type:{name:data.category,type:data.type}}}):null;
  if(!account)throw new ApiError(400,'Unknown account');if(!category||category.type!==data.type)throw new ApiError(400,'Category must match transaction type');
  if(data.account&&data.account!==account.name||data.category&&data.category!==category.name)throw new ApiError(400,'Name and identifier conflict');
  const referenceKey=data.referenceNumber?normalize(data.referenceNumber):null;
  if(data.referenceNumber&&!referenceKey)throw new ApiError(400,'Reference number must contain letters or digits');
  const duplicateKey=createHash('sha256').update(JSON.stringify([data.amount,data.transactionDate,account.id,normalize(data.description)])).digest('hex');
  const candidates=await db.transaction.findMany({where:{id:id?{not:id}:undefined,OR:[...(referenceKey?[{referenceKey}]:[]),{amount:data.amount,transactionDate:data.transactionDate,accountId:account.id}]},include});
  const match=candidates.find(t=>referenceKey&&t.referenceKey===referenceKey||similar(t.description,data.description));if(match)duplicate(match);
  const saved={type:data.type,amount:data.amount,description:data.description,categoryId:category.id,accountId:account.id,transactionDate:data.transactionDate,transactionTime:data.transactionTime??null,notes:data.notes??null,referenceNumber:data.referenceNumber||null,referenceKey,duplicateKey,sourceType:data.sourceType??'manual'};
  try{return publicTransaction(id?await db.transaction.update({where:{id},data:saved,include}):await db.transaction.create({data:saved,include}));}
  catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){const found=await db.transaction.findFirst({where:{OR:[{duplicateKey},...(referenceKey?[{referenceKey}]:[])]},include});if(found)duplicate(found);}throw error;}
});}
function integer(params:URLSearchParams,key:string,min:number,max:number,defaultValue?:number){const v=params.get(key);if(v===null||v==='')return defaultValue;if(!/^\d+$/.test(v)||Number(v)<min||Number(v)>max)throw new ApiError(400,`Invalid ${key}`);return Number(v);}
export function range(params:URLSearchParams){const from=params.get('from')||undefined,to=params.get('to')||undefined;if(from)validate(dateSchema,from);if(to)validate(dateSchema,to);if(from&&to&&from>to)throw new ApiError(400,'from must not follow to');const month=integer(params,'month',1,12),year=integer(params,'year',1900,2200);return {from,to,month,year};}
export async function filteredTransactions(params:URLSearchParams){const {from,to,month,year}=range(params);const type=params.get('type')||undefined,sourceType=params.get('sourceType')||undefined;if(type&&!['income','expense'].includes(type))throw new ApiError(400,'Invalid type');if(sourceType&&!['manual','hermes_image','hermes_text'].includes(sourceType))throw new ApiError(400,'Invalid sourceType');
  const sort=params.get('sort')||'newest';if(!['newest','oldest','largest','smallest'].includes(sort))throw new ApiError(400,'Invalid sort');
  const page=integer(params,'page',1,1000000,1)!,pageSize=integer(params,'pageSize',1,200,20)!;
  const rows=await db.transaction.findMany({where:{type,sourceType,accountId:params.get('accountId')||undefined,categoryId:params.get('categoryId')||undefined,transactionDate:{gte:from,lte:to}},include});
  const q=(params.get('q')||'').trim().toLowerCase();if(q.length>200)throw new ApiError(400,'Search too long');
  const transactions=rows.filter(t=>{if(month&&Number(t.transactionDate.slice(5,7))!==month||year&&Number(t.transactionDate.slice(0,4))!==year)return false;if(!q)return true;const date=new Date(t.transactionDate+'T00:00:00Z');const text=[t.description,t.notes,t.account.name,t.category.name,t.amount,t.transactionDate,t.referenceNumber,date.toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'}),date.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})].join(' ').toLowerCase();return text.includes(q)||/^\d[\d.,\s]*$/.test(q)&&String(t.amount)===q.replace(/[.,\s]/g,'');});
  transactions.sort((a,b)=>{if(sort==='largest'||sort==='smallest'){const diff=(a.amount-b.amount)*(sort==='largest'?-1:1);if(diff)return diff;}const order=sort==='oldest'?1:-1;return order*(a.transactionDate.localeCompare(b.transactionDate)||(a.transactionTime??'').localeCompare(b.transactionTime??'')||a.createdAt.getTime()-b.createdAt.getTime()||a.id.localeCompare(b.id));});
  return {transactions,page,pageSize,total:transactions.length};
}
export async function transactionRoute(req:Request,path:string){if(!/^transactions(?:\/[^/]+)?$/.test(path))return;const id=path.split('/')[1];if(req.method==='GET'){if(id){const t=await db.transaction.findUnique({where:{id},include});if(!t)throw new ApiError(404,'Not found');return json({transaction:publicTransaction(t)});}const {transactions,...meta}=await filteredTransactions(new URL(req.url).searchParams);return json({...meta,transactions:transactions.slice((meta.page-1)*meta.pageSize,meta.page*meta.pageSize).map(publicTransaction)});}if(req.method==='POST'&&!id)return json({success:true,transaction:await saveTransaction(await readJson(req))},201);if(req.method==='PATCH'&&id)return json({success:true,transaction:await saveTransaction(await readJson(req),id)});if(req.method==='DELETE'&&id){await db.transaction.delete({where:{id}});return json({success:true});}}
