async page => {
 const base='http://127.0.0.1:3103';const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base); await page.evaluate(()=>sessionStorage.setItem('athena:preview-session','signed-in'));
 const ids=await page.evaluate(async()=>{const m=await import('/shared/discovery.js');return m.discoveryResources.map(r=>r.id);});
 for(const [width,height] of [[1440,900],[768,1024],[390,844],[320,667]]) {
  await page.setViewportSize({width,height});
  for(const route of [...ids.map(id=>'/discover/'+id),'/','/projects','/resources','/reviews','/insights','/settings','/signup','/projects/demo-project/notes','/projects/demo-project/review','/learn/demo-hierarchy']) {
   await page.goto(base+route); await page.locator('main').waitFor();await page.evaluate(()=>document.fonts.ready);
   const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,captions:[...document.querySelectorAll('main .discovery-art + p')].map(p=>p.getBoundingClientRect().top-p.previousElementSibling.getBoundingClientRect().bottom),pairs:[...document.querySelectorAll('main .button + p')].filter(el=>el.getBoundingClientRect().height>0).map(p=>({gap:p.getBoundingClientRect().top-p.previousElementSibling.getBoundingClientRect().bottom,text:p.textContent.slice(0,40)}))}));
   if(metrics.captions.some(g=>g<11)||metrics.overflow||metrics.pairs.some(p=>p.gap<15))throw Error(JSON.stringify({route,width,...metrics}));
   checks.push({route,width,...metrics});
   if(['/discover/whitespace','/settings'].includes(route)&&(width===1440||width===390)) await page.screenshot({path:`output/playwright/spacing/after-${route.includes('discover')?'discovery':'settings'}-${width}.png`,fullPage:true});
  }
 }
 await page.goto(base+'/discover/whitespace');await page.getByRole('button',{name:/^Save Whitespace/}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
 return {checks,errors,saveDialogOpenedAndDismissed:true};
}
