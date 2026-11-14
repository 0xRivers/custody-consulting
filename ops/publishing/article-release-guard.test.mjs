import {test} from 'node:test';
import assert from 'node:assert/strict';
import {finalizeEvent,generateSecretKey,getPublicKey} from 'nostr-tools/pure';
import {npubEncode} from 'nostr-tools/nip19';
import {ownerApproval,approvalRef,verifyArticleRelease,sha} from './article-release-guard.mjs';
const base='a'.repeat(40),release='b'.repeat(40),proofRef='c'.repeat(40),time=1800000000000;
function fixture(){
 const key=generateSecretKey(),npub=npubEncode(getPublicKey(key)),operationId='11111111-2222-4333-8444-555555555555';
 const files=['en','pl'].map(locale=>({path:'astro/src/content/blog/'+locale+'/example.md',content:'---\nlocale: '+locale+'\nslug: example\ntranslationKey: example\ndraft: false\n---\n\nApproved text.\n'}));
 const plan={articleId:'example',revision:'d'.repeat(40),main:base,staging:'e'.repeat(40),target:'publish',files,createdAt:time,review:{paths:files.map(f=>f.path),routes:['/en/blog/example/','/pl/blog/example/'],target:'publish'}};
 const envelope={operationId,planJson:JSON.stringify(plan)};
 function sign(signingKey=key,purpose='article-release'){
  envelope.event=finalizeEvent({kind:27235,created_at:Math.floor(time/1000),content:'',tags:[['u','https://staging.custody.consulting/booking-api/checkout'],['method','POST'],['payload',sha(JSON.stringify({purpose,request:{id:operationId,digest:sha(envelope.planJson)}}))],['challenge','n'.repeat(43)]]},signingKey);
 }
 sign();const state={main:release,live:base,extra:false,changed:false,mode:'100644',parent:base};
 const get=async path=>{
  if(path==='/git/commits/'+release)return {message:'Publish approved article\n\nCustody-Article-Approval: '+proofRef,parents:[{sha:state.parent},{sha:'e'.repeat(40)}],tree:{sha:'tree'}};
  if(path==='/contents/approval.json?ref='+proofRef)return {type:'file',encoding:'base64',size:JSON.stringify(envelope).length,content:Buffer.from(JSON.stringify(envelope)).toString('base64')};
  if(path==='/git/ref/heads/main')return {object:{sha:state.main}};
  if(path.startsWith('/compare/'))return {files:state.extra?[{filename:'ops/deploy.sh',status:'modified'}]:plan.files.map(f=>({filename:f.path,status:'modified'}))};
  if(path.startsWith('/git/trees/'))return {tree:plan.files.map(f=>({path:f.path,type:'blob',mode:state.mode}))};
  const file=plan.files.find(f=>path==='/contents/'+f.path+'?ref='+release);
  if(file)return {type:'file',encoding:'base64',content:Buffer.from(file.content+(state.changed?'Changed':'')).toString('base64')};
  assert.fail(path);
 };
 return {envelope,npub,plan,state,sign,verify:()=>verifyArticleRelease({release,proofRef,ownerNpub:npub,get,publicRevision:async()=>state.live,now:time+1000})};
}
test('only the configured owner and exact article-purpose payload authorize a release',()=>{
 const f=fixture();assert.equal(ownerApproval(f.envelope,{ownerNpub:f.npub,now:time}).plan.articleId,'example');
 f.sign(generateSecretKey());assert.throws(()=>ownerApproval(f.envelope,{ownerNpub:f.npub,now:time}),/owner signature/);
 f.sign(undefined,'roles-set');assert.throws(()=>ownerApproval(f.envelope,{ownerNpub:f.npub,now:time}),/another action/);
});
test('altering the reviewed plan invalidates the signature',()=>{
 const f=fixture();f.plan.target='unpublish';f.envelope.planJson=JSON.stringify(f.plan);assert.throws(()=>ownerApproval(f.envelope,{ownerNpub:f.npub,now:time}),/another action/);
});
test('stale approval and substituted article paths are rejected',()=>{
 const f=fixture();assert.throws(()=>ownerApproval(f.envelope,{ownerNpub:f.npub,now:time+21600001}),/expired/);
 f.plan.files[0].path='ops/deploy.sh';f.envelope.planJson=JSON.stringify(f.plan);f.sign();assert.throws(()=>ownerApproval(f.envelope,{ownerNpub:f.npub,now:time}),/bilingual/);
});
test('signed URLs and visibility must match the actual bilingual metadata',()=>{
 const f=fixture();f.plan.review.routes[0]='/admin/';f.envelope.planJson=JSON.stringify(f.plan);f.sign();assert.throws(()=>ownerApproval(f.envelope,{ownerNpub:f.npub,now:time}),/URLs/);
});
test('valid publication and idempotent verification of the same deployed revision pass',async()=>{
 const f=fixture();assert.equal((await f.verify()).article,true);f.state.live=release;assert.equal((await f.verify()).release,release);
});
test('signed unpublication is accepted with both translations retained as drafts',async()=>{
 const f=fixture();f.plan.target='unpublish';f.plan.review.target='unpublish';for(const file of f.plan.files)file.content=file.content.replace('draft: false','draft: true');f.envelope.planJson=JSON.stringify(f.plan);f.sign();assert.equal((await f.verify()).target,'unpublish');
});
test('code changes cannot use the article deployment environment',async()=>{
 const f=fixture();f.state.extra=true;await assert.rejects(f.verify(),/outside the approved/);
});
test('source replacement, executable files and symlinks are rejected',async()=>{
 const f=fixture();f.state.changed=true;await assert.rejects(f.verify(),/differs/);f.state.changed=false;
 for(const mode of ['100755','120000']){f.state.mode=mode;await assert.rejects(f.verify(),/regular files/);}
});
test('changed production base or newer main cannot reuse an approval',async()=>{
 const f=fixture();f.state.parent='f'.repeat(40);await assert.rejects(f.verify(),/after the owner/);f.state.parent=base;
 f.state.main='f'.repeat(40);await assert.rejects(f.verify(),/newer main/);f.state.main=release;
 f.state.live='f'.repeat(40);await assert.rejects(f.verify(),/live production base/);
});
test('missing or duplicate approval references never select automatic article routing',()=>{
 assert.throws(()=>approvalRef('Engineering release'),/unique/);assert.throws(()=>approvalRef('Custody-Article-Approval: '+proofRef+'\nCustody-Article-Approval: '+proofRef),/unique/);
});
