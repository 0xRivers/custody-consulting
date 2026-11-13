import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {editableArticle,decodeArticle} from './workspace-model.mjs';
import {publicationProblems} from './workspace/view-model.mjs';

test('publication preflight accepts the existing article corpus checked by CI',async()=>{
 const root=new URL('../../../astro/src/content/blog/',import.meta.url),pairs=new Map();
 for(const path of await readdir(root,{recursive:true})){
  if(!path.endsWith('.md'))continue;
  const raw=await readFile(new URL(path,root),'utf8'),data=decodeArticle(raw).data;
  const pair=pairs.get(data.translationKey)||{};pair[data.locale]=editableArticle(raw);pairs.set(data.translationKey,pair);
 }
 assert.ok(pairs.size>0);
 for(const [id,pair] of pairs)assert.deepEqual(publicationProblems(pair),[],id);
});

test('the placeholder article failure is explained in both languages before GitHub CI',()=>{
 const draft=Object.fromEntries(['en','pl'].map(locale=>[locale,{title:'Testing CMS articles',summary:'A test summary',keyAnswer:'x'.repeat(300),body:'Placeholder text without sections.',sources:[{label:'One source',url:'https://example.com'}]}]));
 const issues=publicationProblems(draft);
 for(const locale of ['en','pl'])for(const fragment of ['40 and 240','three sections','two section headings','two relevant sources','services link','comparison table'])assert.ok(issues.some(issue=>issue.locale===locale&&issue.message.includes(fragment)),locale+': '+fragment);
});
