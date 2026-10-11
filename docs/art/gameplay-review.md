# First 3D gameplay area: implementation and review

Historical first-area evidence. The later full-region expansion, current test counts and final rendering observations are in the [regional review](region-review.md).

Status on October 11, 2026: the user authorized the complete agreed Aenon-to-Jordan gameplay area and making it the root route, superseding the earlier sample-only production boundary. The Babylon host is wired into `index.html`; `/art-sample.html` remains separately available. The Phaser host remains in source. Implementation and automated gameplay checks are recorded below; final browser observations and performance measurements must be recorded separately.

## Implementation

- `src/season/realtime.ts` owns world position, click-to-act approach, WASD movement, timed simulation, independent enemy pursuit/attack windups, automatic basic attacks, three technique roles, timed legendary effects, defeat recovery, renewable Spots, selected-carcass Hunting and ordinary respawns. It imports no Babylon code. Renderer-supplied pathfinding and collision predicates keep simulation and world presentation separate.
- Existing `src/season/lib/` helpers retain skill curves/caps, Gear, inventory, quest rewards, crafting, trading and first-reading history. Permanent defeated-hostile/quest history is distinct from live hostile availability. Level-one Hitpoints retain their original scale; enemy damage and food restoration can be fractional.
- `src/game3d/content.ts` defines the first area: three wilderness hostiles, five gathering disciplines, four crafting stations, people, quests, Scripture and a one-time cache. John attendance requires approaching the actual person. The cache makes the area's legendary Gear available as a collectible world drop.
- `src/game3d/main.ts`, `world.ts` and `ui.ts` present the original assets, fixed player-follow camera, interactions, telegraphs, action bar, panels and quality settings. `src/game3d/types.ts` defines the renderer/rules contract. Original gameplay asset provenance is recorded in [gameplay assets](gameplay-assets.md).
- `src/game3d/persistence.ts` validates versioned saves and provides export/import/restart recovery. The engine preserves combat cadence, hostile windups, burn ticks, technique cooldowns, guard duration, stock and respawn delays in active gameplay time. Reload cancels uncommitted orders. Active scenes reopen their finishable panel; ground loot keeps its location and survives a full pack.
- Compatible earlier saves retain earned progression, Gear, goods and history and enter safely in their saved place. An earlier zero-Hitpoint defeat recovers at the last settlement without charging another loss. Original earlier saves remain separately stored; incompatible data is blocked rather than silently overwritten.

## Automated evidence

`node --test tests/realtime/*.test.ts` passes 23 tests at the engine handoff, including:

- A complete first-area journey through the actual content and navigation: start the potter's quest, gather three wood yields, turn in and equip the reward, defeat the wolf, harvest its selected carcass, return the bone, approach John, finish the scene, return flax and file Scripture once.
- Actual-content crafting at all four stations, trade, Gear changes and fractional food recovery while panels are paused.
- Independent attacks without player swings, dodgeable fixed-position telegraphs, simultaneous threats, pursuit/escape, safe settlements, interrupted harvests, canceled technique windups, guard reduction and full-Hitpoint defeat recovery with possessions retained.
- Renewable stock without automatic farming after depletion, ordinary respawn without erasing quest history, permanent story outcomes, skill/pack gates, legacy migration, paused clocks and exact saved-timer continuity.
- Scene reload reopening, spatial collectible Gear, full-pack loot retention and one-time cache rewards.

The pre-existing Season tests remain applicable to shared primitives; navigation and camera tests cover collision-safe routes and fixed-heading player-centered follow through zoom. A scoped test pass does not establish browser interaction or art acceptance. Repository-wide tests, typecheck and build results should be recorded after the final integrated working tree is checked.

## Live Scripture verification

The initial integration check reported an upstream HTTP 403 for NIV access while the existing local passage service was configured for BSB. On October 11, the user retained NIV and personally added the Biblica license. The Portal showed it active; the existing key then returned HTTP 200 for Bible 111 metadata and John 1:29. The local configuration now explicitly selects `YVP_BIBLE_ID=111`, and the passage server was restarted. No credential was changed and the agent accepted no agreement.

