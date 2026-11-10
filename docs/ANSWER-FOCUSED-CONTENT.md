# Answer-focused content policy

Custody Consulting articles are written to help a reader make a safer decision,
not to manufacture search-engine or AI citations. The same people-first rules
apply to English and Polish.

## Required article pattern

1. The title names the decision or question without exaggeration.
2. `keyAnswer` gives a concise, qualified answer before the detailed article.
3. The introduction defines the subject and explains the relevant limitation.
4. Descriptive sections answer the reader's next questions in a logical order.
5. Comparisons use a table only when rows and columns make a genuine trade-off
   easier to understand.
6. Actionable guidance states assumptions, failure modes and safety caveats.
7. Primary sources support technical claims. Sources do not replace original
   analysis or a clearly identified author.
8. A related service link is included only where it helps the reader take a
   relevant next step. It must not interrupt or distort the answer.

Question headings are useful when readers genuinely ask that question; they are
not mandatory for every heading. Do not create near-duplicate pages for query
variations, repeat keywords unnaturally, target an arbitrary word count, or
promise rankings, featured snippets or citations by an AI system.

## Custody-specific safety

Examples must use invented, non-sensitive information. Never request or publish
seed phrases, private keys, wallet descriptors, live backups or client details.
State clearly when an example is illustrative rather than a recommendation.
Distinguish a product, process and responsibility model instead of treating a
hardware purchase as a complete custody system.

## Bilingual review

Translation pairs must preserve the same key decision, caveats, section
structure, comparison meaning, sources and service scope. Natural Polish and
English phrasing takes priority over literal keyword matching.

`npm run test:astro:contract` checks the source contract. After the staging
build, `npm run check:answer-focused-output` verifies that the concise answer is
rendered before the reasoning, question headings and comparison markup are
present, and the locale-appropriate service link works.

This policy follows Google's
[people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).
Google's current
[AI features guidance](https://developers.google.com/search/docs/appearance/ai-features)
says those experiences use the same foundational SEO practices and require no
special markup or optimization. Helpful organization does not guarantee
crawling, indexing, ranking or citation.
