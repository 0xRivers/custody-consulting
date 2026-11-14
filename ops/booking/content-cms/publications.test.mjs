import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createPublications} from './publications.mjs';
import {decodeArticle} from './workspace-model.mjs';
import {pair} from './workspace-fixture.mjs';
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40),D='d'.repeat(40),E='e'.repeat(40);
function fixture(t,{articleOnly=false}={}){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const originals=pair();for(const locale of ['en','pl']){const decoded=decodeArticle(originals[locale].data);decoded.document.set('sources',[{label:'Wallet documentation',url:'https://example.com/docs'},{label:'Recovery reference',url:'https://example.com/recovery'}]);originals[locale].data=`---
${decoded.document.toString()}---

A recovery check confirms that the backup matches the intended wallet.

## What should you check?
Check the intended wallet.

## How do you compare results?
| Check | Result |
| --- | --- |
| Address | Matches |

## Next steps
Consider [consulting services](/${locale}/#services) when planning a review.
`;}const source=Object.fromEntries(['en','pl'].map(l=>[l,originals[l].data+'\nReviewed addition to the article.\n']));
 const git={main:A,staging:A,draft:B,files:{},prs:[],guard:true,extra:false,failed:false,owner:true,verified:false,dispatched:false};let time=1800000000000;const calls=[];
 const row=(number,head,base)=>({number,state:'open',base:{ref:base,sha:A},head:{ref:head,sha:head==='staging'?git.staging:C,repo:{full_name:'0xRivers/custody-consulting'}},mergeable:true,mergeable_state:'clean',html_url:'https://github.com/0xRivers/custody-consulting/pull/'+number});
 const draft=()=>({number:1,state:'open',head:{ref:'cms/nostr-articles/example/1234567890abcdef',sha:git.draft,repo:{full_name:'0xRivers/custody-consulting'}},html_url:'https://github.com/0xRivers/custody-consulting/pull/1'});
 async function call(path,body,method){calls.push({path,body,method});
  if(path.startsWith('/contents/.github/'))return {content:Buffer.from(git.guard?'Refuse an obsolete production candidate; Verify owner-approved article release':'workflow_dispatch').toString('base64')};
  if(path==='/environments/article-production')return {protection_rules:[],deployment_branch_policy:{custom_branch_policies:true}};
  if(path==='/environments/article-production/deployment-branch-policies')return {branch_policies:[{name:'main',type:'branch'}]};
  if(path.startsWith('/contents/approval.json'))return {content:Buffer.from(git.files['f'.repeat(40)][0].content).toString('base64')};
  if(path.startsWith('/contents/')){const locale=path.includes('/en/')?'en':'pl',ref=new URL('https://example.test'+path).searchParams.get('ref');const raw=ref===B?source[locale]:git.files[ref]?.find(f=>f.path.includes('/'+locale+'/'))?.content||originals[locale].data;return {content:Buffer.from(raw).toString('base64')};}
  if(path.startsWith('/git/ref/heads/')){const ref=path.slice('/git/ref/heads/'.length),value=git[ref];if(!value)throw Object.assign(new Error('missing'),{status:404});return {object:{sha:value}};}
  if(path.startsWith('/compare/'))return {files:git.extra?[{filename:'ops/deploy.sh'}]:[{filename:'astro/src/content/blog/en/example.md'},{filename:'astro/src/content/blog/pl/example.md'}]};
  if(path.startsWith('/pulls?')){if(path.includes('head=0xRivers:cms/releases/'))return git.prs.filter(p=>p.base.ref==='staging');if(path.includes('base=main'))return git.prs.filter(p=>p.base.ref==='main');return [draft(),...git.prs.filter(p=>p.base.ref==='staging')];}
  if(path==='/git/commits/'+A)return {tree:{sha:'tree'}};
  if(path==='/git/trees'){git.pendingFiles=body.tree;return {sha:'new-tree'};}
  if(path==='/git/commits'){const sha=body.parents.length?'c'.repeat(40):'f'.repeat(40);git.files[sha]=git.pendingFiles;return {sha};}
  if(path==='/git/refs'){git[body.ref.replace('refs/heads/','')]=body.sha;return {};}
  if(path==='/pulls'){const pr=row(git.prs.length+2,body.head,body.base);git.prs.push(pr);if(git.timeoutOnce){git.timeoutOnce=false;throw Object.assign(new Error('timeout'),{status:502});}return pr;}
  if(path==='/pulls/1')return draft();
  if(/^\/pulls\/\d+\/merge$/.test(path)){const pr=git.prs.find(p=>p.number===Number(path.split('/')[2]));const sha=pr.base.ref==='staging'?D:E;git[pr.base.ref]=sha;git.files[sha]=git.files[C];pr.state='closed';return {merged:true,sha};}
  if(/^\/pulls\/\d+$/.test(path))return git.prs.find(p=>p.number===Number(path.split('/')[2]));
  if(/\/actions\/workflows\/(?:deploy|article-release)\.yml\/dispatches/.test(path)){git.dispatched=true;return;}
  if(/\/actions\/workflows\/(?:deploy|article-release)\.yml\/runs/.test(path))return {workflow_runs:git.dispatched?[{id:8,status:'completed',conclusion:'success',html_url:'https://github.com/run/8'}]:[]};
  if(path.includes('/actions/runs?')){const stage=path.includes('event=push');return {workflow_runs:(stage?['Check and deploy staging']:['Check and deploy website','Editorial production gate']).map((name,i)=>({id:10+i,workflow_id:i,name,status:'completed',conclusion:git.failed?'failure':'success',html_url:'https://github.com/run/'+i}))};}
  assert.fail(path);
 }
 const publication=createPublications({db,articleOnly,call,isOwner:actor=>git.owner&&actor==='owner',now:()=>time,publicRevision:async origin=>origin.includes('staging')?git.staging:git.main,verifyPublic:async()=>{if(git.publicPending)throw Object.assign(new Error('Route verification pending'),{status:503,publicPending:true});git.verified=true;}});
 return {db,git,calls,source,publication,prepare:target=>publication.prepare('owner',{id:'example',revision:B,target}),approve:plan=>publication.approve('owner',{id:plan.id,digest:plan.digest},{id:'signed-event',created_at:Math.floor(time/1000)}),advance:()=>{time+=600001;}};
}
test('publication requires owner, deployment readiness and a content-only staging scope',async t=>{
 const f=fixture(t);await assert.rejects(f.publication.prepare('editor',{id:'example',revision:B,target:'publish'}),e=>e.status===403);
 f.git.guard=false;await assert.rejects(f.prepare('publish'),/setup required/);f.git.guard=true;f.git.extra=true;await assert.rejects(f.prepare('publish'),/Other changes/);
 assert.ok(!f.calls.some(c=>c.body));
});
test('publish review captures exact pair; unpublish uses live content rather than pending edits',async t=>{
 const f=fixture(t);const plan=await f.prepare('publish');const raw=JSON.parse(f.db.prepare('SELECT planJson FROM article_publications WHERE id=?').get(plan.id).planJson);
 assert.equal(raw.files.length,2);assert.ok(raw.files.every(file=>decodeArticle(file.content).data.draft===false));assert.ok(raw.files.every(file=>file.content.includes('Reviewed addition')));
 const hide=await f.prepare('unpublish');const hidden=JSON.parse(f.db.prepare('SELECT planJson FROM article_publications WHERE id=?').get(hide.id).planJson);
 assert.ok(hidden.files.every(file=>decodeArticle(file.content).data.draft===true&&!file.content.includes('Reviewed addition')));
});
test('approval expires, rejects changed digest, allows only one active release and cannot replay',async t=>{
 const f=fixture(t);const plan=await f.prepare('publish');assert.throws(()=>f.publication.approve('owner',{id:plan.id,digest:'forged'},{}),/expired or changed/);
 f.approve(plan);assert.throws(()=>f.approve(plan),/expired or changed/);const second=await f.prepare('unpublish');assert.throws(()=>f.approve(second),/in progress/);
});
test('expired prepared review and later edits cannot authorize a release',async t=>{
 const f=fixture(t);const expired=await f.prepare('publish');f.advance();assert.throws(()=>f.approve(expired),/expired/);
 const plan=await f.prepare('publish');f.approve(plan);f.git.draft='f'.repeat(40);await f.publication.tick();assert.equal(f.publication.status('owner',plan.id).state,'blocked');assert.ok(!f.calls.some(c=>c.body));
});
test('protected publishing advances through both checks, staging preview, deployment and public verification',async t=>{
 const f=fixture(t);const plan=await f.prepare('publish');f.approve(plan);
 for(let step=0;step<7;step++)await f.publication.tick();
 const result=f.publication.status('owner',plan.id);assert.equal(result.state,'live');assert.ok(f.git.verified&&f.git.dispatched);
 assert.equal(f.calls.filter(c=>c.method==='PUT'&&c.path.endsWith('/merge')).length,2);
});
test('failed checks stop publication and never dispatch a deployment',async t=>{
 const f=fixture(t);const plan=await f.prepare('publish');f.approve(plan);await f.publication.tick();f.git.failed=true;await f.publication.tick();assert.equal(f.publication.status('owner',plan.id).state,'blocked');assert.equal(f.git.dispatched,false);
});
test('owner revocation stops the durable operation',async t=>{
 const f=fixture(t);const plan=await f.prepare('publish');f.approve(plan);f.git.owner=false;await f.publication.tick();assert.equal(f.db.prepare('SELECT state FROM article_publications WHERE id=?').get(plan.id).state,'blocked');
});

