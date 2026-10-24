async page => {
  const base = 'http://127.0.0.1:3103'; const checks = []; const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (name, value) => { if (!value) throw new Error(name); checks.push({name, pass:true}); };
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('athena:vercel-demo')));
  const go = async route => { await page.goto(base+route); await page.locator('h1').first().waitFor(); };
  await go('/');
  const fixture = await page.evaluate(() => JSON.parse(localStorage.getItem('athena:v2-learning-fixture')));
  const reset = async () => page.evaluate(s => { Object.keys(localStorage).filter(k=>k.startsWith('athena:draft:')).forEach(k=>localStorage.removeItem(k)); localStorage.setItem('athena:vercel-demo',JSON.stringify(s)); }, fixture.state);
  try {
    await reset(); await page.setViewportSize({width:1440,height:900});
    await go('/projects'); await page.getByRole('link',{name:/Designing for human attention/}).first().click();
    check('Project opens from Projects', page.url().endsWith('/projects/demo-project'));
    await page.getByRole('link',{name:/Visual hierarchy & attention/}).first().click();
    check('Project source opens Reader',page.url().includes('/learn/demo-hierarchy'));
    await page.getByRole('button',{name:'Use Paragraph 4 as note context',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('athena:vercel-demo')).resources.find(r=>r.id==='demo-hierarchy').position.chunkId==='demo-hierarchy-4');
    await page.reload(); await page.getByRole('button',{name:'Use Paragraph 4 as note context'}).waitFor();
    check('Reading passage persists after reload',await page.getByRole('button',{name:'Use Paragraph 4 as note context'}).getAttribute('aria-pressed')==='true');
    await page.getByRole('button',{name:'Notes',exact:true}).first().click();
    check('Notes shortcut focuses composer',await page.locator('#note-content').evaluate(el=>el===document.activeElement));
    await page.locator('#note-content').fill('A test thought linked to contrast and emphasis.'); await page.getByRole('button',{name:'Save note',exact:true}).click();
    await page.getByText('A test thought linked to contrast and emphasis.',{exact:true}).waitFor();
    let note=(await state()).notes.find(n=>n.content.startsWith('A test thought'));
    check('Contextual note preserves resource and chunk IDs',note.resourceId==='demo-hierarchy'&&note.chunkId==='demo-hierarchy-4');
    await page.locator('#edit-note-'+note.id).click();
    check('Editing focuses note field',await page.getByRole('textbox',{name:'Edit note'}).evaluate(el=>el===document.activeElement));
    await page.getByRole('textbox',{name:'Edit note'}).fill('Edited thought: contrast guides the next action.'); await page.getByRole('button',{name:'Save changes'}).click();
    await page.getByText('Edited thought: contrast guides the next action.',{exact:true}).waitFor();
    check('Editing restores focus to Edit',await page.locator('#edit-note-'+note.id).evaluate(el=>el===document.activeElement));
    await page.reload(); await page.getByText('Edited thought: contrast guides the next action.',{exact:true}).waitFor();
    const updated=(await state()).notes.find(n=>n.id===note.id);
    check('Edited note persists with original context',updated.chunkId===note.chunkId&&updated.resourceId===note.resourceId&&updated.quote===note.quote&&updated.createdAt===note.createdAt);
    await go('/projects/demo-project/notes');
    await page.locator('.saved-note').filter({hasText:'Edited thought:'}).getByRole('link').click();
    check('Project note returns to exact source',new URL(page.url()).searchParams.get('chunk')===note.chunkId);
    await page.getByRole('button',{name:'Focus mode',exact:true}).click();
    check('Focus mode removes shell header and footer',await page.locator('.app-header,.app-footer').count()===0);
    await page.locator('.saved-note').filter({hasText:'Edited thought:'}).getByRole('link').click();
    check('Source return preserves focus mode',new URL(page.url()).searchParams.get('focus')==='1');
    await page.getByRole('button',{name:'Exit focus',exact:true}).click();
    check('Exit focus restores shell',await page.locator('.app-header').isVisible()&&await page.locator('.app-footer').isVisible());
    const article=page.locator('.saved-note').filter({hasText:'Edited thought:'}); await article.getByRole('button',{name:'Delete',exact:true}).click();
    await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    check('Delete dialog Escape keeps note and restores focus',await page.getByRole('dialog').count()===0&&await article.getByRole('button',{name:'Delete',exact:true}).evaluate(el=>el===document.activeElement));
    await article.getByRole('button',{name:'Delete',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();
    await page.waitForFunction(id=>!JSON.parse(localStorage.getItem('athena:vercel-demo')).notes.some(n=>n.id===id),note.id);
    check('Demo note deletion keeps source', (await state()).resources.some(r=>r.id==='demo-hierarchy'));

    await page.setViewportSize({width:390,height:844}); await go('/learn/demo-hierarchy');
    // DOM Range selects real rendered source text; this does not simulate a native touch-selection gesture.
    const selected=await page.locator('#chunk-demo-hierarchy-2 p').evaluate(el=>{const range=document.createRange();range.setStart(el.firstChild,0);range.setEnd(el.firstChild,70);const s=window.getSelection();s.removeAllRanges();s.addRange(range);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return s.toString();});
    await page.getByRole('button',{name:'Capture note',exact:true}).click();
    check('Mobile passage capture brings notes into view',await page.locator('#note-content').evaluate(el=>el===document.activeElement&&el.getBoundingClientRect().top<innerHeight));
    await page.locator('#note-content').fill('Selected passage mobile note.'); await page.getByRole('button',{name:'Save note',exact:true}).click();
    await page.getByText('Selected passage mobile note.',{exact:true}).waitFor();
    note=(await state()).notes.find(n=>n.content==='Selected passage mobile note.');
    check('Selected quote persists with correct source',note.quote===selected&&note.chunkId==='demo-hierarchy-2');
    await page.getByRole('button',{name:'Toggle navigation'}).click(); check('Mobile navigation opens',await page.getByRole('button',{name:'Toggle navigation'}).getAttribute('aria-expanded')==='true');
    await page.keyboard.press('Escape'); check('Mobile navigation Escape restores toggle focus',await page.getByRole('button',{name:'Toggle navigation'}).evaluate(el=>el===document.activeElement)&&await page.getByRole('button',{name:'Toggle navigation'}).getAttribute('aria-expanded')==='false');

    await page.setViewportSize({width:1440,height:900});
    for(const mode of ['Explain Back','Cue Cards','Apply It']) {
      await go('/projects/demo-project/review');
      const choice=page.getByRole('group',{name:'Review mode'}).getByRole('button',{name:new RegExp(mode)}); await choice.click();
      check(mode+': selection state',await choice.getAttribute('aria-pressed')==='true');
      const concepts=page.locator('.concept-checkboxes input'); await concepts.nth(1).uncheck();
      check(mode+': scope updates',await page.getByText('1 concepts selected',{exact:true}).isVisible());
      await page.getByRole('button',{name:mode==='Apply It'?'Apply Now':'Start '+mode,exact:true}).click();
      await page.locator('#review-response').waitFor(); const activeRoute=new URL(page.url()).pathname;
      check(mode+': review starts',activeRoute.startsWith('/reviews/'));
      await page.locator('#review-response').fill('Hierarchy gives important information a clear place through size, contrast and spacing. I would emphasise the main action so a reader can find it.');
      await page.getByRole('radio',{name:'Confident',exact:true}).check();
      await page.waitForFunction(()=>document.querySelector('.response-meta [role=status]')?.textContent==='Draft saved');
      const reviewId=activeRoute.split('/').pop();
      check(mode+': answer and confidence autosave',(await state()).attempts.some(a=>a.reviewId===reviewId&&a.confidence==='Confident'&&a.response.startsWith('Hierarchy gives')));
      await page.getByRole('link',{name:'Pause & leave',exact:true}).click();
      await page.locator('.history-row[href="'+activeRoute+'"]').click(); await page.locator('#review-response').waitFor();
      check(mode+': pause and resume draft',(await page.locator('#review-response').inputValue()).startsWith('Hierarchy gives'));
      if(mode==='Cue Cards') {
        await page.getByRole('button',{name:'Reveal answer',exact:true}).click(); await page.getByRole('button',{name:'Knew it',exact:true}).click();
        await page.waitForFunction(id=>JSON.parse(localStorage.getItem('athena:vercel-demo')).attempts.find(a=>a.reviewId===id)?.selfRating==='Knew it',reviewId);
        check('Cue Cards: reveal and self-rating saved',(await state()).attempts.find(a=>a.reviewId===reviewId).revealed);
      } else {
        for(const help of ['hint','example','explanation','answer']) { await page.getByRole('button',{name:'Show '+help,exact:true}).click(); await page.locator('.help-content').waitFor(); }
        check(mode+': all progressive help levels',(await state()).attempts.find(a=>a.reviewId===reviewId).assistance===4);
      }
      await page.getByRole('button',{name:'Check my understanding',exact:true}).click(); await page.locator('.evaluation').waitFor();
      check(mode+': scripted feedback and sources visible',await page.getByText(/Scripted sample feedback/).isVisible()&&await page.locator('.evaluation .source-reference').count()>0);
      await page.locator('.evaluation .source-reference').first().click(); check(mode+': feedback source return',page.url().includes('/learn/demo-hierarchy?chunk='));
      await go(activeRoute); await page.getByRole('button',{name:'View insight report',exact:true}).click(); await page.locator('.report-page').waitFor();
      check(mode+': sample report and disclosure',await page.getByText('Sample review feedback',{exact:true}).isVisible()&&await page.getByText('Sample feedback does not create knowledge evidence or review dates.',{exact:true}).isVisible());
      await page.locator('.report-history .history-row[href="'+activeRoute+'/report"]').click();
      check(mode+': review history reopens report',page.url().endsWith(activeRoute+'/report'));
    }
    check('Scripted reviews create no knowledge evidence or schedules',(await state()).evidence.length===0&&(await state()).schedules.length===0);
    await go('/insights'); check('Insights separates activity from empty knowledge',await page.getByText('Understanding starts with evidence.',{exact:true}).isVisible());
    await go('/settings'); await page.getByRole('textbox',{name:'Your name',exact:true}).fill('Reader'); await page.getByRole('button',{name:'Save name',exact:true}).click();
    await page.getByRole('combobox').selectOption('larger'); await page.getByRole('checkbox',{name:'Reduce interface motion',exact:true}).check();
    await page.getByRole('checkbox',{name:'Show a due-review reminder when I open Athena',exact:true}).check();
    await page.reload(); await page.getByRole('textbox',{name:'Your name',exact:true}).waitFor();
    check('Settings preferences persist',(await page.getByRole('textbox',{name:'Your name',exact:true}).inputValue())==='Reader'&&await page.getByRole('combobox').inputValue()==='larger'&&await page.getByRole('checkbox',{name:'Reduce interface motion',exact:true}).isChecked()&&await page.getByRole('checkbox',{name:'Show a due-review reminder when I open Athena',exact:true}).isChecked());
    await go('/learn/demo-hierarchy');
    check('Reading and motion preferences apply',await page.evaluate(()=>document.documentElement.dataset.textSize==='larger'&&document.documentElement.dataset.motion==='reduced'&&parseFloat(getComputedStyle(document.querySelector('.text-chunk p')).fontSize)>20));
    await go('/projects/demo-project/review'); await page.keyboard.press('Tab');
    check('Keyboard skip link is first and visibly focused',await page.getByRole('link',{name:'Skip to content',exact:true}).evaluate(el=>el===document.activeElement&&el.getBoundingClientRect().top>=0));
    await page.keyboard.press('Enter'); check('Skip link reaches main',await page.locator('main').evaluate(el=>el===document.activeElement));
    await page.getByRole('group',{name:'Review mode'}).getByRole('button',{name:/Cue Cards/}).focus(); await page.keyboard.press('Enter');
    check('Keyboard selects review mode',await page.getByRole('group',{name:'Review mode'}).getByRole('button',{name:/Cue Cards/}).getAttribute('aria-pressed')==='true');
    await page.screenshot({path:'output/playwright/v2-learning/keyboard-review-focus.png'});
    await reset(); await go(fixture.routes.reader);
  } catch(e) { return {checks,errors,failure:e.message,url:page.url()}; }
  return {checks,errors,scope:'Chrome browser-local scripted demo only; DOM Range passage capture, no native touch gesture, no inference or backend checks.'};
}
