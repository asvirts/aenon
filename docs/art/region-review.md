# Regional game review

The October 11, 2026 expansion implements the user's request to finish the regional game after approving the original 3D first area. It runs at `/`; the art study remains separate. This document records local working-tree evidence, not a deployment or final visual acceptance from the user.

## Content and rules

The region has 18 settlements, 8 wilderness places, 30 road links, five lake landings and 20 directed crossings. Each settlement has ordinary local work, repeatable provisions, a Vendor, four making stations and contextual Scripture. The journal recognizes completion of 59 once-only quests while leaving the Season open. Eleven fixed Gospel encounters use original narration; the NIV wording is fetched separately.

The catalog has 261 Gear pieces including the original first-area items. All slots, weapon holds and kinds, armor weights, bands and rarities have usable recipes. All 51 generated legendary pieces have original display names without changing their persistent IDs. Matching band finds can drop repeatedly from ordinary opponents, and whole legendary maces can also drop. Vendors offer common through rare Gear and buy gathered goods. Food descriptions state restoration and either legendary meal effect.

Automated coverage verifies every spawn and road link, same-place approaches to every interaction, all boat landings, the crafting catalog and actual input consumption. A content journey completes all 59 quests from level 1 to 60 using earned supplies and recorded scene outcomes, without injected XP or Scripture rewards. That journey uses deterministic shared-rules combat and does not prove browser combat balance by itself. Separate real-time tests cover combat, movement, boats, interruptions, save continuity, and scene presence.

Real-time combat simulations with common medium armor and a shield, guaranteed enemy hits and no active techniques lose approximately 18.1% of maximum Hitpoints at middle-band entry and 25.4% at high-band entry. Starter wolf damage remains 14.1% in its corresponding fixture. Guard, stronger armor and leaving a locked telegraph reduce or avoid damage. These are repeatable balance checks, not player difficulty ratings.

Existing saves retain progress. When authored hostile tuning changes, live saved health retains its fraction of the new maximum; dead enemies remain dead and respawn with the new maximum. Saved boat progress, cooldowns, effects and pending fixed encounters survive reload. Invalid saves remain recoverable rather than silently replaced.

## Rendered checks

Browser verification uses the Codex in-app browser and a separate `http://localhost:5180/` QA origin, preserving the user's `http://127.0.0.1:5180/` progress.

- Ran the road from Aenon to Salim using the map, with the camera following the Adventurer.
- Accepted Tamar's first local work, followed the journal to a renewable fiber Spot, harvested and returned supplies. Completion awarded 30 coins and a common sword, and advanced this QA Adventurer from level 1 to 6.
- Gathered herbs, crafted a common linen coat at Salim's loom and wore it. Bought and wore a shield from the local Vendor, whose stock visibly includes common, uncommon and rare Gear.
- Caught silver barbel, cooked it with previously earned meat and herbs, then ate it. Hitpoints increased from 0.928 to 2.728 at level 6, matching the common meal's 30% restoration.
- Live John 1:29 rendered with NIV identity and Biblica attribution. A separate provider check successfully fetched all 31 regional reference mappings as Bible 111, without storing their wording.

A separate production-bundle check at `http://localhost:5174/` imported a validated Cana scene fixture through Settings. Its level 25, prerequisite history and supplies were synthetic setup; it is a presentation and persistence test, not an earned playthrough. The original Cana narration, Jesus, company and episode figures rendered together. Finishing recorded the encounter, removed its participants, and linked to live John 2:1–11, which loaded with NIV identity and Biblica attribution. The completion remained recorded after reload.

This browser check exposed an import/restart issue: the old running game could overwrite the deliberately replaced save during pagehide. Successful replacement now blocks writes from that old instance before reloading; the import was repeated successfully in the built game.

Road travel also exposed two integration issues, now covered by regressions: rejoining a road no longer backtracks into a settlement and re-arms the roadside acquaintance, and already-reached waypoints no longer discard the rest of a route. Static interaction targets retain their route rather than repeatedly recomputing the full region approach.

The built game walked from Cana to Tiberias using Map → Find lake landing, continuing after the roadside acquaintance without returning to the settlement. At Tiberias, boarding for Hippus opened an 11-second active-time crossing. Settings froze the journey at 3.5013% with the same position on the next observation. Reload retained that journey and resumed from its saved progress (6.3513% by the next pause, rather than returning to departure). The original boat rendered on the lake. Arrival placed the Adventurer at the authored Hippus landing (106, −269), cleared the journey and set Hippus as the last settlement; all remained after another reload.

The separate production QA save was then deliberately backed up and restarted through Settings to verify the same save-handoff guard. This did not touch the user's 127.0.0.1 development save.

## Performance limits

Short samples after the shadow fix on an Apple M5 Pro with 48 GB memory, Codex in-app browser, 1604 × 1314 viewport, camera distance 14, idle just north of Salim with the world running. Each sample discards 0.6 seconds of warm-up and measures about 3 seconds. Medium through Ultra had 606 nearby shadow casters; Low intentionally disables cast shadows.

| Preset | Render resolution | Frames | Mean FPS | Median frame | 95th percentile |
| --- | --- | ---: | ---: | ---: | ---: |
| Low | 1145 × 938 | 436 | 144.7 | 6.1 ms | 12.2 ms |
| Medium | 1604 × 1314 | 326 | 108.2 | 6.2 ms | 18.2 ms |
| High | 1604 × 1314 | 339 | 112.7 | 6.1 ms | 18.2 ms |
| Ultra | 1604 × 1314 | 342 | 113.7 | 6.1 ms | 18.1 ms |

These are brief development-machine observations, not sustained benchmarks or evidence that Ultra is faster than High. The small differences reflect sampling variation. Ordinary Windows laptops and integrated graphics remain untested. Earlier measurements made while cast shadows were missing are superseded by this table.

The build's Babylon/glTF chunk remains about 5.9 MB before gzip (about 1.26 MB compressed). It loads locally, but production network loading and integrated-graphics hardware have not been benchmarked. Shared original model geometry and materials support the regional variants; this does not mean every catalog entry has a distinct modeled outfit. See [asset provenance](gameplay-assets.md).

## Final automated checks

After the navigation, waypoint and save-handoff repairs, `npm test` passed all 497 tests in 36 suites with no failures or skips. `npm run typecheck`, `npm run build` and `git diff --check` passed. The built browser target loaded `game-CBQaWwjO.js`. Known warnings are Node’s experimental localStorage notice and Vite’s large chunk warning. No browser console warning or error was observed during the production encounter check.

## Low-band scale pass

Issue #42 expands the four low-band settlements and the Jordan wilderness while preserving the northern region. See [the low-band scale review](low-band-scale-review.md) for before/after coordinates and travel times, save migration, screenshots, and playable acceptance evidence.
