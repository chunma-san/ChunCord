# Vencord, a Discord client mod
# Copyright (c) 2026 Vendicated and contributors
# SPDX-License-Identifier: GPL-3.0-or-later
"""Import only the reviewed Illegalcord selection, then reapply the Equicord port."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def run(*args, cwd=ROOT):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()


def relative(value):
    p = PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or '\\' in value or ':' in value:
        raise ValueError('Unsafe source path')
    return p.as_posix()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Clean checkout of ImHisako/Illegalcord')
    parser.add_argument('--review-native', action='store_true', help='Accept native source changes after manual review')
    args = parser.parse_args()
    source = args.source.resolve()
    origin = run('git', 'remote', 'get-url', 'origin', cwd=source)
    if origin.removesuffix('.git') != 'https://github.com/ImHisako/Illegalcord':
        raise ValueError('Unexpected upstream repository')
    if run('git', 'status', '--porcelain', '--untracked-files=all', cwd=source):
        raise ValueError('Upstream checkout must be clean')
    revision = run('git', 'rev-parse', 'HEAD', cwd=source)
    manifest = json.loads((ROOT/'scripts/custom/illegalcord-allowlist.json').read_text())
    plugins = manifest['plugins']
    if len(plugins) != 45 or len({p['name'] for p in plugins}) != 45:
        raise ValueError('The reviewed selection must contain exactly 45 plugins')
    mapping = {}
    for plugin in plugins:
        folder = relative(plugin['folder'])
        if not folder.startswith('src/illegalcordplugins/') or folder.endswith('/_support'):
            raise ValueError('Unexpected plugin folder')
        for f in plugin['files']:
            f = relative(f)
            if not f.startswith(folder+'/') or f in mapping:
                raise ValueError('Unexpected or duplicate plugin file')
            mapping[f] = f
        if plugin['entry'] not in mapping:
            raise ValueError('Missing plugin entrypoint')
    for helper in manifest['support']:
        dst, src = relative(helper['target']), relative(helper['source'])
        if not dst.startswith('src/illegalcordplugins/') or dst in mapping:
            raise ValueError('Unexpected helper destination')
        mapping[dst] = src
    lock_path = ROOT/'scripts/custom/illegalcord-lock.json'
    old = json.loads(lock_path.read_text()) if lock_path.exists() else {}
    hashes = {}
    contents = {}
    tree = dict(line.split('\t', 1)[::-1] for line in run('git', 'ls-tree', '-r', 'HEAD', cwd=source).splitlines())
    for dst, src in mapping.items():
        if src not in tree:
            raise ValueError('Selected source file is missing; review upstream moves or renames: '+src)
        mode = tree.get(src, '').split(' ', 1)[0]
        if mode != '100644':
            raise ValueError('Only regular, non-executable source files may be imported: '+src)
        data = (source/src).read_bytes()
        if len(data) > 8*1024*1024 or (b'\0' in data and Path(src).suffix not in ('.png', '.webp')):
            raise ValueError('Unexpected binary or oversized source file: '+src)
        normalized = data if Path(src).suffix in ('.png', '.webp') else data.replace(b'\r\n', b'\n')
        hashes[src] = digest(normalized)
        contents[dst] = normalized
    if tree.get('src/utils/constants.ts', '').split(' ', 1)[0] != '100644':
        raise ValueError('Author registry must be a regular source file')
    constants = (source/'src/utils/constants.ts').read_bytes()
    if len(constants) > 8*1024*1024 or b'\0' in constants:
        raise ValueError('Invalid author registry')
    hashes['src/utils/constants.ts'] = digest(constants.replace(b'\r\n', b'\n'))
    native_paths = {src for src in hashes if 'native' in src.lower() or src.endswith(('.cpp','.c','.h','.hpp','.cjs')) or src == 'src/main/utils/safeFetch.ts'}
    queue = list(native_paths)
    while queue:
        src = queue.pop()
        if not src.endswith(('.ts','.tsx','.js','.cjs')):
            continue
        code = (source/src).read_text(encoding='utf-8')
        for dependency in re.findall(r'(?:from\s*|import\s*\(|require\s*\()[\s]*["\'](\.[^"\']+)["\']', code):
            target = os.path.normpath(str(PurePosixPath(src).parent/dependency)).replace('\\', '/')
            for candidate in (target, target+'.ts', target+'.tsx', target+'/index.ts'):
                if candidate in hashes and candidate not in native_paths:
                    native_paths.add(candidate)
                    queue.append(candidate)
    native = {src:hashes[src] for src in sorted(native_paths)}
    if old and old.get('native_sources') != native and not args.review_native:
        raise ValueError('Native source changed. Review it before importing with --review-native.')
    scratch = Path(os.environ.get('RUNNER_TEMP', ROOT.parent))
    with tempfile.TemporaryDirectory(prefix='equicord-illegalcord-', dir=scratch) as folder:
        stage = Path(folder)
        for dst, data in contents.items():
            out = stage/dst
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(data)
        for f in ('scripts/custom/illegalcord-allowlist.json', 'src/utils/types.ts'):
            out = stage/f
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT/f, out)
        run('node', str(ROOT/'scripts/custom/adapt-illegalcord.mjs'), str(source), cwd=stage)
        patch = ROOT/'patches/illegalcord/compat.patch'
        for destination in re.findall(r'^\+\+\+ b/(.+)$', patch.read_text(encoding='utf-8'), re.MULTILINE) if patch.exists() else []:
            if relative(destination) not in mapping:
                raise ValueError('Compatibility patch modifies an unselected file')
        if patch.exists() and patch.stat().st_size:
            run('git', 'apply', '--check', '--whitespace=nowarn', str(patch), cwd=stage)
            run('git', 'apply', '--whitespace=nowarn', str(patch), cwd=stage)
        owned = list(mapping) + ['src/illegalcordplugins/_support/constants.ts']
        prepared = {f:(stage/f).read_bytes() for f in owned}
        prepared = {f:data if Path(f).suffix in ('.png', '.webp') else data.replace(b'\r\n', b'\n') for f,data in prepared.items()}
        output_hashes = {f:digest(data) for f,data in prepared.items()}
        for f in owned:
            out = ROOT/f
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(prepared[f])
    lock = {'source':manifest['source'], 'revision':revision, 'plugin_count':45,
            'source_files':hashes, 'native_sources':native, 'ported_files':output_hashes}
    lock_path.write_text(json.dumps(lock, indent=2, sort_keys=True)+'\n', encoding='utf-8')
    print('Synced 45 Illegalcord plugins at '+revision+'; all imported plugins remain off by default.')


if __name__ == '__main__':
    main()
