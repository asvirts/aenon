# Aenon

A single-player game set in the Galilee and Jordan during one season of Jesus' ministry, about 27–29 AD. The Adventurer starts in Aenon.

## Host

TypeScript in the browser, with Babylon.js drawing the original 3D Galilee and Jordan region at `/`. Click to move or act; WASD runs through the scene. The camera stays centered on the Adventurer with a constant heading and tilt.

The interface uses DOM panels around the canvas. A small Node server holds the YouVersion App Key and fetches live passage text and version attribution. The client requires NIV; it does not substitute another translation or grant reading rewards when the passage is unavailable. Progress lives in that browser's localStorage.

The Season's rules are specified in [Season rules on the logic surface](https://github.com/asvirts/aenon/issues/15). The map of decisions is [Aenon region spec](https://github.com/asvirts/aenon/issues/1). Domain language is in `GLOSSARY.md`.

## Rules module

- `src/season/realtime.ts` — authoritative movement, independent combat, techniques, timed gathering/Hunting, respawns and active-play clocks. `createGame(options)` exposes commands, snapshots, events and versioned saves without importing Babylon.
- `src/season/lib/` — shared progression, inventory, Gear, trading, crafting, quests and Scripture rules. The original `loadSeason` API remains available for the earlier host and its tests.
- `src/game3d/` — Babylon presentation, authored content/layout, panels and validated persistence. `src/host/` retains the earlier Phaser implementation as source; it is no longer the main route.
- `tests/realtime/` — timing, interruption, save continuity, and complete journeys through the actual content and navigation. `tests/season/` retains the shared-rules coverage.

### Verify

```sh
npm test          # behavior tests
npm run typecheck # tsc --noEmit
npm run build     # production bundle in dist/
npm run size      # first-load download against the 40 MB budget; reads dist/
```

GitHub Actions runs these four, in this order, on every pull request and every push to `main` (`.github/workflows/ci.yml`). It uses Node 24 from `package.json`, needs no secrets and never calls YouVersion. Vercel still builds and deploys from Git; CI does not deploy.

