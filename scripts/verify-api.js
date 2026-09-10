import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const base = process.env.ATHENA_TEST_URL || 'http://127.0.0.1:3000';
const report = [];
async function request(route, body, method = 'POST') {
  const response = await fetch(base + '/api' + route, { method: body === undefined ? 'GET' : method, headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const json = await response.json(); if (!response.ok) throw new Error(`${response.status}: ${json.error}`); return json;
}
async function record(name, fn) { try { await fn(); report.push({ name, passed: true, at: new Date().toISOString() }); console.log('PASS ' + name); } catch (error) { report.push({ name, passed: false, error: error.message, at: new Date().toISOString() }); console.error('FAIL ' + name + ': ' + error.message); } }
async function resourceReady(key) { for (let i = 0; i < 90; i++) { const state = await request('/state'); const r = state.resources.find(r => r.id === key); if (r && !['Queued', 'Processing'].includes(r.status)) return r; await new Promise(resolve => setTimeout(resolve, 1000)); } throw new Error('Resource processing timed out'); }
let project;
try {
  await record('Project create/update persist through fresh HTTP state reads', async () => { project = await request('/projects', { title: 'API verification fixture', goal: 'Test ingestion and source integrity.', description: 'Disposable verification data.' }); await request('/projects/' + project.id, { description: 'Updated and persisted.' }, 'PATCH'); assert.equal((await request('/state')).projects.find(p => p.id === project.id).description, 'Updated and persisted.'); });
  let article;
  await record('Public URL import extracts and indexes readable source content', async () => { article = await request(`/projects/${project.id}/resources`, { title: 'Example domain source', type: 'article', url: 'https://example.com' }); const resource = await resourceReady(article.id); assert.equal(resource.status, 'Ready', resource.error); assert.ok(resource.chunkCount > 0); });
  let video;
  await record('Video remains usable without transcript; timestamped text enables indexing', async () => { video = await request(`/projects/${project.id}/resources`, { title: 'Video path verification', type: 'video', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' }); assert.equal((await resourceReady(video.id)).status, 'Partially Ready'); await request('/resources/' + video.id, { transcript: '0:05 Recognition identifies information when cues are available.\n1:20 Recall retrieves information without the cue.' }, 'PATCH'); assert.equal((await resourceReady(video.id)).status, 'Ready'); const chunks = (await request('/state')).chunks.filter(c => c.resourceId === video.id); assert.deepEqual(chunks.map(c => c.location.seconds), [5, 80]); });
  let pdf;
  await record('PDF upload preserves page 1 and page 2 and the original file', async () => { const form = new FormData(); form.set('title', 'PDF verification'); form.set('file', new Blob([await readFile('tests/fixtures/interface-notes.pdf')], { type: 'application/pdf' }), 'interface-notes.pdf'); pdf = await request(`/projects/${project.id}/resources`, form); assert.equal((await resourceReady(pdf.id)).status, 'Ready'); const state = await request('/state'); assert.deepEqual(state.chunks.filter(c => c.resourceId === pdf.id).map(c => c.location.index), [1, 2]); const original = await fetch(base + '/api/resources/' + pdf.id + '/original'); assert.equal(original.status, 200); assert.ok(original.headers.get('content-type').includes('application/pdf')); });
  await record('Failed URL ingestion keeps the resource and explicit failure state', async () => { const invalid = await request(`/projects/${project.id}/resources`, { title: 'Failed source verification', type: 'article', url: 'http://127.0.0.1/private' }); const failed = await resourceReady(invalid.id); assert.equal(failed.status, 'Failed'); assert.ok(/Private network/.test(failed.error)); });
  await record('DOCX upload preserves readable paragraphs and its original', async () => {
    const form = new FormData(); form.set('title', 'DOCX verification');
    form.set('file', new Blob([await readFile('tests/fixtures/interface-notes.docx')]), 'interface-notes.docx');
    const doc = await request(`/projects/${project.id}/resources`, form);
    assert.equal((await resourceReady(doc.id)).status, 'Ready');
    const chunks = (await request('/state')).chunks.filter(c => c.resourceId === doc.id);
    assert.equal(chunks.length, 2); assert.ok(chunks[0].text.includes('Headings organise'));
    assert.equal((await fetch(base + '/api/resources/' + doc.id + '/original')).status, 200);
  });
  let note;
  await record('Context note validates location and survives source removal', async () => { const state = await request('/state'); const chunk = state.chunks.find(c => c.resourceId === pdf.id && c.location.index === 2); note = await request(`/projects/${project.id}/notes`, { content: 'Keep essential actions visible.', resourceId: pdf.id, chunkId: chunk.id }); assert.equal(note.chunkId, chunk.id); await assert.rejects(request(`/projects/${project.id}/notes`, { content: 'Bad quote', resourceId: pdf.id, chunkId: chunk.id, quote: 'Invented text not in source' })); await request('/resources/' + pdf.id, {}, 'DELETE'); const after = await request('/state'); assert.equal(after.chunks.filter(c => c.resourceId === pdf.id).length, 0); assert.equal(after.notes.find(n => n.id === note.id).sourceRemoved, true); });
  await record('Finish Project does not lock project editing', async () => { await request('/projects/' + project.id + '/finish', {}); await request('/projects/' + project.id, { title: 'Editable after Finish' }, 'PATCH'); assert.equal((await request('/state')).projects.find(p => p.id === project.id).title, 'Editable after Finish'); });
  await record('Cross-origin mutations are rejected', async () => { const response = await fetch(base + '/api/projects', { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Cross origin', goal: 'Must not create' }) }); assert.equal(response.status, 403); });
  await record('Deleting project cascades its chunks, notes and resources', async () => { await request('/projects/' + project.id, {}, 'DELETE'); const after = await request('/state'); for (const key of ['resources', 'chunks', 'notes', 'concepts', 'attempts', 'evidence', 'schedules']) assert.equal(after[key].filter(r => r.projectId === project.id).length, 0); assert.ok(!after.projects.some(p => p.id === project.id)); project = null; });
} finally {
  if (project) await request('/projects/' + project.id, {}, 'DELETE').catch(() => {});
  await mkdir('output/verification', { recursive: true }); await writeFile('output/verification/api-results.json', JSON.stringify(report, null, 2));
}

if (report.some(row => !row.passed)) process.exitCode = 1;



