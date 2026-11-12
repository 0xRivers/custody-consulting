#!/usr/bin/env bash
# Static-only upgrade for the separately routed staging mentor workspace.
set -euo pipefail
cd -- "$(dirname -- "$0")/../.."
MENTOR_NETWORK_ENABLED=true CONTENT_CMS_ENABLED=true CONTENT_NOSTR_ENABLED=true npm run build:astro:staging
python3 - "$1" <<'PY'
from pathlib import Path
import hashlib, shutil, sys, tarfile, tempfile
out=Path(sys.argv[1]).resolve();out.parent.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='custody-network-ui-') as temp:
 root=Path(temp);ui=root/'ui';(ui/'admin/network').mkdir(parents=True)
 html=Path('build/astro-staging/admin/network/index.html').read_text().replace('/_astro/','/_mentor-pilot-assets/')
 assert 'network-page' in html and 'network-masthead' in html and 'noindex' in html
 (ui/'admin/network/index.html').write_text(html)
 admin=Path('build/astro-staging/admin/index.html').read_text().replace('/_astro/','/_mentor-pilot-assets/')
 assert 'data-network-nav' in admin and 'network-panel' in admin
 (ui/'admin/index.html').write_text(admin)
 shutil.copytree('build/astro-staging/_astro',ui/'_mentor-pilot-assets')
 shutil.copyfile('ops/mentors/install-network-ui.sh',root/'install.sh')
 files=sorted(p for p in root.rglob('*') if p.is_file())
 (root/'SHA256SUMS').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(root))+'\n' for p in files))
 with tarfile.open(out,'w:gz') as tar:
  for p in root.iterdir():tar.add(p,arcname=p.name)
 print(hashlib.sha256(out.read_bytes()).hexdigest(),out.name)
PY
