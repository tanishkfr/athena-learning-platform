async page => {
  const base='http://127.0.0.1:3103'; const checks=[]; const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base); const fixture=await page.evaluate(()=>JSON.parse(localStorage.getItem('athena:v2-learning-fixture')));
  const check=(name,pass)=>{if(!pass)throw new Error(name);checks.push({name,pass});};
  const load=async(state,route)=>{await page.evaluate(s=>{localStorage.setItem('athena:vercel-demo',JSON.stringify(s));Object.keys(localStorage).filter(k=>k.startsWith('athena:draft:')).forEach(k=>localStorage.removeItem(k));},state);await page.goto(base+route);await page.locator('main h1, main h2, main h3').first().waitFor();};
  try {
    for(const [width,height] of [[1440,900],[1280,800],[768,1024],[390,844],[375,667],[320,667]]) {
      await page.setViewportSize({width,height});await load(fixture.state,fixture.routes.notes);
      await page.getByRole('button',{name:'Delete',exact:true}).click(); await page.getByRole('dialog').waitFor();
      check('Delete dialog fits '+width,await page.getByRole('dialog').evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight;}));
      await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).focus();
      let backgroundReached=false; for(let i=0;i<8;i++){await page.keyboard.press('Tab');backgroundReached ||= await page.getByRole('dialog').evaluate(el=>document.activeElement!==document.body&&!el.contains(document.activeElement));}
      check('Native dialog prevents background control focus '+width,!backgroundReached);
      if(width===320||width===1440)await page.screenshot({path:`output/playwright/v2-learning/dialog-${width}.png`});
      await page.keyboard.press('Escape');
    }
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      for(const status of ['Processing','Failed','Empty']) {
        const s=structuredClone(fixture.state);const r=s.resources.find(r=>r.id==='demo-hierarchy');
        r.status=status==='Empty'?'Ready':status;r.error=status==='Failed'?'This resource could not be prepared. Open the original or retry processing.':null;r.chunkCount=0;s.chunks=s.chunks.filter(c=>c.resourceId!==r.id);s.notes=[];
        await load(s,fixture.routes.reader);
        check(status+' reader state '+width,status==='Processing'?await page.getByText('Preparing your resource. You can keep using the workspace.',{exact:true}).isVisible():status==='Failed'?await page.getByRole('button',{name:'Retry processing',exact:true}).isVisible():await page.getByText('No readable text yet.',{exact:true}).isVisible());
        check(status+' reader has no overflow '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:`output/playwright/v2-learning/state-${status.toLowerCase()}-${width}.png`,fullPage:true});
      }
    }
    await page.setViewportSize({width:320,height:667});await load(fixture.state,'/learn/missing-ui-fixture');
    check('Unavailable source offers project return',await page.getByRole('link',{name:'Your projects',exact:true}).isVisible());
    const video=structuredClone(fixture.state);video.resources.push({id:'ui-video-fixture',projectId:'demo-project',title:'Video presentation fixture',type:'video',url:'https://example.com/watch',source:'UI fixture only',status:'Ready',createdAt:'2026-01-01T00:00:00.000Z',chunkCount:1,wordCount:12,position:{seconds:0}});video.chunks.push({id:'ui-video-chunk',projectId:'demo-project',resourceId:'ui-video-fixture',text:'A timestamped passage used to check source navigation in the existing interface.',location:{kind:'timestamp',seconds:35,label:'0:35',index:1}});
    await load(video,'/learn/ui-video-fixture');
    check('Unsupported video has a source fallback',await page.getByRole('link',{name:'Open video',exact:true}).isVisible());
    await page.getByRole('button',{name:'Chapters',exact:true}).click();await page.locator('.chapter-list button').click();
    check('Timestamp chapter changes transcript context',new URL(page.url()).searchParams.get('chunk')==='ui-video-chunk'&&await page.getByRole('spinbutton',{name:'Note timestamp in seconds'}).inputValue()==='35');
    await page.getByRole('spinbutton',{name:'Note timestamp in seconds'}).fill('72');await page.getByRole('button',{name:'Notes',exact:true}).first().click();await page.locator('#note-content').fill('Timestamped UI fixture note.');await page.getByRole('button',{name:'Save note',exact:true}).click();await page.getByText('Timestamped UI fixture note.',{exact:true}).waitFor();
    check('Video note retains explicit timestamp and source',await page.evaluate(()=>{const n=JSON.parse(localStorage.getItem('athena:vercel-demo')).notes.find(n=>n.content==='Timestamped UI fixture note.');return n.seconds===72&&n.resourceId==='ui-video-fixture'&&n.chunkId===null;}));
    await page.locator('.saved-note').filter({hasText:'Timestamped UI fixture note.'}).getByRole('link').click();check('Timestamp note returns with seconds parameter',new URL(page.url()).searchParams.get('seconds')==='72');
    await page.screenshot({path:'output/playwright/v2-learning/state-video-320.png',fullPage:true});
    await load(fixture.state,fixture.routes.active);await page.getByRole('group',{name:'Review questions'}).getByRole('button').nth(1).click();
    check('Question navigation exposes second response',await page.getByRole('group',{name:'Review questions'}).getByRole('button').nth(1).getAttribute('aria-pressed')==='true');
    await load(fixture.state,fixture.routes.reader);await page.getByRole('button',{name:'Ask Athena',exact:true}).click();
    check('Source question panel discloses sample behavior',await page.getByText('Scripted example',{exact:true}).isVisible());
    await page.screenshot({path:'output/playwright/v2-learning/state-question-panel-320.png',fullPage:true});
    await load(fixture.state,fixture.routes.reader);
  } catch(e){return{checks,errors,failure:e.message,url:page.url()};}
  return{checks,errors,scope:'Presentation fixtures stored in the browser demo. No retry processing, extraction, inference, PDF rendering or actual video playback was invoked or verified.'};
}
