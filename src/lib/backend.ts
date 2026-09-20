import { PrismaClient } from '@prisma/client';
import { resources,databaseError } from './resources';
import { transactionRoute } from './transactions';
import { budgetRoute,summary } from './reports';
import { xlsxRoute } from './xlsx';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
const globalDb=globalThis as unknown as {expenseDb?:PrismaClient};
export const db=globalDb.expenseDb??new PrismaClient();
if(process.env.NODE_ENV!=='production') globalDb.expenseDb=db;
export class ApiError extends Error {constructor(public status:number,message:string,public extra:Record<string,unknown>={}){super(message);}}
const SESSION_IDLE_MS=3*60*1000;
const SESSION_MAX_MS=7*86400000;
type SessionData={exp:number;idleExp:number;nonce:string};
export const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function signature(s:string){const secret=process.env.SESSION_SECRET;if(!secret||secret.length<32)throw new ApiError(503,'Session unavailable');return createHmac('sha256',secret).update(s).digest('base64url');}
function secureCookie(req:Request){return new URL(req.url).protocol==='https:'||req.headers.get('x-forwarded-proto')==='https';}
function sessionCookie(data:SessionData,req:Request){const payload=Buffer.from(JSON.stringify(data)).toString('base64url');const maxAge=Math.max(0,Math.ceil((data.exp-Date.now())/1000));return `expense_session=${payload}.${signature(payload)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookie(req)?'; Secure':''}`;}
function sessionData(req:Request):SessionData|null{try{const value=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('expense_session='))?.slice(16);if(!value)return null;const parts=value.split('.');if(parts.length!==2||!equal(signature(parts[0]),parts[1]))return null;const data=JSON.parse(Buffer.from(parts[0],'base64url').toString());return typeof data.exp==='number'&&typeof data.idleExp==='number'&&typeof data.nonce==='string'&&data.exp>Date.now()&&data.idleExp>Date.now()?data as SessionData:null;}catch{return null;}}
function cookieAuth(req:Request){return sessionData(req)!==null;}
function refreshSession(response:Response,req:Request,session:SessionData){const headers=new Headers(response.headers);headers.set('Set-Cookie',sessionCookie({...session,idleExp:Math.min(session.exp,Date.now()+SESSION_IDLE_MS)},req));return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}
const limits=new Map<string,{count:number,until:number}>();
function rateLimit(key:string,max=120){const now=Date.now();if(limits.size>10000)for(const [k,v]of limits)if(v.until<now)limits.delete(k);const value=limits.get(key);if(!value||value.until<now){limits.set(key,{count:1,until:now+60000});return;}if(++value.count>max)throw new ApiError(429,'Too many requests');}
function sameOrigin(req:Request){const origin=req.headers.get('origin');if(!origin)throw new ApiError(403,'Invalid origin');try{const source=new URL(origin),target=new URL(req.url);const loopback=new Set(['localhost','127.0.0.1','0.0.0.0','[::1]']);const localPair=loopback.has(source.hostname)&&loopback.has(target.hostname);const allowed=source.host===target.host||source.host==='expense.derajat.tech'||localPair;if(!allowed||!['http:','https:'].includes(source.protocol))throw 0;}catch{throw new ApiError(403,'Invalid origin');}}
export async function readJson(req:Request){if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ApiError(415,'Content-Type must be application/json');const text=await req.text();if(Buffer.byteLength(text)>65536)throw new ApiError(413,'Request too large');try{return JSON.parse(text);}catch{throw new ApiError(400,'Invalid JSON');}}
export async function handle(req:Request):Promise<Response>{try{
  const path=new URL(req.url).pathname.replace(/^\/api\/?/,'').replace(/\/$/,'');
  if(path==='health'&&req.method==='GET'){await db.$queryRaw`SELECT 1`;return json({status:'ok'});}
  if(path==='session'){
    if(req.method==='GET')return json({authenticated:cookieAuth(req)});
    if(req.method==='POST'){
      rateLimit('login',20);if(req.headers.has('origin'))sameOrigin(req);const body=await readJson(req);
      if(typeof body.password!=='string'||!process.env.DASHBOARD_PASSWORD||!equal(body.password,process.env.DASHBOARD_PASSWORD))throw new ApiError(401,'Unauthorized');
      const now=Date.now();const session:SessionData={exp:now+SESSION_MAX_MS,idleExp:now+SESSION_IDLE_MS,nonce:randomBytes(16).toString('hex')};
      return json({authenticated:true},200,{'Set-Cookie':sessionCookie(session,req)});
    }
    if(req.method==='DELETE'){sameOrigin(req);return json({authenticated:false},200,{'Set-Cookie':'expense_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
  }
  const authorization=req.headers.get('authorization');
  const bearer=!!authorization&&!!process.env.HERMES_API_TOKEN&&equal(authorization,`Bearer ${process.env.HERMES_API_TOKEN}`);
  const session=bearer?null:sessionData(req);
  if((authorization&&!bearer)||(!bearer&&!session))throw new ApiError(401,'Unauthorized');
  const withSession=(response:Response)=>bearer||!session?response:refreshSession(response,req,session);
  if(path==='csv/export'||path==='csv/template'||path==='csv/import')throw new ApiError(404,'Not found');
  if(!['GET','HEAD'].includes(req.method)){rateLimit('write');if(!bearer)sameOrigin(req);if(req.method!=='DELETE'&&!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ApiError(415,'Content-Type must be application/json');}
  if(path==='summary'&&req.method==='GET')return withSession(await summary(req));
  const xlsx=await xlsxRoute(req,path);if(xlsx)return withSession(xlsx);
  const budget=await budgetRoute(req,path);if(budget)return withSession(budget);
  const transaction=await transactionRoute(req,path);if(transaction)return withSession(transaction);
  const resource=await resources(req,path);if(resource)return withSession(resource);
  throw new ApiError(404,'Not found');
}catch(caught){const error=databaseError(caught);if(error instanceof ApiError)return json({success:false,error:error.message,...error.extra},error.status);console.error('API request failed',error instanceof Error?error.name:'Unknown');return json({success:false,error:'Internal server error'},500);}}
