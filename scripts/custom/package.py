# Vencord, a Discord client mod
# Copyright (c) 2026 Vendicated and contributors
# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
import hashlib,json,shutil,subprocess,sys

root=Path(__file__).resolve().parents[2]
destination=Path(sys.argv[1]).resolve();destination.mkdir(parents=True,exist_ok=True)
def git(*args):return subprocess.check_output(['git','-C',str(root),*args],text=True).strip()
desktop=root/'dist/desktop'
for name in ['patcher.js','preload.js','renderer.js']:
    if not (desktop/name).is_file() or not (desktop/name).stat().st_size:raise RuntimeError('Incomplete desktop output: '+name)
lock=json.loads((root/'scripts/custom/testcord-lock.json').read_text())
selection=json.loads((root/'scripts/custom/testcord-allowlist.json').read_text())
info={'source_commit':git('rev-parse','HEAD'),'upstream_commit':git('rev-parse','upstream/main'),'plugins':['BadgeSelector','FakeMuteAndDeafen','ServerBadges'],'testcord_plugins':[p['name'] for p in selection['plugins']],'testcord_revision':lock['revision'],'standalone':True}
illegalcord=json.loads((root/'scripts/custom/illegalcord-allowlist.json').read_text())
info['illegalcord_plugins']=[p['name'] for p in illegalcord['plugins']]
info['illegalcord_revision']=json.loads((root/'scripts/custom/illegalcord-lock.json').read_text())['revision']
(destination/'build-info.json').write_text(json.dumps(info,indent=2)+'\n')
for name in ['desktop.asar','equibop.asar']:
    source=root/'dist'/name
    if not source.is_file() or source.stat().st_size<1024:raise RuntimeError('Incomplete ASAR output: '+name)
    shutil.copyfile(source,destination/name)
checksums=[]
for name in ['desktop.asar','equibop.asar','build-info.json']:
    with (destination/name).open('rb') as stream:checksum=hashlib.file_digest(stream,'sha256').hexdigest()
    checksums.append(checksum+'  '+name+'\n')
(destination/'SHA256SUMS.txt').write_text(''.join(checksums))
