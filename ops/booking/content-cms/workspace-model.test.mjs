import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'yaml';
import { editableArticle, updatePair } from './workspace-model.mjs';
import { editableChanges, reviewChanges, validateChanges } from './workspace/view-model.mjs';

import { pair } from './workspace-fixture.mjs';
function changes() { return editableChanges(Object.fromEntries(Object.entries(pair()).map(([locale, entry]) => [locale, editableArticle(entry.data)])), ['foundations']); }

test('draft updates preserve published state, dates, byline, URLs and translation identity', () => {
  const input = changes(); input.pl.title = 'Zrozumiały poradnik kopii zapasowych';
  const result = updatePair(pair(), input);
  for (const entry of result) {
    const data = parse(entry.raw.split('---')[1]);
    const before = parse(entry.data.split('---')[1]);
    for (const key of ['draft', 'publishedAt', 'updatedAt', 'author', 'slug', 'translationKey', 'locale']) assert.equal(data[key], before[key]);
    assert.deepEqual(data.topics, ['foundations']);
  }
  assert.equal(parse(result[1].raw.split('---')[1]).title, input.pl.title);
});

test('workspace refuses publication flags, date changes, unknown topics and saved URL changes', () => {
  for (const field of ['draft', 'publishedAt', 'locale', 'author']) {
    const input = changes(); input.en[field] = 'injected';
    assert.throws(() => updatePair(pair(), input), /Only article text/);
  }
  const invalid = changes(); invalid.topics = ['typo']; assert.throws(() => updatePair(pair(), invalid), /Choose a topic/);
  const renamed = changes(); renamed.pl.slug = 'new-url'; assert.throws(() => updatePair(pair(), renamed), /redirect review/);
});

test('both languages need valid text and safe source links before saving', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com/']) {
    const input = changes(); input.pl.sources[0].url = url;
    assert.throws(() => updatePair(pair(), input), /public HTTP/);
    assert.equal(validateChanges(input).locale, 'pl');
  }
  const short = changes(); short.pl.summary = 'short';
  assert.throws(() => updatePair(pair(), short), /Polski: summary/);
  assert.equal(validateChanges(short).field, 'summary');
  assert.equal(validateChanges(changes()), null);
});

test('switching/editing one language leaves the other intact and review includes shared topics', () => {
  const saved = Object.fromEntries(Object.entries(pair()).map(([locale, entry]) => [locale, editableArticle(entry.data)]));
  const input = editableChanges(saved, ['foundations']); input.pl.body += '\nNowy akapit.';
  assert.equal(saved.pl.body.includes('Nowy akapit.'), false);
  assert.equal(input.en.body, saved.en.body);
  const review = reviewChanges(input, saved);
  assert.equal(review[0].changes.length, 0);
  assert.deepEqual(review[1].changes.map(change => change.field), ['body']);
});

test('new articles are safe bilingual drafts and cannot smuggle publication metadata',async()=>{
 const {createPair,decodeArticle}=await import('./workspace-model.mjs');
 const bases=pair();const changes=editableChanges(Object.fromEntries(Object.entries(bases).map(([locale,entry])=>[locale,editableArticle(entry.data)])),['foundations']);
 const created=createPair({id:'new-article',changes,date:'2026-11-12'});
 assert.equal(created.length,2);for(const entry of created){const data=decodeArticle(entry.raw).data;assert.equal(data.draft,true);assert.equal(data.author,'Custody Consulting');assert.equal(data.translationKey,'new-article');}
 assert.throws(()=>createPair({id:'../escape',changes}),/URL-safe/);
 const invalid=structuredClone(changes);invalid.en.draft=false;assert.throws(()=>createPair({id:'new-article',changes:invalid}),/Only article text/);
});
