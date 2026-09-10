import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { z } from 'zod';
import { all, get, put, remove, removeProject, snapshot, dataDir, id, now, transaction } from './db.js';
import { health } from './ollama.js';
import { processResource } from './ingestion.js';
import { answerFromProject, extractConcepts, generateExplainBack, generateCueCards, generateApplicationTask, evaluateResponse, generateInsightReport, simplifySelection, summariseResource } from './learning.js';
import { seedDemo } from './seed.js';

const app = express();
const port = Number(process.env.PORT || 3000);
app.disable('x-powered-by');
app.use('/api', (req, res, next) => {
  const host = req.hostname;
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) return res.status(403).json({ error: 'This workspace is local.' });
  if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(req.headers.origin)) return res.status(403).json({ error: 'Cross-origin writes are not allowed.' });
  res.setHeader('Cache-Control', 'no-store'); next();
});
app.use(express.json({ limit: '3mb' }));
const upload = multer({ dest: path.join(dataDir, 'files'), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });
const must = (table, key) => { const entity = get(table, key); if (!entity) { const e = new Error('This item was not found. It may have been removed.'); e.status = 404; throw e; } return entity; };
const projectInput = z.object({ title: z.string().trim().min(1).max(120), description: z.string().max(2000).default(''), goal: z.string().trim().min(1).max(1200), preferredFormats: z.array(z.string()).default([]) });
app.get('/api/state', (req, res) => res.json(snapshot()));
app.get('/api/ai/status', async (req, res) => res.json(await health()));
app.post('/api/demo', (req, res) => res.json(seedDemo()));
app.patch('/api/preferences', (req, res) => {
  const input = z.object({ name: z.string().trim().min(1).max(50).optional(), view: z.enum(['grid', 'list']).optional(), textSize: z.enum(['standard', 'large', 'larger']).optional(), reducedMotion: z.boolean().optional(), reminders: z.boolean().optional() }).parse(req.body);
  res.json(put('preferences', { ...must('preferences', 'local'), ...input }));
});
app.post('/api/projects', (req, res) => res.status(201).json(put('projects', { ...projectInput.parse(req.body), id: id(), status: 'Active', createdAt: now(), updatedAt: now() })));
app.patch('/api/projects/:id', (req, res) => res.json(put('projects', { ...must('projects', req.params.id), ...projectInput.partial().parse(req.body), updatedAt: now() })));
app.delete('/api/projects/:id', async (req, res) => {
  must('projects', req.params.id); const files = all('resources', req.params.id).map(r => r.filePath).filter(Boolean);
  removeProject(req.params.id); await Promise.all(files.map(file => unlink(file).catch(() => {}))); res.json({ deleted: true });
});
app.post('/api/projects/:id/finish', (req, res) => res.json(put('projects', { ...must('projects', req.params.id), status: 'Finished', finishedAt: now(), updatedAt: now() })));
const conceptJobs = new Set();
app.post('/api/projects/:id/concepts', async (req, res) => {
  must('projects', req.params.id);
  if (conceptJobs.has(req.params.id)) return res.status(409).json({ error: 'Concept extraction is already running.' });
  conceptJobs.add(req.params.id);
  try { res.json(await extractConcepts(req.params.id)); } finally { conceptJobs.delete(req.params.id); }
});
app.post('/api/projects/:id/resources', upload.single('file'), async (req, res) => {
  try {
    must('projects', req.params.id);
    const input = z.object({ title: z.string().max(180).default(''), type: z.enum(['text', 'article', 'video', 'pdf', 'document']).default('text'), url: z.string().max(3000).default(''), content: z.string().max(1_000_000).default(''), author: z.string().max(200).default('') }).parse(req.body);
    let type = input.type;
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      type = ext === '.pdf' ? 'pdf' : ext === '.docx' ? 'document' : ['.txt', '.md', '.vtt', '.srt'].includes(ext) ? 'text' : null;
      if (!type) throw new Error('Upload a PDF, DOCX, TXT, Markdown, VTT or SRT file.');
    } else if (['pdf', 'document'].includes(type)) throw new Error('Choose a document to upload.');
    if (input.url) { const u = new URL(input.url); if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Use an HTTP or HTTPS URL.'); }
    if (type === 'video' && !input.url) throw new Error('Add a video URL.');
    if (!req.file && !input.content.trim() && !input.url) throw new Error('Add text, a URL or a file.');
    const resource = put('resources', { id: id(), projectId: req.params.id, title: input.title.trim() || req.file?.originalname || (input.url ? new URL(input.url).hostname : 'Untitled text'), type, url: input.url, input: input.content, author: input.author || null, source: req.file ? 'Uploaded document' : input.url ? new URL(input.url).hostname : 'Learner-provided text', filePath: req.file?.path || null, fileName: req.file?.originalname || null, status: 'Queued', createdAt: now(), explored: false });
    res.status(202).json({ id: resource.id }); setImmediate(() => processResource(resource.id));
  } catch (e) { if (req.file) await unlink(req.file.path).catch(() => {}); throw e; }
});
app.get('/api/resources/:id/original', (req, res) => {
  const r = must('resources', req.params.id);
  if (r.filePath) return res.sendFile(path.resolve(r.filePath), { headers: { 'Content-Type': r.type === 'pdf' ? 'application/pdf' : 'application/octet-stream', 'Content-Disposition': `inline; filename="${encodeURIComponent(r.fileName)}"`, 'X-Content-Type-Options': 'nosniff' } });
  res.type('text/plain').send(r.input || 'No original text was supplied. Use the source URL.');
});
app.post('/api/resources/:id/retry', (req, res) => { const r = must('resources', req.params.id); if (!['Queued', 'Processing'].includes(r.status)) { put('resources', { ...r, status: 'Queued' }); setImmediate(() => processResource(r.id)); } res.status(202).json({ saved: true }); });
app.patch('/api/resources/:id', (req, res) => {
  const r = must('resources', req.params.id);
  const input = z.object({ explored: z.boolean().optional(), position: z.object({ chunkId: z.string().optional(), seconds: z.number().min(0).optional() }).optional(), transcript: z.string().max(500000).optional() }).parse(req.body);
  if (input.transcript !== undefined) {
    if (r.type !== 'video') throw new Error('Only videos accept transcripts.');
    if (all('concepts', r.projectId).some(c => c.resourceId === r.id)) throw new Error('This transcript already supports review evidence. Add a new version as another resource to preserve existing citations.');
    put('resources', { ...r, input: input.transcript, status: 'Queued' }); setImmediate(() => processResource(r.id));
  } else put('resources', { ...r, ...input });
  put('projects', { ...must('projects', r.projectId), lastResourceId: r.id, updatedAt: now() });
  res.json({ saved: true });
});
app.delete('/api/resources/:id', async (req, res) => {
  const r = must('resources', req.params.id);
  transaction(() => {
    const removedConcepts = all('concepts', r.projectId).filter(c => c.resourceId === r.id).map(c => c.id);
    for (const c of all('chunks', r.projectId).filter(c => c.resourceId === r.id)) remove('chunks', c.id);
    for (const c of removedConcepts) { remove('concepts', c); remove('schedules', c); }
    for (const e of all('evidence', r.projectId).filter(e => removedConcepts.includes(e.conceptId))) remove('evidence', e.id);
    for (const note of all('notes', r.projectId).filter(n => n.resourceId === r.id)) put('notes', { ...note, resourceId: null, chunkId: null, sourceRemoved: true, sourceTitle: r.title });
    remove('resources', r.id);
  });
  if (r.filePath) await unlink(r.filePath).catch(() => {});
  res.json({ deleted: true });
});
app.post('/api/projects/:id/notes', (req, res) => {
  must('projects', req.params.id);
  const input = z.object({ content: z.string().trim().min(1).max(30000), resourceId: z.string().nullable().default(null), chunkId: z.string().nullable().default(null), quote: z.string().max(5000).default(''), seconds: z.number().min(0).nullable().default(null) }).parse(req.body);
  if (input.resourceId && must('resources', input.resourceId).projectId !== req.params.id) throw new Error('Resource belongs to another project.');
  if (input.chunkId) { const c = must('chunks', input.chunkId); if (c.projectId !== req.params.id || c.resourceId !== input.resourceId) throw new Error('Invalid source context.'); if (input.quote && !c.text.includes(input.quote)) throw new Error('Selected text does not match this source.'); }
  res.status(201).json(put('notes', { ...input, id: id(), projectId: req.params.id, createdAt: now() }));
});
app.patch('/api/notes/:id', (req, res) => res.json(put('notes', { ...must('notes', req.params.id), ...z.object({ content: z.string().trim().min(1).max(30000) }).parse(req.body), updatedAt: now() })));
app.delete('/api/notes/:id', (req, res) => { must('notes', req.params.id); remove('notes', req.params.id); res.json({ deleted: true }); });
app.post('/api/projects/:id/ask', async (req, res) => { must('projects', req.params.id); const { question } = z.object({ question: z.string().trim().min(2).max(4000) }).parse(req.body); res.json(await answerFromProject(req.params.id, question)); });
app.post('/api/projects/:id/simplify', async (req, res) => { must('projects', req.params.id); const { selection, action } = z.object({ selection: z.string().min(1).max(4000), action: z.enum(['Simplify', 'Give Example', 'Explain Differently', 'Compare']).default('Simplify') }).parse(req.body); res.json(await simplifySelection(req.params.id, selection, action)); });
app.post('/api/resources/:id/summary', async (req, res) => res.json(await summariseResource(must('resources', req.params.id))));
app.post('/api/projects/:id/reviews', async (req, res) => {
  const project = must('projects', req.params.id);
  if (project.status === 'Active') throw new Error('Finish the learning phase before starting review. You can keep editing afterwards.');
  const input = z.object({ mode: z.enum(['Explain Back', 'Cue Cards', 'Apply It']), conceptIds: z.array(z.string()).min(1).max(6) }).parse(req.body);
  const concepts = [...new Set(input.conceptIds)].map(key => must('concepts', key));
  if (concepts.some(c => c.projectId !== project.id)) throw new Error('Choose concepts from this project.');
  const review = put('reviews', { id: id(), projectId: project.id, mode: input.mode, conceptIds: concepts.map(c => c.id), status: 'Generating', createdAt: now() });
  res.status(202).json(review);
  generateReview(review).catch(() => {});
});
async function generateReview(review) {
  try {
    for (const key of review.conceptIds) {
      if (all('attempts', review.projectId).some(a => a.reviewId === review.id && a.conceptId === key)) continue;
      const concept = must('concepts', key);
      const task = await ({ 'Explain Back': generateExplainBack, 'Cue Cards': generateCueCards, 'Apply It': generateApplicationTask }[review.mode])(concept);
      if (!get('reviews', review.id)) return;
      put('attempts', { id: id(), projectId: review.projectId, reviewId: review.id, conceptId: key, mode: review.mode, ...task, response: '', confidence: '', assistance: 0, status: 'Draft', createdAt: now() });
    }
    if (get('reviews', review.id)) put('reviews', { ...review, status: 'In Progress', error: null });
  } catch (e) { if (get('reviews', review.id)) put('reviews', { ...review, status: 'Generation Failed', error: e.message }); }
}
app.post('/api/reviews/:id/retry', (req, res) => { const review = must('reviews', req.params.id); if (review.status === 'Generating') return res.json(review); put('reviews', { ...review, status: 'Generating', error: null }); generateReview(review).catch(() => {}); res.status(202).json({ saved: true }); });
app.patch('/api/attempts/:id', (req, res) => {
  const attempt = must('attempts', req.params.id);
  if (attempt.evaluation || attempt.status === 'Evaluating') throw new Error('This submitted response is preserved. Start another review for a new attempt.');
  const input = z.object({ response: z.string().max(15000).optional(), confidence: z.enum(['', 'Not confident', 'Somewhat confident', 'Confident']).optional(), assistance: z.number().int().min(0).max(4).optional(), selfRating: z.enum(["Didn't know", 'Almost', 'Knew it']).optional(), revealed: z.boolean().optional() }).parse(req.body);
  if ((input.revealed || input.selfRating) && !(input.response ?? attempt.response).trim()) throw new Error('Attempt the card before revealing or rating it.');
  if (input.selfRating && !attempt.revealed && !input.revealed) throw new Error('Reveal the card after attempting it, then rate your recall.');
  res.json(put('attempts', { ...attempt, ...input, assistance: Math.max(attempt.assistance, input.assistance || 0, input.revealed ? 4 : 0), updatedAt: now() }));
});
app.post('/api/attempts/:id/evaluate', (req, res) => {
  const attempt = must('attempts', req.params.id);
  if (attempt.evaluation || attempt.status === 'Evaluating') return res.json(attempt);
  if (!attempt.response.trim() || !attempt.confidence) throw new Error('Save your response and confidence before evaluation.');
  put('attempts', { ...attempt, status: 'Evaluating', error: null });
  res.status(202).json({ saved: true });
  evaluateResponse(attempt).catch(e => { if (get('attempts', attempt.id)) put('attempts', { ...must('attempts', attempt.id), status: 'Submitted', error: e.message }); });
});
app.post('/api/reviews/:id/finish', (req, res) => {
  const review = must('reviews', req.params.id); const report = generateInsightReport(review);
  res.json(put('reviews', { ...review, report, status: 'Saved', completedAt: now() }));
  const project = must('projects', review.projectId); put('projects', { ...project, status: 'Reviewed', updatedAt: now() });
});
app.patch('/api/schedules/:id', (req, res) => {
  const schedule = must('schedules', req.params.id);
  const input = z.object({ dueAt: z.iso.datetime().optional(), status: z.enum(['Upcoming', 'Postponed', 'Dismissed']).optional() }).parse(req.body);
  res.json(put('schedules', { ...schedule, ...input }));
});
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((error, req, res, next) => { res.status(error.status || (error instanceof z.ZodError ? 400 : 422)).json({ error: error instanceof z.ZodError ? error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : error.message || 'Something went wrong. Your saved work is intact.' }); });
if (process.argv.includes('--production')) { app.use(express.static('dist')); app.get('/{*path}', (req, res) => res.sendFile(path.resolve('dist/index.html'))); }
else { const { createServer } = await import('vite'); const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares); }
app.listen(port, '127.0.0.1', () => console.log(`Athena is ready at http://127.0.0.1:${port} — local data: ${dataDir}`));
