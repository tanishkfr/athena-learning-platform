async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:3100/');
  const capture = async (name, route, signedIn, width, height, view = 'grid') => {
    await page.evaluate(({ signedIn, view }) => {
      const state = JSON.parse(localStorage.getItem('athena:v2-evidence-fixture'));
      if (!state || state.projects.length !== 3) throw new Error('Expected three explicitly seeded example projects');
      state.preferences[0].view = view;
      localStorage.setItem('athena:vercel-demo', JSON.stringify(state));
      signedIn ? sessionStorage.setItem('athena:preview-session', 'signed-in') : sessionStorage.removeItem('athena:preview-session');
    }, { signedIn, view });
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:3100' + route);
    await page.locator('h1').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `output/playwright/v2/after-${name}.png`, fullPage: true, animations: 'disabled' });
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
  await page.screenshot({ path: 'output/playwright/v2/after-navigation-mobile.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  const menuClosed = await page.getByRole('button', { name: 'Toggle navigation' }).getAttribute('aria-expanded') === 'false';
  const metrics = [];
  for (const [width, height] of [[1440,900], [1280,800], [768,1024], [390,844], [375,667], [320,667]]) {
    await page.setViewportSize({ width, height });
    for (const route of ['/', '/projects', '/resources', '/search', '/projects/demo-project', '/projects/demo-project/resources', '/projects/demo-project/notes', '/projects/demo-project/goals', '/projects/demo-project/insights', '/learn/demo-hierarchy', '/projects/demo-project/review', '/reviews', '/insights']) {
      await page.goto('http://127.0.0.1:3100' + route);
      await page.locator('h1').first().waitFor();
      const layout = await page.evaluate(() => ({
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
        outside: [...document.querySelectorAll('main button, main input, main h1, main h2, main h3, main a, .app-header > *')].filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1); }).map(el => ({ tag: el.tagName, className: el.className, text: el.textContent.slice(0,70) })).slice(0, 8)
      }));
      metrics.push({ width, height, route, ...layout });
      if ([1280,768,375,320].includes(width) && ['/', '/projects', '/projects/demo-project'].includes(route)) await page.screenshot({ path: `output/playwright/v2/after-${route === '/' ? 'home' : route === '/projects' ? 'projects' : 'overview'}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
  }
  return { menuClosed, errors, checkedLayouts: metrics.length, overflow: metrics.filter(m => m.scrollWidth > m.width || m.outside.length), metrics };
}
