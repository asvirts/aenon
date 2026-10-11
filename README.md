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
```

## Run the 3D game

The root route starts the regional gameplay host: eighteen settlements, eight wilderness areas, connecting roads, and five lake landings. The App Key lives in local `.env` (see `.env.example`), never in git or the client bundle. Live in-game Scripture requires an App Key with access to NIV, Bible ID 111; other gameplay runs without the passage server.

```sh
npm run server  # passage API on http://localhost:5174 (needs YVP_APP_KEY and NIV access)
npm run dev     # play at the root of the displayed local URL (normally http://localhost:5173/)
npm run build   # production bundle in dist/
```

If Scripture says unavailable, check `http://localhost:5174/api/version`: its `version.bibleId` must be `111`. Keep `YVP_BIBLE_ID=111` in `.env` and restart the passage server after configuration changes. A running server keeps the key and version it loaded at startup. The provider may abbreviate Bible 111 as `NIV11`; the game verifies the Bible ID rather than that label.

An upstream 401 means authentication was rejected. A 403 means the requested Bible is not accessible to that key; inspect the owning app and its publisher agreements in the [YouVersion Platform portal](https://platform.youversion.com/platform/licenses). A Bible appearing in the full catalog does not establish access. After resolving access, verify a real NIV passage in the game before treating Scripture as working. Do not use another translation under an NIV label.

Click the ground to run, or click a person, Spot, hostile, station, cache, carcass or dropped Gear to approach and act. Spots repeat timed harvests until depleted; selecting a hostile begins automatic basic attacks. Move out of the red attack warning to evade a hostile's independent strike.

| Control | Action |
| --- | --- |
| WASD / arrow keys | Run; movement cancels the previous order |
| Q / E / Space | Offensive technique / guard / reposition |
| I or G / J / K | Gear / journals / skills |
| M | Region map, routes and local work |
| O | Settings, graphics quality and save controls |
| Mouse wheel | Zoom around the Adventurer |
| Escape | Close a panel or cancel the current order |

Panels and hidden tabs pause all timed gameplay. Closing a panel leaves the Adventurer idle. Food and changing worn Gear remain blocked while any hostile is engaged or pursuing; defeat returns to the last settlement with full Hitpoints, possessions retained and a small coin loss.

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
