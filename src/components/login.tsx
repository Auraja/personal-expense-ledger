"use client";
import React, { useState } from 'react';

export function Login({ onLogin }: { onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="login-page"><div className="login-decoration" aria-hidden="true"><span>PEL</span><div>Keep a considered account<br/>of everyday life.</div><p>Clarity today. Confidence tomorrow.</p></div><section className="login-card"><div className="monogram">PEL</div><p className="eyebrow">PRIVATE FINANCIAL RECORD</p><h1>Personal Expense<br/>Ledger</h1><p className="muted">A quieter way to see where your money goes.</p><form onSubmit={async e => {e.preventDefault();setBusy(true);setError('');try {await onLogin(password);} catch(err) {setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');} finally {setBusy(false);}}}><label>Dashboard password<input aria-label="Dashboard password" autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>{error && <p role="alert" className="alert error">{error}</p>}<button className="primary" disabled={busy}>{busy?'Opening ledger…':'Open my ledger'}<span aria-hidden="true"> →</span></button></form><div className="login-note"><strong>Your record stays private.</strong><p>Use the dashboard password configured in the server .env file. This is not your Hermes API token.</p><p>Your session signs out automatically after 3 minutes without activity.</p></div><p className="tiny muted">INDONESIAN RUPIAH · ASIA/JAKARTA</p></section></main>;
}
