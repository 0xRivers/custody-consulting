export type MetadataLocale = 'en' | 'pl';

export interface AlternatePath {
  lang: MetadataLocale;
  path: string;
}

interface MetadataInput {
  indexable: boolean;
  noindex: boolean;
  site: string;
  canonicalPath?: string;
  alternatePaths?: AlternatePath[];
  xDefaultPath?: string;
}

function absoluteSiteUrl(site: string, path: string): string {
  if (!path.startsWith('/')) throw new Error(`Metadata path must be site-relative: ${path}`);
  return new URL(path, site).href;
}

export function buildMetadataLinks({
  indexable,
  noindex,
  site,
  canonicalPath,
  alternatePaths = [],
  xDefaultPath,
}: MetadataInput) {
  if (!indexable || noindex || !canonicalPath) {
    return { canonical: undefined, alternates: [] as { hreflang: string; href: string }[] };
  }

  const seen = new Set<MetadataLocale>();
  const alternates = alternatePaths.map(({ lang, path }) => {
    if (seen.has(lang)) throw new Error(`Duplicate hreflang: ${lang}`);
    seen.add(lang);
    return { hreflang: lang, href: absoluteSiteUrl(site, path) };
  });

  // x-default is meaningful only when a real bilingual choice is present.
  if (xDefaultPath && seen.has('en') && seen.has('pl')) {
    alternates.push({ hreflang: 'x-default', href: absoluteSiteUrl(site, xDefaultPath) });
  }

  return {
    canonical: absoluteSiteUrl(site, canonicalPath),
    alternates,
  };
}
