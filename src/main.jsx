import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import '@fontsource/literata/500.css';
import '@fontsource/literata/500-italic.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import { Store, useStore } from './store';
import { Home, Projects, Library, Settings } from './pages';
import { Project } from './project';
import { Learn } from './learn';
import { ReviewSetup, ActiveReview, Report, Reviews, Insights } from './review';
import { Icon, Loading, ErrorMessage, Empty, ActionLink } from './ui';
import './styles.css';
import { Signup } from './signup';

function Shell() {
  const { data, error, refresh, prefs } = useStore(); const [menu, setMenu] = useState(false); const location = useLocation(); const focused = location.search.includes('focus=1'); const signup = location.pathname === '/signup';
  return <><a className="skip-link" href="#main">Skip to content</a>{!focused && !signup && <header className="app-header"><Link className="wordmark" to="/" aria-label="Athena home">athena<span className="brand-period">.</span></Link><button className="icon-button mobile-menu" onClick={() => setMenu(!menu)} aria-label="Toggle navigation" aria-expanded={menu}><Icon name="menu"/></button><nav className={menu ? 'open' : ''} aria-label="Main navigation">{[['/', 'Home'], ['/projects', 'Projects'], ['/resources', 'Library'], ['/reviews', 'Reviews'], ['/insights', 'Insights']].map(([to, name]) => <NavLink key={to} end={to === '/'} to={to} onClick={() => setMenu(false)}>{name}</NavLink>)}</nav><Link to="/signup" className="text-link signup-entry">Sign up</Link><Link to="/settings" className="profile-control" aria-label="Local profile and preferences">{(prefs?.name || 'L').slice(0, 1).toUpperCase()}</Link></header>}<main id="main" tabIndex={-1} className={focused ? 'main focused' : 'main'}>{!data ? error ? <Empty title="Workspace unavailable" action={<button className="button" onClick={refresh}>Retry connection</button>}>{error}</Empty> : <Loading/> : <><ErrorMessage error={error && 'Connection interrupted. Your saved work remains on this computer. Reconnecting…'}/><Routes><Route path="/signup" element={<Signup/>}/><Route path="/" element={<Home/>}/><Route path="/projects" element={<Projects/>}/><Route path="/projects/:id" element={<Project/>}/><Route path="/projects/:id/:tab" element={<Project/>}/><Route path="/resources" element={<Library/>}/><Route path="/learn/:id" element={<Learn/>}/><Route path="/projects/:id/review" element={<ReviewSetup/>}/><Route path="/reviews/:id" element={<ActiveReview/>}/><Route path="/reviews/:id/report" element={<Report/>}/><Route path="/reviews" element={<Reviews/>}/><Route path="/insights" element={<Insights/>}/><Route path="/settings" element={<Settings/>}/><Route path="*" element={<Empty title="This page isn’t here" action={<ActionLink to="/projects">Your projects</ActionLink>}>Return to your workspace to continue learning.</Empty>}/></Routes></>}</main>{!focused && !signup && <footer className="app-footer"><span>A little more understood.</span><Link to="/settings"><span className="local-dot"/>Local workspace · your work stays here<Icon name="arrow_forward" size={14}/></Link></footer>}</>;
}
class Boundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div className="empty"><h1>Let’s reopen your workspace.</h1><p>Your saved work is still on this computer.</p><button className="button" onClick={() => location.reload()}>Reload Athena</button></div> : this.props.children; }
}
createRoot(document.getElementById('root')).render(<Boundary><BrowserRouter><Store><Shell/></Store></BrowserRouter></Boundary>);

