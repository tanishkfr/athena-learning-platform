async page => {
  const base = 'http://127.0.0.1:3103';
  await page.goto(base);
  await page.evaluate(async () => {
    const { mockApi } = await import('/src/mock.js');
    const state = await mockApi('/state');
    localStorage.setItem('athena:vercel-demo', JSON.stringify(state));
    const chunk = state.chunks.find(c => c.resourceId === 'demo-hierarchy' && c.text.length > 100);
    await mockApi('/projects/demo-project/notes', { content: 'Hierarchy is a decision about what the reader should notice first. I should check the primary action before changing the decoration.', resourceId: 'demo-hierarchy', chunkId: chunk.id, quote: chunk.text.split('. ')[0] + '.', seconds: null });
    const concepts = (await mockApi('/state')).concepts.filter(c => c.projectId === 'demo-project');
    const finished = await mockApi('/projects/demo-project/reviews', { mode: 'Explain Back', conceptIds: [concepts[0].id] });
    let next = await mockApi('/state');
    const attempt = next.attempts.find(a => a.reviewId === finished.id);
    await mockApi('/attempts/' + attempt.id, { response: 'Visual hierarchy communicates importance through size, contrast and spacing. I would make the main action easier to recognise and group the secondary actions together.', confidence: 'Somewhat confident', assistance: 1 }, 'PATCH');
    await mockApi('/attempts/' + attempt.id + '/evaluate', {});
    await mockApi('/reviews/' + finished.id + '/finish', {});
    const active = await mockApi('/projects/demo-project/reviews', { mode: 'Apply It', conceptIds: concepts.map(c => c.id) });
    next = await mockApi('/state');
    const draft = next.attempts.find(a => a.reviewId === active.id);
    await mockApi('/attempts/' + draft.id, { response: 'I would keep the reading material prominent and place saved notes alongside the source.', confidence: 'Somewhat confident' }, 'PATCH');
    next = await mockApi('/state');
    const fixture = { state: next, routes: { reader: '/learn/demo-hierarchy', notes: '/projects/demo-project/notes', setup: '/projects/demo-project/review', active: '/reviews/' + active.id, feedback: '/reviews/' + finished.id, report: '/reviews/' + finished.id + '/report', insights: '/insights', reviews: '/reviews', settings: '/settings', focus: '/learn/demo-hierarchy?focus=1' } };
    localStorage.setItem('athena:v2-learning-fixture', JSON.stringify(fixture));
    sessionStorage.setItem('athena:preview-session', 'signed-in');
  });
  const fixture = await page.evaluate(() => JSON.parse(localStorage.getItem('athena:v2-learning-fixture')));
  for (const [label,width,height] of [['desktop',1440,900], ['mobile',390,844]]) {
    await page.setViewportSize({width,height});
    for (const [screen,route] of Object.entries(fixture.routes)) {
      await page.evaluate(state => localStorage.setItem('athena:vercel-demo', JSON.stringify(state)), fixture.state);
      await page.goto(base + route);
      await page.locator('h1').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `output/playwright/v2-learning/before-${screen}-${label}.png`, fullPage: true, animations: 'disabled' });
    }
  }
  await page.goto(base + fixture.routes.notes);
  await page.locator('.saved-note').first().getByRole('button', {name:'Edit',exact:true}).click();
  await page.getByRole('textbox', {name:'Edit note'}).fill('Edited note for baseline persistence check.');
  await page.getByRole('button', {name:'Save changes',exact:true}).click();
  const noteEditPersisted = await page.locator('.note-text').first().textContent() === 'Edited note for baseline persistence check.';
  return { screenshots:20, noteEditPersisted, evidenceRecords:fixture.state.evidence.length, note:'Existing browser demo only; feedback is scripted. Fixture belongs to isolated browser context on port 3103.' };
}
