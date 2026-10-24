async page => {
 const resources=await page.evaluate(async()=>{const m=await import('/shared/discovery.js');return m.discoveryResources.map(r=>({id:r.id,title:r.title}));});
 await page.goto('http://127.0.0.1:3103/discover/'+resources[0].id);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'output/playwright/spacing/before-desktop.png',fullPage:true});
 return {resources,gap:await page.locator('.discovery-preview article').evaluate(el=>{const b=el.querySelector('.button'),p=b.nextElementSibling;return p.getBoundingClientRect().top-b.getBoundingClientRect().bottom;})};
}
