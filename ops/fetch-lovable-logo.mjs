import { writeFile } from 'node:fs/promises';
const url = 'https://custodyconsulting.lovable.app/__l5e/assets-v1/6187da55-b8ce-4794-9108-dd93395095e0/custody-logo-white.png';
const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Logo download failed: HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
if (!bytes.subarray(0, 8).equals(signature)) throw new Error('Logo URL did not return a PNG. Export the logo from Lovable and save it as src/assets/custody-logo-white.png.');
await writeFile(new URL('../src/assets/custody-logo-white.png', import.meta.url), bytes);
console.log('Saved original Lovable logo.');
