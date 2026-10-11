# Slice 9 — Architecture

Implements [#58](https://github.com/asvirts/aenon/issues/58) under [#41](https://github.com/asvirts/aenon/issues/41), with approved ground integrated. **Source checks and integrated browser QA complete, with measured performance limits below. Reporter visual approval pending.**

PR base: `2dac97aa9acd73e2d1097eb5661e491a20c53326`. Integrated implementation: `4cee146bc21124cbed17baf8a90a20115bd9a3db`. The current before set comes from approved ground source `97182d109671a68f1a6a93f6b90a1bf8d8da6dbc`, whose `src/`, `public/`, `package.json` and `package-lock.json` match the approved base exactly. [provenance.json](provenance.json) records this equivalence. All 32 integrated canonical and eight supplemental after frames are captured and independently inspected. The approved-ground supplemental town baseline is also complete. All 32 repeat fixture states also match. Fresh same-session before/after timing rows and final production records are verified. Integrated click-to-act, compound fade, restoration and settled review storage readback passed.

The earlier architecture-only review at `db6f9dc` is historical evidence: the complete package remains in Git at `8504b8c` and in `/tmp/aenon-58-isolated-db6f9dc`. [Isolated interaction records](isolated/README.md) are retained with explicit labels; they do not establish the integrated result.

## Change and preserved contracts

Six flat-roofed house assemblies replace the repeated house and primitive dressing: limestone, courtyard, mudbrick, workshop, public assembly hall, and colonnaded house. Parapets, ladders, drying racks, shade cloth, storage jars, courtyard walls and timber details distinguish them. Scythopolis and other larger towns receive dressed stone, profiled columns, public buildings and cloth-covered market porticoes. Four domestic variants remain available across the ordinary settlement footprints.

Every imported house stays within the existing asymmetric local footprint, x `[-3.3,3.3]` and z `[-2.8,3.4]`, with its front courtyard facing +Z in the host's right-handed scene. Existing house positions, scales, rotations, navigation and collision remain unchanged. Complete cloned buildings retain one occlusion group; neighboring buildings share geometry/materials while keeping independent visibility. Render meshes continue through the existing shadow registration.

Continuous bridge decks follow the existing crossing centre lines. The Jordan deck is 2.5 cm above the unchanged y=.57 walk surface; the other bridges add millimetre-scale separation where crossings overlap. Metre-scale UV repetition replaces the stretched masonry seen in the first development capture. The baseline coplanar striping belongs to the old bridge, and this slice replaces that geometry. Timber piers turn and extend from unchanged shore-side landing anchors. Boats float beside them with submerged keels and a shaped dry planked interior above water; selecting a boat still uses its original landing ID and boarding point. Traveling boats retain the journey transform.

No changes were made to simulation, content/navigation definitions, terrain heights, storage, or the save format. Supplemental DEV-only `architectureShot('salim'|'pella', preset)` fixtures preserve the canonical eight-shot list. They use Salim (−206,164) and Pella (210,−73), radius 44 m, to include the northern house rows.

## Verification

Integrated source passed **600 tests in 49 suites**, [typecheck](checks/typecheck.log) and [production build](checks/build.log). [Full test output](checks/npm-test.log) belongs to `4cee146`; only trailing whitespace was normalized. The existing Vite large-chunk advisory remains. No runtime implementation changed while assembling evidence.

Imported-geometry tests cover house footprints and orientation, whole-house fade isolation, clone visibility for existing olives, bridge placement and UV scale, full-hull water clearance, pier depth and dry boat floors. Runtime meshopt decoding, shared KTX2 hashes/mips and credits checks pass. Simulation, content/navigation definitions, terrain heights, storage and save format remain unchanged relative to approved ground. Independent contact-sheet inspection of all 40 integrated frames found no actionable visual issue; olives remain visible in every preset, and the bridge, dry boat interior and settlement variants remain coherent with approved ground. All 40 before/after fixture states match after documented supplemental alias normalization. Integrated browser click-to-act, compound fade/restoration and settled review storage readback passed; [qa-summary.json](qa-summary.json) keeps their status separate from isolated checks.

## Source and asset provenance

Retained Anker Desert Buildings FBX files come from the official CC0 asset page, with the declaration preserved alongside source hashes. Quaternius Medieval Village MegaKit contributions use the downloaded Standard archive's byte-for-byte `License_Standard.txt`, which explicitly grants CC0-1.0. That archive-specific text is the licensing basis. Plaster 002, Stylized Stone Wall 002 and Stylized Wood Planks 002 come from Katsukagi's 3dtextures.me CC0 sets; retained metadata records exact pages, public download IDs and checksums. Original assembly and modeled contributions retain the project's existing licensing treatment.

See the [intake and rebuild instructions](../../../../../art/vendor/architecture/README.md), [runtime manifest](../../../../../art/source/architecture/runtime-manifest.json), [credits register](../../../../../art/credits.json) and [generated credits](../../../../../CREDITS.md). Blender source exports are retained; the reproducible optimizer uses meshopt plus ETC1S colour and UASTC data maps with complete mip chains. Shared texture extraction preserves compressed streams and logical fallback offsets.

Exact runtime slice size is **4,113,529 bytes**: 11 GLBs totaling 947,668 bytes and 22 unique shared KTX2 files totaling 3,165,861 bytes. The largest GLB is 193,340 bytes; every model stays below 1 MB. These file bytes are separate from first-playable transfer. The integrated estimate is 13.718658 MB below.

## Capture and measurement protocol

October 11, 2026; Apple MacBook Pro M5 Pro (15 CPU / 16 GPU cores), 48 GB RAM; macOS 26.7.1; Codex in-app Chromium 155. CSS viewport 1280 × 720, DPR 1. Each of the eight canonical shots uses Low, Medium, High and Ultra; Salim/Pella add eight separately recorded town frames. The [supplemental approved-ground fixture-only patch](supplemental/baseline-fixture-only.patch) and [before metadata](supplemental/before/shots.json) preserve exact baseline aliases and source `97182d1`; the temporary source was restored after capture.

The [review protocol](../../../review-protocol.md) applies. Timing uses five seconds of visible warmup and ten seconds of completed frames per row, near/far on every preset. A short sample on one M5 Pro does not establish ordinary-laptop or sustained performance. [repeatability.json](repeatability.json) records all 32 matching repeated fixture states, PNG hashes and pixel residuals; [repeat metadata](repeat-shots.json) is retained. Pixels differing by more than 8/255 in any RGB channel range from **0.000651% to 0.201606%**, with no alignment or masks. No PNG pairs are byte-identical; held simulation still permits skeletal/renderer temporal variation.

## Download

[Baseline production transfer](production-transfer-before.json), [request log](production-requests-before.jsonl) and [guard](production-guard-before.json) are copied unchanged from approved ground's final `97182d1` production run. Runtime equivalence to `2dac97a` is verified above. This is reused evidence, not a new baseline run.

| Version | Encoded payload | Responses | Header allowance | Estimated transferred MB |
| --- | ---: | ---: | ---: | ---: |
| Before, runtime-equivalent `97182d1` | 9,792,246 bytes | 246 | 300 bytes/response | 9.866046 |
| Integrated after `4cee146` | 13,623,558 bytes | 317 | 300 bytes/response | 13.718658 |

The [integrated transfer summary](production-transfer-after.json) and [frozen request log](production-network-after.jsonl) include decoder-worker traffic from a fresh logging-proxy origin. Independent recomputation verifies the body sum and response count. All 52 conditional 304 responses have a full 200 payload for the same URL in this run; the only failed request is the optional favicon (404). The **13.718658 MB estimate is below 40 MB**, including 300 bytes per response for headers. This allowance is an estimate rather than a packet capture. The [production guard](production-guard-after.json) records ready=true on Medium and `reviewShot`, `measure`, `architectureShot` all undefined.

## Performance

Before: [performance-before.json](performance-before.json), **fresh same-session** approved-ground source `97182d1`, runtime-equivalent to base `2dac97a`. The [refresh record](performance-baseline-refresh.json) documents the run. The [earlier approved baseline](performance-before-approved-earlier.json) remains unchanged as historical evidence; it is not the comparator below. First-load MB is the separate production result above.

| Preset | Shot / radius | Viewport | Render size | Avg FPS | p95 ms | Draw calls | Active meshes | Triangles | First-load MB |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | aenon-near / 12 m | 1280 × 720 | 914 × 514 | 78.45 | 16.8 | 144 | 148 | 76212 | 9.866046 |
| Low | aenon-far / 44 m | 1280 × 720 | 914 × 514 | 74.08 | 17.6 | 575 | 589 | 200682 | 9.866046 |
| Medium | aenon-near / 12 m | 1280 × 720 | 1280 × 720 | 70.48 | 27.8 | 999 | 159 | 255388 | 9.866046 |
| Medium | aenon-far / 44 m | 1280 × 720 | 1280 × 720 | 61.60 | 29.1 | 1587 | 612 | 447052 | 9.866046 |
| High | aenon-near / 12 m | 1280 × 720 | 1280 × 720 | 44.31 | 35.4 | 1007 | 159 | 255388 | 9.866046 |
| High | aenon-far / 44 m | 1280 × 720 | 1280 × 720 | 34.37 | 44.2 | 1595 | 612 | 447052 | 9.866046 |
| Ultra | aenon-near / 12 m | 1280 × 720 | 1280 × 720 | 42.75 | 31.4 | 3533 | 159 | 776614 | 9.866046 |
| Ultra | aenon-far / 44 m | 1280 × 720 | 1280 × 720 | 26.42 | 42.1 | 4556 | 612 | 1152880 | 9.866046 |

Integrated after: [performance-after.json](performance-after.json), final source `4cee146`.

| Preset | Shot / radius | Viewport | Render size | Avg FPS | p95 ms | Draw calls | Active meshes | Triangles | First-load MB |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | aenon-near / 12 m | 1280 × 720 | 914 × 514 | 76.37 | 17.2 | 129 | 133 | 68002 | 13.718658 |
| Low | aenon-far / 44 m | 1280 × 720 | 914 × 514 | 71.93 | 18.1 | 471 | 485 | 173084 | 13.718658 |
| Medium | aenon-near / 12 m | 1280 × 720 | 1280 × 720 | 63.16 | 29.8 | 832 | 144 | 207990 | 13.718658 |
| Medium | aenon-far / 44 m | 1280 × 720 | 1280 × 720 | 62.10 | 28.1 | 1331 | 508 | 380266 | 13.718658 |
| High | aenon-near / 12 m | 1280 × 720 | 1280 × 720 | 42.68 | 34.6 | 840 | 144 | 207990 | 13.718658 |
| High | aenon-far / 44 m | 1280 × 720 | 1280 × 720 | 34.84 | 40.0 | 1339 | 508 | 380266 | 13.718658 |
| Ultra | aenon-near / 12 m | 1280 × 720 | 1280 × 720 | 42.91 | 30.5 | 2910 | 144 | 611652 | 13.718658 |
| Ultra | aenon-far / 44 m | 1280 × 720 | 1280 × 720 | 26.89 | 42.3 | 3844 | 508 | 968530 | 13.718658 |

**Low clears the required 30 FPS in these samples: 76.37 near and 71.93 far.** Fresh approved ground measured 78.45/74.08 FPS. Seven of the eight before/after average-FPS pairs differ by at most 3.7%; Medium near measures 70.48 before and 63.16 after (10.39% lower). These single short samples do not establish repeatability or causation.

Both versions miss 60 FPS on High and Ultra. Integrated High averages 42.68/34.84 FPS and Ultra 42.91/26.89 FPS; Ultra far is below 30 on both versions. The faster historical ground and isolated-architecture samples remain historical, and are not evidence that the integrated slice achieves those rates under current conditions.

The capture operator confirmed other heavy jobs stopped, a visible single game tab, 1280 × 720 CSS pixels and DPR 1 for each current run. A [source integration audit](performance-integration-review.json) found no duplicated ground material, quality/update path or changed ground shader: ground material and terrain are unchanged from approved ground. Draw calls, meshes and triangles are lower in every integrated row. The refreshed baseline also runs much slower than its historical measurement, so that earlier gap cannot be attributed to architecture alone. The cause of the session difference, sustained behavior and ordinary-laptop performance are unmeasured; no causal claim or speculative optimization is made.

## Comparisons

Canonical metadata: [approved-ground before states](before/shots.json) and [integrated after states](after/shots.json). Supplemental metadata: [before](supplemental/before/shots.json) and [after](supplemental/after/shots.json). [state-comparison.json](state-comparison.json) confirms all 40 matching states after normalizing only the explicit supplemental hook aliases. [capture-manifest.json](capture-manifest.json) records SHA-256 and verified 1280 × 720 dimensions for all 80 PNGs. Final after frames were captured at `4cee146`; reporter visual approval remains pending.

| Shot | Before — High | Integrated after — High |
| --- | --- | --- |
| aenon-square | [Before](before/aenon-square-high.png) | [After](after/aenon-square-high.png) |
| aenon-near | [Before](before/aenon-near-high.png) | [After](after/aenon-near-high.png) |
| aenon-far | [Before](before/aenon-far-high.png) | [After](after/aenon-far-high.png) |
| aenon-riverbank | [Before](before/aenon-riverbank-high.png) | [After](after/aenon-riverbank-high.png) |
| jordan-bridge | [Before](before/jordan-bridge-high.png) | [After](after/jordan-bridge-high.png) |
| scythopolis-market | [Before](before/scythopolis-market-high.png) | [After](after/scythopolis-market-high.png) |
| sea-shore | [Before](before/sea-shore-high.png) | [After](after/sea-shore-high.png) |
| fight | [Before](before/fight-high.png) | [After](after/fight-high.png) |
| salim | [Before](supplemental/before/salim-high.png) | [After](supplemental/after/salim-high.png) |
| pella | [Before](supplemental/before/pella-high.png) | [After](supplemental/after/pella-high.png) |

All presets (each cell links before / after):

| Shot | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| aenon-square | [Before](before/aenon-square-low.png) / [After](after/aenon-square-low.png) | [Before](before/aenon-square-medium.png) / [After](after/aenon-square-medium.png) | [Before](before/aenon-square-high.png) / [After](after/aenon-square-high.png) | [Before](before/aenon-square-ultra.png) / [After](after/aenon-square-ultra.png) |
| aenon-near | [Before](before/aenon-near-low.png) / [After](after/aenon-near-low.png) | [Before](before/aenon-near-medium.png) / [After](after/aenon-near-medium.png) | [Before](before/aenon-near-high.png) / [After](after/aenon-near-high.png) | [Before](before/aenon-near-ultra.png) / [After](after/aenon-near-ultra.png) |
| aenon-far | [Before](before/aenon-far-low.png) / [After](after/aenon-far-low.png) | [Before](before/aenon-far-medium.png) / [After](after/aenon-far-medium.png) | [Before](before/aenon-far-high.png) / [After](after/aenon-far-high.png) | [Before](before/aenon-far-ultra.png) / [After](after/aenon-far-ultra.png) |
| aenon-riverbank | [Before](before/aenon-riverbank-low.png) / [After](after/aenon-riverbank-low.png) | [Before](before/aenon-riverbank-medium.png) / [After](after/aenon-riverbank-medium.png) | [Before](before/aenon-riverbank-high.png) / [After](after/aenon-riverbank-high.png) | [Before](before/aenon-riverbank-ultra.png) / [After](after/aenon-riverbank-ultra.png) |
| jordan-bridge | [Before](before/jordan-bridge-low.png) / [After](after/jordan-bridge-low.png) | [Before](before/jordan-bridge-medium.png) / [After](after/jordan-bridge-medium.png) | [Before](before/jordan-bridge-high.png) / [After](after/jordan-bridge-high.png) | [Before](before/jordan-bridge-ultra.png) / [After](after/jordan-bridge-ultra.png) |
| scythopolis-market | [Before](before/scythopolis-market-low.png) / [After](after/scythopolis-market-low.png) | [Before](before/scythopolis-market-medium.png) / [After](after/scythopolis-market-medium.png) | [Before](before/scythopolis-market-high.png) / [After](after/scythopolis-market-high.png) | [Before](before/scythopolis-market-ultra.png) / [After](after/scythopolis-market-ultra.png) |
| sea-shore | [Before](before/sea-shore-low.png) / [After](after/sea-shore-low.png) | [Before](before/sea-shore-medium.png) / [After](after/sea-shore-medium.png) | [Before](before/sea-shore-high.png) / [After](after/sea-shore-high.png) | [Before](before/sea-shore-ultra.png) / [After](after/sea-shore-ultra.png) |
| fight | [Before](before/fight-low.png) / [After](after/fight-low.png) | [Before](before/fight-medium.png) / [After](after/fight-medium.png) | [Before](before/fight-high.png) / [After](after/fight-high.png) | [Before](before/fight-ultra.png) / [After](after/fight-ultra.png) |
| salim | [Before](supplemental/before/salim-low.png) / [After](supplemental/after/salim-low.png) | [Before](supplemental/before/salim-medium.png) / [After](supplemental/after/salim-medium.png) | [Before](supplemental/before/salim-high.png) / [After](supplemental/after/salim-high.png) | [Before](supplemental/before/salim-ultra.png) / [After](supplemental/after/salim-ultra.png) |
| pella | [Before](supplemental/before/pella-low.png) / [After](supplemental/after/pella-low.png) | [Before](supplemental/before/pella-medium.png) / [After](supplemental/after/pella-medium.png) | [Before](supplemental/before/pella-high.png) / [After](supplemental/after/pella-high.png) | [Before](supplemental/before/pella-ultra.png) / [After](supplemental/after/pella-ultra.png) |

## Integrated browser checks

The normal integrated production game imported the [fresh close-position fixture](interaction/house-close-import.json) through Settings. Only its position was altered; no coin, experience, Gear or progress was added. An actual Merchant label click routed west around house 0 and opened the [Merchant trade dialog](interaction/merchant-reached.png), ending at (−8.16214,205.87361).

The [interaction audit](interaction/house-route-qa.json) verifies all **1,879 recorded positions**, all 1,878 consecutive segments and every queued route segment against unchanged navigation; 42 samples moved. The direct route through the house is blocked. [Raw samples](interaction/house-route-samples.json) retain the full recording, including its long idle tail.

| Whole assembly fades behind the Adventurer | Solid again after the route |
| --- | --- |
| ![House roof, walls, ladder, courtyard and awning fade together](interaction/whole-house-faded.png) | ![Same house restored to opaque](interaction/whole-house-clear.png) |

Both integrated images were independently inspected at full size. The player remains visible through the faded assembly, and the building becomes solid after clearing the view and closing trade.

The [6.496-second route video](interaction/house-route.webm) is a stream-copy trim of the original 188.550-second canvas recording. It retains the opening through approximately arrival plus 2 seconds; the long idle tail is removed, with no re-encoding or changes to retained frames. [The edit record](interaction/house-route-video-edit.json) retains hashes, exact cutoff and timing limitations. The 25.25 MB raw recording remains at `/tmp/aenon-58-integrated-house-route-4cee146-full.webm`. Canvas capture omits DOM labels and panels; the separate PNG above proves the trade dialog.

Integrated production readiness and review-hook isolation passed above. [Review storage isolation](storage-isolation.json) also passed: a script-free baseline contained zero entries; all four presets settled, the reloaded review scene settled, and script-free readback remained byte-identical with zero entries. This proves no storage writes in the tested empty origin; it does not by itself test an existing populated save. The temporary probe page was removed. Earlier isolated checks remain labeled under [isolated/](isolated/README.md).
