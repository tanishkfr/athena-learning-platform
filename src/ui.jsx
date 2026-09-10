import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from './store';

// Material Symbols outlined paths, Apache 2.0, used as local SVGs.
const paths = {
  arrow_forward: 'm12 4-1.4 1.4L16.2 11H4v2h12.2l-5.6 5.6L12 20l8-8z',
  arrow_back: 'm12 4 1.4 1.4L7.8 11H20v2H7.8l5.6 5.6L12 20l-8-8z',
  add: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  close: 'm6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z',
  search: 'M9.5 3a6.5 6.5 0 1 0 4.02 11.6L20 21l1-1-6.4-6.48A6.5 6.5 0 0 0 9.5 3m0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9',
  folder: 'M10 4H2v16h20V6H12zm10 14H4V6h5l2 2h9z',
  article: 'M4 3h16v18H4zm2 2v14h12V5zm2 3h8v2H8zm0 4h8v2H8zm0 4h5v1H8z',
  play: 'M8 5v14l11-7z',
  notes: 'M4 3h16v13l-5 5H4zm2 2v14h8v-4h4V5zm2 3h8v2H8zm0 4h8v2H8z',
  upload: 'M11 16V7.8l-3.6 3.6L6 10l6-6 6 6-1.4 1.4L13 7.8V16zM4 18h16v2H4z',
  grid: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  list: 'M3 4h3v3H3zm5 0h13v3H8zM3 10h3v3H3zm5 0h13v3H8zM3 16h3v3H3zm5 0h13v3H8z',
  check: 'm9 17-5-5 1.4-1.4L9 14.2 18.6 4.6 20 6z',
  external: 'M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14zM3 3h8v2H5v14h14v-6h2v8H3z',
  focus: 'M3 3h7v2H5v5H3zm11 0h7v7h-2V5h-5zM3 14h2v5h5v2H3zm16 0h2v7h-7v-2h5z',
  review: 'M12 2a10 10 0 1 1-9.5 13h2.2A8 8 0 1 0 7 5.8L10 9H2V1l3.6 3.4A10 10 0 0 1 12 2m-1 5h2v5l4 2-1 1.7-5-3z',
  light: 'M12 2a7 7 0 0 0-4 12.74V18h8v-3.26A7 7 0 0 0 12 2m-2 14v-2.4l-1-.58A5 5 0 1 1 15 14l-1 .6V16zm0 4h4v2h-4z',
  book: 'M3 3h8l1 1 1-1h8v17h-8l-1 1-1-1H3zm2 2v13h6V5zm8 0v13h6V5z',
  delete: 'M7 3h10v2h4v2H3V5h4zm-2 6h14v12H5zm2 2v8h10v-8z',
  tune: 'M3 5h10v2H3zm14 0h4v2h-4zm-4-2h4v6h-4zM3 11h4v2H3zm8 0h10v2H11zm-4-2h4v6H7zM3 17h12v2H3zm16 0h2v2h-2zm-4-2h4v6h-4z',
  calendar: 'M6 2h2v2h8V2h2v2h3v18H3V4h3zm13 8H5v10h14zM5 6v2h14V6z',
  link: 'M8 7H6a5 5 0 0 0 0 10h2v-2H6a3 3 0 0 1 0-6h2zm8 0h2a5 5 0 0 1 0 10h-2v-2h2a3 3 0 0 0 0-6h-2zm-9 4h10v2H7z',
  menu: 'M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z',
};
export function Icon({ name, size = 20 }) { return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d={paths[name] || paths.article}/></svg>; }
export function Button({ children, icon, variant = 'primary', className = '', ...props }) { return <button className={`button ${variant} ${className}`} {...props}>{icon && <Icon name={icon}/>} {children}</button>; }
export function ActionLink({ to, children, icon = 'arrow_forward', variant = 'secondary', ...props }) { return <Link to={to} className={`button ${variant}`} {...props}>{children}<Icon name={icon}/></Link>; }
export function Status({ value }) { return <span className={`status state-${value?.toLowerCase().replaceAll(' ', '-')}`}><span className="status-dot"/>{value}</span>; }
export function Empty({ icon = 'book', title, children, action }) { return <div className="empty"><span className="empty-icon"><Icon name={icon} size={28}/></span><h3>{title}</h3><p>{children}</p>{action}</div>; }
export function ErrorMessage({ error }) { return error ? <div className="error-message" role="alert">{error}</div> : null; }
export function Loading({ children = 'Opening your workspace…' }) { return <div className="loading" role="status"><span className="spinner"/>{children}</div>; }
export function Modal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => { const el = ref.current; const old = document.activeElement; el.showModal(); return () => { el.close(); old?.focus?.(); }; }, []);
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="modal-title" onClick={e => { if (e.target === ref.current) onClose(); }}><div className="modal-head"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close"/></button></div>{children}</dialog>;
}
export function PageHeading({ eyebrow, title, description, children }) { return <header className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted intro">{description}</p>}</div>{children && <div className="heading-actions">{children}</div>}</header>; }
export function Reference({ chunkId, label }) {
  const location = useLocation();
  const focus = new URLSearchParams(location.search).get('focus') === '1' ? '&focus=1' : '';
  const { data } = useStore(); const chunk = data.chunks.find(c => c.id === chunkId); const resource = data.resources.find(r => r.id === chunk?.resourceId);
  return chunk && resource ? <Link className="source-reference" to={`/learn/${resource.id}?chunk=${chunk.id}${focus}`}><Icon name="link" size={16}/>{label || `${resource.title} · ${chunk.location.label}`}<Icon name="arrow_forward" size={16}/></Link> : <span className="muted small">Source removed</span>;
}
export function SourceReferences({ ids = [] }) { return <div className="source-references">{[...new Set(ids)].map(key => <Reference key={key} chunkId={key}/>)}</div>; }
export function ConfirmDelete({ title, detail, onDelete, onClose }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <Modal title={title} onClose={onClose}><p>{detail}</p><ErrorMessage error={error}/><div className="form-actions"><Button variant="secondary" onClick={onClose}>Keep it</Button><Button variant="danger" disabled={busy} onClick={async () => { setBusy(true); try { await onDelete(); onClose(); } catch (e) { setError(e.message); setBusy(false); } }}>{busy ? 'Removing…' : 'Delete'}</Button></div></Modal>;
}
export function BookArt({ variant = 0, compact = false }) {
  return <div className={`book-art art-${variant % 3} ${compact ? 'compact' : ''}`} aria-hidden="true"><svg viewBox="0 0 360 180" fill="none"><path d="M70 136V44c42-9 76-3 110 20 34-23 68-29 110-20v92c-42-9-76-3-110 20-34-23-68-29-110-20Z" stroke="currentColor" strokeWidth="1.5"/><path d="M180 65v90M83 53c31-3 59 3 83 17M83 67c31-3 59 3 83 17M83 81c31-3 59 3 60 4M194 72c24-14 52-20 83-17M194 87c24-14 52-20 83-17M194 102c24-14 52-20 83-17M194 117c24-14 52-20 58-17" stroke="currentColor" strokeWidth="1"/><circle cx="124" cy="110" r="13" stroke="currentColor"/><path d="m120 110 4-5 5 9" stroke="currentColor"/><path d="M307 34v20m-10-10h20" stroke="currentColor"/><circle cx="49" cy="120" r="3" fill="currentColor"/></svg></div>;
}

