"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Analytics } from '@/components/analytics';
import { EntryEditor } from '@/components/entry-editor';
import { Login } from '@/components/login';
import { ResourceCards } from '@/components/resource-cards';
import { SettingsPanel } from '@/components/settings-panel';
import { Transactions } from '@/components/transactions';
import { queryString, request } from '@/components/ledger-model';
import { installIdleLogout } from '@/lib/idle-session';
import type { Account, Budget, Category, Entry, Filters, Payload, Resource, Settings, Summary, Transaction } from '@/components/ledger-types';

type Tab = 'Overview' | 'Transactions' | 'Accounts' | 'Categories' | 'Budgets' | 'Reports' | 'Settings';
const tabs: Tab[] = ['Overview', 'Transactions', 'Accounts', 'Categories', 'Budgets', 'Reports', 'Settings'];
const initialFilters: Filters = { month: '', year: '', from: '', to: '', accountId: '', categoryId: '', type: '', sourceType: '', q: '', sort: 'newest', page: 1, pageSize: 20 };
const emptySummary: Summary = { totalBalance: 0, income: 0, expense: 0, netCashflow: 0, savingRate: 0, averageDailySpending: 0, accounts: [], spendingByCategory: [], incomeByCategory: [], spendingByAccount: [], monthlyTrend: [], topMerchants: [], biggestTransaction: null, budgets: [], recentTransactions: [] };

