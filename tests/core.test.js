import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
process.env.ATHENA_DATA_DIR = 'tmp/test-data-' + randomUUID();
mkdirSync(process.env.ATHENA_DATA_DIR, { recursive: true });
const { sectionsFromText, transcriptSections, safePublicUrl, isPrivateAddress } = await import('../server/ingestion.js');
const { masteryState, scheduleFor, validateEvaluation, cosine, retrieve, answerFromProject, groundConceptFacts } = await import('../server/learning.js');
const { put, get, all, removeProject, transaction } = await import('../server/db.js');

test('text chunks preserve paragraph identity and all source content', () => {
  const text = 'First paragraph explains hierarchy.\n\n' + 'Recognition reduces memory demands. '.repeat(90);
  const chunks = sectionsFromText(text);
  assert.equal(chunks[0].location.index, 1);
  assert.ok(chunks.slice(1).every(c => c.location.index === 2));
  assert.equal(chunks.map(c => c.text).join(' ').replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim());
});
test('transcript timestamps map actual source moments, including VTT', () => {
  const chunks = transcriptSections('WEBVTT\n\n00:01:12.000 --> 00:01:14.000\nA claim about hierarchy.\n\n[2:30] Another claim.');
  assert.equal(chunks[0].location.seconds, 72);
  assert.equal(chunks[1].location.seconds, 150);
  assert.equal(transcriptSections('No timestamp given')[0].location.kind, 'paragraph');
});
test('long unbroken input does not silently lose its leading text', () => {
  const source = 'a'.repeat(4500);
  const chunks = sectionsFromText(source);
  assert.equal(chunks.map(c => c.text).join(''), source);
  assert.ok(chunks.every(c => c.text.length <= 1400));
});
test('private and local URL inputs are rejected', async () => {
  for (const address of ['127.0.0.1', '10.0.0.8', '172.16.0.2', '192.168.1.3', '169.254.169.254', '::1']) assert.ok(isPrivateAddress(address));
  for (const url of ['http://127.0.0.1', 'http://localhost', 'http://[::1]', 'file:///etc/passwd', 'https://user:pass@example.com']) await assert.rejects(safePublicUrl(url));
});
test('knowledge states depend on response evidence and assistance, not confidence', () => {
  const good = [{ verdict: 'demonstrated' }, { verdict: 'demonstrated' }];
  assert.equal(masteryState(good, 0, 'Explain Back'), 'Solid');
  assert.equal(masteryState(good, 1, 'Explain Back'), 'Developing');
  assert.equal(masteryState(good, 0, 'Cue Cards'), 'Developing');
  assert.equal(masteryState([{ verdict: 'demonstrated' }, { verdict: 'missing' }], 0, 'Explain Back'), 'Developing');
  assert.equal(masteryState([{ verdict: 'incorrect' }], 0, 'Apply It'), 'Review');
  assert.equal(masteryState([{ verdict: 'missing' }], 0, 'Explain Back'), 'Review');
});
test('scheduling uses deterministic concept-level evidence intervals', () => {
  const date = new Date('2026-09-09T09:00:00Z');
  assert.equal(scheduleFor('Review', 0, 0, date).dueAt, '2026-09-10T09:00:00.000Z');
  assert.equal(scheduleFor('Developing', 2, 0, date).intervalDays, 3);
  assert.equal(scheduleFor('Solid', 0, 0, date).intervalDays, 7);
  assert.equal(scheduleFor('Solid', 0, 1, date).intervalDays, 14);
});
test('evaluation rejects invented learner quotations and missing rubric rows', () => {
  const attempt = { response: 'Hierarchy directs attention through contrast.' }; const concept = { facts: ['Hierarchy directs attention.', 'Contrast signals importance.'] };
  const valid = { results: [{ factIndex: 0, verdict: 'demonstrated', learnerQuote: 'Hierarchy directs attention', reason: 'Matches.' }, { factIndex: 1, verdict: 'missing', learnerQuote: '', reason: 'Importance not explained.' }] };
  assert.equal(validateEvaluation(valid, attempt, concept), valid);
  assert.throws(() => validateEvaluation({ results: [{ ...valid.results[0], learnerQuote: 'I know everything' }, valid.results[1]] }, attempt, concept));
  assert.throws(() => validateEvaluation({ results: [valid.results[0]] }, attempt, concept));
  assert.throws(() => validateEvaluation({ results: [valid.results[0], valid.results[0]] }, attempt, concept));
});
test('empty retrieval never fabricates evidence and is project scoped', async () => {
  put('chunks', { id: 'foreign', projectId: 'other-project', resourceId: 'other-resource', text: 'Private material', embedding: [1, 0], embeddingModel: 'nomic-embed-text:latest' });
  assert.deepEqual(await retrieve('empty-project', 'Anything'), []);
  const answer = await answerFromProject('empty-project', 'Anything');
  assert.equal(answer.sufficient, false); assert.deepEqual(answer.references, []);
  assert.equal(cosine([1, 0], [1, 0]), 1); assert.equal(cosine([1, 0], [0, 1]), 0);
});
test('project deletion removes its derived evidence without touching another project', () => {
  for (const table of ['projects', 'resources', 'chunks', 'notes', 'concepts', 'reviews', 'attempts', 'evidence', 'schedules']) {
    put(table, { id: table === 'projects' ? 'delete-me' : 'delete-' + table, projectId: 'delete-me' });
    put(table, { id: table === 'projects' ? 'keep-me' : 'keep-' + table, projectId: 'keep-me' });
  }
  removeProject('delete-me');
  for (const table of ['resources', 'chunks', 'notes', 'concepts', 'reviews', 'attempts', 'evidence', 'schedules']) assert.equal(all(table, 'delete-me').length, 0);
  assert.ok(get('projects', 'keep-me')); assert.ok(get('notes', 'keep-notes'));
});
test('failed transaction does not leave partial learner data', () => {
  assert.throws(() => transaction(() => { put('notes', { id: 'rollback', projectId: 'p', content: 'draft' }); throw new Error('failure'); }));
  assert.equal(get('notes', 'rollback'), null);
});

test('rubric citations are derived from the actual fact location', () => {
  const chunks = [{ id: 'a', text: 'Headings organise content.' }, { id: 'b', text: 'Secondary actions use lower emphasis.' }];
  const concept = groundConceptFacts({ facts: ['Secondary actions use lower emphasis.'], references: ['a'] }, chunks);
  assert.deepEqual(concept.references, ['b']);
  assert.throws(() => groundConceptFacts({ facts: ['Hide all secondary actions.'] }, chunks), /not found/);
});