test('reviewed plan and digest cannot be mutated after preparation',async t=>{
 const f=fixture(t);const plan=await f.prepare('publish');assert.throws(()=>f.db.prepare('UPDATE article_publications SET planJson=? WHERE id=?').run('{}',plan.id),/immutable/);
});


test('retry after an uncertain PR response reuses the candidate and review',async t=>{
 const f=fixture(t);const plan=await f.prepare('publish');f.approve(plan);f.git.timeoutOnce=true;await f.publication.tick();assert.equal(f.publication.status('owner',plan.id).state,'queued');
 await f.publication.tick();assert.equal(f.publication.status('owner',plan.id).state,'staging_checks');assert.equal(f.git.prs.length,1);assert.equal(f.calls.filter(c=>c.path==='/git/commits'&&c.body).length,1);
});

test('unpublish completes the protected flow with both translations retained as drafts',async t=>{
 const f=fixture(t);const plan=await f.prepare('unpublish');f.approve(plan);
 for(let step=0;step<7;step++)await f.publication.tick();
 assert.equal(f.publication.status('owner',plan.id).state,'live');
 assert.ok(f.git.files[E].every(file=>decodeArticle(file.content).data.draft===true));
 assert.ok(f.git.files[E].every(file=>!file.content.includes('Reviewed addition')));
});

