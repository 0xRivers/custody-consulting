import {createHash} from 'node:crypto';
import {decode} from 'nostr-tools/nip19';
import {verifyEvent} from 'nostr-tools/pure';
import {parse} from 'yaml';
import {appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const repository='0xRivers/custody-consulting';
export const sha=value=>createHash('sha256').update(value).digest('hex');
const revision=/^[a-f0-9]{40}$/;
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail=message=>{throw new Error(message);};
function ownerKey(npub){try{const key=decode(npub);if(key.type==='npub')return key.data;}catch{}fail('Configure the trusted business owner npub.');}
export function ownerApproval(envelope,{ownerNpub,now=Date.now()}={}){
 if(!envelope||!uuid.test(envelope.operationId||'')||typeof envelope.planJson!=='string'||Buffer.byteLength(envelope.planJson)>300000)fail('Invalid owner approval envelope.');
 const plan=JSON.parse(envelope.planJson),digest=sha(envelope.planJson),event=envelope.event;
 if(!event||event.pubkey!==ownerKey(ownerNpub)||!verifyEvent({...event}))fail('The business owner signature is invalid.');
 if(event.kind!==27235||event.content!==''||!Array.isArray(event.tags)||event.tags.length!==4)fail('This is not an article publication approval.');
 const payload=sha(JSON.stringify({purpose:'article-release',request:{id:envelope.operationId,digest}}));
 const endpoints=['https://staging.custody.consulting/booking-api/checkout','https://custody.consulting/booking-api/checkout'];
 if(!endpoints.includes(event.tags[0]?.[1])||JSON.stringify(event.tags.slice(1,3))!==JSON.stringify([['method','POST'],['payload',payload]])||event.tags[0]?.[0]!=='u'||event.tags[0]?.length!==2||event.tags[3]?.[0]!=='challenge'||event.tags[3]?.length!==2||!/^[A-Za-z0-9_-]{43}$/.test(event.tags[3]?.[1]||''))fail('The signature is for another action or plan.');
 if(!Number.isSafeInteger(event.created_at)||!Number.isSafeInteger(plan.createdAt)||event.created_at*1000+1000<plan.createdAt||event.created_at*1000>plan.createdAt+600000||event.created_at*1000>now+60000||now-event.created_at*1000>21600000)fail('The article approval expired. Review and sign again.');
 if(!revision.test(plan.main)||!revision.test(plan.staging)||!revision.test(plan.revision)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plan.articleId||'')||plan.articleId.length>100||!['publish','unpublish'].includes(plan.target)||!Array.isArray(plan.files)||plan.files.length!==2)fail('Invalid reviewed article plan.');
 const routes=[];
 for(const [index,locale] of ['en','pl'].entries()){
  const file=plan.files[index];
  if(file?.path!=='astro/src/content/blog/'+locale+'/'+plan.articleId+'.md'||typeof file.content!=='string'||Buffer.byteLength(file.content)>100000)fail('The approval must contain exactly one bilingual Markdown pair.');
  const match=file.content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if(!match)fail('Invalid approved article metadata.');
  const data=parse(match[1]);
  if(data?.locale!==locale||data.translationKey!==plan.articleId||data.draft!==(plan.target==='unpublish')||typeof data.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)||data.slug.length>100)fail('Article identity or visibility does not match its approval.');
  routes.push('/'+locale+'/blog/'+data.slug+'/');
 }
 if(JSON.stringify(plan.review?.paths)!==JSON.stringify(plan.files.map(f=>f.path))||JSON.stringify(plan.review?.routes)!==JSON.stringify(routes)||plan.review?.target!==plan.target)fail('The reviewed paths or URLs changed.');
 return {plan,digest,routes};
}
export function approvalRef(message){
 const matches=[...message.matchAll(/^Custody-Article-Approval: ([a-f0-9]{40})$/gm)];
 if(matches.length!==1)fail('No unique article approval reference in this merge.');
 return matches[0][1];
}
export async function verifyArticleRelease({release,proofRef,ownerNpub,get,publicRevision,now}){
 if(!revision.test(release)||!revision.test(proofRef))fail('Expected immutable release and approval commits.');
 const commit=await get('/git/commits/'+release);
 if(approvalRef(commit.message)!==proofRef)fail('The production merge names a different approval.');
 const proof=await get('/contents/approval.json?ref='+proofRef);
 if(proof.type!=='file'||proof.encoding!=='base64'||proof.size>500000)fail('Invalid approval artifact.');
 const envelope=JSON.parse(Buffer.from(proof.content,'base64').toString());
 const {plan,routes}=ownerApproval(envelope,{ownerNpub,now});
 if(commit.parents?.length!==2||commit.parents[0]?.sha!==plan.main)fail('Production changed after the owner review.');
 const main=await get('/git/ref/heads/main');
 if(main.object.sha!==release)fail('A newer main revision exists.');
 const current=await publicRevision();
 if(current!==plan.main&&current!==release)fail('The live production base changed. Review again.');
 const comparison=await get('/compare/'+plan.main+'...'+release);
 if(!comparison.files?.length||comparison.files.length>2||comparison.files.some(file=>!plan.files.some(approved=>approved.path===file.filename)||!['added','modified'].includes(file.status)))fail('This release includes changes outside the approved article pair.');
 const tree=await get('/git/trees/'+commit.tree.sha+'?recursive=1');
 if(tree.truncated)fail('The release tree cannot be fully verified.');
 for(const file of plan.files){
  const entry=tree.tree.find(entry=>entry.path===file.path);
  if(entry?.mode!=='100644'||entry.type!=='blob')fail('Approved article paths must be regular files.');
  const actual=await get('/contents/'+file.path+'?ref='+release);
  if(actual.type!=='file'||actual.encoding!=='base64'||Buffer.from(actual.content,'base64').toString()!==file.content)fail('Released content differs from the signed approval.');
 }
 return {article:true,release,proofRef,operationId:envelope.operationId,target:plan.target,routes};
}
export async function githubGet(path){
 const response=await fetch('https://api.github.com/repos/'+repository+path,{headers:{Accept:'application/vnd.github+json',...(process.env.GH_TOKEN?{Authorization:'Bearer '+process.env.GH_TOKEN}:{})},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)fail('GitHub verification returned HTTP '+response.status+'.');
 return response.json();
}
async function publicRevision(){
 const response=await fetch('https://custody.consulting/version.txt?owner-release='+Date.now(),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 const value=(await response.text()).trim();if(!response.ok||!revision.test(value))fail('The production release could not be verified.');return value;
}
async function main(){
 const [mode,release,provided]=process.argv.slice(2);
 let result={article:false};
 try{
  if(!['route','verify'].includes(mode)||process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_SHA!==release)fail('Article releases must run for this repository main commit.');
  const proofRef=provided||approvalRef((await githubGet('/git/commits/'+release)).message);
  result=await verifyArticleRelease({release,proofRef,ownerNpub:process.env.CUSTODY_SUPER_ADMIN_NPUB,get:githubGet,publicRevision});
 }catch(error){if(mode!=='route')throw error;console.warn('Standard protected deployment retained: '+error.message);}
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'article='+String(result.article)+'\n');
 console.log(JSON.stringify(result));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