function titleFor(tab: Tab) { return tab === 'Overview' ? 'Good morning, keep your accounts considered.' : tab; }
function subtitleFor(tab: Tab) { const copy: Record<Tab, string> = { Overview: 'A clear view of the money coming in, going out, and quietly accumulating.', Transactions: 'Every entry, in order. Search by merchant, account, month or amount.', Accounts: 'The places your money rests, each with its own balance.', Categories: 'A thoughtful vocabulary for understanding your habits.', Budgets: 'Monthly limits that keep intention close to action.', Reports: 'The longer view, arranged for reflection.', Settings: 'Private preferences for this ledger and its Hermes connection.' }; return copy[tab]; }

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [editor, setEditor] = useState<{ kind: Resource; entry?: Entry } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const qs = queryString(filters);
      const [s, tx, a, c, b, pref] = await Promise.all([
        request<Summary>(`/api/summary${qs ? `?${qs}` : ''}`),
        request<{ transactions: Transaction[]; total: number }>(`/api/transactions${qs ? `?${qs}` : ''}`),
        request<{ accounts: Account[] }>('/api/accounts'),
        request<{ categories: Category[] }>('/api/categories'),
        request<{ budgets: Budget[] }>('/api/budgets'),
        request<{ settings: Settings }>('/api/settings'),
      ]);
      setSummary(s); setTransactions(tx.transactions); setTotalTransactions(tx.total); setAccounts(a.accounts); setCategories(c.categories); setBudgets(b.budgets); setSettings(pref.settings);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load the ledger.'); }
  }, [filters]);

  const onLogout = useCallback(async () => { try { await request('/api/session', { method: 'DELETE' }); } catch { /* Local sign-out still protects the visible screen. */ } finally { setAuthenticated(false); } }, []);
  useEffect(() => { request<{ authenticated: boolean }>('/api/session').then(v => setAuthenticated(v.authenticated)).catch(() => setAuthenticated(false)); }, []);
  useEffect(() => { if (!authenticated) return; return installIdleLogout({ target: window, onTimeout: () => { void onLogout(); } }); }, [authenticated, onLogout]);
  useEffect(() => { if (!authenticated) return; const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [authenticated, load]);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 3500); return () => window.clearTimeout(id); }, [notice]);

  const onLogin = async (password: string) => { await request('/api/session', { method: 'POST', body: JSON.stringify({ password }) }); setAuthenticated(true); };
  const onFilter = (patch: Partial<Filters>) => setFilters(current => ({ ...current, ...patch }));

  const save = async (data: Payload) => {
    if (!editor) return;
    setBusy(true);
    try {
      const endpoint = editor.kind === 'transactions' ? 'transactions' : editor.kind;
      const url = `/api/${endpoint}${editor.entry?.id ? `/${editor.entry.id}` : ''}`;
      await request(url, { method: editor.entry?.id ? 'PATCH' : 'POST', body: JSON.stringify(data) });
      setEditor(null); setNotice('The ledger has been updated.'); await load();
    } finally { setBusy(false); }
  };
  const remove = useCallback(async (kind: Resource, entry: Entry) => {
    if (!entry.id || !window.confirm(`Delete this ${kind === 'transactions' ? 'transaction' : kind.slice(0, -1)}? This cannot be undone.`)) return;
    try { await request(`/api/${kind}/${entry.id}`, { method: 'DELETE' }); setNotice('Entry removed from the ledger.'); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete this entry.'); }
  }, [load]);

  const downloadFile = async (path: string, filename: string) => {
    const response = await fetch(path, { credentials: 'same-origin' });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status}).`); }
    const link = document.createElement('a'); link.href = URL.createObjectURL(await response.blob()); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
  };
  const exportReport = async () => { await downloadFile(`/api/xlsx/export${queryString(filters) ? `?${queryString(filters)}` : ''}`, 'personal-expense-ledger-report.xlsx'); };
  const currentDefault = settings?.defaultAccountId ?? accounts[0]?.id ?? null;
  const month = Number(filters.month) || new Date().getMonth() + 1; const year = Number(filters.year) || new Date().getFullYear();
  const activeContent = useMemo(() => {
    if (tab === 'Overview') return <Analytics summary={summary} onNavigate={name => setTab(name as Tab)} onEdit={t => setEditor({ kind: 'transactions', entry: t })} />;
    if (tab === 'Reports') return <Analytics summary={summary} detailed onNavigate={name => setTab(name as Tab)} onEdit={t => setEditor({ kind: 'transactions', entry: t })} />;
    if (tab === 'Transactions') return <Transactions transactions={transactions} total={totalTransactions} filters={filters} accounts={accounts} categories={categories} onFilter={onFilter} onEdit={t => setEditor({ kind: 'transactions', entry: t })} onDelete={t => void remove('transactions', t)} />;
    if (tab === 'Settings' && settings) return <SettingsPanel settings={settings} accounts={accounts} onSave={async data => { await request('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }); await load(); setNotice('Preferences saved.'); }} />;
    return <ResourceCards kind={tab.toLowerCase() as Exclude<Resource, 'transactions'>} accounts={accounts} categories={categories} budgets={budgets} onEdit={(kind, entry) => setEditor({ kind, entry })} onDelete={(kind, entry) => void remove(kind, entry)} />;
  }, [accounts, budgets, categories, filters, load, remove, settings, summary, tab, totalTransactions, transactions]);

  if (authenticated === null) return <main className="loading-page"><span className="monogram">PEL</span><p>Opening your private ledger…</p></main>;
  if (!authenticated) return <Login onLogin={onLogin} />;
  return <div className={`app-shell ${settings?.theme ?? 'classic-light'}`}>
    <aside className="sidebar">
      <div className="brand"><span className="monogram">PEL</span><div><strong>Personal Expense</strong><span>Ledger</span></div></div>
      <p className="sidebar-kicker">PRIVATE FINANCIAL RECORD</p>
      <nav aria-label="Primary navigation">{tabs.map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}><span className="nav-mark" aria-hidden="true">{item === 'Overview' ? '⌂' : item === 'Transactions' ? '≡' : item === 'Accounts' ? '▥' : item === 'Categories' ? '◈' : item === 'Budgets' ? '⌁' : item === 'Reports' ? '◒' : '⚙'}</span>{item}</button>)}</nav>
      <div className="sidebar-footer"><div className="integration-status"><span className="status-dot" /> Hermes connected</div><button className="sidebar-logout" onClick={() => void onLogout()}>Sign out <span>↗</span></button><small>INDONESIAN RUPIAH · ASIA/JAKARTA</small></div>
    </aside>
    <main className="main-content"><header className="topbar"><button className="mobile-brand monogram" aria-label="Personal Expense Ledger">PEL</button><div className="breadcrumbs"><span>PERSONAL EXPENSE LEDGER</span><i>/</i><strong>{tab.toUpperCase()}</strong></div><div className="top-actions"><button className="quiet-button" onClick={() => void exportReport().catch(e => setError(e instanceof Error ? e.message : 'Unable to export the Excel report.'))}>Export Excel</button>{tab !== 'Settings' && <button className="primary add-button" onClick={() => setEditor({ kind: tab === 'Overview' || tab === 'Reports' ? 'transactions' : tab.toLowerCase() as Resource })}>+ <span className="add-label">New {tab === 'Overview' || tab === 'Reports' ? 'transaction' : tab.slice(0, -1).toLowerCase()}</span></button>}</div></header>
      <section className="page-heading"><div><p className="eyebrow">{tab === 'Overview' ? 'WELCOME BACK' : 'YOUR PRIVATE RECORD'}</p><h1>{titleFor(tab)}</h1><p className="page-subtitle">{subtitleFor(tab)}</p></div><div className="date-stamp"><span>AS OF</span><strong>{new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date())}</strong></div></section>
      {error && <div role="alert" className="alert error page-alert"><strong>Something needs your attention.</strong> {error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}{notice && <div role="status" className="alert success page-alert">{notice}</div>}
      {busy && <div className="saving-line" aria-live="polite">Saving your record…</div>}
      {activeContent}
    </main>
    {editor && <EntryEditor kind={editor.kind} entry={editor.entry} accounts={accounts} categories={categories} defaultAccountId={currentDefault} month={month} year={year} onSave={save} onClose={() => setEditor(null)} />}
  </div>;
}
