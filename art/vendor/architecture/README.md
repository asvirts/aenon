# Architecture source intake — issue #58

Retrieved 2026-10-11. `source.json` in each vendor directory records the original
archive URL, byte size, SHA-256, and hashes for every retained FBX. Only source
meshes used by `scripts/art/build_architecture.py` are retained; the large unrelated
Quaternius archive is not shipped or committed.

- Anker's Assets: https://ankersassets.itch.io/low-poly-desert-buildings
  Official page declares CC0; preserved declaration in `anker/LICENSE-SOURCE.md`.
- Quaternius: https://quaternius.com/packs/medievalvillagemegakit.html and its
  linked https://quaternius.itch.io/medieval-village-megakit download.
  The downloaded **Standard** archive includes `License_Standard.txt`, explicitly
  “CC0 1.0 Universal (CC0 1.0) / Public Domain Dedication.” It is retained byte for
  byte. This archive-specific licence is the intake basis. The newer general
  website QAL v1.0 notice dated 2026-08-28, documented in ADR 0023, is not used to
  infer a licence for other Quaternius packs or future downloads.
- Katsukagi, https://3dtextures.me: retained under
  `art/vendor/3dtextures/architecture`, with source-page URLs, public download IDs,
  dates and checksums per set. The site-wide CC0 and redistribution declaration is
  https://3dtextures.me/about/ . Sources used: Plaster 002, Stylized Wood Planks 002,
  and Stylized Stone Wall 002. Normal maps are consumed using the glTF OpenGL convention.

The Season's assembly, courtyard dressing, profiled portico columns, continuous
bridge deck and modular arch spandrels, open planked boat and timber dock are
original work. Retained CC0 material/model contributions are separately credited;
no new licence is granted for original contribution by recording these sources.

Rebuild from the repo root with Blender 5.2.2:

```sh
blender -b --python scripts/art/build_architecture.py
KTX_BIN=/path/to/ktx/bin node scripts/art/optimize.mjs art/source/architecture/house-limestone.glb public/game-assets/architecture/house-limestone.glb
```

Run the optimizer for each generated GLB, then run
`node scripts/art/share-architecture-textures.mjs` to extract identical texture
payloads into one content-addressed `textures/` directory. The sharing pass
compacts physical binary ranges while retaining logical meshopt fallback offsets.
Its decoder regression checks every repacked meshopt stream. A runtime manifest
records each GLB and texture hash, image reference, and byte total.

The pipeline prunes/deduplicates, uses
meshopt geometry, ETC1S colour and UASTC normal/roughness, and retains complete
mip chains. Original texture files remain untouched. Derivative textures are
resized to 512px or retain their smaller native size and tinted for the game's
warm limestone, mud plaster and wood palette. UVs tile every two metres rather
than stretching a single map across a facade.

Six house assets share the existing local x `[-3.3, 3.3]`, z `[-2.8, 3.4]` footprint.
Blender source authoring uses +Y as forward; export bakes a half-turn so -Y
becomes game +Z in the host's right-handed Y-up scene. Actual Babylon import tests
check the resulting bounds and front courtyard, rather than trusting metadata.
The source bounds JSON describes authoring coordinates (x, forward, up).

All root house transforms, selection metadata, scenery culling, and simulation
colliders remain unchanged. Complete buildings are registered as one occlusion
group. The continuous bridge deck is 4.8m wide and its Jordan top is y=.595, 2.5cm
above the existing y=.57 collision terrain. Subsequent road bridges add 5mm
per ordinal (tops .600–.610) so the overlapping Kishon crossings do not share
coplanar decks. This removes their previous striping without changing traversal.
Its rail-side arch supports are render geometry only. Dock deck top remains
local y=.155, and fishing boat keel/gunwale bracket the unchanged local waterline.

Final optimized payload: **4,111,045 bytes** including 11 GLBs and 22 unique shared
KTX2 files (previous embedded form: 9,979,264 bytes before the workshop height
correction). Largest GLB: **193,340 bytes**. Every GLB is below the 1 MB model
budget. Browser first-playable transfer must still be measured for the integrated
scene; these are exact file bytes for this slice, not network performance claims.
