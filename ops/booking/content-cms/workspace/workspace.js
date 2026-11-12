import { editableChanges, signature, reviewChanges, validateChanges } from './view-model.mjs';

const $ = id => document.getElementById(id);
let snapshot, draft, savedSignature = '', language = 'en', articles = [], busy = false, reading = false;
let selection = 0,capabilities={create:false,publish:false},publishing={ready:false},libraryTopics=[],releasePlan,operation;
const dirty = () => draft && signature(draft) !== savedSignature;
const setText = (id, text) => { $(id).textContent = text; };
function feedback(text) { setText('feedback', text); }
function error(text = '') { setText('error', text); $('error').hidden = !text; }
async function api(action, params = {}) {
  const response = await fetch('/admin/content/articles', { method: 'POST', credentials: 'same-origin',
    cache: 'no-store', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }), signal: AbortSignal.timeout(30000) });
  let data;
  try { data = await response.json(); } catch { throw new Error('The content service returned an unreadable response. Your edits are still here.'); }
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your content session ended. Keep this tab open and reconnect with Nostr in another Admin tab, then try again.');
    throw new Error(data.error || 'The request could not finish. Your edits are still here.');
  }
  return data;
}
function setBusy(value) {
  busy = value;
  for (const control of document.querySelectorAll('#article-workspace input, #article-workspace textarea, #article-workspace button, #refresh-library, #new-article, #article-list button')) control.disabled = value;
  updateState();
}
function updateState() {
  if (!draft) return;
  $('save').disabled = busy || !dirty();
  for(const id of ['publish','unpublish']){$(id).hidden=!capabilities.publish;$(id).disabled=busy||dirty()||snapshot.isNew||!publishing.ready;}
  $('unpublish').hidden=!capabilities.publish||!snapshot.live?.en;
  $('slug').readOnly=!snapshot.isNew;
  setText('save-state', busy ? 'Saving…' : dirty() ? 'Unsaved changes' : 'Saved draft');
  $('save-state').classList.toggle('unsaved', !!dirty());
  setText('title-count', `${draft[language].title.length} / 100`);
  setText('article-title', draft.en.title || draft.pl.title || 'Article');
}
function listArticles() {
  const query = $('search').value.toLocaleLowerCase();
  $('article-list').replaceChildren();
  for (const article of articles.filter(item => `${item.title ?? ''} ${item.id}`.toLocaleLowerCase().includes(query))) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = article.title || article.id.split('-').join(' ');
    const detail = document.createElement('small'); detail.textContent = article.hasSavedChanges ? 'Saved changes · English + Polski' : 'English + Polski'; button.append(detail);
    if (snapshot?.id === article.id) button.setAttribute('aria-current', 'page');
    button.disabled = busy;
    button.addEventListener('click', () => void selectArticle(article.id));
    $('article-list').append(button);
  }
  if (!$('article-list').children.length) { const p = document.createElement('p'); p.textContent = 'No matching articles.'; $('article-list').append(p); }
  setText('article-count', String(articles.length));
}
async function loadLibrary() {
  const result = await api('workspaceList');capabilities=result.capabilities||{create:false,publish:false};publishing=result.publishing||{ready:false};libraryTopics=result.topics||[];$('new-article').hidden=!capabilities.create;setText('publication-help',publishing.ready?'Approve the saved revision to begin protected publication.':publishing.message||'Only the business owner can publish.');articles = result.articles; listArticles();
  if (!snapshot && articles.length) await selectArticle(articles[0].id);
  if (!articles.length) setText('loading-message', 'No articles are available yet.');
}
async function selectArticle(id) {
  if (busy) return;
  if (snapshot?.id === id) return;
  if (dirty() && !window.confirm('Leave this article and discard your unsaved changes?')) return;
  const attempt = ++selection;
  setText('loading-message', 'Loading both translations…'); $('loading').hidden = false;
  $('article-workspace').hidden = true;
  try {
    const result = await api('workspaceRead', { id });
    if (attempt !== selection) return;
    operation=result.publication||null;$('publication-progress').hidden=!operation;if(operation)void checkPublication();
    snapshot = result; draft = editableChanges(result.translations, result.translations.en.topics);
    savedSignature = signature(draft); language = 'en'; reading = false;
    $('loading').hidden = true; $('article-workspace').hidden = false;
    $('review-panel').hidden = true; error(); feedback('Ready to edit. Saving a draft does not change the live article.');
    const isLive = result.liveStatusKnown && result.live.en && result.live.pl;
    setText('live-status', !result.liveStatusKnown ? 'Live status could not be verified. Your saved draft is available.' : isLive ? 'Published in English and Polish · You are editing a draft copy.' : 'Not yet verified as published in both languages.');
    renderLanguage(); renderTopics(); listArticles();
  } catch (failure) { setText('loading-message', failure.message); $('sign-in-link').hidden = false; }
}
function renderLanguage() {
  for (const locale of ['en', 'pl']) {
    const active = locale === language;
    $(`tab-${locale}`).setAttribute('aria-selected', String(active)); $(`tab-${locale}`).tabIndex = active ? 0 : -1;
  }
  $('translation-panel').setAttribute('aria-labelledby', `tab-${language}`); $('translation-panel').lang = language;
  for (const field of ['title', 'summary', 'keyAnswer', 'body','slug']) { $(field).value = draft[language][field]; $(field).lang = language; }
  renderSources();
  setText('article-author', snapshot.translations[language].author);
  setText('article-url', `/${language}/blog/${draft[language].slug}/`);
  setText('article-revision', snapshot.revision||'New draft');
  updateReadingPreview(); updateState();
}
function renderSources() {
  $('sources').replaceChildren();
  draft[language].sources.forEach((source, index) => {
    const row = document.createElement('div'); row.className = 'source-row';
    for (const [field, label] of [['label', 'Source name'], ['url', 'Source URL']]) {
      const wrapper = document.createElement('label'); wrapper.textContent = `${label} ${index + 1}`;
      const input = document.createElement('input'); input.value = source[field]; input.type = field === 'url' ? 'url' : 'text'; input.disabled = busy;
      input.addEventListener('input', () => { source[field] = input.value; changed(); }); wrapper.append(input); row.append(wrapper);
    }
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove source ${index + 1}`); remove.disabled = busy;
    remove.addEventListener('click', () => { draft[language].sources.splice(index, 1); renderSources(); changed(); }); row.append(remove); $('sources').append(row);
  });
}
function renderTopics() {
  $('topics').replaceChildren();
  for (const topic of snapshot.topics) {
    const label = document.createElement('label'); label.className = 'topic-option';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = topic.id; input.checked = draft.topics.includes(topic.id);
    input.addEventListener('change', () => {
      draft.topics = snapshot.topics.filter(item => [...$('topics').querySelectorAll('input:checked')].some(selected => selected.value === item.id)).map(item => item.id);
      changed();
    }); label.append(input, document.createTextNode(topic.label)); $('topics').append(label);
  }
}
function changed() { error(); $('review-panel').hidden = true; updateState(); }

// Reading preview uses DOM nodes, not innerHTML. Markdown HTML is displayed as
// text, and links are limited to ordinary web URLs or same-origin paths.
function inline(parent, text) {
  const expression = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let cursor = 0;
  for (const match of text.matchAll(expression)) {
    parent.append(document.createTextNode(text.slice(cursor, match.index)));
    if (match[3]) { const strong = document.createElement('strong'); strong.textContent = match[3]; parent.append(strong); }
    else {
      let url;
      try { url = new URL(match[2], location.origin); } catch { /* render as plain text */ }
      if (url && ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
        const link = document.createElement('a'); link.textContent = match[1]; link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; parent.append(link);
      } else parent.append(document.createTextNode(match[1]));
    }
    cursor = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(cursor)));
}
function markdown(parent, source) {
  parent.replaceChildren();
  const lines = source.split('\n');
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (/^#{1,6} /.test(line)) { const heading = document.createElement('h3'); inline(heading, line.replace(/^#+ /, '')); parent.append(heading); index++; continue; }
    if (/^\s*[-*] /.test(line)) {
      const list = document.createElement('ul');
      while (index < lines.length && /^\s*[-*] /.test(lines[index])) { const item = document.createElement('li'); inline(item, lines[index++].replace(/^\s*[-*] /, '')); list.append(item); }
      parent.append(list); continue;
    }
    if (line.startsWith('|') && /^\|[\s:|-]+\|\s*$/.test(lines[index + 1] ?? '')) {
      const table = document.createElement('table'); let header = true;
      while (index < lines.length && lines[index].startsWith('|')) {
        const text = lines[index++]; if (/^\|[\s:|-]+\|\s*$/.test(text)) continue;
        const tr = document.createElement('tr');
        for (const value of text.replace(/^\||\|$/g, '').split('|')) { const cell = document.createElement(header ? 'th' : 'td'); if (header) cell.scope = 'col'; inline(cell, value.trim()); tr.append(cell); }
        table.append(tr); header = false;
      }
      parent.append(table); continue;
    }
    const paragraph = document.createElement('p'); const block = [];
    while (index < lines.length && lines[index].trim() && !/^#{1,6} |^\s*[-*] /.test(lines[index])) block.push(lines[index++]);
    inline(paragraph, block.join(' ')); parent.append(paragraph);
  }
}
function updateReadingPreview() {
  $('fields').hidden = reading; $('reading-preview').hidden = !reading;
  $('preview-toggle').setAttribute('aria-pressed', String(reading));
  $('preview-toggle').textContent = reading ? 'Back to editing' : 'Reading preview';
  if (reading) { setText('preview-title', draft[language].title); setText('preview-answer', draft[language].keyAnswer); markdown($('preview-body'), draft[language].body); }
}
function stringify(value) { return value === null ? 'Not present in the verified live version.' : typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
function showReview() {
  if (!draft) return;
  $('review-panel').hidden = false;
  setText('review-intro', !snapshot.liveStatusKnown ? 'Live comparison is unavailable. Review the draft text below; do not treat it as a verified comparison with production.' : dirty() ? 'These include unsaved changes. Save the draft before requesting a staging review.' : 'Compare this saved draft with the last verified public release.');
  $('review-differences').replaceChildren();
  for (const pair of reviewChanges(draft, snapshot.live)) {
    const heading = document.createElement('h3'); heading.textContent = pair.locale === 'en' ? 'English' : 'Polski'; $('review-differences').append(heading);
    if (!pair.changes.length) { const p = document.createElement('p'); p.textContent = 'No text changes compared with the verified live article.'; $('review-differences').append(p); }
    for (const change of pair.changes) {
      const detail = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = ({ keyAnswer: 'Opening answer', body: 'Article', sources: 'Sources', topics: 'Shared topics', title: 'Title', summary: 'Summary', slug: 'URL' })[change.field]; detail.append(summary);
      const grid = document.createElement('div'); grid.className = 'diff-grid';
      for (const [label, value] of [[snapshot.liveStatusKnown ? 'VERIFIED LIVE VERSION' : 'LIVE VERSION UNAVAILABLE', change.before], ['CURRENT DRAFT', change.after]]) { const column = document.createElement('div'); const name = document.createElement('strong'); name.textContent = label; const text = document.createElement('pre'); text.textContent = !snapshot.liveStatusKnown && label === 'LIVE VERSION UNAVAILABLE' ? 'Live comparison is unavailable.' : stringify(value); column.append(name, text); grid.append(column); }
      detail.append(grid); $('review-differences').append(detail);
    }
  }
  $('preview-links').replaceChildren();
  if (snapshot.previewReady && !dirty()) {
    for (const locale of ['en', 'pl']) { const link = document.createElement('a'); link.textContent = locale === 'en' ? 'Open English staging preview ↗' : 'Otwórz polski podgląd ↗'; link.href = `https://staging.custody.consulting/${locale}/blog/${draft[locale].slug}/?revision=${snapshot.revision}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; $('preview-links').append(link); }
  } else { const p = document.createElement('p'); p.className = 'field-hint'; p.textContent = 'A matching staging preview has not been verified for this draft. The reading preview above is available while editing.'; $('preview-links').append(p); }
  $('draft-review-link').hidden = !snapshot.reviewUrl;
  if (snapshot.reviewUrl) $('draft-review-link').href = snapshot.reviewUrl;
  setText('review-revision', `Saved revision: ${snapshot.revision}. ${dirty() ? 'Current edits have not been saved.' : ''}`);
  $('review-title').focus();
}

for (const field of ['title', 'summary', 'keyAnswer', 'body','slug']) $(field).addEventListener('input', () => { draft[language][field] = $(field).value; changed(); });
for (const locale of ['en', 'pl']) {
  $(`tab-${locale}`).addEventListener('click', () => { if (draft && !busy) { language = locale; renderLanguage(); } });
  $(`tab-${locale}`).addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) && draft && !busy) { event.preventDefault(); language = event.key === 'Home' ? 'en' : event.key === 'End' ? 'pl' : language === 'en' ? 'pl' : 'en'; renderLanguage(); $(`tab-${language}`).focus(); } });
}
$('preview-toggle').addEventListener('click', () => { reading = !reading; updateReadingPreview(); });
$('add-source').addEventListener('click', () => { if (draft[language].sources.length >= 12) { error('Each article can have up to 12 sources.'); return; } draft[language].sources.push({ label: '', url: '' }); renderSources(); changed(); $('sources').lastElementChild.querySelector('input').focus(); });
for (const button of document.querySelectorAll('[data-insert]')) button.addEventListener('click', () => {
  const body = $('body'); const selected = body.value.slice(body.selectionStart, body.selectionEnd);
  const text = { heading: `\n\n## ${selected || 'Heading'}\n`, list: `\n- ${selected || 'List item'}\n`, link: `[${selected || 'Link text'}](https://)` }[button.dataset.insert];
  body.setRangeText(text, body.selectionStart, body.selectionEnd, 'end'); draft[language].body = body.value; changed(); body.focus();
});
$('review').addEventListener('click', showReview);
$('search').addEventListener('input', listArticles);
$('refresh-library').addEventListener('click', async () => { try { await loadLibrary(); feedback('Library refreshed. Your open draft has been kept.'); } catch (failure) { error(failure.message); } });
$('save').addEventListener('click', async () => {
  if (busy || !dirty()) return;
  const problem = validateChanges(draft);
  if (problem) {
    if (problem.locale) { language = problem.locale; renderLanguage(); }
    error(problem.message); const target = $(problem.field);
    (target?.matches('input,textarea') ? target : target?.querySelector('input'))?.focus(); return;
  }
  setBusy(true); error(); feedback('Saving both translations…');
  try {
    const result = await api(snapshot.isNew?'workspaceCreate':'workspaceSave', { id: snapshot.id, revision: snapshot.revision, changes: draft });
    if(snapshot.isNew){articles.push({id:snapshot.id,title:draft.en.title,hasSavedChanges:true});snapshot.isNew=false;}
    snapshot.revision = result.revision; snapshot.reviewUrl = result.url; snapshot.previewReady = false;
    savedSignature = signature(draft); setText('article-revision', snapshot.revision||'New draft');
    feedback(`Both translations saved at ${new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date())}. The live site has not changed.`);
    $('review-panel').hidden = true;renderLanguage();
    const article = articles.find(item => item.id === snapshot.id); if (article) { article.hasSavedChanges = true; article.title = draft.en.title; }
  } catch (failure) { error(failure.name === 'TimeoutError' ? 'Saving timed out. Keep your edits here. Reload this article in a second tab to check whether it saved before trying again.' : failure.message); feedback('Your edits are still here.'); }
  finally { setBusy(false); listArticles(); }
});
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
async function start() {
  try {
    const response = await fetch('/admin/content/session', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.status !== 204) { setText('loading-message', 'Connect with Nostr in Admin to open your article workspace.'); $('sign-in-link').hidden = false; return; }
    await loadLibrary();
  } catch (failure) { setText('loading-message', failure.message || 'The content service is unavailable. Try again shortly.'); $('sign-in-link').hidden = false; }
}
void start();

