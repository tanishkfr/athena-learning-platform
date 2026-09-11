// Scripted browser-demo data only. Never sent to the local AI backend.
export function prepareDemoConcepts(state) {
  for (const resource of state.resources) {
    if (state.concepts.some(c => c.resourceId === resource.id)) continue;
    const chunk = state.chunks.find(c => c.resourceId === resource.id && c.text.length > 100);
    if (!chunk) continue;
    state.concepts.push({ id: `preview-${resource.id}`, projectId: resource.projectId, resourceId: resource.id, name: resource.title, description: 'Explain the main idea, then connect it to a concrete example.', facts: [chunk.text.split(/\n+/).find(p => p.length > 100) || chunk.text, 'Connect the idea to a specific decision and explain why it helps.'], references: [chunk.id], state: 'Not Tested', demo: true });
  }
}

export function demoReviewRequest(state, path, body, method) {
  const now = new Date().toISOString();
  const project = path.match(/^\/projects\/([^/]+)\/(concepts|reviews|finish)$/);
  if (project?.[2] === 'concepts') return state.concepts.filter(c => c.projectId === project[1]);
  if (project?.[2] === 'finish') { const p = state.projects.find(p => p.id === project[1]); p.status = 'Finished'; p.updatedAt = now; return p; }
  if (project?.[2] === 'reviews') {
    const concepts = state.concepts.filter(c => c.projectId === project[1] && body.conceptIds.includes(c.id));
    if (!concepts.length) throw new Error('Choose at least one concept.');
    const review = { id: crypto.randomUUID(), projectId: project[1], conceptIds: concepts.map(c => c.id), mode: body.mode, status: 'Ready', createdAt: now, demo: true };
    state.reviews.push(review);
    for (const concept of concepts) state.attempts.push({ id: crypto.randomUUID(), projectId: review.projectId, reviewId: review.id, conceptId: concept.id, mode: review.mode, status: 'Ready', response: '', confidence: null, assistance: 0, revealed: false, selfRating: null, createdAt: now, demo: true, prompt: review.mode === 'Cue Cards' ? `What is the main idea in “${concept.name}”? Give one example.` : review.mode === 'Apply It' ? 'What would you change, and how does the idea from this source support your decision?' : `Explain “${concept.name}” to someone encountering it for the first time. Include a practical example.`, scenario: review.mode === 'Apply It' ? 'You are helping a teammate improve a learning workspace. Readers lose track of important information and struggle to return to what they saved. Propose one change using the selected source.' : '', hint: 'Start with the main idea, then describe when it would be useful.', example: 'For example, keep a saved note beside its source so a reader can check the original context.', explanation: concept.facts[0], answer: concept.facts[0] });
    return review;
  }
  const match = path.match(/^\/attempts\/([^/]+)(\/evaluate)?$/);
  if (match) {
    const attempt = state.attempts.find(a => a.id === match[1]);
    if (!attempt) throw new Error('Preview attempt not found.');
    if (method === 'PATCH') { if (!attempt.evaluation) Object.assign(attempt, body); return attempt; }
    if (match[2]) {
      if (attempt.evaluation) return attempt;
      if (!attempt.response.trim() || !attempt.confidence) throw new Error('Write a response and choose your confidence first.');
      const concept = state.concepts.find(c => c.id === attempt.conceptId);
      attempt.status = 'Evaluated';
      attempt.evaluation = { demo: true, state: 'Developing', dimension: attempt.mode === 'Cue Cards' ? 'Recall' : attempt.mode === 'Apply It' ? 'Application' : 'Explanation', references: concept.references, results: [{ factIndex: 0, verdict: 'demonstrated', reason: 'Sample strength: the response identifies the main idea and explains its purpose.', learnerQuote: '' }, { factIndex: 1, verdict: 'missing', reason: 'Sample next step: add a concrete example and explain the effect of your decision.', learnerQuote: '' }], nextAction: 'Reopen the source and add one example showing how you would use the idea.' };
      // Do not turn simulated feedback into actual knowledge evidence.
      return attempt;
    }
  }
  const finish = path.match(/^\/reviews\/([^/]+)\/finish$/);
  if (finish) {
    const review = state.reviews.find(r => r.id === finish[1]);
    const attempts = state.attempts.filter(a => a.reviewId === review.id && a.evaluation);
    if (!attempts.length) throw new Error('Complete one sample response first.');
    const rows = attempts.flatMap(a => a.evaluation.results.map(r => ({ ...r, attemptId: a.id, conceptId: a.conceptId })));
    review.status = 'Completed'; review.completedAt = now;
    review.report = { demo: true, attemptIds: attempts.map(a => a.id), strengths: rows.filter(r => r.verdict === 'demonstrated'), gaps: rows.filter(r => r.verdict !== 'demonstrated'), nextAction: 'Sample recommendation: revisit your source, add a practical example, then try another activity.' };
    return review;
  }
}
