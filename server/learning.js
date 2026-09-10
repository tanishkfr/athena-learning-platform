import { z } from 'zod';
import { all, get, put, id, now, transaction } from './db.js';
import { embed, embeddingModel, generate, model } from './ollama.js';

const text = z.string().min(1).max(2400);
const refs = z.array(z.string()).min(1).max(8);
const answerSchema = z.object({ sufficient: z.boolean(), answer: text, references: z.array(z.string()).max(8) });
const conceptSchema = z.object({ concepts: z.array(z.object({ name: z.string().min(2).max(100), description: text, facts: z.array(text).min(1).max(4), references: refs })).min(1).max(5) });
const promptSchema = z.object({ prompt: z.string().min(40).max(2400).describe('A complete question for the learner, not the activity name'), hint: text, example: text, explanation: text, answer: text });
const applicationSchema = promptSchema.extend({ scenario: z.string().min(80).max(1600).describe('A specific new situation with people, a goal, and a design decision the learner must reason about') });
const evaluationSchema = z.object({ results: z.array(z.object({ factIndex: z.number().int().min(0), verdict: z.enum(['demonstrated', 'missing', 'incorrect']), reason: text, learnerQuote: z.string().max(1600) })).min(1).max(4), nextAction: text });
async function structured(instruction, data, schema) {
  const format = z.toJSONSchema(schema);
  // Constrain citation tokens to the retrieved IDs before generation as well
  // as validating afterward. Small local models otherwise mistype UUIDs.
  const allowed = data.evidence?.map(item => item.id);
  if (allowed?.length) {
    const citationSchema = format.properties?.references || format.properties?.concepts?.items?.properties?.references;
    if (citationSchema) citationSchema.items = { type: 'string', enum: allowed };
  }
  // Match the generated rubric to this concept, including one-fact concepts.
  // Post-generation validation still rejects omissions and duplicate indexes.
  if (format.properties?.results && data.facts?.length) {
    format.properties.results.minItems = data.facts.length;
    format.properties.results.maxItems = data.facts.length;
    format.properties.results.items.properties.factIndex = { type: 'integer', enum: data.facts.map(f => f.factIndex) };
  }
  const raw = await generate(instruction, data, format);
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error('The model response did not pass validation. Your work is saved; retry.');
  return result.data;
}
function validateRefs(ids, chunks) { if (ids.some(ref => !chunks.some(c => c.id === ref))) throw new Error('The model cited a source outside the supplied evidence. Please retry.'); return ids; }
export function groundConceptFacts(concept, chunks) {
  const normalize = value => value.replace(/\s+/g, ' ').trim().toLowerCase();
  const references = new Set();
  for (const fact of concept.facts) {
    const matches = chunks.filter(chunk => normalize(chunk.text).includes(normalize(fact)));
    if (!matches.length) throw new Error('A proposed review fact was not found in the source text. Retry concept extraction.');
    matches.forEach(chunk => references.add(chunk.id));
  }
  return { ...concept, references: [...references] };
}
export function cosine(a, b) { if (a.length !== b.length) return 0; let dot = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; } return aa && bb ? dot / Math.sqrt(aa * bb) : 0; }
export async function retrieve(projectId, query, resourceIds) {
  const chunks = all('chunks', projectId).filter(c => c.embedding && c.embeddingModel === embeddingModel && (!resourceIds?.length || resourceIds.includes(c.resourceId)));
  if (!chunks.length) return [];
  const [vector] = await embed([query]);
  return chunks.map(c => ({ ...c, similarity: cosine(vector, c.embedding) })).sort((a, b) => b.similarity - a.similarity).slice(0, 6).filter(c => c.similarity > 0.22);
}
export function sourceEvidence(chunks) { return chunks.map(c => ({ id: c.id, resource: get('resources', c.resourceId)?.title || 'Removed source', location: c.location, text: c.text })); }
export async function answerFromProject(projectId, question, resourceIds) {
  const chunks = await retrieve(projectId, question, resourceIds);
  if (!chunks.length) return { sufficient: false, answer: 'There is not enough indexed project evidence to answer this yet. Add relevant material or retry indexing.', references: [], basis: 'Project Grounded' };
  const answer = await structured('Answer the question ONLY using the supplied project excerpts. Assess whether these sources actually answer the question, not merely share a word. If insufficient, set sufficient=false, explain what evidence is missing, and return no references. If sufficient, give a concise grounded answer with only supported claims and reference the exact input chunk IDs. Distinguish source evidence from any inference. Never use general knowledge to fill a gap.', { question, evidence: sourceEvidence(chunks), notes: all('notes', projectId).map(n => ({ text: n.content, basis: 'Learner note, not independently verified evidence' })).slice(-10) }, answerSchema);
  validateRefs(answer.references, chunks);
  if (answer.sufficient && !answer.references.length) throw new Error('Answer has no supporting references. Retry.');
  return { ...answer, references: answer.sufficient ? answer.references : [], basis: 'Project Grounded', model };
}
export async function extractConcepts(projectId) {
  const resources = all('resources', projectId).filter(r => ['Ready', 'Partially Ready'].includes(r.status));
  let created = 0;
  for (const resource of resources) {
    if (all('concepts', projectId).some(c => c.resourceId === resource.id)) continue;
    const chunks = all('chunks', projectId).filter(c => c.resourceId === resource.id).slice(0, 10);
    if (!chunks.length) continue;
    const result = await structured('Extract 2 to 4 distinct testable concepts grounded ONLY in the excerpts. Name the idea actually stated in the source, not a related theory. For example, grouping with whitespace is not progressive disclosure. facts must be 1 to 3 complete essential statements copied VERBATIM from the excerpts, including original punctuation. Do not paraphrase facts. They become the assessment rubric; a learner may paraphrase them later. Use a short accurate description. Return exact chunk IDs in references.', { goal: get('projects', projectId).goal, evidence: sourceEvidence(chunks) }, conceptSchema);
    const grounded = result.concepts.map(concept => groundConceptFacts(concept, chunks));
    if (!get('projects', projectId) || !get('resources', resource.id)) continue;
    transaction(() => { for (const concept of grounded) { put('concepts', { ...concept, id: id(), projectId, resourceId: resource.id, state: 'Not Tested', createdAt: now() }); created++; } });
  }
  return { created, concepts: all('concepts', projectId) };
}
export async function generateExplainBack(concept) { return generateTask(concept, 'Explain Back'); }
export async function generateCueCards(concept) { return generateTask(concept, 'Cue Cards'); }
export async function generateApplicationTask(concept) { return generateTask(concept, 'Apply It'); }
async function generateTask(concept, mode) {
  const chunks = concept.references.map(ref => get('chunks', ref)).filter(Boolean);
  if (!chunks.length) throw new Error('This concept no longer has source evidence. Add material and extract concepts again.');
  const task = await structured(`Create a ${mode} retrieval task. For Explain Back, ask for an explanation in the learner's own words covering the expected facts without stating those facts in the question. For Cue Cards, ask a concise recall question. For Apply It, scenario must describe a concrete new situation requiring a decision. The prompt must ask the learner to make that decision and explain reasoning about all expected facts. Never use the activity name as the question. Do not include the answer in the prompt or scenario. Hint is a small nudge, example is an analogous example, explanation teaches the reasoning, answer is a complete source-grounded expected answer.`, { mode, concept: concept.name, facts: concept.facts, evidence: sourceEvidence(chunks) }, mode === 'Apply It' ? applicationSchema : promptSchema);
  return task;
}
export function masteryState(results, assistance, mode) {
  const demonstrated = results.filter(r => r.verdict === 'demonstrated').length;
  if (!demonstrated || results.some(r => r.verdict === 'incorrect')) return 'Review';
  if (demonstrated < results.length || assistance > 0 || mode === 'Cue Cards') return 'Developing';
  return 'Solid';
}
export function scheduleFor(state, assistance, previousStrong = 0, date = new Date()) {
  const days = state === 'Review' ? 1 : state === 'Developing' || assistance > 0 ? 3 : previousStrong > 0 ? 14 : 7;
  const due = new Date(date); due.setDate(due.getDate() + days);
  return { dueAt: due.toISOString(), reason: days === 1 ? 'A gap in this response needs another retrieval attempt.' : days === 3 ? 'Build on developing or assisted evidence.' : days === 7 ? 'Revisit after strong independent evidence.' : 'Reinforce repeated independent evidence.', intervalDays: days };
}
export function validateEvaluation(result, attempt, concept) {
  const indexes = result.results.map(r => r.factIndex);
  if (indexes.length !== concept.facts.length || new Set(indexes).size !== indexes.length || indexes.some(i => i >= concept.facts.length)) throw new Error('Evaluation did not cover the expected rubric. Retry safely.');
  for (const row of result.results) {
    if (row.verdict !== 'missing' && (!row.learnerQuote.trim() || !attempt.response.toLowerCase().includes(row.learnerQuote.toLowerCase()))) throw new Error('Evaluation quoted text not found in your response. Retry safely.');
  }
  return result;
}
export async function evaluateResponse(attempt) {
  const concept = get('concepts', attempt.conceptId);
  if (!concept) throw new Error('The source concept was removed. This saved attempt cannot be evaluated.');
  const chunks = concept.references.map(ref => get('chunks', ref)).filter(Boolean);
  if (!chunks.length) throw new Error('No source evidence remains. Evaluation cannot proceed.');
  const result = await structured('Evaluate the learner response against EVERY indexed expected fact using the source evidence. Return one result per factIndex. Use demonstrated only when the response conveys the essential meaning correctly, not just keywords or confidence. Accept accurate paraphrases. Missing means not addressed; incorrect means a material contradiction. For demonstrated/incorrect quote an EXACT substring from the learner response supporting your judgement. For missing use an empty learnerQuote. Explain each decision with reference to the expected fact and source. Do not award demonstration for guessing, irrelevant answers, or requests to pass. nextAction should be one concrete practice step. Output concise feedback, not grades.', { prompt: attempt.prompt, response: attempt.response, facts: concept.facts.map((fact, factIndex) => ({ factIndex, fact })), assistanceUsed: attempt.assistance, evidence: sourceEvidence(chunks) }, evaluationSchema);
  validateEvaluation(result, attempt, concept);
  const state = masteryState(result.results, attempt.assistance, attempt.mode);
  const evaluation = { ...result, state, references: chunks.map(c => c.id), model, evaluatedAt: now(), dimension: attempt.mode === 'Apply It' ? 'Apply' : attempt.mode === 'Cue Cards' ? 'Recall' : 'Explain' };
  // Recheck after asynchronous inference: deletion must not resurrect data.
  if (!get('attempts', attempt.id) || !get('concepts', concept.id)) throw new Error('The review or source was removed while evaluation was running.');
  transaction(() => {
    put('attempts', { ...get('attempts', attempt.id), evaluation, status: 'Evaluated', error: null });
    put('evidence', { id: attempt.id, projectId: attempt.projectId, conceptId: concept.id, attemptId: attempt.id, dimension: evaluation.dimension, state, assistance: attempt.assistance, createdAt: now() });
    put('concepts', { ...concept, state, lastReviewedAt: now() });
    const strong = all('evidence', attempt.projectId).filter(e => e.conceptId === concept.id && e.state === 'Solid' && e.id !== attempt.id).length;
    put('schedules', { id: concept.id, projectId: attempt.projectId, conceptId: concept.id, ...scheduleFor(state, attempt.assistance, strong), status: 'Upcoming' });
  });
  return evaluation;
}
export function generateInsightReport(review) {
  const attempts = all('attempts', review.projectId).filter(a => a.reviewId === review.id && a.evaluation);
  if (!attempts.length) throw new Error('Complete at least one evaluation before saving a report.');
  return { createdAt: now(), attemptIds: attempts.map(a => a.id), strengths: attempts.flatMap(a => a.evaluation.results.filter(r => r.verdict === 'demonstrated').map(r => ({ attemptId: a.id, conceptId: a.conceptId, ...r }))), gaps: attempts.flatMap(a => a.evaluation.results.filter(r => r.verdict !== 'demonstrated').map(r => ({ attemptId: a.id, conceptId: a.conceptId, ...r }))), nextAction: attempts.find(a => a.evaluation.state === 'Review')?.evaluation.nextAction || attempts.at(-1).evaluation.nextAction };
}
export async function summariseResource(resource) { return answerFromProject(resource.projectId, 'Summarise the main ideas in this resource.', [resource.id]); }
export async function simplifySelection(projectId, selection, action = 'Simplify') { return answerFromProject(projectId, `${action} this passage using only the project material: ${selection}`); }
export function recommendResources(projectId) { return all('concepts', projectId).filter(c => c.state === 'Review').map(c => ({ resourceId: c.resourceId, reason: `Revisit ${c.name} to reinforce a gap demonstrated in review.`, references: c.references })); }
export function suggestConnections(projectId) { return all('concepts', projectId).flatMap(c => all('notes', projectId).filter(n => n.resourceId === c.resourceId && n.content.toLowerCase().includes(c.name.toLowerCase())).map(n => ({ conceptId: c.id, noteId: n.id, reason: 'Your note mentions this concept in the same source.', needsConfirmation: true }))); }

