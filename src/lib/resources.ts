import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db,ApiError,json,readJson } from './backend';
const name=z.string().trim().min(1).max(100);
const money=z.number().int().min(0).max(2147483647);
const accountSchema=z.object({name,type:z.enum(['bank','cash','ewallet','investment','other']),initialBalance:money.default(0)}).strict();
const categorySchema=z.object({name,type:z.enum(['income','expense']),icon:z.string().max(60).default('tag')}).strict();
const settingsSchema=z.object({displayName:name,currency:z.literal('IDR'),locale:z.literal('id-ID'),timezone:z.literal('Asia/Jakarta'),defaultAccountId:z.string().nullable(),theme:z.enum(['classic-light','classic-dark'])}).partial().strict();
export function validate<T>(schema:z.ZodType<T>,data:unknown):T{const result=schema.safeParse(data);if(!result.success)throw new ApiError(400,result.error.issues.map(i=>`${i.path.join('.')||'body'}: ${i.message}`).join('; '));return result.data;}
export async function accounts(){const [rows,totals]=await Promise.all([db.account.findMany({orderBy:{createdAt:'asc'}}),db.transaction.groupBy({by:['accountId','type'],_sum:{amount:true},_count:true})]);return rows.map(a=>{const groups=totals.filter(t=>t.accountId===a.id),totalIncome=groups.find(t=>t.type==='income')?._sum.amount??0,totalExpenses=groups.find(t=>t.type==='expense')?._sum.amount??0;return {...a,totalIncome,totalExpenses,currentBalance:a.initialBalance+totalIncome-totalExpenses,transactionCount:groups.reduce((s,t)=>s+t._count,0)};});}
export async function categories(){const [rows,totals]=await Promise.all([db.category.findMany({orderBy:[{type:'asc'},{name:'asc'}]}),db.transaction.groupBy({by:['categoryId'],_sum:{amount:true},_count:true})]);return rows.map(c=>({...c,totalAmount:totals.find(t=>t.categoryId===c.id)?._sum.amount??0,transactionCount:totals.find(t=>t.categoryId===c.id)?._count??0}));}
export async function resources(req:Request,path:string):Promise<Response|undefined>{
  const [kind,id,extra]=path.split('/');if(extra)return;
  if(kind==='settings'&&!id){
    if(req.method==='GET')return json({settings:await db.settings.findUniqueOrThrow({where:{id:'default'}})});
    if(req.method==='PATCH'){const data=validate(settingsSchema,await readJson(req));if(data.defaultAccountId&&!await db.account.findUnique({where:{id:data.defaultAccountId}}))throw new ApiError(400,'Unknown default account');return json({settings:await db.settings.update({where:{id:'default'},data})});}
    return;
  }
  if(kind!=='accounts'&&kind!=='categories')return;
  const isAccount=kind==='accounts';
  if(req.method==='GET'&&!id)return json(isAccount?{accounts:await accounts()}:{categories:await categories()});
  if(req.method==='POST'&&!id){const body=await readJson(req);if(isAccount)return json({account:await db.account.create({data:validate(accountSchema,body)})},201);return json({category:await db.category.create({data:validate(categorySchema,body)})},201);}
  if(!id)return;
  const existing=isAccount?await db.account.findUnique({where:{id}}):await db.category.findUnique({where:{id}});if(!existing)throw new ApiError(404,'Not found');
  if(req.method==='PATCH'){
    if(isAccount)return json({account:await db.account.update({where:{id},data:validate(accountSchema.partial(),await readJson(req))})});
    const data=validate(categorySchema.partial(),await readJson(req));
    if(data.type&&data.type!==existing.type){const used=await db.transaction.count({where:{categoryId:id,type:{not:data.type}}});const budgetCount=data.type==='income'?await db.budget.count({where:{categoryId:id}}):0;if(used||budgetCount)throw new ApiError(409,'Category type conflicts with transactions or budgets');}
    return json({category:await db.category.update({where:{id},data})});
  }
  if(req.method==='DELETE'){
    if(isAccount)await db.account.delete({where:{id}});else await db.category.delete({where:{id}});
    return json({success:true});
  }
}
export function databaseError(error:unknown){if(error instanceof Prisma.PrismaClientKnownRequestError){if(error.code==='P2002')return new ApiError(409,'Record already exists');if(error.code==='P2003')return new ApiError(409,'Record is in use');if(error.code==='P2025')return new ApiError(404,'Not found');}return error;}
