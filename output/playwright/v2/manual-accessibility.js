async page => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('http://127.0.0.1:3100/projects/demo-project');
  await page.locator('h1').waitFor();
  await page.screenshot({ path: 'output/playwright/v2/after-overview-768.png', fullPage: true, animations: 'disabled' });
  const header = await page.locator('.app-header').evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
  await page.goto('http://127.0.0.1:3100/search');
  await page.locator('h1').waitFor();
  await page.addScriptTag({ path: 'tmp/axe.min.js' });
  const manualNodes = await page.evaluate(async () => {
    const audit = await axe.run(document, { runOnly: ['color-contrast'] });
    return audit.incomplete.flatMap(r => r.nodes.map(n => ({ target: n.target, html: n.html, summary: n.failureSummary })));
  });
  const luminance = hex => {
    const channels = hex.match(/[a-f\d]{2}/gi).map(v => parseInt(v,16)/255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return channels[0]*.2126 + channels[1]*.7152 + channels[2]*.0722;
  };
  const ratio = (a,b) => { const values=[luminance(a),luminance(b)].sort((x,y)=>y-x); return Number(((values[0]+.05)/(values[1]+.05)).toFixed(2)); };
  return { header, manualNodes, ratios: { 'SVG navy labels on cream nodes': ratio('173461','FFFAED'), 'Primary cream label on dark terracotta': ratio('FFFAED','ad4524'), 'Muted text on cream': ratio('626b70','FFFAED'), 'Search arrow on terracotta': ratio('191e24','D95F32') }, note: 'Manual source and rendered review for SVG text that axe cannot calculate. Not a screen-reader or physical-device audit.' };
}
