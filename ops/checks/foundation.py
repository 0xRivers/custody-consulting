#!/usr/bin/env python3
"""Read-only public baseline and staging indexing checks; no credentials needed."""
import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.robots = []
        self.anchors = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.anchors.append(attrs['id'])
        if tag == 'meta' and attrs.get('name', '').lower() == 'robots':
            self.robots.append(attrs.get('content', '').lower())

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'build/foundation')
out.mkdir(parents=True, exist_ok=True)
report = {'captured': datetime.now(timezone.utc).isoformat(), 'sites': {}, 'errors': []}
for env, host in [('production', 'custody.consulting'), ('staging', 'staging.custody.consulting')]:
    site = report['sites'][env] = {}
    for name, path in [('index.html', '/'), ('version.txt', '/version.txt'), ('robots.txt', '/robots.txt')]:
        try:
            with urlopen('https://' + host + path, timeout=20) as response:
                body = response.read()
                headers = dict(response.headers.items())
                site[name] = {'status': response.status, 'url': response.url, 'headers': headers}
            (out / (env + '-' + name)).write_bytes(body)
            text = body.decode('utf-8')
            if name == 'version.txt':
                site['release'] = text.strip()
                if not re.fullmatch('[a-f0-9]{40}', text.strip()):
                    raise ValueError('Expected full release SHA')
            if name == 'index.html':
                page = Page()
                page.feed(text)
                site['anchors_in_html'] = page.anchors
                if env == 'staging':
                    directives = ','.join(v for k, v in headers.items() if k.lower() == 'x-robots-tag').lower()
                    if 'noindex' not in directives or not any('noindex' in r for r in page.robots):
                        raise ValueError('Staging needs noindex header AND HTML meta')
            if env == 'staging' and name == 'robots.txt':
                lines = [line.split('#')[0].strip().lower() for line in text.splitlines()]
                if any(re.fullmatch(r'disallow:\s*/\s*', line) for line in lines):
                    raise ValueError('Staging blocks crawlers from reading noindex')
                if any(line.startswith('sitemap:') for line in lines):
                    raise ValueError('Staging must not advertise a sitemap')
        except Exception as error:
            # Production may not yet have robots.txt; it is an inventory finding.
            if env == 'production' and name == 'robots.txt':
                site['robots_note'] = str(error)
            else:
                report['errors'].append(f'{env} {path}: {error}')
(out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
sys.exit(bool(report['errors']))
