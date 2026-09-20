export type Flow = 'income' | 'expense';
export type Resource = 'transactions' | 'accounts' | 'categories' | 'budgets';
export interface Account { id:string; name:string; type:string; initialBalance:number; currentBalance:number; totalIncome:number; totalExpenses:number; transactionCount:number; }
export interface Category { id:string; name:string; type:Flow; icon:string; totalAmount:number; transactionCount:number; }
export interface Transaction { id:string; type:Flow; amount:number; description:string; accountId:string; categoryId:string; transactionDate:string; transactionTime?:string; notes?:string; referenceNumber?:string; sourceType:string; account?:Account; category?:Category; }
export interface Budget { id:string; categoryId:string; category:Category; amount:number; month:number; year:number; spent:number; percentage:number; status:string; }
export interface Settings { displayName:string; currency:string; locale:string; timezone:string; defaultAccountId:string | null; theme:'classic-light'|'classic-dark'; }
export interface Distribution { name:string; amount:number; }
export interface Trend { month:string; income:number; expense:number; netCashflow:number; }
export interface Summary { totalBalance:number; income:number; expense:number; netCashflow:number; savingRate:number; averageDailySpending:number; accounts:Account[]; spendingByCategory:Distribution[]; incomeByCategory:Distribution[]; spendingByAccount:Distribution[]; monthlyTrend:Trend[]; topMerchants:Distribution[]; biggestTransaction:Transaction|null; budgets:Budget[]; recentTransactions:Transaction[]; }
export type Entry = Partial<Transaction & Account & Budget> & {icon?:string};
export type Payload = Record<string,string|number|null>;
export interface Filters { month:string; year:string; from:string; to:string; accountId:string; categoryId:string; type:string; sourceType:string; q:string; sort:string; page:number; pageSize:number; }
