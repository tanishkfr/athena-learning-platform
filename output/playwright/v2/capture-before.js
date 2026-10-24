async page => {
  await page.goto('http://127.0.0.1:3100/');
  await page.evaluate(async () => {
    const { mockApi } = await import('/src/mock.js');
    localStorage.removeItem('athena:vercel-demo');
    const state = await mockApi('/state');
    const base = state.projects[0];
    state.projects.push(
      { ...base, id: 'v2-research', title: 'Asking better research questions', goal: 'Turn a broad topic into a question that can be answered with evidence.', description: 'An empty example project for collecting research methods.', updatedAt: '2025-12-30T00:00:00.000Z' },
      { ...base, id: 'v2-memory', title: 'How we remember', goal: 'Describe the difference between recognising an idea and recalling it independently.', description: 'An empty example project for exploring memory.', status: 'Finished', updatedAt: '2025-12-29T00:00:00.000Z' }
    );
    state.preferences[0].view = 'grid';
    localStorage.setItem('athena:vercel-demo', JSON.stringify(state));
    localStorage.setItem('athena:v2-evidence-fixture', JSON.stringify(state));
  });
  const capture = async (name, route, signedIn, width, height, view = 'grid') => {
    await page.evaluate(({ signedIn, view }) => {
      const state = JSON.parse(localStorage.getItem('athena:v2-evidence-fixture'));
      state.preferences[0].view = view;
      localStorage.setItem('athena:vercel-demo', JSON.stringify(state));
      signedIn ? sessionStorage.setItem('athena:preview-session', 'signed-in') : sessionStorage.removeItem('athena:preview-session');
    }, { signedIn, view });
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:3100' + route);
    await page.locator('h1').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `output/playwright/v2/before-${name}.png`, fullPage: true, animations: 'disabled' });
  };
  for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    await capture('home-' + label, '/', false, width, height);
    await capture('returning-' + label, '/', true, width, height);
    await capture('projects-grid-' + label, '/projects', true, width, height);
    await capture('projects-list-' + label, '/projects', true, width, height, 'list');
    await capture('discovery-' + label, '/search', false, width, height);
    await capture('library-' + label, '/resources', true, width, height);
    await capture('overview-' + label, '/projects/demo-project', true, width, height);
  }
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.screenshot({ path: 'output/playwright/v2/before-navigation-mobile.png', animations: 'disabled' });
  return 'Captured 15 baseline screenshots using explicitly seeded example projects; no learner evidence.';
}


