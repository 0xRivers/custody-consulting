import { defineConfig } from 'astro/config';
import { buildEnvironment } from './environment.mjs';
const environment = buildEnvironment(process.env.SITE_ENV);
export default defineConfig({
  root: new URL('./', import.meta.url),
  site: environment.site,
  output: 'static',
  outDir: environment.outDir,
  trailingSlash: 'always',
});
