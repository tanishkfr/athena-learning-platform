import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from './store';
import { Button, Icon, ActionLink, Empty, PageHeading, Status, Modal, ErrorMessage } from './ui';
import { ProjectForm, ResourceForm } from './forms';
import { Discovery } from './discovery';

export function Home() {
  const { data, mutate, prefs, signedIn } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState(''); const [create, setCreate] = useState(false);
  const [upload, setUpload] = useState(false); const [choose, setChoose] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const due = prefs.reminders ? data.schedules.filter(s => s.status !== 'Dismissed' && new Date(s.dueAt) <= new Date()).length : 0;
  const recent = [...data.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 2);
  return <div className="home">
    <section className="home-search" aria-labelledby="home-title">
      <div className="home-intro"><h1 id="home-title">What will you<br/><em>make sense of</em> today?</h1><p>Collect your sources, capture your thoughts, and put your understanding into words.</p></div>
      <div className="home-start"><h2>Find a starting point</h2>
        <form className="search-box home-search-box" onSubmit={e => { e.preventDefault(); navigate('/search?q=' + encodeURIComponent(query)); }}>
          <Icon name="search" size={22}/><input aria-label="Search learning resources" placeholder="Try design, memory or research" value={query} onChange={e => setQuery(e.target.value)}/><button aria-label="Search resources" className="search-submit"><Icon name="arrow_forward"/></button>
        </form>
        <p className="search-context">Browse original sample resources, or bring your own.</p>
        <div className="home-actions"><Button icon="add" onClick={() => setCreate(true)}>New project</Button><Button variant="secondary" icon="upload" onClick={() => { if (signedIn && data.projects.length) setChoose(true); else { setUpload(true); setCreate(true); } }}>Upload files</Button></div>
        <button className="text-link example-link" disabled={busy} onClick={async () => { setBusy(true); try { const p = await mutate('/demo', {}); navigate('/projects/' + p.id); } catch (e) { setError(e.message); } finally { setBusy(false); } }}><Icon name="book" size={18}/>{busy ? 'Opening example…' : 'Explore an example project'}<Icon name="arrow_forward" size={16}/></button>
        <ErrorMessage error={error}/>
      </div>
    </section>
    <section className="home-bottom">
      {signedIn && due > 0 && <div className="continue-strip"><div><Icon name="review"/><p>{due} {due === 1 ? 'concept is' : 'concepts are'} ready for another look.</p><ActionLink to="/reviews">Review now</ActionLink></div></div>}
      {signedIn && recent.length > 0 && <section className="recent-section" aria-labelledby="recent-title"><div className="section-heading"><div><h2 id="recent-title">Pick up a thought</h2><p className="muted">Your recent projects, ready when you are.</p></div><Link className="text-link" to="/projects">All projects <Icon name="arrow_forward" size={18}/></Link></div><div className="home-recents">{recent.map(p => <Link className="recent-row" key={p.id} to={p.lastResourceId && data.resources.some(r => r.id === p.lastResourceId) ? '/learn/' + p.lastResourceId : '/projects/' + p.id}><span className="tile-icon"><Icon name="folder" size={24}/></span><div><h3>{p.title}</h3><p>{data.resources.filter(r => r.projectId === p.id).length} {data.resources.filter(r => r.projectId === p.id).length === 1 ? 'resource' : 'resources'} · {p.status === 'Active' ? 'In progress' : 'Finished'}</p></div><Icon name="arrow_forward"/></Link>)}</div></section>}
      <Discovery/>
    </section>
    {create && <ProjectForm initialTitle={query} onClose={() => { setCreate(false); setUpload(false); }} onCreated={upload ? p => { navigate('/projects/' + p.id + '?add=1'); setUpload(false); } : undefined}/>}
    {choose && <Modal title="Add files to a project" onClose={() => setChoose(false)}><p>Choose where to keep this resource.</p><div className="project-picker">{data.projects.map(p => <Link key={p.id} to={`/projects/${p.id}?add=1`}>{p.title}<Icon name="arrow_forward"/></Link>)}</div></Modal>}
  </div>;
}

export function ProjectCard({ project }) {
  const { data, mutate, notice } = useStore(); const [finishing, setFinishing] = useState(false);
  const resources = data.resources.filter(r => r.projectId === project.id);
  const tested = data.concepts.filter(c => c.projectId === project.id && c.state !== 'Not Tested');
  return <article className="project-card">
    <Link to={'/projects/' + project.id} className="project-card-open">
      <div className="project-card-top"><span className="project-kind"><Icon name="folder" size={20}/>{project.demo ? 'Example project' : 'Learning project'}</span><Status value={project.status === 'Active' ? 'In progress' : project.status}/></div>
      <h3>{project.title}</h3><p className="project-goal">{project.goal}</p>
      <div className="project-card-footer"><span><Icon name="book" size={16}/>{resources.length} {resources.length === 1 ? 'resource' : 'resources'}</span><span>{tested.length ? `${tested.length} ${tested.length === 1 ? 'concept' : 'concepts'} tested` : 'Knowledge not tested'}</span></div>
      <span className="project-open-label">Open project<Icon name="arrow_forward" size={18}/></span>
    </Link>
    {project.status === 'Active' && <button className="text-button card-finish" disabled={finishing} aria-label={'Finish project: ' + project.title} onClick={async () => { setFinishing(true); try { await mutate(`/projects/${project.id}/finish`, {}); notice('Project marked finished. You can still edit or review it.'); } catch(e) { notice(e.message); } finally { setFinishing(false); } }}>{finishing ? 'Finishing…' : 'Finish project'}</button>}
  </article>;
}

