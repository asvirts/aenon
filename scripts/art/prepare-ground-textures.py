"""Compress retained CC0 source maps. Requires official KTX-Software 4.4+ in KTX_BIN."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
source = root / 'art/vendor/3dtextures/ground'
output = root / 'public/game-assets/terrain'
output.mkdir(parents=True, exist_ok=True)
ktx = str(Path(os.environ['KTX_BIN']) / 'ktx') if 'KTX_BIN' in os.environ else 'ktx'
records = []
for directory in sorted(p for p in source.iterdir() if p.is_dir()):
    manifest = json.loads((directory / 'source.json').read_text())
    for item in manifest['files']:
        normal = 'normal' in item['name'].lower()
        kind = 'normal' if normal else 'color'
        target = output / f'{directory.name}-{kind}.ktx2'
        original = directory / item['name']
        assert hashlib.sha256(original.read_bytes()).hexdigest() == item['sha256']
        args = [ktx, 'create', '--format', 'R8G8B8A8_UNORM' if normal else 'R8G8B8A8_SRGB',
                '--width', '512', '--height', '512', '--generate-mipmap', '--threads', '2']
        if normal:
            # Keep RGB XYZ normals; normal-mode would repack Y into alpha.
            args += ['--assign-tf', 'linear', '--normalize', '--encode', 'uastc', '--uastc-quality', '2', '--zstd', '18']
        else:
            args += ['--encode', 'basis-lz', '--qlevel', '220']
        subprocess.run(args + [str(original), str(target)], check=True)
        data = target.read_bytes()
        records.append({'file':str(target.relative_to(root)), 'source':str(original.relative_to(root)),
                        'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest(),
                        'encoding':'UASTC + Zstd, linear RGB normals' if normal else 'ETC1S, sRGB colour',
                        'dimensions':[512,512], 'mipLevels':10})
        print(target.name, len(data), flush=True)
(source / 'conversion.json').write_text(json.dumps({'tool':subprocess.check_output([ktx,'--version'],text=True).strip(), 'outputs':records},indent=2)+'\n')