`npm run size` fails above 40,000,000 bytes, the first-load budget in [Improve the graphics](https://github.com/asvirts/aenon/issues/41) (decision 9). It prints the figure on every run, beside the budget and the first harness measurement (7,056,561 bytes at `dc507f4`). The figure is a static upper bound taken from `dist/` without a browser:

- Every file in `dist/` counts except source maps and the separate art-sample page: `art-sample.html`, the script and stylesheet only it loads, and the `art-sample/` models no root-route script names by URL.
- HTML, JavaScript, CSS, JSON and SVG count at their size under gzip's fastest level, which compresses least. Those under 4 KB count at the larger of their full and gzip sizes, because servers may send small files uncompressed. Everything else counts at full size.
- Each file adds 300 bytes for response headers, the allowance the [review protocol](docs/art/review-protocol.md) uses.

The review harness measures the real cold load in a browser, and its figure is the one each graphics PR reports. On the same shipped code (`4cee146`), the harness measured 13,718,658 bytes and `npm run size` reports 14,621,465. Every file the browser received was counted at no less than its measured size. The difference is mostly 60 files the first load never requested, such as Babylon chunks loaded on demand and GPU transcoders that machine didn't need.

## Run the 3D game

The root route starts the regional gameplay host: eighteen settlements, eight wilderness areas, connecting roads, and five lake landings. The App Key lives in local `.env` (see `.env.example`), never in git or the client bundle. Live in-game Scripture requires an App Key with access to NIV, Bible ID 111; other gameplay runs without the passage server.

```sh
npm run server  # passage API on http://localhost:5174 (needs YVP_APP_KEY and NIV access)
npm run dev     # play at the root of the displayed local URL (normally http://localhost:5173/)
npm run build   # production bundle in dist/
```

If Scripture says unavailable, check `http://localhost:5174/api/version`: its `version.bibleId` must be `111`. Keep `YVP_BIBLE_ID=111` in `.env` and restart the passage server after configuration changes. A running server keeps the key and version it loaded at startup. The provider may abbreviate Bible 111 as `NIV11`; the game verifies the Bible ID rather than that label.

An upstream 401 means authentication was rejected. A 403 means the requested Bible is not accessible to that key; inspect the owning app and its publisher agreements in the [YouVersion Platform portal](https://platform.youversion.com/platform/licenses). A Bible appearing in the full catalog does not establish access. After resolving access, verify a real NIV passage in the game before treating Scripture as working. Do not use another translation under an NIV label.

### Vercel

Deploy the repository with its Vite frontend and the root `api/passage.ts` and `api/version.ts` Node Functions. `vercel.json` selects `npm ci`, the current npm lockfile, the Vite build and `dist` output. Node 24 is selected by `package.json`. The standalone `npm run server` process and Vite's development proxy do not run in a static Vercel deployment.

Set `YVP_APP_KEY` to this game's licensed YouVersion Platform App Key and `YVP_BIBLE_ID` to `111` in the Vercel project's Production environment; also set Preview if previews need live Scripture. Keep both server-side, without a `VITE_` prefix. `PORT` is only for local use. Deploy the code containing the API Functions after setting the variables; redeploying an older frontend-only commit will still return 404.

Verify `/api/version` returns JSON with `version.bibleId: 111`, then `/api/passage?usfm=JHN.3.22-30` returns nonempty `html` and version attribution. Finally open that passage in the game. The API returns `Cache-Control: no-store` and JSON diagnostics for missing configuration or provider failures. A plain-text/HTML 404 means the Functions were not deployed; it does not establish a licensing problem.

References: [Vercel Node Functions](https://vercel.com/docs/functions/runtimes/node-js), [YouVersion API usage](https://developers.youversion.com/api-usage).

Click the ground to run, or click a person, Spot, hostile, station, cache, carcass or dropped Gear to approach and act. Spots repeat timed harvests until depleted; selecting a hostile begins automatic basic attacks. Move out of the red attack warning to evade a hostile's independent strike.

| Control | Action |
| --- | --- |
| WASD / arrow keys | Run; movement cancels the previous order |
| Q / E / Space | Offensive technique / guard / reposition |
| C / B | Gear / Inventory |
| J / K | Journals / skills |
| M | Region map, routes and local work |
| O | Settings, graphics quality and save controls |
| Mouse wheel | Zoom around the Adventurer |
| Escape | Close a panel or cancel the current order |
| Controller Start | Open the menu of pages; on any panel, return to the world |
| Controller LB / RB | On a page, move to the previous or next page |
| Controller B | On a page reached from the menu, go back to the menu; otherwise close the panel or cancel the current order |

The menu's pages (Map, Gear, Inventory, Journal, Skills, Trade, Scripture and Settings) fill the screen. Panels and hidden tabs pause all timed gameplay. Closing a panel leaves the Adventurer idle. Food and changing worn Gear remain blocked while any hostile is engaged or pursuing; defeat returns to the last settlement with full Hitpoints, possessions retained and a small coin loss.

The potter starts the first quest. Gather wood, earn and equip a weapon, venture north beyond Aenon's safe boundary, then return with Hunting materials. Later steps lead to John. Settings include save export/import and a deliberate new-Season control. Compatible earlier saves migrate to a safe entry in their saved place, with the original save retained. Invalid or incompatible saves are blocked rather than silently overwritten.

Each settlement offers a local course of work, repeatable provisions, a Vendor and four crafting stations. The map can plan a walking route, find the local giver or lead to a lake landing; the journal can guide you to a current step. The 59 once-only quests support progression through level 60. Repeatable provision work awards coins, while ordinary wilderness encounters and gathering replenish during active play. Legendary crafting uses rare renewable finds from opponents in the matching band. Lake boats travel between Tiberias, Magdala, Capernaum, Bethsaida and Hippus; pause and save retain an underway crossing.

Gospel encounters use original narration, with their matching NIV passages available to read. Completing the local works recognizes your journey in the journal; exploration, crafts and readings remain available afterward. The regional completion checklist is recorded in [Completing the Season](docs/design/full-game.md).

The [regional review](docs/art/region-review.md) records the expanded game, browser journeys, live NIV verification and measured graphics presets. The [first-area review](docs/art/gameplay-review.md) retains earlier evidence. Low/Medium/High/Ultra are available; 30 FPS on ordinary laptops at Low and 60 FPS where feasible remain validation targets.

## Play the original 3D art sample

Run `npm run dev` and open `/art-sample.html` on the displayed local URL. The
Babylon.js sample has an animated Adventurer, a limestone dwelling, olive trees,
and the Jordan riverbank. Click the ground or use WASD to run, scroll to zoom,
and open World settings to change graphics quality. Settings pause the scene.
It needs no passage server or API key and uses a separate quality preference;
it does not load or change a Season save.

The editable Blender models and original animation source are described in
[asset sources](docs/art/asset-source.md). The [sample review](docs/art/sample-review.md)
records the earlier sample checks and feedback. The user subsequently authorized the complete regional gameplay implementation and its promotion to `/`; see the [3D design](docs/design/3d-redesign.md) and [original gameplay assets](docs/art/gameplay-assets.md).
