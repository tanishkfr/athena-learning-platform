import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { discoveryResources } from '../shared/discovery';
import { useStore } from './store';
import { Button, Icon, Modal, ErrorMessage, Empty, ActionLink } from './ui';
import { ProjectForm } from './forms';

export function ResourceArtwork({ resource }) {
  const cycle = ['cycle', 'recall'].includes(resource.art);
  return <svg className={`discovery-art art-${resource.art}`} viewBox="0 0 400 300" role="img" aria-label={resource.format === 'Visual' ? resource.title : `${resource.topic} illustration`}>
    <rect width="400" height="300" fill="currentColor"/>
    {cycle ? <g fill="none" stroke="#173461" strokeWidth="2"><circle cx="200" cy="145" r="92" strokeDasharray="5 7"/><path d="M122 99l13-3-3 13m136 88-13 3 3-13"/><g fill="#FFFAED"><rect x="139" y="34" width="122" height="49" rx="4"/><rect x="240" y="177" width="122" height="49" rx="4"/><rect x="38" y="177" width="122" height="49" rx="4"/></g><g fill="#173461" stroke="none" fontSize="18" fontFamily="sans-serif" textAnchor="middle"><text x="200" y="65">Attempt</text><text x="301" y="208">Check</text><text x="99" y="208">Revisit</text></g></g> : resource.art === 'groups' ? <g fill="#173461">{[0,1,2,3,4,5].map(i=><circle key={i} cx={75+i%3*32} cy={102+Math.floor(i/3)*32} r="9"/>)}{[0,1,2,3,4,5].map(i=><circle key={i} cx={250+i%3*32} cy={165+Math.floor(i/3)*32} r="9"/>)}<path d="M48 70h120v95H48zm177 65h120v95H225z" fill="none" stroke="#D95F32" strokeWidth="2"/></g> : <g><rect x="58" y="47" width="284" height="210" fill="#FFFAED"/><rect x="82" y="75" width="195" height={resource.art === 'hierarchy' ? 26 : 12} fill="#173461"/><rect x="82" y="122" width="123" height="9" fill="#D95F32"/>{[0,1,2,3].map(i=><rect key={i} x="82" y={155+i*17} width={i===3?141:224} height="4" fill="#173461" opacity=".55"/>)}</g>}
  </svg>;
}
export function Discovery({ query = '', heading = 'Explore resources' }) {
  const { signedIn } = useStore(); const [params, setParams] = useSearchParams(); const location = useLocation();
  const CountHeading = location.pathname === '/search' ? 'h2' : 'p';
  const [saving, setSaving] = useState(null);
  useEffect(() => { const resource = discoveryResources.find(r => r.id === params.get('save')); if (resource && signedIn) { setSaving(resource); const next = new URLSearchParams(params); next.delete('save'); setParams(next, {replace:true}); } }, [params.toString(), signedIn]);
  const format = ['Video','Visual','Article'].includes(params.get('format')) ? params.get('format') : 'All';
  const setFormat = value => { const next = new URLSearchParams(params); if (value === 'All' || value === format) next.delete('format'); else next.set('format', value); setParams(next); };
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = discoveryResources.filter(r => (!words.length || words.some(word => `${r.title} ${r.topic} ${r.content}`.toLowerCase().includes(word))) && (format === 'All' || r.format === format));
  const close = () => { setSaving(null); if (params.has('save')) { const next = new URLSearchParams(params); next.delete('save'); setParams(next, { replace:true }); } };
  return <section className="discovery-section">
    <div className="section-heading"><div>{location.pathname === '/search' ? <h1>{heading}</h1> : <h2>{heading}</h2>}<p className="muted discovery-disclosure">Original examples to explore. This searches Athena’s sample library, not the web.</p></div>{location.pathname !== '/search' && <Link className="text-link" to="/search">Browse samples<Icon name="arrow_forward" size={16}/></Link>}</div>
    <div className="filter-tabs" role="group" aria-label="Learning format">{['All','Video','Visual','Article'].map(value => <button key={value} aria-pressed={format === value} className={format === value ? 'selected' : ''} onClick={() => setFormat(value)}>{value === 'All' ? 'All formats' : value === 'Visual' ? 'Images & diagrams' : value === 'Article' ? 'Reading' : 'Videos'}{format === value && value !== 'All' && <Icon name="close" size={14}/>}</button>)}</div>
    <CountHeading className="collection-caption" aria-live="polite">{matches.length} sample {matches.length === 1 ? 'resource' : 'resources'}</CountHeading>
    {matches.length ? <div className="discovery-grid">{matches.map(resource => <article className={`discovery-card format-${resource.format.toLowerCase()}`} key={resource.id}>
      <Link to={'/discover/' + resource.id} state={{from:location.pathname + location.search}} className="discovery-open">
        {resource.format !== 'Article' && <ResourceArtwork resource={resource}/>}
        <div className="discovery-copy"><p className="resource-format"><Icon name={resource.format === 'Video' ? 'play' : resource.format === 'Visual' ? 'grid' : 'article'} size={16}/>{resource.format} <span>· {resource.topic}</span></p><h3>{resource.title}</h3>{resource.format === 'Article' && <p className="discovery-excerpt">{resource.content.split('\n')[0]}</p>}</div>
      </Link>
      <div className="discovery-card-footer"><span>{resource.detail}</span><SaveResourceButton resource={resource} onSave={() => setSaving(resource)}/></div>
    </article>)}</div> : <Empty title="No sample resources match" action={<ActionLink to="/search">Browse sample resources</ActionLink>}>Try “design”, “memory” or “research”. This prototype searches its example library.</Empty>}
    {saving && <SaveResource resource={saving} onClose={close}/>}
  </section>;
}
function SaveResourceButton({ resource, onSave, children }) {
  const { signedIn } = useStore(); const navigate = useNavigate(); const location = useLocation();
  return <button className={children?'button primary':'discovery-save'} aria-label={`Save ${resource.title}`} onClick={()=>{ if (!signedIn) { sessionStorage.setItem('athena:pending-save', JSON.stringify({ id:resource.id, returnTo:location.pathname+location.search, from:location.state?.from })); navigate('/signup'); } else onSave(); }}>{children || <><Icon name="add" size={17}/>Save</>}</button>;
}
function SaveResource({ resource, onClose }) {
  const { data, mutate } = useStore(); const [projectId,setProjectId]=useState(data.projects[0]?.id || ''); const [creating,setCreating]=useState(false); const [saved,setSaved]=useState(null); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const save = async id => { setBusy(true); setError(''); try { const body=new FormData(); body.set('sampleId',resource.id); body.set('title',resource.title); body.set('type','text'); body.set('content',resource.content); const result=await mutate(`/projects/${id}/resources`,body); setSaved({id:result.id,projectId:id}); } catch(e) {setError(e.message);} finally {setBusy(false);} };
  if (creating) return <ProjectForm initialTitle={resource.topic} onClose={()=>setCreating(false)} onCreated={project=>{setCreating(false);setProjectId(project.id);save(project.id);}}/>;
  return <Modal title={saved?'Resource saved':'Save to a project'} onClose={onClose}>{saved ? <><p>“{resource.title}” is in {data.projects.find(p=>p.id===saved.projectId)?.title}.</p><div className="form-actions"><Button variant="secondary" onClick={onClose}>Continue browsing</Button><ActionLink variant="primary" to={'/learn/'+saved.id}>Learn & capture a note</ActionLink></div></> : <><p>{resource.title}</p><form onSubmit={e=>{e.preventDefault();save(projectId);}}>{data.projects.length>0 && <label>Project<select value={projectId} onChange={e=>setProjectId(e.target.value)} required>{data.projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}<ErrorMessage error={error}/><div className="form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={()=>setCreating(true)}>New project</Button><Button disabled={busy || !projectId}>{busy?'Saving…':'Save resource'}</Button></div></form></>}</Modal>;
}
export function SearchResults() {
  const [params]=useSearchParams(); const query=params.get('q')||''; const [draft,setDraft]=useState(query); const navigate=useNavigate();
  useEffect(()=>setDraft(query),[query]);
  return <div className="page discovery-page"><Link className="breadcrumb" to="/"><Icon name="arrow_back" size={16}/>Home</Link><form className="search-box home-search-box" onSubmit={e=>{e.preventDefault();const next=new URLSearchParams(params); if(draft.trim()) next.set('q',draft.trim()); else next.delete('q'); navigate('/search?'+next);}}><Icon name="search"/><input aria-label="Search resources" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Search a topic"/><button type="button" className="icon-button search-clear" aria-label="Clear search" disabled={!draft} onClick={()=>{setDraft('');const next=new URLSearchParams(params);next.delete('q');navigate('/search?'+next);}}><Icon name="close" size={18}/></button><button className="search-submit" aria-label="Search resources"><Icon name="arrow_forward"/></button></form><Discovery query={query} heading={query?`Results for "${query}"`:'Explore resources'}/></div>;
}
export function DiscoverResource() {
  const {id}=useParams(); const location=useLocation(); const resource=discoveryResources.find(r=>r.id===id); const [saving,setSaving]=useState(false); const [params,setParams]=useSearchParams(); const {signedIn}=useStore();
  useEffect(()=>{if(signedIn && params.get('save')===id){setSaving(true);const next=new URLSearchParams(params);next.delete('save');setParams(next,{replace:true});}},[signedIn,params.toString(),id]);
  if(!resource)return <Empty title="Resource not found" action={<ActionLink to="/search">Browse resources</ActionLink>}>Choose another resource from the example library.</Empty>;
  return <div className="page discovery-preview"><Link className="breadcrumb" to={location.state?.from || '/search'}>Resources</Link><div className="discovery-preview-layout"><div><ResourceArtwork resource={resource}/><p className="small muted">Original prototype example · {resource.format === 'Video' ? 'Illustrative video transcript; no recording is included.' : resource.format}</p></div><article><p className="eyebrow">{resource.topic}</p><h1>{resource.title}</h1><p className="muted">{resource.detail}</p>{resource.content.split(/\n+/).map((text,i)=><p key={i}>{text}</p>)}<SaveResourceButton resource={resource} onSave={()=>setSaving(true)}>Save resource</SaveResourceButton><p className="small muted">Save to a project to learn alongside your notes.</p></article></div>{saving && <SaveResource resource={resource} onClose={()=>{setSaving(false);setParams({}, {replace:true});}}/>}</div>;
}
