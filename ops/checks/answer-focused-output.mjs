import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stagingRoot = new URL('../../build/astro-staging/', import.meta.url);
const fixtures = [
  {
    path: 'en/blog/bitcoin-self-custody-foundations/index.html',
    answer: 'Bitcoin self-custody means controlling the keys',
    service: 'href="/en/#services"',
  },
  {
    path: 'pl/blog/podstawy-samodzielnego-przechowywania-bitcoina/index.html',
    answer: 'Samodzielne przechowywanie bitcoina oznacza kontrolę',
    service: 'href="/pl/#services"',
  },
];

for (const fixture of fixtures) {
  const html = await readFile(new URL(fixture.path, stagingRoot), 'utf8');
  const answerPosition = html.indexOf(fixture.answer);
  const prosePosition = html.indexOf('class="article-prose"');
  assert(answerPosition >= 0 && answerPosition < prosePosition, `Concise answer must precede reasoning in ${fixture.path}`);
  assert.match(html, /<h2 id="[^"]+">[^<]+\?<\/h2>/, `Question heading missing from ${fixture.path}`);
  assert.match(html, /<table>/, `Comparison table missing from ${fixture.path}`);
  assert(html.includes(fixture.service), `Contextual services link missing from ${fixture.path}`);
  assert.doesNotMatch(html, /featured snippet|AI citation|rank #?1|pierwsze miejsce w google/i);
}

console.log('Verified answer-first rendering, question headings, comparisons and contextual service links.');
