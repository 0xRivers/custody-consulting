import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import * as model from './workspace/view-model.mjs';
import {editableArticle} from './workspace-model.mjs';
import {pair} from './workspace-fixture.mjs';
class Element{
 constructor(){this.children=[];this.hidden=false;this.classList={toggle(){}};}
 addEventListener(){} setAttribute(){} focus(){} querySelectorAll(){return [];}
 append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}
}
async function workspace(){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const translations=Object.fromEntries(['en','pl'].map(locale=>[locale,editableArticle(pair()[locale].data)]));
 const initial={id:'example',revision:'old',translations,topics:[],live:{en:null,pl:null},liveStatusKnown:true};
 const fresh=structuredClone(initial);fresh.revision='new';fresh.live=structuredClone(translations);fresh.liveRevision='production';
 const state={fresh,operation:{id:'operation',state:'live',message:'Published',requiresGitHubApproval:false}};
 const context=createContext({...model,structuredClone,URL,AbortSignal,Intl,Date,console,
 document:{getElementById:get,querySelectorAll:()=>[],createElement:()=>new Element(),createTextNode:text=>({textContent:text})},
 window:{addEventListener(){},confirm:()=>true},location:{origin:'https://staging.custody.consulting'},setInterval:()=>1,clearInterval(){},
 fetch:async(url,options)=>url==='/admin/content/session'?{status:401}:{ok:true,json:async()=>JSON.parse(options.body).action==='workspaceReleaseStatus'?state.operation:state.fresh},
 });
 const source=(await readFile(new URL('./workspace/workspace.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
 runInContext(source+`
globalThis.hooks={
 setup(value){snapshot=value;draft=editableChanges(value.translations,value.translations.en.topics);savedSignature=signature(draft);capabilities={publish:true};publishing={ready:true};},
 edit(){draft.en.title+=' edited';},
 get(){return {snapshot,draft,savedSignature};},
 sync:refreshOpenArticle,
 complete(){operation={id:'operation',state:'deploy'};return checkPublication();}
};`,context);
 context.hooks.setup(initial);
 return {hooks:context.hooks,state,get};
}
test('verified publication refreshes the authoring revision and reveals Unpublish without reload',async()=>{
 const w=await workspace();await w.hooks.sync();assert.equal(w.get('unpublish').hidden,false);assert.equal(w.hooks.get().snapshot.revision,'new');
});
test('refresh preserves unsaved text and its conflict revision when live metadata changes',async()=>{
 const w=await workspace();w.hooks.edit();w.state.fresh.translations.en.title='A concurrent edit';
 await w.hooks.sync();assert.match(w.hooks.get().draft.en.title,/ edited$/);assert.equal(w.hooks.get().snapshot.revision,'old');assert.equal(w.get('unpublish').hidden,false);assert.equal(w.get('unpublish').disabled,true);
});
test('automatic completion refreshes visibility and does not ask for a GitHub approval',async()=>{
 const w=await workspace();await w.hooks.complete();assert.equal(w.get('unpublish').hidden,false);assert.equal(w.get('publication-link').hidden,true);assert.equal(w.hooks.get().snapshot.revision,'new');
});
