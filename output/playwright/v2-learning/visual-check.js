async page => {
  const base = 'http://127.0.0.1:3103'; const errors = []; const layouts = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  const fixture = await page.evaluate(() => JSON.parse(localStorage.getItem('athena:v2-learning-fixture')));
  if(!fixture) throw new Error('Run baseline capture in the isolated demo browser first.');
  for (const [width,height] of [[1440,900],[1280,800],[768,1024],[390,844],[375,667],[320,667]]) {
    await page.setViewportSize({width,height});
    const routes = {...fixture.routes,home:'/',projects:'/projects',library:'/resources',overview:'/projects/demo-project'};
    for (const [screen,route] of Object.entries(routes)) {
      await page.evaluate(state => {localStorage.setItem('athena:vercel-demo', JSON.stringify(state));sessionStorage.setItem('athena:preview-session','signed-in');}, fixture.state);
      await page.goto(base + route);
      await page.locator('h1').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => ({ viewport:document.documentElement.clientWidth, scrollWidth:document.documentElement.scrollWidth, outside:[...document.querySelectorAll('main h1, main h2, main button, main input, main textarea')].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&(b.right>innerWidth+1||b.left< -1)}).map(el=>({tag:el.tagName,className:el.className,text:el.textContent.slice(0,60)})).slice(0,8) }));
      layouts.push({screen,width,height,...layout});
      if(width===1440||width===390||(['reader','setup','report'].includes(screen))) {
        const label=width===1440?'desktop':width===390?'mobile':width;
        await page.screenshot({path:`output/playwright/v2-learning/after-${screen}-${label}.png`,fullPage:true,animations:'disabled'});
      }
    }
  }
  return {layouts,errors,overflow:layouts.filter(row=>row.scrollWidth>row.viewport||row.outside.length)};
}
