export function buildEnvironment(value) {
  if (!['staging', 'production'].includes(value)) {
    throw new Error('SITE_ENV must explicitly be staging or production');
  }
  const production = value === 'production';
  return Object.freeze({
    name: value,
    site: production ? 'https://custody.consulting' : 'https://staging.custody.consulting',
    indexable: production,
    outDir: `../build/astro-${value}`,
  });
}
