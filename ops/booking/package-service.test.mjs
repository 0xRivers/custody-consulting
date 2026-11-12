import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageService } from './package-service.mjs';
async function fixture(t) {
 const root=await mkdtemp(join(tmpdir(),'custody-link-'));t.after(()=>rm(root,{recursive:true,force:true}));
 return {root,destination:join(root,'output')};
}
test('missing named exports fail preflight before deployment',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.root,'service.mjs'),"import { currentCalAppointment } from './scheduler.mjs';");
 await writeFile(join(f.root,'scheduler.mjs'),'export function createCalScheduler() {}');
 await assert.rejects(packageService({...f,entries:['service.mjs']}),/currentCalAppointment/);
});
test('packages static, transitive and dynamic dependencies without evaluating service',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.root,'service.mjs'),"import {ok} from './helper.mjs'; throw new Error('Must not execute'); const later=()=>import('./later.mjs');");
 await writeFile(join(f.root,'helper.mjs'),"export {ok} from './nested.mjs';");
 await writeFile(join(f.root,'nested.mjs'),'export const ok=true;');
 await writeFile(join(f.root,'later.mjs'),'export const ready=true;');
 const files=await packageService({...f,entries:['service.mjs']});
 assert.deepEqual(files,['helper.mjs','later.mjs','nested.mjs','service.mjs']);
 assert.match(await readFile(join(f.destination,'nested.mjs'),'utf8'),/ok=true/);
});
