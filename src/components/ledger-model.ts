import type { Filters } from './ledger-types';

export function money(value: number | undefined | null): string {
  return new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value ?? 0);
}
export function jakartaToday(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function dateLabel(value:string):string {
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${value.slice(0,10)}T12:00:00+07:00`)).replace('Sept','Sep');
}
export function queryString(filters: Partial<Filters>): string {
  const p=new URLSearchParams();
  for(const [key,value] of Object.entries(filters)) {
    if(value===''||value===undefined||value===null)continue;
    if((key==='month'||key==='year')&&(filters.from||filters.to))continue;
    p.set(key,String(value));
  }
  return p.toString();
}
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.status === 'possible_duplicate' ? 'Possible duplicate: a similar transaction already exists. Review your ledger before saving again.' : typeof data.error === 'string' ? data.error : data.error?.message || data.message || `Request failed (${response.status}). Please try again.`, response.status);
  return data as T;
}
