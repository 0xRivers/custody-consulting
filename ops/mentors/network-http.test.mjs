import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { npubEncode } from 'nostr-tools/nip19';
import { createMentorNetwork } from './network.mjs';
import { createNetworkHTTP } from './network-http.mjs';
import { createContentHandler } from '../booking/content-cms/content-http.mjs';
function fixture(t, {staffLedger} = {}) {
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 const secret=generateSecretKey(),npub=npubEncode(getPublicKey(secret)),origin='https://staging.custody.consulting';
 const network=createMentorNetwork({db,superAdminNpub:npub,origin});
 const contentHandler=createContentHandler({api:()=>{},admin:network,origin,sessionSeconds:1800});
 const handle=createNetworkHTTP({network,contentHandler,origin,staffLedger});
 const request=(input,headers={})=>{const output={headers:{},status:0,body:''};const res={setHeader(k,v){output.headers[k.toLowerCase()]=v;},writeHead(status){output.status=status;return this;},end(body){output.body=body;}};handle({method:'POST',headers:{origin,'content-type':'application/json',...headers}},res,input);return output;};
 const sign=purpose=>finalizeEvent(network.challenge({npub,purpose}).event,secret);
 return {network,request,sign,pubkey:getPublicKey(secret)};
}
test('signed HTTP login confines bearer tokens to secure cookies and supports read/logout',t=>{
 const f=fixture(t);const login=f.request({action:'mentor-network-confirm',event:f.sign('session-start')});
 assert.equal(login.status,200);assert.deepEqual(JSON.parse(login.body),{connected:true});
 const setCookie=login.headers['set-cookie'];for(const flag of ['Secure','HttpOnly','SameSite=Strict','Path=/booking-api/'])assert.ok(setCookie.includes(flag));
 const cookie=setCookie.split(';')[0];
 assert.equal(f.request({action:'mentor-network-read',purpose:'my-status'},{cookie}).status,200);
 assert.equal(f.request({action:'mentor-network-read',purpose:'create-branch'},{cookie}).status,403);
 const logout=f.request({action:'mentor-network-logout'},{cookie});assert.equal(logout.status,200);assert.match(logout.headers['set-cookie'],/Max-Age=0/);
 assert.equal(f.request({action:'mentor-network-read',purpose:'my-status'},{cookie}).status,401);
});
test('content HTTP login uses separate cookie scope and rejects foreign origins before consuming signature',t=>{
 const f=fixture(t),event=f.sign('content-session-start');
 assert.equal(f.request({action:'mentor-network-confirm',event},{origin:'https://attacker.example'}).status,403);
 const result=f.request({action:'mentor-network-confirm',event});assert.equal(result.status,200);
 assert.deepEqual(JSON.parse(result.body),{connected:true});assert.match(result.headers['set-cookie'],/Path=\/admin\/content\//);
 const token=result.headers['set-cookie'].split(';')[0].split('=')[1];assert.match(f.network.requireContentSession(token),/^[a-f0-9]{64}$/);
 assert.equal(f.request({action:'mentor-network-confirm',event}).status,403);
});


test('combined ledger session uses the verified actor and rejects missing/revoked sessions',t=>{
 let actor,calls=0;
 const f=fixture(t,{staffLedger:(key,request)=>{actor=key;calls++;return {rows:[],page:request.page,canReview:true};}});
 const login=f.request({action:'mentor-network-confirm',event:f.sign('session-start')});const cookie=login.headers['set-cookie'].split(';')[0];
 const result=f.request({action:'mentor-network-read',purpose:'sales-ledger',request:{page:2},pubkey:'forged-owner'},{cookie});
 assert.equal(result.status,200);assert.equal(actor,f.pubkey);assert.equal(JSON.parse(result.body).page,2);
 assert.equal(f.request({action:'mentor-network-read',purpose:'sales-ledger',request:{page:1}}).status,401);
 f.request({action:'mentor-network-logout'},{cookie});assert.equal(f.request({action:'mentor-network-read',purpose:'sales-ledger',request:{page:1}},{cookie}).status,401);
 assert.equal(calls,1);
});
