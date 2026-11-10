"""Package the unpacked Chrome extension using only the Python standard library."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
files = sorted((root / 'extension').glob('*'))
for required in ('manifest.json', 'icon.png', 'index.html', 'background.js'):
    if not (root / 'extension' / required).is_file():
        raise SystemExit(f'Missing extension file: {required}')
destination = root / 'study-together-extension.zip'
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for path in files:
        if path.is_file():
            archive.write(path, path.name)
print(f'Created {destination.name} ({len(files)} files).')
