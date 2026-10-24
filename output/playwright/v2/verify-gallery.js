async page => {
  await page.goto('http://127.0.0.1:3100/output/playwright/v2/index.html');
  const results=[];
  for (const [screen, viewport] of [['home','desktop'], ['overview','mobile'], ['navigation','mobile']]) {
    await page.locator('#screen').selectOption(screen);
    if(screen !== 'navigation') await page.locator('#viewport').selectOption(viewport);
    await page.locator('#after').evaluate(el => el.decode());
    await page.locator('#before').evaluate(el => el.decode());
    results.push(await page.locator('.comparison img').evaluateAll(images => images.map(el => ({ src:el.getAttribute('src'), loaded:el.complete && el.naturalWidth > 0 }))));
  }
  await page.locator('#screen').selectOption('home');
  await page.locator('#viewport').selectOption('desktop');
  return results;
}
