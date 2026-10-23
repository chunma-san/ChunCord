# Vencord, a Discord client mod
# Copyright (c) 2026 Vendicated and contributors
# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
import hashlib,json,subprocess,sys,zipfile

root=Path(__file__).resolve().parents[2]
destination=Path(sys.argv[1]).resolve();destination.mkdir(parents=True,exist_ok=True)
def git(*args):return subprocess.check_output(['git','-C',str(root),*args],text=True).strip()
desktop=root/'dist/desktop'
for name in ['patcher.js','preload.js','renderer.js']:
    if not (desktop/name).is_file() or not (desktop/name).stat().st_size:raise RuntimeError('Incomplete desktop output: '+name)
lock=json.loads((root/'scripts/custom/testcord-lock.json').read_text())
selection=json.loads((root/'scripts/custom/testcord-allowlist.json').read_text())
info={'source_commit':git('rev-parse','HEAD'),'upstream_commit':git('rev-parse','upstream/main'),'plugins':['BadgeSelector','FakeMuteAndDeafen','ServerBadges'],'testcord_plugins':[p['name'] for p in selection['plugins']],'testcord_revision':lock['revision'],'standalone':True}
(destination/'build-info.json').write_text(json.dumps(info,indent=2)+'\n')
archive=destination/'Equicord-Custom-Desktop.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as out:
    for path in sorted(desktop.iterdir()):
        if path.is_file() and (path.suffix in ['.js','.css'] or path.name.endswith('.LEGAL.txt')):out.write(path,'desktop/'+path.name)
    out.write(root/'LICENSE','LICENSE');out.write(root/'CUSTOM.md','CUSTOM.md');out.write(destination/'build-info.json','build-info.json')
    out.write(root/'TESTCORD_PLUGINS.md','TESTCORD_PLUGINS.md')
    out.write(root/'patches/testcord/LICENSE','TestCord-LICENSE')
with archive.open('rb') as stream:checksum=hashlib.file_digest(stream,'sha256').hexdigest()
(destination/'SHA256SUMS.txt').write_text(checksum+'  '+archive.name+'\n')