$('new-article').addEventListener('click',()=>{if(busy)return;$('new-article-dialog').showModal();$('new-en-slug').focus();});
$('new-cancel').addEventListener('click',()=>$('new-article-dialog').close());
$('new-article-form').addEventListener('submit',event=>{
 event.preventDefault();if(!event.currentTarget.reportValidity())return;if(dirty()&&!confirm('Discard your unsaved changes and start a new article?'))return;
 const en=$('new-en-slug').value.trim(),pl=$('new-pl-slug').value.trim();
 const translations=Object.fromEntries(['en','pl'].map(locale=>[locale,{title:'',summary:'',keyAnswer:'',body:'',slug:locale==='en'?en:pl,sources:[{label:'',url:''}],topics:libraryTopics.length?[libraryTopics[0].id]:[],author:'Custody Consulting',draft:true}]));
 operation=null;$('publication-progress').hidden=true;
 snapshot={id:en,isNew:true,revision:null,translations,topics:libraryTopics,live:{},liveStatusKnown:true};draft=editableChanges(translations,translations.en.topics);savedSignature='';language='en';reading=false;
 $('new-article-dialog').close();$('loading').hidden=true;$('article-workspace').hidden=false;$('review-panel').hidden=true;setText('live-status','New bilingual draft · not published');renderLanguage();renderTopics();error();feedback('Write both translations, then save your draft.');$('title').focus();
});
async function signerRequest(event){const detail={event};window.dispatchEvent(new CustomEvent('custody:article-sign',{detail}));if(!detail.result)throw new Error('The article signer is not available. Reload this page.');return detail.result;}
async function preparePublication(target){
 if(busy||dirty()||snapshot.isNew){error('Save your draft before reviewing publication.');return;}
 setBusy(true);error();
 try{releasePlan=await api('workspacePrepareRelease',{id:snapshot.id,revision:snapshot.revision,target});setText('publication-dialog-title',target==='publish'?'Publish this article?':'Unpublish this article?');setText('publication-summary',target==='publish'?'Both language versions will go through the protected publishing pipeline.':'Both language versions will be removed from the public site after the protected deployment. Your source drafts are retained.');$('publication-routes').replaceChildren();for(const [i,route] of releasePlan.review.routes.entries()){const li=document.createElement('li');li.textContent=releasePlan.review.titles[i]+' · '+route;$('publication-routes').append(li);}setText('publication-revision','Reviewed revision: '+releasePlan.revision);$('publication-dialog').showModal();}
 catch(failure){error(failure.message);}finally{setBusy(false);}
}
$('publish').addEventListener('click',()=>void preparePublication('publish'));$('unpublish').addEventListener('click',()=>void preparePublication('unpublish'));$('publication-cancel').addEventListener('click',()=>$('publication-dialog').close());
$('publication-confirm').addEventListener('click',async()=>{
 if(!releasePlan||busy)return;setBusy(true);$('publication-confirm').disabled=true;
 try{const event=await signerRequest();const npub=event.npub;const response=await fetch('/booking-api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mentor-network-challenge',npub,purpose:'article-release',request:{id:releasePlan.id,digest:releasePlan.digest}}),signal:AbortSignal.timeout(30000)});const challenge=await response.json();if(!response.ok)throw new Error(challenge.error||'Publication approval failed.');const signed=await signerRequest(challenge.event);const confirmation=await fetch('/booking-api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mentor-network-confirm',event:signed}),signal:AbortSignal.timeout(30000)});const result=await confirmation.json();if(!confirmation.ok)throw new Error(result.error||'Publication approval failed.');operation=result;$('publication-dialog').close();$('publication-progress').hidden=false;await checkPublication();}
 catch(failure){$('publication-dialog').close();error(failure.message);if(releasePlan){operation={id:releasePlan.id};$('publication-progress').hidden=false;setText('publication-message','Approval response not confirmed. Check progress before trying again.');}}finally{setBusy(false);$('publication-confirm').disabled=false;}
});
async function checkPublication(){if(!operation)return;try{operation=await api('workspaceReleaseStatus',{id:operation.id});setText('publication-message',operation.message||({prepared:'Review required',queued:'Publication queued',staging_checks:'Checking the saved revision',staging_deploy:'Deploying staging preview',production_checks:'Checking production promotion',deploy:'Waiting for production deployment or approval',live:'Verified on production',blocked:'Publication needs attention'})[operation.state]);const url=operation.runUrl||operation.reviewUrl;$('publication-link').hidden=!url;if(url)$('publication-link').href=url;if(['live','blocked'].includes(operation.state)&&publicationTimer)clearInterval(publicationTimer);}catch(failure){error(failure.message);}}
$('publication-refresh').addEventListener('click',()=>void checkPublication());
const publicationTimer=setInterval(()=>{if(operation&&!['live','blocked'].includes(operation.state))void checkPublication();},15000);
