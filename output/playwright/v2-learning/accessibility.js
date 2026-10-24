async page => {
  const base='http://127.0.0.1:3103'; const results=[];
  await page.goto(base);
  const fixture=await page.evaluate(()=>JSON.parse(localStorage.getItem('athena:v2-learning-fixture')));
  for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:900});
    for(const [screen,route] of Object.entries(fixture.routes)) {
      await page.goto(base+route);await page.locator('h1').first().waitFor();await page.evaluate(()=>document.fonts.ready);
      await page.addScriptTag({path:'tmp/axe.min.js'});
      const result=await page.evaluate(async()=>{const a=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}});return{passes:a.passes.length,violations:a.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:a.incomplete.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html}))}))}});
      results.push({screen,width,...result});
    }
  }
  return results;
}
