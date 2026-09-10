import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from './store';
import { Button, ErrorMessage, Icon } from './ui';

export function Signup({ login = false }) {
  const { mutate, signIn, prefs } = useStore(); const navigate = useNavigate();
  const [step, setStep] = useState(0); const [name, setName] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [show, setShow] = useState(false); const [code, setCode] = useState('');
  const [provider, setProvider] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const formPanel = useRef(null); const Heading = step > 0 ? 'h1' : 'h2';
  useEffect(() => { const target = formPanel.current?.querySelector('input') || formPanel.current?.querySelector('h1, h2'); if (['H1','H2'].includes(target?.tagName)) target.tabIndex = -1; target?.focus(); }, [step, login]);
  const finish = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      await mutate('/preferences', { name: name.trim() || prefs.name || 'Learner' }, 'PATCH');
      const pending = JSON.parse(sessionStorage.getItem('athena:pending-project') || 'null');
      if (pending) {
        const project = await mutate('/projects', { title: pending.title, goal: pending.goal, description: pending.description });
        sessionStorage.removeItem('athena:pending-project');
        for (const field of ['title', 'goal', 'description']) localStorage.removeItem('athena:draft:project-' + field + '-new');
        signIn(); navigate('/projects/' + project.id + (pending.addResource ? '?add=1' : ''));
      } else {
        signIn(); const saved = JSON.parse(sessionStorage.getItem('athena:pending-save') || 'null');
        if (saved) { const target = new URL(saved.returnTo, location.origin); target.searchParams.set('save', saved.id); sessionStorage.removeItem('athena:pending-save'); navigate(target.pathname + target.search, {state:{from:saved.from}}); }
        else navigate('/');
      }
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return <div className="signup-page">
    <header className="signup-header"><Link className="wordmark" to="/" aria-label="Athena home">athena<span className="brand-period">.</span></Link><Link className="text-link" to="/">Continue browsing <Icon name="arrow_forward" size={17}/></Link></header>
    <div className={`signup-layout ${step > 0 ? 'signup-later' : ''}`}>
      <aside className="signup-intro"><div className="signup-intro-copy"><p className="eyebrow">YOUR LEARNING WORKSPACE</p><h1>Make room for<br/><em>what stays.</em></h1><p>Keep your sources, notes and reviews together.</p></div><ol className="signup-steps">{[login ? 'Log in' : 'Create your account', 'Verify your email', 'Start learning'].map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined} className={step === i ? 'current' : ''}><span>{i < step ? <Icon name="check" size={17}/> : `0${i + 1}`}</span>{label}</li>)}</ol></aside>
      <section ref={formPanel} className="signup-form" aria-labelledby="signup-title" key={step} aria-busy={busy}>
        <p className="eyebrow">{login ? 'WELCOME BACK' : `STEP ${step + 1} OF 3`}</p>
        {step === 0 ? <><Heading id="signup-title">{login ? 'Log in to Athena.' : 'Create your account.'}</Heading><p className="muted">{login ? 'Open your saved workspace.' : 'Save resources and keep your notes in context.'}</p>
          <div className="signup-providers">{['Google','Apple','Microsoft'].map(value=><button key={value} className="button secondary" type="button" onClick={()=>{setProvider(value);setName(prefs.name || 'Learner');setPassword('');setError('');setStep(2);}}>Continue with {value}<Icon name="arrow_forward" size={17}/></button>)}</div><p className="signup-divider small muted">or use email</p>
          <form onSubmit={e => { e.preventDefault(); setError(''); setPassword(''); if(login) {setName(prefs.name || 'Learner');setStep(2);} else setStep(1); }}>
          {!login && <label>Your name<input required maxLength={50} autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" pattern=".*\S.*"/></label>}
          <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
          <label htmlFor="signup-password">Password</label><div className="signup-password"><input id="signup-password" required minLength={8} type={show ? 'text' : 'password'} autoComplete={login?'current-password':'new-password'} value={password} onChange={e => setPassword(e.target.value)} aria-describedby="password-help"/><button type="button" className="text-button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div><p id="password-help" className="small muted">Preview only. Use any made-up password of 8 or more characters.</p>
          <Button>{login ? 'Log in' : 'Create account'}<Icon name="arrow_forward" size={18}/></Button>
        </form><p className="small">{login?'New to Athena?':'Already have an account?'} <Link className="text-link" to={login?'/signup':'/login'}>{login?'Sign up':'Log in'}</Link></p></> : step === 1 ? <><Heading id="signup-title">Verify your email.</Heading><p className="muted">The full experience would send a code to <strong>{email}</strong>.</p><div className="signup-demo-code"><span className="small">Preview code</span><strong>123456</strong><span className="small muted">No email has been sent.</span></div><form onSubmit={e => { e.preventDefault(); if (code !== '123456') { setError('Use the preview code 123456 to continue.'); return; } setError(''); setStep(2); }}><label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code"/></label><ErrorMessage error={error}/><Button>Verify email<Icon name="arrow_forward" size={18}/></Button><button className="text-button signup-back" type="button" onClick={() => { setError(''); setCode(''); setStep(0); }}>Change email</button></form></> : <><span className="signup-success"><Icon name="check" size={32}/></span><Heading id="signup-title">Welcome{login?' back':''}, {name.trim() || 'Learner'}.</Heading><p className="muted">{provider ? `${provider} sign-in simulated. No provider connection was made.` : 'Your preview workspace is ready.'}</p><p className="small muted">Any project details or resource you selected will continue from here.</p><ErrorMessage error={error}/><Button disabled={busy} onClick={finish}>{busy ? 'Opening your workspace…' : 'Enter your workspace'}<Icon name="arrow_forward" size={18}/></Button></>}
        <p className="signup-preview small muted">Authentication preview. No online account is created. Email and password are not stored or checked. Provider buttons simulate sign-in; only your display name and a browser session are saved.</p>
      </section>
    </div>
  </div>;
}
