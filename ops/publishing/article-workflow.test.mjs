import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
const workflow=async name=>parse(await readFile(new URL('../../.github/workflows/'+name,import.meta.url),'utf8'));
test('engineering and article deployments serialize without weakening production approval',async()=>{
 const engineering=await workflow('deploy.yml'),article=await workflow('article-release.yml');
 assert.equal(engineering.jobs.deploy.environment,'production');
 assert.match(engineering.jobs.deploy.if,/article_route.outputs.article != 'true'/);
 assert.ok(engineering.jobs.deploy.needs.includes('article_route'));
 assert.equal(article.jobs.deploy.environment,'article-production');
 assert.deepEqual(engineering.concurrency,article.concurrency);
 assert.equal(article.concurrency['cancel-in-progress'],false);
});
test('article credentials require both signature verification and a fresh complete build',async()=>{
 const article=await workflow('article-release.yml');
 assert.deepEqual(article.jobs.deploy.needs,['verify','build']);
 assert.equal(article.jobs.build.needs,'verify');
 assert.match(article.jobs.verify.if,/refs\/heads\/main/);
 assert.ok(article.jobs.verify.steps.some(step=>step.with?.ref==='\$'+'{{ vars.ARTICLE_RELEASE_GUARD_SHA }}'));
 for(const name of ['verify','build'])assert.ok(!JSON.stringify(article.jobs[name]).includes('secrets.VPS_'));
 assert.ok(article.jobs.build.steps.some(step=>step.run?.includes('npm audit --audit-level=moderate')));
 assert.ok(article.jobs.deploy.steps.some(step=>step.run?.includes('article-release-guard.mjs verify')));
});
