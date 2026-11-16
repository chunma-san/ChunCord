# Vencord, a Discord client mod
# Copyright (c) 2026 Vendicated and contributors
# SPDX-License-Identifier: GPL-3.0-or-later
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('candidate', Path(__file__).with_name('build-candidate.py'))
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)


class ClassificationTests(unittest.TestCase):
    plugins = {'src/testcordplugins/Example': 'Example'}

    def test_optional_errors(self):
        result = candidate.offenders('src/testcordplugins/Example/index.ts(2,3): error TS2322: incompatible\n', self.plugins)
        self.assertEqual(result, {'src/testcordplugins/Example': {'TS2322'}})

    def test_core_error_is_not_suppressed(self):
        with self.assertRaises(RuntimeError):
            candidate.offenders('src/main/patcher.ts(2,3): error TS2322: incompatible\n', self.plugins)

    def test_mixed_and_global_errors_are_not_suppressed(self):
        with self.assertRaises(RuntimeError):
            candidate.offenders('src/testcordplugins/Example/index.ts(2,3): error TS2322: incompatible\nerror TS2307: missing global dependency\n', self.plugins)
        with self.assertRaises(RuntimeError):
            candidate.offenders('Process crashed without diagnostics', self.plugins)

    def exercise_build(self, build_status):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            custom = root / 'scripts/custom'
            custom.mkdir(parents=True)
            folder = root / 'src/testcordplugins/Example'
            folder.mkdir(parents=True)
            (folder / 'index.ts').write_text('export default {};')
            for collection in ('testcord', 'illegalcord'):
                plugins = [{'folder': 'src/testcordplugins/Example', 'name': 'Example'}] if collection == 'testcord' else []
                (custom / f'{collection}-allowlist.json').write_text(json.dumps({'plugins': plugins}))
            calls = []

            def run(*args):
                calls.append(args)
                if len(calls) == 1:
                    return SimpleNamespace(returncode=1, stdout='src/testcordplugins/Example/index.ts(2,3): error TS2322: incompatible\n')
                self.assertFalse(folder.exists(), 'Broken source must be absent during candidate checks')
                return SimpleNamespace(returncode=build_status if 'buildStandalone' in args else 0, stdout='')

            with patch.object(candidate, 'ROOT', root), patch.object(candidate, 'run', run), patch.object(candidate, 'verify_isolation'):
                if build_status:
                    with self.assertRaises(RuntimeError):
                        candidate.main()
                    self.assertFalse((root / 'dist/optional-plugin-status.json').exists())
                else:
                    candidate.main()
                    report = json.loads((root / 'dist/optional-plugin-status.json').read_text())
                    self.assertEqual(report['quarantined'][0]['name'], 'Example')
            self.assertEqual((folder / 'index.ts').read_text(), 'export default {};')
            self.assertEqual(len(calls), 3)

    def test_source_restored_after_success(self):
        self.exercise_build(0)

    def test_source_restored_and_no_success_report_after_build_failure(self):
        self.exercise_build(1)


if __name__ == '__main__':
    unittest.main()
