async page => {
  const results = [];
  await page.goto('http://127.0.0.1:3100/');
  await page.evaluate(() => { localStorage.setItem('athena:vercel-demo', localStorage.getItem('athena:v2-evidence-fixture')); sessionStorage.setItem('athena:preview-session', 'signed-in'); });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/projects', '/resources', '/search', '/projects/demo-project']) {
      await page.goto('http://127.0.0.1:3100' + route);
      await page.locator('h1').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ path: 'tmp/axe.min.js' });
      const result = await page.evaluate(async () => {
        const audit = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','best-practice'] } });
        return { passes: audit.passes.length, violations: audit.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), incomplete: audit.incomplete.map(v => ({ id: v.id, count: v.nodes.length })) };
      });
      results.push({ width, route, ...result });
    }
  }
  return results;
}
