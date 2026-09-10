// Controlled fault injection, separate from the real-model acceptance evidence.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

let nextOutput = ''; let unavailable = false;
const stub = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  res.setHeader('Content-Type', 'application/json');
  if (unavailable) { res.writeHead(503); res.end(JSON.stringify({ error: 'Injected outage' })); return; }
  if (req.url === '/api/embed') res.end(JSON.stringify({ embeddings: body.input.map(() => [1, 0]) }));
  else if (req.url === '/api/tags') res.end(JSON.stringify({ models: [{ name: 'test-model' }, { name: 'test-embed' }] }));
  else res.end(JSON.stringify({ message: { content: nextOutput } }));
});
stub.listen(0, '127.0.0.1'); await once(stub, 'listening');
const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening');
const port = portProbe.address().port; await new Promise(resolve => portProbe.close(resolve));
const dataDir = path.resolve('tmp/recovery-' + Date.now()); await mkdir(dataDir, { recursive: true });
const child = spawn(process.execPath, ['server/index.js', '--production'], { env: { ...process.env, PORT: String(port), ATHENA_DATA_DIR: dataDir, OLLAMA_BASE_URL: `http://127.0.0.1:${stub.address().port}`, ATHENA_MODEL: 'test-model', ATHENA_EMBED_MODEL: 'test-embed' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
const base = `http://127.0.0.1:${port}/api`;
async function request(route, body, method = 'POST') {
  const response = await fetch(base + route, { method: body === undefined ? 'GET' : method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
}
async function until(read, accept) {
  for (let i = 0; i < 100; i++) { try { const value = await read(); if (accept(value)) return value; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error('Timed out during recovery check. ' + logs);
}
const results = [];
try {
  await until(() => request('/state'), Boolean);
  const project = await request('/projects', { title: 'Disposable recovery fixture', goal: 'Test saved work under controlled model failures.' });
  const fact = 'Whitespace separates related groups without extra boxes.';
  const resource = await request(`/projects/${project.id}/resources`, { title: 'Recovery source', type: 'text', content: fact });
  const ready = await until(() => request('/state'), s => s.resources.find(r => r.id === resource.id)?.status === 'Ready');
  const chunk = ready.chunks.find(c => c.resourceId === resource.id);
  nextOutput = JSON.stringify({ concepts: [{ name: 'Whitespace', description: 'Separating related groups.', facts: [fact], references: [chunk.id] }] });
  await request(`/projects/${project.id}/concepts`, {});
  const concept = (await request('/state')).concepts[0];
  await request(`/projects/${project.id}/finish`, {});
  nextOutput = '{broken';
  const review = await request(`/projects/${project.id}/reviews`, { mode: 'Explain Back', conceptIds: [concept.id] });
  await until(() => request('/state'), s => s.reviews[0]?.status === 'Generation Failed');
  nextOutput = JSON.stringify({ prompt: 'Explain how whitespace can organise related groups of content.', hint: 'Think about spacing.', example: 'Separate two sections.', explanation: fact, answer: fact });
  await request(`/reviews/${review.id}/retry`, {});
  const generated = await until(() => request('/state'), s => s.reviews[0]?.status === 'In Progress');
  assert.equal(generated.attempts.length, 1);
  results.push('Malformed generation is explicit; retry creates one valid attempt.');
  const attempt = generated.attempts[0]; const response = 'Spacing separates groups without extra boxes.';
  await request(`/attempts/${attempt.id}`, { response, confidence: 'Confident', assistance: 1 }, 'PATCH');
  nextOutput = '{broken';
  await request(`/attempts/${attempt.id}/evaluate`, {});
  const failed = await until(() => request('/state'), s => s.attempts[0]?.status === 'Submitted');
  assert.equal(failed.attempts[0].response, response); assert.equal(failed.attempts[0].confidence, 'Confident'); assert.equal(failed.attempts[0].assistance, 1); assert.equal(failed.evidence.length, 0);
  results.push('Malformed evaluation retains response, confidence and help, and creates no evidence.');
  nextOutput = JSON.stringify({ results: [{ factIndex: 0, verdict: 'demonstrated', reason: 'Matches the supplied statement.', learnerQuote: response }], nextAction: 'Explain it again without help.' });
  await request(`/attempts/${attempt.id}/evaluate`, {});
  const recovered = await until(() => request('/state'), s => s.attempts[0]?.status === 'Evaluated');
  assert.equal(recovered.evidence.length, 1); assert.equal(recovered.attempts[0].evaluation.state, 'Developing');
  results.push('Retry evaluates the same saved attempt exactly once and preserves assisted status.');
  unavailable = true;
  await request(`/projects/${project.id}/notes`, { content: 'A note saved while the model is unavailable.' });
  assert.equal((await request('/state')).notes.length, 1); assert.equal((await request('/ai/status')).available, false);
  results.push('Local model outage leaves reading state and note creation available.');
  await mkdir('output/verification', { recursive: true });
  await writeFile('output/verification/recovery-results.json', JSON.stringify({ at: new Date().toISOString(), kind: 'Isolated controlled fault injection; not real AI-quality evidence', passed: true, results }, null, 2));
  console.log('PASS ' + results.join('\nPASS '));
} finally { child.kill(); stub.closeAllConnections(); await new Promise(resolve => stub.close(resolve)); }