The server returns numeric `version.bibleId` on both endpoints; the UI requires ID 111 and nonempty live text and attribution before filing a reading or granting its reward. Provider abbreviations `NIV` and `NIV11` do not change version identity. Missing identity, a different Bible, or missing attribution is rejected; HTTP 401 and 403 have distinct diagnostics. Twelve added regression tests bring the suite to 440 passing tests; typecheck and build pass.

The Codex in-app browser at `http://127.0.0.1:5180/` visibly rendered John 1:29 with the NIV name, required Biblica attribution, and the correct Bible.com link. On the separate `localhost:5180` QA save, the first successful reading changed Scripture experience from 0 to 25 and Adventurer experience from 300 to 310, and filed exactly one reference with Bible ID 111. Reopening the passage left both totals and the single filing unchanged; all persisted after reload. No browser warnings or errors were observed. Provider access remains time-sensitive; no credentials belong in this document or the client bundle.

## Browser and performance acceptance

The integrating agent owns the Codex in-app browser review. Record the URL, exact working-tree/build, device/GPU where available, browser, viewport, render resolution, preset and zoom beside measured results. Include movement, click targets, combat cues, gathering, panels, scene reload and save recovery.

Integrated browser checks on October 11 used the current uncommitted working tree at `http://localhost:5180/` in a separate origin from the user's `http://127.0.0.1:5180/` save. Verified in the rendered game:

- A complete three-quest journey: potter, repeated wood harvesting, sword reward/equip, real-time wolf combat, paused combat Gear restrictions, timed carcass Hunting, bone return, John attendance, flax gathering and final turn-in.
- John encounter close/Escape preserves a reachable Finish action; reloading mid-encounter reopens that action; finishing records `john-witness` and restores normal play.
- Defeat recovers at the settlement with full Hitpoints, retained worn sword/materials, and exactly two fewer coins. Ordinary wolf respawn and finite stock replenishment were visible after later return.
- Compatible prior progress loaded in the user's root game, including 800 Adventurer experience, 1,875 Woodcutting experience, 75 wood and the filed passage. The earlier storage key remains separate. Test play used the other origin.
- WASD changed camera position/target together while alpha stayed π/4, beta .83 and radius 36. Zoom 10 and 24 retained the same target and heading; both extremes rendered cleanly.
- The initial Scripture check correctly withheld reading credit during the configured-version problem. Successful live NIV rendering and one-time reading rewards were subsequently verified as recorded above.
- No browser console errors during the final gameplay checks. The production build was also loaded through the existing Node server at `http://localhost:5174/`; the root game reached ready state with all original assets and no console errors. Build and TypeScript checks pass; the full suite passes 428 tests. The build still warns about a large Babylon/glTF chunk (~5.9 MB before gzip).

Short preset measurements: Apple M5 Pro, 48 GiB RAM; Codex in-app browser reporting Chromium 155; viewport 1280 × 720, DPR 1, camera distance 14, active unpaused world beside John. Each capture used a 0.6-second warm-up and about 2 seconds of requestAnimationFrame intervals. These are short checks on this device, not sustained or representative-laptop benchmarks.

| Preset | Render resolution | Mean FPS | Median frame | 95th percentile frame |
| --- | --- | ---: | ---: | ---: |
| Low | 914 × 514 | 165.0 | 6.1 ms | 6.1 ms |
| Medium | 1280 × 720 | 164.9 | 6.1 ms | 6.8 ms |
| High | 1280 × 720 | 164.9 | 6.1 ms | 6.8 ms |
| Ultra | 1280 × 720 | 165.0 | 6.1 ms | 6.8 ms |

The short runs appear refresh-rate limited; they do not establish GPU headroom. Presets change resolution limits, shadows and decoration without removing interaction targets. Ordinary-laptop and extended-session tests remain outstanding. Earlier sample observations on an Apple M5 Pro are recorded in [the sample review](sample-review.md); they are not measurements of this larger gameplay scene. The targets remain at least 30 FPS on ordinary laptops at Low and 60 FPS where feasible. Do not infer those targets from build success or a high-end development machine.

The current implementation is the first playable area, not the entire regional design. Final user visual feedback, balance tuning, and sustained performance across representative devices remain acceptance work. Live NIV reading, the four-preset smoke comparison above, and the first-area browser journey are complete.
