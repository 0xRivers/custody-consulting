import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stagingRoot = new URL('../../build/astro-staging/', import.meta.url);
const fixtures = [
  {
    path: 'en/blog/bitcoin-self-custody-foundations/index.html',
    service: 'href="/en/#services"',
  },
  {
    path: 'pl/blog/podstawy-samodzielnego-przechowywania-bitcoina/index.html',
    service: 'href="/pl/#services"',
  },
  {
    path: 'en/blog/how-to-test-your-bitcoin-backup-safely/index.html',
    service: 'href="/en/#services"',
  },
  {
    path: 'pl/blog/jak-bezpiecznie-sprawdzic-kopie-portfela-bitcoin/index.html',
    service: 'href="/pl/#services"',
  },
];

for (const fixture of fixtures) {
  const html = await readFile(new URL(fixture.path, stagingRoot), 'utf8');
  const answer = html.match(/<section\b[^>]*class="key-answer"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<\/section>/);
  assert(answer && answer[1].replace(/<[^>]*>/g, '').trim(), `Concise answer missing from ${fixture.path}`);
  const prosePosition = html.indexOf('class="article-prose"');
  assert(prosePosition >= 0 && answer.index + answer[0].length < prosePosition, `Concise answer must precede reasoning in ${fixture.path}`);
  assert.match(html, /<h2 id="[^"]+">[^<]+\?<\/h2>/, `Question heading missing from ${fixture.path}`);
  assert.match(html, /<table>/, `Comparison table missing from ${fixture.path}`);
  assert(html.includes(fixture.service), `Contextual services link missing from ${fixture.path}`);
  assert.doesNotMatch(html, /featured snippet|AI citation|rank #?1|pierwsze miejsce w google/i);
}

console.log('Verified answer-first rendering, question headings, comparisons and contextual service links.');
