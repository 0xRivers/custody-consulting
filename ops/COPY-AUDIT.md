# Staging copy and interface audit

## Direction

Replace anxiety-led selling with a concrete service proposition: help clients
choose, operate, back up and recover their own Bitcoin custody setup. Address
individuals, families and businesses across Europe in Polish and English.
Preserve the navy/orange identity, original imagery and existing starting prices.

## Findings and revisions

| Finding | Before | Revision and purpose |
| --- | --- | --- |
| Hero takes too long to identify the service | “Whatever happens across the border” | “Your bitcoin. Your keys. A clear plan.” Follow with wallets, backups and recovery, plus languages and audience. |
| Fear dominates the rationale | War, frozen bank accounts, inflation | Explain control, recoverable backups, manageable complexity and family continuity. Each maps to a service. |
| Absolute claims obscure responsibility | “No risk of frozen accounts”; wealth restored using memorised words | Remove guarantees and memory-only recovery framing. Explain custody responsibility and practising a documented recovery plan. |
| Geography does not match the brief | Poland-only positioning | European audience, with explicit Polish/English support. Remove unverified Warsaw/Kraków meetings. |
| Services list tasks without an outcome | Wallet setup and multisig packages | Add practical outcomes and explain that multisig is assessed rather than a default upgrade. Keep 490 / 1,900 / 4,900 PLN starting prices and custom quote. |
| Unverified service commitments | Free 15-minute call; reply within 24h; months of support | Remove these promises. Say further support and meeting availability are agreed separately. |
| Legal/tax FAQ is overbroad | “Fully legal”; PIT-38 instruction | Replace with a scope FAQ directing legal, tax and inheritance-law questions to qualified advisers. No legal conclusions are made. |
| Form implies a working contact channel | Collects personal details before revealing no message was sent | Remove inactive inputs. Show preparation questions and booking availability up front; never collect details through a nonfunctional form. |
| Main CTA leads to unavailable booking | “Free intro call” | Primary action explores services; secondary action explains the process. Contact status remains explicit. |
| Four service columns constrain bilingual text | Four narrow desktop cards | Two-column layout with clearer descriptions, outcomes and price hierarchy. |
| Keyboard and anchor navigation need support | Small language targets; sticky header can cover anchors | 44px language controls, named navigation, visible focus, anchor offset and reduced-motion support. |
| Metadata remains Poland-only after switching | Static title/description | Update document language, title and description with the selected language. |

## Hero pair

English: “Your bitcoin. Your keys. A clear plan.”

Polish: “Twój bitcoin. Twoje klucze. Jasny plan.”

Both versions use natural wording and the same service scope, prices, process,
FAQs and contact status. The default remains Polish.

## Still needed before accepting enquiries

- A verified contact address or booking URL and its actual availability.
- Consultant name, biography and verifiable experience to support trust claims.
- Confirmation of published prices, billing currency, taxes and package scope.
- Business details and the appropriate privacy information for any contact integration.

These are missing business inputs, not new functionality introduced by this edit.
No client testimonials, credentials or regulated-service claims were invented.

## Validation and limitations

TypeScript and the production Vite build pass. Content parity and a rendered
page check cover section anchors, a single H1, bilingual structure and removal
of the inactive form. Browser-based visual QA is unavailable in this session;
responsive layout, language switching and FAQ interactions still need a staging
browser review after deployment. This is an editorial/interface audit, not a
legal review. Changes are confined to staging; the existing production dist
and production deployment workflow are unchanged.
