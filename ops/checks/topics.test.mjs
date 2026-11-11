import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { topicRegistry, topicForLocale } from '../../astro/src/lib/topics.ts';

test('stable and legacy topic IDs resolve to existing localized URLs and labels', () => {
  assert.deepEqual(topicForLocale('foundations', 'pl'), { slug: 'podstawy', label: 'Podstawy' });
  assert.equal(topicForLocale('podstawy', 'en').slug, 'foundations');
  assert.equal(topicForLocale('podstawy', 'pl').slug, 'podstawy');
  assert.equal(topicForLocale('ciaglosc', 'pl').label, 'Ciągłość');
  assert.throws(() => topicForLocale('foundatons', 'pl'), /Choose a topic/);
});

test('editor choices and build registry use the same shared IDs', async () => {
  const config = parse(await readFile(new URL('../booking/content-cms/config.yml', import.meta.url), 'utf8'));
  const topicField = config.collections[0].fields.find(field => field.name === 'topics');
  assert.equal(topicField.widget, 'select');
  assert.equal(topicField.i18n, 'duplicate');
  assert.deepEqual(topicField.options.map(option => option.value), topicRegistry.map(topic => topic.id));
  for (const [index, topic] of topicRegistry.entries()) {
    assert.equal(topicField.options[index].label, `${topic.en.label} / ${topic.pl.label}`);
  }
});