export function Projects() {
  const { data, prefs, mutate, notice, signedIn } = useStore();
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('All'); const [create, setCreate] = useState(false);
  const availableProjects = signedIn ? data.projects : [];
  const projects = [...availableProjects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter(p => (p.title + ' ' + p.goal).toLowerCase().includes(query.trim().toLowerCase()) && (filter === 'All' || (filter === 'In progress' ? p.status === 'Active' : p.status !== 'Active')));
  const latest = [...availableProjects].filter(p => p.lastResourceId && data.resources.some(r => r.id === p.lastResourceId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const due = (signedIn ? data.schedules : []).filter(s => s.status !== 'Dismissed' && new Date(s.dueAt) <= new Date()).length;
  return <div className="page projects-page">
    <PageHeading title="Your projects" description="A space for each thing you want to understand."><Button icon="add" onClick={() => setCreate(true)}>New project</Button></PageHeading>
    {(latest || due > 0) && <div className="continue-strip">{latest && <div><Icon name="book" size={28}/><div><p className="continuation-label">Continue reading</p><h3>{data.resources.find(r => r.id === latest.lastResourceId)?.title}</h3><p className="muted small">{latest.title} · your place is saved</p></div><ActionLink to={'/learn/' + latest.lastResourceId}>Continue</ActionLink></div>}{due > 0 && <div><Icon name="review"/><p>{due} {due === 1 ? 'concept is' : 'concepts are'} ready for review.</p><ActionLink to="/reviews">Review now</ActionLink></div>}</div>}
    <div className="collection-toolbar"><div className="filter-tabs" role="group" aria-label="Project status">{['All', 'In progress', 'Finished'].map(f => <button key={f} className={filter === f ? 'selected' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}<span className="filter-count">{availableProjects.filter(p => f === 'All' || (f === 'In progress' ? p.status === 'Active' : p.status !== 'Active')).length}</span></button>)}</div><div className="toolbar"><div className="search-box small-search"><Icon name="search" size={18}/><input aria-label="Search projects" placeholder="Find a project or goal" value={query} onChange={e => setQuery(e.target.value)}/></div><div className="segmented" role="group" aria-label="Project layout">{['grid', 'list'].map(view => <button key={view} aria-label={view === 'grid' ? 'Grid view' : 'List view'} aria-pressed={prefs.view === view} onClick={() => mutate('/preferences', { view }, 'PATCH').catch(e => notice(e.message))}><Icon name={view}/></button>)}</div></div></div>
    <h2 className="collection-caption" aria-live="polite">{projects.length} {projects.length === 1 ? 'project' : 'projects'}{query ? ` matching “${query}”` : ''}</h2>
    {projects.length ? <div className={`projects-collection ${prefs.view}`}>{projects.map(p => <ProjectCard key={p.id} project={p}/>)}</div> : <Empty icon="folder" title={availableProjects.length ? 'No projects match this view' : 'Start with something you want to understand.'} action={availableProjects.length ? <Button variant="secondary" onClick={() => { setQuery(''); setFilter('All'); }}>Clear search & filters</Button> : <Button icon="add" onClick={() => setCreate(true)}>Create a project</Button>}>{availableProjects.length ? 'Try a different title, goal or project status.' : 'Add a goal, bring in your resources, and take it at your own pace.'}</Empty>}
    {create && <ProjectForm onClose={() => setCreate(false)}/>}
  </div>;
}

export const typeLabel = type => ({ text: 'Text', article: 'Article', video: 'Video', pdf: 'PDF', document: 'Document' }[type] || type);
export function ResourceRow({ resource, showProject = false }) {
  const { data } = useStore();
  return <Link className="resource-row" to={'/learn/' + resource.id}><span className={`resource-type-icon type-${resource.type}`}><Icon name={resource.type === 'video' ? 'play' : 'article'} size={23}/></span><div className="resource-row-main"><div className="card-overline"><span>{typeLabel(resource.type)}{resource.pageCount ? ` · ${resource.pageCount} pages` : resource.wordCount ? ` · ${Math.max(1, Math.ceil(resource.wordCount / 200))} min read` : ''}</span></div><h3>{resource.title}</h3><p>{resource.source}{resource.author ? ` · ${resource.author}` : ''}{showProject ? ` · ${data.projects.find(p => p.id === resource.projectId)?.title || ''}` : ''}</p></div><Status value={resource.status}/><Icon name="arrow_forward" size={20}/></Link>;
}
export function ResourceLibrary({ projectId }) {
  const { data, signedIn } = useStore(); const [params] = useSearchParams(); const [query, setQuery] = useState(params.get('q') || ''); const [filter, setFilter] = useState('All'); const [add, setAdd] = useState(false);
  const categories = { All: [], Videos: ['video'], 'Articles / Text': ['article', 'text'], Documents: ['pdf', 'document'], 'Websites / Links': ['article'] };
  const resources = (projectId || signedIn ? data.resources : []).filter(r => (!projectId || r.projectId === projectId) && (filter === 'All' || categories[filter].includes(r.type)) && (r.title + ' ' + r.source + ' ' + data.chunks.filter(c => c.resourceId === r.id).map(c => c.text).join(' ')).toLowerCase().includes(query.toLowerCase()));
  return <><div className="section-heading"><div className="search-box library-search"><Icon name="search"/><input aria-label="Search resources" placeholder="Search your saved sources" value={query} onChange={e => setQuery(e.target.value)}/></div>{projectId && <Button icon="add" onClick={() => setAdd(true)}>Add resource</Button>}</div><div className="filter-tabs" role="group" aria-label="Saved resource type">{Object.keys(categories).map(type => <button key={type} className={filter === type ? 'selected' : ''} aria-pressed={filter === type} onClick={() => setFilter(type)}>{type}</button>)}</div><h2 className="collection-caption" aria-live="polite">{resources.length} saved {resources.length === 1 ? 'resource' : 'resources'}{query ? ` matching “${query}”` : ''}</h2>{resources.length ? <div className="resource-list">{resources.map(r => <ResourceRow key={r.id} resource={r} showProject={!projectId}/>)}</div> : <Empty title={query || filter !== 'All' ? 'No saved sources match' : 'A little space for your sources.'} action={query || filter !== 'All' ? <Button variant="secondary" onClick={() => { setQuery(''); setFilter('All'); }}>Clear search & filters</Button> : projectId ? <Button onClick={() => setAdd(true)} icon="add">Add your first resource</Button> : <ActionLink to="/projects">Open your projects</ActionLink>}>This search covers your saved library. Add an article link, text, document or video to a project to begin.</Empty>}{add && <ResourceForm projectId={projectId} onClose={() => setAdd(false)}/>}</>;
}
export function Library() { return <div className="page"><PageHeading title="Your library" description="The sources you’ve saved, across all your projects."><ActionLink to="/search" icon="search">Explore samples</ActionLink></PageHeading><ResourceLibrary/></div>; }

export function Settings() {
  const { prefs, mutate, ai, refreshAi, notice } = useStore(); const [name, setName] = useState(prefs.name); const [error, setError] = useState('');
  const change = async values => { try { await mutate('/preferences', values, 'PATCH'); notice('Preferences saved.'); } catch (e) { setError(e.message); } };
  return <div className="page settings-page"><PageHeading eyebrow="MAKE YOURSELF AT HOME" title="Your workspace, your pace." description="A local profile. No account or email verification needed."/><section className="settings-section"><div><h2>Personal details</h2><p>Only used to greet you in this workspace.</p></div><form onSubmit={e => { e.preventDefault(); change({ name }); }}><label>Your name<input value={name} required maxLength={50} onChange={e => setName(e.target.value)}/></label><Button>Save name</Button></form></section><section className="settings-section"><div><h2>Reading & focus</h2><p>Choose the presentation that feels comfortable.</p></div><div><label>Reading text size<select value={prefs.textSize} onChange={e => change({ textSize: e.target.value })}><option value="standard">Standard</option><option value="large">Large</option><option value="larger">Larger</option></select></label><label className="check-label"><input type="checkbox" checked={prefs.reducedMotion} onChange={e => change({ reducedMotion: e.target.checked })}/>Reduce interface motion</label></div></section><section className="settings-section"><div><h2>Review reminders</h2><p>Review dates are always available in Reviews. No push notifications are sent.</p></div><label className="check-label"><input type="checkbox" checked={prefs.reminders} onChange={e => change({ reminders: e.target.checked })}/>Show a due-review reminder when I open Athena</label></section><section className="settings-section"><div><h2>Local AI & privacy</h2><p>Documents, notes, embeddings and model requests stay on this computer. Importing a URL contacts that website; embedded videos contact their provider.</p></div><div><Status value={ai?.available ? 'Connected' : 'Unavailable'}/><p className="small">Instruction model: {ai?.model || 'Checking…'}<br/>Embedding model: {ai?.embeddingModel || 'Checking…'}</p><Button variant="secondary" onClick={refreshAi}>Check connection</Button><p className="small muted">If AI is unavailable, reading and note-taking still work. Generated learning feedback can be wrong; use the linked source to check it.</p></div></section><ErrorMessage error={error}/></div>;
}
