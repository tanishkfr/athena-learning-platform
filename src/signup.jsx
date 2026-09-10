import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from './store';
import { Button, ErrorMessage, Icon } from './ui';

export function Signup() {
  const { mutate } = useStore(); const navigate = useNavigate();
  const [step, setStep] = useState(0); const [name, setName] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [show, setShow] = useState(false); const [code, setCode] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <div className="signup-page">
    <header className="signup-header"><Link className="wordmark" to="/" aria-label="Athena home">athena<span className="brand-period">.</span></Link><Link className="text-link" to="/">Explore the workspace <Icon name="arrow_forward" size={17}/></Link></header>
    <div className="signup-layout">
      <aside className="signup-intro"><p className="eyebrow">A PLACE FOR YOUR CURIOSITY</p><h1>Make room for<br/><em>what stays.</em></h1><p>Bring your sources together. Find your own words. Come back to the ideas that need another look.</p><ol className="signup-steps">{['Create your account', 'Verify your email', 'Start learning'].map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined} className={step === i ? 'current' : ''}><span>{i < step ? <Icon name="check" size={17}/> : `0${i + 1}`}</span>{label}</li>)}</ol></aside>
      <section className="signup-form" aria-labelledby="signup-title" key={step}>
        <p className="eyebrow">STEP {step + 1} OF 3</p>
        {step === 0 ? <><h2 id="signup-title">Start with you.</h2><p className="muted">Create a little space for what you want to learn.</p><form onSubmit={e => { e.preventDefault(); setError(''); setPassword(''); setStep(1); }}>
          <label>Your name<input autoFocus required maxLength={50} autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" pattern=".*\S.*"/></label>
          <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
          <label htmlFor="signup-password">Password</label><div className="signup-password"><input id="signup-password" required minLength={8} type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} aria-describedby="password-help"/><button type="button" className="text-button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div><p id="password-help" className="small muted">Use at least 8 characters. A made-up password is fine here.</p>
          <Button> Create account <Icon name="arrow_forward" size={18}/></Button>
        </form></> : step === 1 ? <><h2 id="signup-title">Check your inbox.</h2><p className="muted">In the full experience, a verification code would be sent to <strong>{email}</strong>.</p><div className="signup-demo-code"><span className="small">Preview code</span><strong>123456</strong><span className="small muted">No email has been sent.</span></div><form onSubmit={e => { e.preventDefault(); if (code !== '123456') { setError('Use the preview code 123456 to continue.'); return; } setError(''); setStep(2); }}><label>Verification code<input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code"/></label><ErrorMessage error={error}/><Button>Verify email <Icon name="arrow_forward" size={18}/></Button><button className="text-button signup-back" type="button" onClick={() => { setError(''); setCode(''); setStep(0); }}>Change email</button></form></> : <><span className="signup-success"><Icon name="check" size={32}/></span><h2 id="signup-title">Welcome, {name.trim()}.</h2><p className="muted">Your next question is a good place to begin. Start a project or explore the example collection.</p><ErrorMessage error={error}/><Button disabled={busy} onClick={async () => { setBusy(true); try { await mutate('/preferences', { name: name.trim() }, 'PATCH'); navigate('/projects'); } catch (e) { setError(e.message); setBusy(false); } }}>{busy ? 'Opening your workspace…' : 'Enter your workspace'}<Icon name="arrow_forward" size={18}/></Button></>}
        <p className="signup-preview small muted">Sign-up preview. No online account is created. Email and password are not saved; only your name is applied to this local workspace when you continue.</p>
      </section>
    </div>
    </div>;
}
