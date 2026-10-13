"""Pruebas aisladas: nunca consultan ni escriben la base real."""
import contextlib
import csv
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('updater', Path(__file__).resolve().parents[1] / 'scripts/update_history.py')
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


def fixture(n=100, corrupt=False, incomplete=False):
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(['sorteo','fecha','modalidad',*[f'numero{i}' for i in range(1,7)]])
    for contest in range(1,n+1):
        for mode in updater.MODES:
            if incomplete and contest == n and mode == updater.MODES[-1]:
                continue
            nums = [0,1,2,3,4,6] if corrupt and contest == 1 else [0,1,2,3,4,5]
            writer.writerow([contest,'2026-01-01',mode,*nums])
    return out.getvalue().encode()


class HistorySafety(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.target = Path(self.temp.name) / 'data.json'
        self.target_patch = patch.object(updater,'TARGET',self.target)
        self.target_patch.start()
        self.run_import(fixture())
        self.before = self.target.read_bytes()
    def tearDown(self):
        self.target_patch.stop()
        self.temp.cleanup()
    def run_import(self, raw):
        with patch.object(updater.urllib.request,'urlopen',return_value=io.BytesIO(raw)),contextlib.redirect_stdout(io.StringIO()):
            updater.main()
    def test_no_change_preserves_bytes_and_timestamp(self):
        self.run_import(fixture())
        self.assertEqual(self.before,self.target.read_bytes())
    def test_incomplete_source_preserves_old_history(self):
        with self.assertRaisesRegex(ValueError,'incompleta'):
            self.run_import(fixture(101,incomplete=True))
        self.assertEqual(self.before,self.target.read_bytes())
    def test_existing_result_change_requires_review(self):
        with self.assertRaisesRegex(ValueError,'requiere revisión'):
            self.run_import(fixture(101,corrupt=True))
        self.assertEqual(self.before,self.target.read_bytes())
    def test_new_complete_contest_is_imported(self):
        self.run_import(fixture(101))
        value = json.loads(self.target.read_text())
        self.assertEqual(value['draw_count'],101)
        self.assertEqual(value['record_count'],404)
        self.assertEqual(value['incomplete_draws'],0)
        self.assertFalse(self.target.with_suffix('.json.tmp').exists())

if __name__ == '__main__':
    unittest.main()
