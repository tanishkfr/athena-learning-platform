async page => {
  const results = []; const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:3100/');
  await page.evaluate(() => { localStorage.setItem('athena:vercel-demo', localStorage.getItem('athena:v2-evidence-fixture')); sessionStorage.setItem('athena:preview-session', 'signed-in'); });
  for (const mode of ['Explain Back', 'Cue Cards', 'Apply It']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:3100/projects/demo-project/review');
    await page.locator('.mode-card').filter({ has: page.getByRole('heading', { name: mode, exact: true }) }).click();
    await page.locator('.concept-checkboxes input').nth(1).uncheck();
    await page.getByRole('button', { name: mode === 'Apply It' ? 'Apply Now' : 'Start ' + mode, exact: true }).click();
    await page.getByRole('textbox', { name: 'Your response', exact: true }).fill('Hierarchy helps readers identify the most important information. I would give the main heading stronger contrast and group related actions together.');
    await page.getByRole('radio', { name: 'Somewhat confident', exact: true }).check();
    if (mode === 'Explain Back') {
      await page.screenshot({ path: 'output/playwright/v2/compatibility-review-desktop.png', fullPage: true, animations: 'disabled' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: 'output/playwright/v2/compatibility-review-mobile.png', fullPage: true, animations: 'disabled' });
    }
    await page.getByRole('button', { name: 'Check my understanding', exact: true }).click();
    await page.getByRole('button', { name: 'View insight report', exact: true }).waitFor();
    const feedbackDisclosure = await page.getByText('Scripted sample feedback', { exact: false }).isVisible();
    await page.getByRole('button', { name: 'View insight report', exact: true }).click();
    await page.waitForURL(/\/report$/);
    await page.locator('.report-columns').waitFor();
    if (mode === 'Explain Back') {
      await page.screenshot({ path: 'output/playwright/v2/compatibility-report-mobile.png', fullPage: true, animations: 'disabled' });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: 'output/playwright/v2/compatibility-report-desktop.png', fullPage: true, animations: 'disabled' });
    }
    await page.locator('.source-reference').first().click();
    await page.locator('.active-chunk').waitFor();
    results.push({ mode, scriptedFeedbackDisclosed: feedbackDisclosure, reportAndSourceReturn: page.url().includes('/learn/') && page.url().includes('chunk=') });
  }
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('athena:vercel-demo')));
  return { kind: 'Browser demo only; scripted feedback, no model-quality claim', results, actualEvidenceRecords: state.evidence.length, errors };
}

