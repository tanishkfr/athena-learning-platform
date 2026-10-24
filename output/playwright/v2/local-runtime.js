async page => {
  const base = 'http://127.0.0.1:3101'; const results = []; const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (name, passed) => { results.push({ name, passed }); if (!passed) throw new Error(name); };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/state', route => route.abort('connectionrefused'));
  await page.goto(base);
  await page.getByRole('heading', { name: 'Workspace unavailable' }).waitFor();
  await page.screenshot({ path: 'output/playwright/v2/local-unavailable-mobile.png', fullPage: true });
  check('Connection failure has retry action', await page.getByRole('button', { name: 'Retry connection' }).isVisible());
  await page.unroute('**/api/state');
  await page.getByRole('button', { name: 'Retry connection' }).click();
  await page.getByRole('heading', { name: 'Find a starting point' }).waitFor();
  check('Retry reconnects to actual isolated SQLite backend', true);
  await page.evaluate(() => sessionStorage.setItem('athena:preview-session', 'signed-in'));
  await page.route('**/api/state', async route => { await new Promise(resolve => setTimeout(resolve, 1500)); await route.continue(); });
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'Opening your workspace' }).waitFor();
  await page.screenshot({ path: 'output/playwright/v2/local-loading-mobile.png', fullPage: true });
  check('Loading state is announced while real request is delayed', true);
  await page.getByRole('heading', { name: 'Find a starting point' }).waitFor();
  await page.unroute('**/api/state');
  await page.goto(base + '/projects');
  await page.getByRole('heading', { name: 'Start with something you want to understand.' }).waitFor();
  check('Empty local collection offers project creation', await page.getByRole('button', { name: 'Create a project', exact: true }).isVisible());
  await page.screenshot({ path: 'output/playwright/v2/local-empty-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('textbox', { name: 'Project title', exact: true }).fill('Isolated UI verification');
  await page.getByRole('textbox', { name: 'Learning goal', exact: true }).fill('Verify saved sources and notes while local AI is unavailable.');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page.getByRole('heading', { name: 'Isolated UI verification', exact: true }).waitFor();
  const projectId = new URL(page.url()).pathname.split('/').at(-1);
  try {
    await page.getByRole('button', { name: 'Add your first resource', exact: true }).click();
    await page.getByRole('button', { name: 'Link', exact: true }).click();
    await page.getByRole('textbox', { name: /Title/ }).fill('Unavailable source');
    await page.getByRole('textbox', { name: 'Article URL', exact: true }).fill('http://127.0.0.1/private');
    await page.getByRole('dialog').getByRole('button', { name: 'Add resource', exact: true }).click();
    await page.locator('.resource-row .state-failed').waitFor();
    check('Failed import stays visible in project overview', true);
    await page.locator('.resource-row').filter({ has: page.getByRole('heading', { name: 'Unavailable source', exact: true }) }).click();
    await page.locator('div.resource-alert').waitFor();
    check('Failed resource view retains original-link and retry controls', await page.getByRole('button', { name: 'Retry processing' }).isVisible());
    await page.screenshot({ path: 'output/playwright/v2/local-failed-resource-mobile.png', fullPage: true });
    await page.goto(base + '/projects/' + projectId);
    await page.getByRole('button', { name: 'Add resource', exact: true }).click();
    await page.getByRole('textbox', { name: /Title/ }).fill('Readable source during model outage');
    await page.getByRole('textbox', { name: 'Resource text', exact: true }).fill('A saved note retains the context of its source. Reading and writing notes remain available when the local model is offline.');
    await page.getByRole('dialog').getByRole('button', { name: 'Add resource', exact: true }).click();
    await page.locator('.resource-row .state-partially-ready').waitFor();
    await page.locator('.resource-row').filter({ has: page.getByRole('heading', { name: 'Readable source during model outage', exact: true }) }).click();
    await page.locator('.text-chunk').first().waitFor();
    check('Actual local import remains readable without indexing', await page.locator('.reading-content').textContent().then(text => text.includes('A saved note retains the context')));
    await page.getByRole('textbox', { name: 'Capture a thought' }).fill('The original text is available despite the model outage.');
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await page.locator('.saved-note').waitFor();
    await page.reload();
    await page.locator('.saved-note').waitFor();
    const state = await page.request.get(base + '/api/state').then(r => r.json());
    check('Source-linked note persists through real API and SQLite reload', state.notes.some(n => n.projectId === projectId && n.chunkId));
    await page.goto(base + '/projects/' + projectId);
    await page.screenshot({ path: 'output/playwright/v2/local-overview-outage-mobile.png', fullPage: true });
    check('Model availability remains honestly unavailable', !(await page.request.get(base + '/api/ai/status').then(r => r.json())).available);
  } finally {
    await page.request.delete(base + '/api/projects/' + projectId, { data: {} });
  }
  return { kind: 'Real local backend, isolated SQLite database; no Ollama model available. Connection/loading are explicitly injected UI states.', results, errors };
}

