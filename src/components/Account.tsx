import { useState } from 'react'
import type { Account as AccountStatus } from '../lib/supabase'

interface Props {
  account: AccountStatus | null
  busy: boolean
  onLogin: (email: string, password: string) => Promise<string | null>
  onLogout: () => Promise<void>
  onBack: () => void
}

/**
 * Account — one page, one job. Signed in with a real, named account: show
 * who, offer to log out. Otherwise: a plain email + password form. Accounts
 * are set up manually for now (Supabase dashboard) — this is sign-IN, not
 * self-serve signup.
 */
export function Account({ account, busy, onLogin, onLogout, onBack }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  const signedIn = account?.email && !account.anonymous

  const submit = async () => {
    if (!email.trim() || !password) return
    setErr('')
    const problem = await onLogin(email.trim(), password)
    if (problem) setErr(`Error — ${problem}`)
    else { setEmail(''); setPassword('') }
  }

  if (signedIn) {
    return (
      <div className="develop">
        <button className="btn text back-line" onClick={onBack}>← Settings</button>
        <h1>Account</h1>
        <p className="sub">Signed in as {account.email}. Your nights back up here.</p>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => void onLogout()} disabled={busy}>
          {busy ? 'Signing out…' : 'Log out'}
        </button>
      </div>
    )
  }

  return (
    <div className="develop">
      <button className="btn text back-line" onClick={onBack}>← Settings</button>
      <h1>Account</h1>
      <p className="sub">
        {account?.anonymous
          ? 'This device backs up anonymously — not yet linked to an account. Log in to reach it from anywhere.'
          : 'Log in to bring back everything an account has backed up — on any device.'}
      </p>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
        autoFocus
        aria-label="Email"
      />
      <div className="section">
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          aria-label="Password"
          onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
        />
      </div>
      {err && <p className="field-error">{err}</p>}
      <div className="spacer" />
      <button className="btn" onClick={() => void submit()} disabled={busy || !email.trim() || !password}>
        {busy ? 'Logging in…' : 'Log in'}
      </button>
    </div>
  )
}
