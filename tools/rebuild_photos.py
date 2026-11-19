"""Update js/photo-data.js from the files in assets/photos (Python 3, stdlib only)."""
import base64
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
images = root / 'assets' / 'photos'
data = {}
for path in sorted(images.glob('*.jpg')):
    data[str(int(path.stem))] = 'data:image/jpeg;base64,' + base64.b64encode(path.read_bytes()).decode('ascii')
if not data:
    raise SystemExit('No photos were found in assets/photos.')
out = root / 'js' / 'photo-data.js'
out.write_text('/* Generated from assets/photos; rerun tools/rebuild_photos.py when photos change. */\nwindow.PHOTO_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n', encoding='utf-8')
print(f'Embedded {len(data)} photos into {out}')
