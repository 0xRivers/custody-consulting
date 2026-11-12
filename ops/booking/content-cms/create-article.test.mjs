import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createArticlesAPI} from './articles.mjs';
import {pair} from './workspace-fixture.mjs';
import {editableArticle,decodeArticle} from './workspace-model.mjs';
import {editableChanges} from './workspace/view-model.mjs';
const A='a'.repeat(40),B='b'.repeat(40);
function fixture({scope={workspaceAll:true,global:false,articleIds:[]},collision=false}={}){
 const calls=[],base=pair(),changes=editableChanges(Object.fromEntries(Object.entries(base).map(([l,e])=>[l,editableArticle(e.data)])),['foundations']);
 const api=createArticlesAPI({access:()=>scope,getToken:async()=>'',request:async(url,token,body,method)=>{
  calls.push({url,body,method});const route=url.replace('/repos/0xRivers/custody-consulting','');
  if(route.startsWith('/pulls?'))return [];
  if(route==='/git/ref/heads/staging')return {object:{sha:A}};
  if(route.startsWith('/contents/')&&/\/(en|pl)\?/.test(route))return collision?[{type:'file',path:'astro/src/content/blog/en/old.md'}]:[];
  if(route.includes('/old.md'))return {type:'file',encoding:'base64',sha:'file',content:Buffer.from(base.en.data).toString('base64')};
  if(route.startsWith('/contents/'))throw Object.assign(new Error('missing'),{status:404});
  if(route==='/git/commits/'+A)return {tree:{sha:'tree'}};
  if(route==='/git/trees')return {sha:'new-tree'};
  if(route==='/git/commits')return {sha:B};
  if(route==='/git/refs')return {};
  if(route==='/pulls')return {html_url:'https://github.com/0xRivers/custody-consulting/pull/8'};
  assert.fail(route);
 }});return {api,changes,calls};
}
test('editors can create both translations atomically as draft-only content',async()=>{
 const f=fixture();const result=await f.api({action:'workspaceCreate',params:{id:'new-article',changes:f.changes}});
 assert.equal(result.revision,B);const tree=f.calls.find(c=>c.url.endsWith('/git/trees')).body.tree;assert.equal(tree.length,2);assert.ok(tree.every(f=>decodeArticle(f.content).data.draft));
});
test('creation rejects URL collisions and unprivileged actors before writes',async()=>{
 const collision=fixture({collision:true});await assert.rejects(collision.api({action:'workspaceCreate',params:{id:'new-article',changes:collision.changes}}),e=>e.status===409);assert.ok(!collision.calls.some(c=>c.body));
 const denied=fixture({scope:{global:false,workspaceAll:false,articleIds:[]}});await assert.rejects(denied.api({action:'workspaceCreate',params:{id:'new-article',changes:denied.changes}}),e=>e.status===403);assert.equal(denied.calls.length,0);
});
test('Editor creation authority does not grant publish or unpublish authority',async()=>{
 const f=fixture();for(const action of ['workspacePrepareRelease','workspaceReleaseStatus'])await assert.rejects(f.api({action,params:{id:'new-article'}}),e=>e.status===403);assert.equal(f.calls.length,0);
});