test('a successful deployment remains pending until public routes verify',async t=>{
 const f=fixture(t);const plan=await f.prepare('publish');f.approve(plan);f.git.publicPending=true;
 for(let step=0;step<7;step++)await f.publication.tick();
 assert.equal(f.publication.status('owner',plan.id).state,'deploy');assert.equal(f.git.verified,false);
 f.git.publicPending=false;await f.publication.tick();assert.equal(f.publication.status('owner',plan.id).state,'live');
});

test('publication content preflight rejects incomplete drafts before creating a release plan or changing GitHub',async t=>{
 const f=fixture(t);const parsed=decodeArticle(f.source.en);parsed.document.set('keyAnswer','x'.repeat(300));parsed.document.set('sources',[{label:'Only one reference',url:'https://example.com'}]);f.source.en=`---\n${parsed.document.toString()}---\n\nPlaceholder text with no headings or comparison table.\n`;
 await assert.rejects(f.prepare('publish'),error=>error.status===400&&error.message.includes('40 and 240')&&error.message.includes('two relevant sources')&&error.message.includes('three sections'));
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM article_publications').get().n,0);assert.ok(!f.calls.some(call=>call.body));
});

test('website publication stores the original proof and binds its deployment dispatch to the production merge',async t=>{
 const f=fixture(t,{articleOnly:true});assert.equal((await f.publication.readiness()).websiteOnly,true);const plan=await f.prepare('publish');f.approve(plan);
 for(let step=0;step<7;step++)await f.publication.tick();
 assert.equal(f.publication.status('owner',plan.id).state,'live');assert.equal(f.publication.status('owner',plan.id).requiresGitHubApproval,false);
 const proof=f.git.files['f'.repeat(40)][0];assert.equal(proof.path,'approval.json');const envelope=JSON.parse(proof.content);assert.equal(envelope.operationId,plan.id);assert.equal(envelope.event.id,'signed-event');
 assert.equal(JSON.parse(envelope.planJson).revision,B);
 const merge=f.calls.find(c=>c.method==='PUT'&&c.body.commit_message);assert.equal(merge.body.commit_message,'Custody-Article-Approval: '+'f'.repeat(40));
 const dispatch=f.calls.find(c=>c.path==='/actions/workflows/article-release.yml/dispatches');assert.deepEqual(dispatch.body,{ref:'main',inputs:{release_sha:E,approval_ref:'f'.repeat(40)}});
 assert.ok(!f.calls.some(c=>c.path==='/actions/workflows/deploy.yml/dispatches'));
});
import {finalizeEvent,generateSecretKey,getPublicKey} from 'nostr-tools/pure';
import {npubEncode} from 'nostr-tools/nip19';
import {ownerApproval,sha as approvalHash} from '../../publishing/article-release-guard.mjs';
test('the worker proof round-trips through the independent workflow signature verifier',async t=>{
 const f=fixture(t,{articleOnly:true}),plan=await f.prepare('publish');
 const raw=JSON.parse(f.db.prepare('SELECT planJson FROM article_publications WHERE id=?').get(plan.id).planJson);
 const key=generateSecretKey();
 const event=finalizeEvent({kind:27235,created_at:Math.floor(raw.createdAt/1000),content:'',tags:[['u','https://staging.custody.consulting/booking-api/checkout'],['method','POST'],['payload',approvalHash(JSON.stringify({purpose:'article-release',request:{id:plan.id,digest:plan.digest}}))],['challenge','z'.repeat(43)]]},key);
 f.publication.approve('owner',{id:plan.id,digest:plan.digest},event);
 for(let step=0;step<7;step++)await f.publication.tick();
 const proof=JSON.parse(f.git.files['f'.repeat(40)][0].content);
 assert.equal(ownerApproval(proof,{ownerNpub:npubEncode(getPublicKey(key)),now:raw.createdAt+1000}).digest,plan.digest);
});
