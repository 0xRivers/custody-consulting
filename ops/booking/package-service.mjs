import { SourceTextModule, SyntheticModule } from 'node:vm';
import { readFile, mkdir, copyFile, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

// Parse/link only: never evaluate the booking service or load its environment.
export async function packageService({ root, destination, entries }) {
  root = await realpath(root);
  const modules = new Map(), files = new Set(), external = new Map();
  function within(file) {
    const path = relative(root, file);
    if (path.startsWith('..') || path.includes('.local') || !['.mjs', '.json'].includes(extname(file))) throw new Error('Invalid service dependency: ' + path);
    return file;
  }
  async function load(file) {
    file = within(await realpath(file));
    if (modules.has(file)) return modules.get(file);
    const source = await readFile(file, 'utf8');
    const mod = extname(file) === '.json'
      ? new SyntheticModule(['default'], function () { this.setExport('default', JSON.parse(source)); }, { identifier: file })
      : new SourceTextModule(source, { identifier: file });
    modules.set(file, mod); files.add(file);
    return mod;
  }
  async function linker(specifier, importer) {
    if (specifier.startsWith('.')) return load(resolve(dirname(importer.identifier), specifier));
    if (!specifier.startsWith('node:') && !['stripe', 'yaml', 'nostr-tools/pure', 'nostr-tools/nip19'].includes(specifier)) throw new Error('Review external dependency: ' + specifier);
    if (!external.has(specifier)) {
      const namespace = await import(specifier);
      external.set(specifier, new SyntheticModule(Object.keys(namespace), function () {
        for (const key of Object.keys(namespace)) this.setExport(key, namespace[key]);
      }));
    }
    return external.get(specifier);
  }
  // Include literal dynamic imports as independent roots; they are not linked by
  // the static module linker, but must still be present and compatible.
  const queue = entries.map(file => resolve(root, file));
  for (let i = 0; i < queue.length; i++) {
    const mod = await load(queue[i]);
    if (mod.status === 'unlinked') await mod.link(linker);
    for (const file of [...files]) {
      if (extname(file) !== '.mjs') continue;
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
        const dynamic = resolve(dirname(file), match[1]);
        if (!queue.includes(dynamic)) queue.push(dynamic);
      }
    }
  }
  for (const file of files) {
    const target = resolve(destination, relative(root, file));
    await mkdir(dirname(target), { recursive: true });
    await copyFile(file, target);
  }
  return [...files].map(file => relative(root, file)).sort();
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = await packageService({ root: process.cwd(), destination: process.argv[2], entries: ['ops/booking/staging-service.mjs', 'ops/booking/content-cms/articles.mjs'] });
  console.log(`Linked and packaged ${files.length} service dependencies without starting the service.`);
}
