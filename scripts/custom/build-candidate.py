# Vencord, a Discord client mod
# Copyright (c) 2026 Vendicated and contributors
# SPDX-License-Identifier: GPL-3.0-or-later
"""Build a checked candidate, isolating only manifest-owned optional TS errors."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
DIAGNOSTIC = re.compile(r'^([^\r\n]+)\(\d+,\d+\): error (TS\d+):', re.MULTILINE)


def offenders(output, plugins):
    matches = list(DIAGNOSTIC.finditer(output))
    if not matches or len(matches) != len(re.findall(r'\berror TS\d+:', output)):
        raise RuntimeError('Unclassified compiler failure; refusing automatic isolation')
    result = {}
    for match in matches:
        file = match[1].replace('\\', '/')
        owners = [folder for folder in plugins if file.startswith(folder + '/')]
        if len(owners) != 1:
            raise RuntimeError('Compiler error outside an optional plugin: ' + file)
        folder = owners[0]
        result.setdefault(folder, set()).add(match[2])
    return result


def run(*args):
    result = subprocess.run(args, cwd=ROOT, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, encoding='utf-8', errors='replace')
    print(result.stdout, end='', flush=True)
    return result


def verify_isolation(folders, plugins):
    subprocess.run(['node', 'scripts/custom/check-isolation.mjs', json.dumps({
        'folders': list(folders), 'names': [plugins[f] for f in folders]})], cwd=ROOT, check=True)


def main():
    plugins = {}
    for collection in ('testcord', 'illegalcord'):
        manifest = json.loads((ROOT / f'scripts/custom/{collection}-allowlist.json').read_text())
        for plugin in manifest['plugins']:
            folder = plugin['folder']
            if not re.fullmatch(r'src/(?:testcord|illegalcord)plugins/[A-Za-z0-9_ .-]+', folder):
                raise RuntimeError('Unsafe optional plugin folder')
            if folder.rsplit('/', 1)[1].startswith(('_', '.')):
                raise RuntimeError('Support modules cannot be isolated')
            plugins[folder] = plugin['name']
    report = ROOT / 'dist/optional-plugin-status.json'
    report.unlink(missing_ok=True)
    isolated = []
    moved = []
    with tempfile.TemporaryDirectory(prefix='chuncord-candidate-') as temporary:
        try:
            for attempt in range(4):
                checked = run('node', 'node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false')
                if checked.returncode == 0:
                    break
                failures = offenders(checked.stdout, plugins)
                if attempt == 3 or len(isolated) + len(failures) > 10:
                    raise RuntimeError('Optional isolation limit reached; manual repair required')
                verify_isolation(failures, plugins)
                for folder, codes in failures.items():
                    if folder in {item['folder'] for item in isolated}:
                        raise RuntimeError('Already isolated plugin is still imported; refusing publication')
                    source = ROOT / folder
                    if source.is_symlink() or not source.is_dir():
                        raise RuntimeError('Optional source must be a regular directory')
                    target = Path(temporary) / str(len(moved))
                    shutil.move(str(source), target)
                    moved.append((source, target))
                    isolated.append({'folder': folder, 'name': plugins[folder], 'errors': sorted(codes)})
                    print('::warning::Optional plugin omitted from this candidate: ' + plugins[folder])
            command = 'pnpm.cmd' if os.name == 'nt' else 'pnpm'
            if run(command, 'buildStandalone').returncode:
                raise RuntimeError('Standalone build failed; no candidate may be published')
            report.parent.mkdir(parents=True, exist_ok=True)
            report.write_text(json.dumps({'quarantined': isolated, 'typecheck': 'passed',
                                         'build': 'passed'}, indent=2) + '\n', encoding='utf-8')
        finally:
            for source, target in reversed(moved):
                shutil.move(str(target), source)


if __name__ == '__main__':
    main()
