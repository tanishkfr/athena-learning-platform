async page => {
  const checks=[];const errors=[];const failedRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  const check=(name,pass)=>{if(!pass)throw new Error(name);checks.push({name,pass});};
  await page.goto('http://127.0.0.1:3103/');const fixture=await page.evaluate(()=>JSON.parse(localStorage.getItem('athena:v2-learning-fixture')));
  await page.evaluate(s=>localStorage.setItem('athena:vercel-demo',JSON.stringify(s)),fixture.state);
  await page.goto('http://127.0.0.1:3103'+fixture.routes.reader);await page.locator('#note-content').waitFor();
  const contrast=await page.locator('#note-content').evaluate(el=>{
    const c=getComputedStyle(el),p=getComputedStyle(el,'::placeholder');
    const lum=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    const ratio=(a,b)=>{a=lum(a);b=lum(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
    return{foreground:c.color,placeholder:p.color,background:c.backgroundColor,textRatio:ratio(c.color,c.backgroundColor),placeholderRatio:ratio(p.color,c.backgroundColor),placeholderOpacity:p.opacity};
  });check('Manual computed textarea contrast exceeds 4.5:1',contrast.textRatio>=4.5&&contrast.placeholderRatio>=4.5&&contrast.placeholderOpacity==='1');
  const path='http://127.0.0.1:3103/output/playwright/v2-learning/index.html';await page.setViewportSize({width:1440,height:900});await page.goto(path);
  for(const screen of ['reader','notes','setup','active','feedback','report','insights','reviews','settings','focus'])for(const viewport of ['desktop','mobile']){
    await page.locator('#screen').selectOption(screen);await page.locator('#viewport').selectOption(viewport);
    await page.waitForFunction(()=>[...document.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0));
    check('Comparison images load: '+screen+' '+viewport,await page.locator('#before').getAttribute('src')===`before-${screen}-${viewport}.png`&&await page.locator('#after').getAttribute('src')===`after-${screen}-${viewport}.png`);
  }
  await page.locator('#screen').selectOption('reader');await page.locator('#viewport').selectOption('desktop');await page.screenshot({path:'output/playwright/v2-learning/comparison-gallery.png'});
  await page.goto('http://127.0.0.1:3104/');await page.evaluate(s=>{localStorage.setItem('athena:vercel-demo',JSON.stringify(s));sessionStorage.setItem('athena:preview-session','signed-in');},fixture.state);
  for(const [name,route] of Object.entries({reader:fixture.routes.reader,setup:fixture.routes.setup,feedback:fixture.routes.feedback,report:fixture.routes.report,settings:fixture.routes.settings})){
    await page.goto('http://127.0.0.1:3104'+route);await page.locator('h1').waitFor();check('Built demo renders '+name,await page.locator('h1').isVisible());
  }
  check('Built demo retains sample disclosure',await page.getByText('Feedback: scripted samples',{exact:false}).isVisible());
  await page.goto(path);
  return{checks,errors,failedRequests,contrast,scope:'Frontend production-build smoke and evidence gallery verification; no local backend or model verification.'};
}
