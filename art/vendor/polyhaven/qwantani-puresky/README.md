# Qwantani (Pure Sky)

Original HDRI by Greg Zaal; sky edits by Jarod Guest. Downloaded from the official
[Poly Haven asset page](https://polyhaven.com/a/qwantani_puresky) on 2026-10-11.
The asset and [Poly Haven licence page](https://polyhaven.com/license) identify it
as CC0. `License.txt` records this declaration with the complete official CC0
legal text; the direct HDR download supplied no separate vendor licence file.
`source.json` records the exact download URL, upstream MD5, local SHA-256 and
conversion parameters.

The unmodified source is a 1024 × 512 RGBE panorama (1,142,401 bytes). Only the
prefiltered `.env` file under `public/game-assets/environment/` ships to players.
The raw HDR, licence and source record remain in this source folder. The shipped
file is 567,390 bytes, SHA-256
`0006e4b7c6ee68a6c2b6ed062e06bbe35292d8e90cc747aefbbbe8aa27296218`.
All 54 embedded PNGs were validated for mip dimensions, RGBA encoding and
decompressed image lengths; all 27 diffuse polynomial components are finite.

## Rebuild

Start the Vite development server and open
`/scripts/art/prefilter-environment.html` in the Codex in-app browser after any
performance measurements have finished. Click **Convert HDR to .env**, wait for
**Complete**, then download the file. The page shows loading, prefiltering and
per-face encoding progress with stage timeouts. It is excluded from the production
build and does not load the game.

For programmatic readback on that page:

```js
const result = await window.__environmentExport
```

Save `result.bytes` unchanged to
`public/game-assets/environment/qwantani-puresky.env`. The helper uses the installed
Babylon.js `HDRCubeTexture`, `HDRFiltering` and `CreateEnvTextureAsync` APIs on
WebGL 2. It reads
this source through Vite's `/art/vendor/` URL without copying raw art to `public/`,
awaits a 4096-sample prefilter, and writes a 256-pixel cubemap with nine complete specular mip
levels, PNG RGBD images and diffuse spherical harmonics. It does not bake exposure,
tint, rotation or scene intensity. Runtime lighting remains responsible for those
settings. GPU/toolchain changes may change the exported bytes; re-record checksums
and review the actual game after rebuilding.

The format and prefilter workflow follow
[Babylon's HDR environment documentation](https://doc.babylonjs.com/features/featuresDeepDive/materials/using/HDREnvironment/).
Run `npm run credits` and `node --test tests/game3d/credits.test.ts` after intake.
The complete `.env` file must remain below 1 MB for this initial lighting asset;
the total first playable download is measured separately in the slice evidence.
