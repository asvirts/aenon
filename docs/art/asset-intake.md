# Asset intake

`art/credits.json` is the source for `CREDITS.md` and Settings → Credits. Register
each shipped file exactly once. `npm test` scans all of `public/`, including new
directories, and also verifies every registered source file exists. Runtime art
painted in TypeScript is registered by its source path.

## Provenance before import

Use the art licences and exclusions in [ADR 0023](../adr/0023-licensed-third-party-and-ai-art-with-credits.md).
Keep raw third-party downloads under `art/vendor/<source>/`, together with the
vendor's actual licence file. Record the original source URL, author, licence URL,
retrieval date, exact required attribution, and modifications. A Quaternius archive
must contain its own CC0 licence; record the conflicting site notice in `notes`.
Do not infer a licence from a search result or a neighbouring pack.

Each `assets` entry contains `files`, `category`, `title`, `author`, `source`,
`license`, `licenseUrl`, `retrieved` (`YYYY-MM-DD`), and `changes`. Optional fields
are `authorUrl`, `notes`, and `vendorLicenseFile`; the vendor file is required when
one was supplied. `attribution` is mandatory for CC-BY. `tool-terms` also requires
`ai: { tool, plan, termsUrl, prompt }`. Keep the exact prompt and verify the terms
for the plan used. Original scripted artwork uses `original`; this label does not
grant a new licence to the repository's artwork.

Decoder software is recorded separately in `software` because art licences do not
describe code. Those entries may only cover `public/decoders/` and must retain the
vendor licence and any bundled notices. The same generator and Credits screen
display both collections.

After changing the manifest, run:

```sh
npm run credits
node --test tests/game3d/credits.test.ts
```

## Runtime compression

The optimizer reads a raw GLB under `art/vendor/` or `art/source/` and writes its
compressed runtime GLB under `public/game-assets/`. Install dependencies with
`npm ci` and install the official [KTX-Software](https://github.com/KhronosGroup/KTX-Software/releases)
tools (4.4 or newer). If they are not on PATH, set `KTX_BIN` to their `bin` directory.

```sh
npm run art:optimize -- art/vendor/example/source.glb public/game-assets/example.glb
```

The explicit stages prune unused content, deduplicate shared content, resample
animation keys, compress normal/data maps with UASTC, compress colour with ETC1S,
and meshopt-compress geometry. Runtime transforms, clip names, and gameplay
collision remain the asset author's responsibility. The output replaces the target
only after every stage succeeds.

The original house is the first sample. Its original painted colour tiles and a
small procedural limestone normal map exercise ETC1S, UASTC, and meshopt during
ordinary world loading. The art-study route keeps its original export. Rebuild the
sample with:

```sh
node scripts/art/prepare-compression-sample.mjs
npm run art:optimize
npm run credits
```

`src/game3d/assetDecoders.ts` configures every Babylon KTX2 decoder URL and meshopt
before the first GLB load. Decoder JavaScript, WASM, and licence notices live under
`public/decoders/`; the configured URLs resolve to the site's own origin, including
inside workers. When updating Babylon, check its full KTX2 URL configuration for
new GPU fallbacks, refresh the vendored versions and notices together, and update
the manifest.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build`. In the Codex in-app
browser, open Settings → Credits by mouse, Tab/Enter, and the controller's Start,
D-pad, and A controls. The panel must pause the world; Escape, the close button,
and B return to it. Links participate in the existing dialog focus loop.

Reload with an empty cache and inspect network requests for the optimized house,
meshopt, KTX2 JavaScript and WASM. Verify successful responses on the site's own
origin, no decoder CDN requests, and a visible textured house with no console
errors. Unit checks and extension metadata alone do not establish this acceptance.
