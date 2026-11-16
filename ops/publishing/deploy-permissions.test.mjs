import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, chmod, stat, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

test('public release markers remain readable across deployment users, including retries',async t=>{
 const root=await mkdtemp(join(tmpdir(),'custody-deploy-permissions-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const bin=join(root,'bin'),base=join(root,'server'),sha='a'.repeat(40);
 await mkdir(bin);await mkdir(join(base,'releases'),{recursive:true});
 for(const route of ['index.html','en/index.html','pl/index.html','en/blog/index.html','pl/blog/index.html','sitemap.xml','robots.txt']){
  const path=join(root,'build/astro-production',route);
  await mkdir(join(path,'..'),{recursive:true});await writeFile(path,'static public content');
 }
 const executable=async(name,body)=>{const path=join(bin,name);await writeFile(path,'#!/usr/bin/env bash\nset -euo pipefail\n'+body);await chmod(path,0o755);return path;};
 await executable('git',`case "$1" in rev-parse) echo ${sha};; status) :;; *) exit 1;; esac\n`);
 await executable('ssh',[
  'command=${!#}',
  'command=${command//\\/srv\\/custody-consulting/$DEPLOY_TEST_BASE}',
  'command=${command//\\/usr\\/local\\/bin\\/custody-activate-release/$DEPLOY_TEST_ACTIVATOR}',
  'exec bash -c "$command"',
 ].join('\n'));
 const activate=await executable('activate',String.raw`for marker in astro-release.txt version.txt; do
  mode=$(stat -c '%a' "$DEPLOY_TEST_BASE/releases/$1/$marker")
  [[ $mode == 644 ]] || { echo "Public marker $marker is unreadable to the web server: $mode" >&2; exit 1; }
done
`);
 const key=join(root,'key'),hosts=join(root,'known_hosts');
 await writeFile(key,'private test key',{mode:0o600});await writeFile(hosts,'test host');
 const env={...process.env,PATH:bin+':'+process.env.PATH,DEPLOY_KEY:key,DEPLOY_KNOWN_HOSTS:hosts,DEPLOY_USER:'custody',DEPLOY_TEST_BASE:base,DEPLOY_TEST_ACTIVATOR:activate,DEPLOY_TEST_SCRIPT:fileURLToPath(new URL('../deploy.sh',import.meta.url))};
 const deploy=()=>{const result=spawnSync('bash',['-c','umask 077; bash "$DEPLOY_TEST_SCRIPT"'],{cwd:root,env,encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);};
 deploy();
 const target=join(base,'releases',sha);
 assert.equal(await readFile(join(target,'version.txt'),'utf8'),sha+'\n');
 // A failed older attempt can leave identical content with unreadable modes.
 for(const marker of ['astro-release.txt','version.txt'])await chmod(join(target,marker),0o600);
 deploy();
 assert.equal((await stat(key)).mode&0o777,0o600,'SSH credentials must remain private');
});
