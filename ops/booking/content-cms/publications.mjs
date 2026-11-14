import {publicationProblems} from './workspace/view-model.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {decodeArticle,editableArticle,updatePair} from './workspace-model.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const origin='https://custody.consulting';
const path=(id,locale)=>`astro/src/content/blog/${locale}/${id}.md`;
const error=(message,status=409)=>Object.assign(new Error(message),{status});
export function createPublications({db,call,isOwner,publicRevision,now=Date.now,articleOnly=false,verifyPublic=async(plan)=>{for(const route of plan.review.routes){const response=await fetch(origin+route+'?publication-check=1',{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(10000)});if(response.status!==(plan.target==='publish'?200:404))throw Object.assign(error('Production route verification is still pending.',503),{publicPending:true});}}}){
 db.exec(`CREATE TABLE IF NOT EXISTS article_publications(id TEXT PRIMARY KEY,actor TEXT NOT NULL,digest TEXT NOT NULL,planJson TEXT NOT NULL,state TEXT NOT NULL,infoJson TEXT NOT NULL DEFAULT '{}',approvalJson TEXT,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL);
 CREATE TRIGGER IF NOT EXISTS article_publication_plan_immutable BEFORE UPDATE OF actor,digest,planJson,createdAt ON article_publications BEGIN SELECT RAISE(ABORT,'Publication plans are immutable'); END;
 CREATE UNIQUE INDEX IF NOT EXISTS one_article_release ON article_publications((1)) WHERE state IN ('queued','staging_checks','staging_deploy','production_checks','deploy');`);
 const owner=actor=>{if(!isOwner(actor))throw Object.assign(error('Only the business super-admin can publish or unpublish articles.',403),{fatal:true});};
 const read=async(file,ref)=>{try{const entry=await call(`/contents/${file}?ref=${encodeURIComponent(ref)}`);return Buffer.from(entry.content,'base64').toString();}catch(e){if(e.status===404)return null;throw e;}};
 const head=async ref=>(await call(`/git/ref/heads/${ref}`)).object.sha;
 const save=(row,state,info)=>db.prepare('UPDATE article_publications SET state=?,infoJson=?,updatedAt=? WHERE id=?').run(state,JSON.stringify(info),now(),row.id);
 const get=id=>db.prepare('SELECT * FROM article_publications WHERE id=?').get(id);
 function view(row){const plan=JSON.parse(row.planJson),info=JSON.parse(row.infoJson);return {id:row.id,digest:row.digest,articleId:plan.articleId,target:plan.target,state:row.state,revision:plan.revision,review:plan.review,updatedAt:row.updatedAt,requiresGitHubApproval:!articleOnly,...info};}
 async function source(articleId){const prs=await call(`/pulls?state=open&base=staging&per_page=100`);const pattern=new RegExp(`^cms/(?:articles/${articleId}|nostr-articles/${articleId}/[a-f0-9]{16})$`);const pr=prs.find(p=>p.head.repo?.full_name==='0xRivers/custody-consulting'&&pattern.test(p.head.ref));return pr?{number:pr.number,ref:pr.head.ref,sha:pr.head.sha}:{ref:'staging',sha:await head('staging')};}
 async function exactScope(base,revision,files){const comparison=await call(`/compare/${base}...${revision}`);if(comparison.files?.length>=300||comparison.files?.some(f=>!files.includes(f.filename)||['removed','renamed'].includes(f.status)))throw error('Other changes are pending in staging. Review or synchronize them before publishing this article.');}
 async function readiness(){
  // call uses an installation token explicitly scoped to Actions write. Failure
  // occurs before any branch/PR mutation if the App has not been configured.
  const workflow=await read('.github/workflows/deploy.yml','main');
  if(!workflow?.includes('Refuse an obsolete production candidate'))throw error('Publishing setup required: merge the protected deployment workflow update before enabling article releases.');
  if(articleOnly){const dedicated=await read('.github/workflows/article-release.yml','main');if(!dedicated?.includes('Verify owner-approved article release'))throw error('Website publishing setup required: deploy the signed article workflow first.');const environment=await call('/environments/article-production');if(environment.protection_rules?.some(rule=>rule.type==='required_reviewers')||!environment.deployment_branch_policy?.custom_branch_policies)throw error('Website publishing setup required: configure the main-only article deployment environment.');const branches=await call('/environments/article-production/deployment-branch-policies');if(branches.branch_policies?.length!==1||branches.branch_policies[0].name!=='main'||branches.branch_policies[0].type!=='branch')throw error('The article deployment environment must allow only main.');}
  return {ready:true,websiteOnly:articleOnly};
 }
 async function prepare(actor,{id:articleId,revision,target}){
  owner(actor);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleId||'')||articleId.length>100||!['publish','unpublish'].includes(target)||! /^[a-f0-9]{40}$/.test(revision||''))throw error('Choose a saved article revision and publication action.',400);
  await readiness();const main=await head('main'),staging=await head('staging');
  if(await publicRevision(origin)!==main)throw error('A production release is still pending. Finish or verify it before publishing another article.');
  const saved=await source(articleId);if(saved.sha!==revision)throw error('The saved article changed. Reload and review the new revision.');
  const paths=['en','pl'].map(locale=>path(articleId,locale));await exactScope(main,staging,paths);
  const bases={},original={};for(const locale of ['en','pl']){original[locale]=await read(path(articleId,locale),main);const raw=target==='unpublish'?original[locale]:await read(path(articleId,locale),revision);if(!raw)throw error('Both article translations must exist before this operation.');bases[locale]={data:raw};}
  if(target==='unpublish'&&Object.values(original).every(raw=>!raw||decodeArticle(raw).data.draft))throw error('This article is already unpublished.');
  const editable=Object.fromEntries(['en','pl'].map(locale=>[locale,editableArticle(bases[locale].data)]));
  const changes={topics:editable.en.topics,...Object.fromEntries(['en','pl'].map(locale=>[locale,Object.fromEntries(['title','summary','keyAnswer','body','slug','sources'].map(key=>[key,editable[locale][key]]))]))};
  if(target==='publish'){const problems=publicationProblems(changes);if(problems.length)throw error('Before publishing:\n'+problems.map(problem=>problem.message).join('\n'),400);}
  const validated=updatePair(bases,changes);const date=new Date(now()).toISOString().slice(0,10);
  const files=validated.map((entry,index)=>{const locale=['en','pl'][index];const decoded=decodeArticle(entry.raw);decoded.document.set('draft',target==='unpublish');if(target==='publish'){decoded.document.set('updatedAt',date);if(!original[locale])decoded.document.set('publishedAt',date);}return {path:path(articleId,locale),content:`---\n${decoded.document.toString()}---\n\n${decoded.body}\n`};});
  if(files.every((f,index)=>f.content===original[['en','pl'][index]]))throw error('This exact article revision is already live.');
  const plan={articleId,revision,target,main,staging,source:saved,files,createdAt:now(),review:{titles:['en','pl'].map(locale=>editable[locale].title),paths,routes:['en','pl'].map(locale=>`/${locale}/blog/${editable[locale].slug}/`),target}};
  const planJson=JSON.stringify(plan),id=randomUUID(),digest=sha(planJson);
  db.prepare('INSERT INTO article_publications(id,actor,digest,planJson,state,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run(id,actor,digest,planJson,'prepared',now(),now());
  return view(get(id));
 }
 function approve(actor,{id,digest},event){owner(actor);const row=get(id);if(!row||sha(row.planJson)!==row.digest||row.actor!==actor||row.digest!==digest||row.state!=='prepared'||row.createdAt+600000<now())throw error('This publication review expired or changed. Review the saved article again.');
  if(db.prepare("SELECT id FROM article_publications WHERE state IN ('queued','staging_checks','staging_deploy','production_checks','deploy')").get())throw error('Another article release is in progress. Finish it before starting this one.');
  db.prepare("UPDATE article_publications SET state='queued',approvalJson=?,updatedAt=? WHERE id=?").run(JSON.stringify(event),now(),id);return view(get(id));
 }
 async function approvalProof(row,info){
  const content=JSON.stringify({operationId:row.id,planJson:row.planJson,event:JSON.parse(row.approvalJson)});
  if(Buffer.byteLength(content)>500000)throw error('The signed article proof is too large.',400);
  const branch='cms/approvals/'+row.id;
  let existing;try{existing=await head(branch);}catch(e){if(e.status!==404)throw e;}
  if(existing){if(await read('approval.json',existing)!==content)throw error('The stored owner approval artifact changed.');info.proofRef=existing;save(row,row.state,info);return existing;}
  let proofRef=info.proofRef;
  if(!proofRef){
   const tree=await call('/git/trees',{tree:[{path:'approval.json',mode:'100644',type:'blob',content}]});
   proofRef=(await call('/git/commits',{message:'Owner approval '+row.id,tree:tree.sha,parents:[]})).sha;
   info.proofRef=proofRef;save(row,row.state,info);
  }
  await call('/git/refs',{ref:'refs/heads/'+branch,sha:proofRef});return proofRef;
 }
 async function checked(number,expected,production){
  const pr=await call(`/pulls/${number}`);if(pr.head.sha!==expected)throw error('The release PR changed. A new owner review is required.');
  const {workflow_runs:runs}=await call(`/actions/runs?head_sha=${expected}&event=pull_request&per_page=100`);
  const byWorkflow=new Map();for(const run of runs.sort((a,b)=>b.id-a.id))if(!byWorkflow.has(run.workflow_id))byWorkflow.set(run.workflow_id,run);const latest=[...byWorkflow.values()];
  const required=['Check and deploy website',...(production?['Editorial production gate']:[])];
  for(const name of required){const run=latest.find(r=>r.name===name);if(!run||run.status!=='completed')return false;if(run.conclusion!=='success')throw error(`Publication checks failed: ${name}. Review the linked pull request.`);}
  if(pr.state==='closed'&&!pr.merged)throw error('The publication review was closed. Start a new review to continue.');
  if(!pr.merged&&(!pr.mergeable||pr.mergeable_state!=='clean'))return false;
  return true;
 }
 async function advance(row){
  const plan=JSON.parse(row.planJson),info=JSON.parse(row.infoJson);owner(row.actor);if(articleOnly){const event=JSON.parse(row.approvalJson);if(!Number.isSafeInteger(event?.created_at)||now()-event.created_at*1000>21600000)throw error('The owner approval expired. Review and sign the saved article again.');}if(sha(row.planJson)!==row.digest)throw error('The publication plan changed. A new review is required.');
  if(row.state!=='deploy'&&plan.source.number&&(await source(plan.articleId)).sha!==plan.revision)throw error('The draft changed after approval. Review the new revision before continuing.');
  if(row.state==='queued'){
   if(await head('main')!==plan.main||await head('staging')!==plan.staging)throw error('A release branch changed after approval. Review again.');
   let candidate=info.candidate;
   if(!candidate){const parent=await call(`/git/commits/${plan.staging}`),tree=await call('/git/trees',{base_tree:parent.tree.sha,tree:plan.files.map(f=>({...f,mode:'100644',type:'blob'}))});candidate=(await call('/git/commits',{message:`${plan.target} bilingual article: ${plan.articleId}`,tree:tree.sha,parents:[plan.staging]})).sha;info.candidate=candidate;save(row,'queued',info);}
   const branch=`cms/releases/${row.id}`;let ref;try{ref=await head(branch);}catch(e){if(e.status!==404)throw e;}
   if(ref&&ref!==candidate)throw error('The publication branch changed. Review again.');
   if(!ref)await call('/git/refs',{ref:`refs/heads/${branch}`,sha:candidate});
   const existing=await call(`/pulls?state=open&base=staging&head=0xRivers:${branch}&per_page=100`);
   if(existing.length>1)throw error('Multiple publication reviews exist. Resolve them before continuing.');
   const pr=existing[0]||await call('/pulls',{head:branch,base:'staging',title:`${plan.target==='publish'?'Publish':'Unpublish'}: ${plan.review.titles[0]}`,body:`Owner-approved article operation ${row.id}. Exact source ${plan.revision}. Changes are restricted to both translations.`});
   save(row,'staging_checks',{...info,stagePR:pr.number,candidate,reviewUrl:pr.html_url,message:'Checking the approved article update.'});return;
  }
  if(row.state==='staging_checks'){
   if(await head('main')!==plan.main||await head('staging')!==plan.staging)throw error('A branch changed before the staging merge. Review again.');
   if(!await checked(info.stagePR,info.candidate,false))return;
   const merged=await call(`/pulls/${info.stagePR}/merge`,{sha:info.candidate,merge_method:'merge'},'PUT');if(!merged.merged)return;
   save(row,'staging_deploy',{...info,stageSHA:merged.sha,message:'Waiting for the staging deployment and preview.'});return;
  }
  if(row.state==='staging_deploy'){
   if(await head('main')!==plan.main||await head('staging')!==info.stageSHA)throw error('Staging or main changed. Review the complete release again.');
   await exactScope(plan.main,info.stageSHA,plan.review.paths);
   for(const file of plan.files)if(await read(file.path,info.stageSHA)!==file.content)throw error('Staging content no longer matches the owner-approved revision.');
   const {workflow_runs:runs}=await call(`/actions/runs?head_sha=${info.stageSHA}&event=push&per_page=100`);const run=runs.filter(r=>r.name==='Check and deploy staging').sort((a,b)=>b.id-a.id)[0];
   if(!run||run.status!=='completed'){save(row,row.state,{...info,runUrl:run?.html_url,message:'Waiting for staging checks or its environment approval.'});return;}
   if(run.conclusion!=='success')throw error('Staging deployment failed. Review its workflow run.');
   if(await publicRevision('https://staging.custody.consulting')!==info.stageSHA)return;
   const existing=await call('/pulls?state=open&base=main&head=0xRivers:staging&per_page=100');if(existing.length>1||existing.some(pr=>pr.head.sha!==info.stageSHA))throw error('A different production promotion is already open. Resolve it before continuing.');
   const pr=existing[0]||await call('/pulls',{head:'staging',base:'main',title:`${plan.target==='publish'?'Publish':'Unpublish'} reviewed article: ${plan.review.titles[0]}`,body:`Owner-approved article operation ${row.id}. Staging ${info.stageSHA}. Only ${plan.review.paths.join(' and ')} are approved.`});
   save(row,'production_checks',{...info,productionPR:pr.number,reviewUrl:pr.html_url,message:'Checking the protected production promotion.'});return;
  }
  if(row.state==='production_checks'){
   if(await head('main')!==plan.main||await head('staging')!==info.stageSHA)throw error('The production candidate changed. Review again.');
   if(!await checked(info.productionPR,info.stageSHA,true))return;
   const proofRef=articleOnly?await approvalProof(row,info):null;
   const merged=await call(`/pulls/${info.productionPR}/merge`,{sha:info.stageSHA,merge_method:'merge',...(proofRef?{commit_message:'Custody-Article-Approval: '+proofRef}:{})},'PUT');if(!merged.merged)return;
   save(row,'deploy',{...info,productionSHA:merged.sha,message:'Production merge complete. Preparing the protected deployment.'});return;
  }
  if(row.state==='deploy'){
   if(await head('main')!==info.productionSHA)throw error('Main advanced during publication. Verify the latest production deployment before continuing.');
   const workflow=articleOnly?'article-release.yml':'deploy.yml';
   if(articleOnly&&!info.proofRef)throw error('This release has no signed proof. Review it again.');
   if(!info.dispatched){const existing=await call(`/actions/workflows/${workflow}/runs?head_sha=${info.productionSHA}&per_page=100`);if(!existing.workflow_runs.length)await call('/actions/workflows/'+workflow+'/dispatches',{ref:'main',...(articleOnly?{inputs:{release_sha:info.productionSHA,approval_ref:info.proofRef}}:{})});save(row,'deploy',{...info,dispatched:true,message:articleOnly?'Deploying the owner-approved article automatically.':'Waiting for deployment or production environment approval.'});return;}
   const {workflow_runs:runs}=await call(`/actions/workflows/${workflow}/runs?head_sha=${info.productionSHA}&per_page=100`);const run=runs.sort((a,b)=>b.id-a.id)[0];
   if(articleOnly&&run?.status==='queued'){const standard=await call(`/actions/workflows/deploy.yml/runs?head_sha=${info.productionSHA}&per_page=100`);const waiting=standard.workflow_runs.find(item=>item.status==='waiting');if(waiting){save(row,'blocked',{...info,requiresGitHubApproval:true,runUrl:waiting.html_url,message:'The protected engineering deployment requires review. Article verification did not select the automatic path; review the linked deployment before continuing.'});return;}}
   if(!run||run.status!=='completed'){save(row,'deploy',{...info,runUrl:run?.html_url,message:articleOnly?'The approved article is being checked and deployed. No GitHub approval is required.':'Waiting for production deployment or environment approval. Open the run if approval is required.'});return;}
   if(run.conclusion!=='success')throw error('Production deployment failed. The article is not marked live.');
   if(await publicRevision(origin)!==info.productionSHA)return;
   for(const file of plan.files)if(await read(file.path,info.productionSHA)!==file.content)throw error('The deployed article source does not match the approval.');
   await verifyPublic(plan);
   save(row,'live',{...info,message:plan.target==='publish'?'Published in English and Polish.':'Unpublished in English and Polish.'});
   // Draft cleanup must never revoke an already verified publication result.
   if(plan.source.number)try{const pr=await call(`/pulls/${plan.source.number}`);if(pr.state==='open'&&pr.head.sha===plan.revision)await call(`/pulls/${plan.source.number}`,{state:'closed'},'PATCH');}catch{save(row,'live',{...info,message:(plan.target==='publish'?'Published':'Unpublished')+' in English and Polish. The old draft review could not be closed automatically.'});}
  }
 }
 let running=false;
 return {prepare,approve,readiness,latest(actor,articleId){owner(actor);const row=db.prepare("SELECT * FROM article_publications WHERE state!='prepared' ORDER BY createdAt DESC LIMIT 100").all().find(row=>JSON.parse(row.planJson).articleId===articleId);return row?view(row):null;},status(actor,id){owner(actor);const row=get(id);if(!row)throw error('Publication operation not found.',404);return view(row);},async tick(){if(running)return;running=true;try{for(const row of db.prepare("SELECT * FROM article_publications WHERE state IN ('queued','staging_checks','staging_deploy','production_checks','deploy') ORDER BY createdAt LIMIT 1").all())try{await advance(row);}catch(e){if(!e.fatal&&[401,403,405,429,502,503].includes(e.status)){save(row,row.state,{...JSON.parse(get(row.id).infoJson),message:e.publicPending?e.message:'Waiting for GitHub access or branch protection. No protection is bypassed.'});}else save(row,'blocked',{...JSON.parse(get(row.id).infoJson),message:e.status&&e.status<500?e.message:'Publication could not continue. Check the linked review or run.'});}}finally{running=false;}}};
}
