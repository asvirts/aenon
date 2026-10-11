# Graphics review protocol

[Issue #41](https://github.com/asvirts/aenon/issues/41) owns the visual decisions. Every slice uses these same eight shots. Its PR reports the measurements and shows the frames; the reporter supplies the visual verdict.

## Start an isolated review

Run `npm ci`, then `npm run dev -- --host 127.0.0.1`. Open `http://127.0.0.1:5173/?review` in the **Codex in-app browser** with a **1280 × 720 CSS-pixel viewport**. Use the same machine, display scaling, browser version and viewport on the base and head. Record device pixel ratio separately: presets may render at different pixel sizes.

`?review` works only in the Vite development server. It selects a fresh in-memory `Storage` before loading saves, so migrations, graphics preferences, import/restart controls and autosave cannot touch the player's persistent storage. It never reads the player's saved progress. Review hooks and their dynamically imported module are absent from the production build, including when the production URL has `?review`.

The existing `window.__aenonGame()` status function remains available. In a development review session it also has these asynchronous methods:

```js
await window.__aenonGame.reviewShot('aenon-square', 'high')
window.__aenonGame.reviewState() // { shot, settled: true, busy: null }
await window.__aenonGame.measure(10)
```

The optional preset defaults to `high`; use `low`, `medium`, `high` and `ultra`. `reviewShot` returns the shot name, quality, zoom, exact position, simulation time and combat status. Await it before capturing. A query such as `?review&shot=sea-shore&preset=medium` loads the shot automatically; wait until `reviewState().settled` is true. A second operation while a shot or measurement is running is rejected.

Each call rebuilds a fresh, deterministic simulation using the real rules. The simulation then holds its position, combat phase and water time while Babylon continues rendering and animating. The fight uses the authored Salim wolf near camp `low-road-0-5`, advanced by 24 fixed 1/60-second steps into engagement. It does not add hostiles or change their rules. Small skeletal-animation phase differences between screenshots are acceptable. Transient notices are hidden; gameplay cues and HUD remain visible. Do not move, open panels, resize or change settings during a measurement.

## Shot matrix

| Shot | Adventurer position (x, z) | Zoom | Subject |
| --- | --- | --- | --- |
| `aenon-square` | −0.8, 209 | Default | Houses, stations, John and river edge |
| `aenon-near` | −0.8, 209 | Minimum | Same square, closest zoom |
| `aenon-far` | −0.8, 209 | Maximum | Same square, widest zoom |
| `aenon-riverbank` | 4.7, 201 | Default | Reeds and water |
| `jordan-bridge` | 24, −77.98 | Default | Scythopolis–Pella road crossing |
| `scythopolis-market` | −20, −65 | Default | Market court |
| `sea-shore` | 31, −374 | Default | Capernaum landing and Sea of Galilee |
| `fight` | −118.2, 188 | Default | Engaged hostile near a wilderness camp |

Zoom names resolve through `cameraZoom`, so the perspective-camera slice can change camera settings while preserving shot semantics. The fixed positions are asserted walkable; a geography change should fail visibly rather than silently capture somewhere else.

Capture **every shot on every preset**: 32 PNGs per before/after set. Use `<shot>-<preset>.png`, for example `aenon-near-low.png`. Capture the browser viewport, excluding Codex chrome. Wait for fonts and assets to load, move the pointer off any game object, then await `reviewShot` and capture. Repeat each shot once to check reproducibility apart from animation; retain the first matching set. Do not substitute a build or HTTP response for inspecting the actual frames.

The initial set belongs in `docs/art/reviews/issue-41/baseline/`. For each subsequent slice use `docs/art/reviews/issue-41/<slice-number>-<slug>/before/` and `after/`. State both commit SHAs. Slice 1 changes the harness only, so its baseline on the unchanged renderer is also its before/after visual evidence. The final full set belongs in `docs/art/reviews/issue-41/final/`.

## Performance and download measurements

Measure `aenon-near` and `aenon-far` on all four presets: eight rows. After loading each shot, run `measure(10)` without other work competing for the GPU. Every measurement first warms for **five seconds of visible frames**, then collects at least the requested number of visible seconds. Time spent hidden, including the frame spanning each visibility change, is excluded from warmup and sampling. A hidden tab may take longer in wall-clock time. Long visible frames remain in the results.

`averageFps` is completed frames divided by measured visible seconds; `p95FrameMs` is the nearest-rank 95th percentile of completed-frame intervals. Draw calls, active meshes and triangles are arithmetic means over those frames. Draw calls use Babylon's draw-call counter; active meshes use the current scene's active mesh list; triangles use Babylon's active rendered index counter divided by three. These are rendered workload counters, not total loaded geometry. Preserve raw JSON to retain precision, actual sample duration, sample count, GPU/browser strings, viewport and render size.

Measure **first playable load separately from the production build**. Run `npm run build` and `npm run preview`; use a fresh in-app page with cache disabled or cleared. Count first-party transferred bytes from navigation until `__aenonGame().ready` and initial assets are complete, recording the exact method and whether response headers are included. Divide bytes by 1,000,000 for MB. Browser resource timing can return zero for cache hits, so a cached reload is not a cold-load result. Do not use Vite development-module traffic as the production download size. Production intentionally has no review hooks; copy this cold-load figure into the applicable rows and name its production commit.

Each evidence directory's `README.md` records date, base/head SHA, hardware (CPU/GPU/RAM), OS, in-app browser version, viewport, device pixel ratio, transfer method and measurement duration. State that results from one machine do not prove the ordinary-laptop target. Use this table and include both viewport and render size:

| Preset | Shot / zoom | Viewport | Render size | Average FPS | p95 frame ms | Draw calls | Active meshes | Triangles | First-load transferred MB |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | aenon-near / minimum | 1280 × 720 | measured | measured | measured | measured | measured | measured | measured |
| Low | aenon-far / maximum | 1280 × 720 | measured | measured | measured | measured | measured | measured | measured |
| Medium | aenon-near / minimum | 1280 × 720 | measured | measured | measured | measured | measured | measured | measured |
| Medium | aenon-far / maximum | 1280 × 720 | measured | measured | measured | measured | measured | measured | measured |
| High | aenon-near / minimum | 1280 × 720 | measured | measured | measured | measured | measured | measured | measured |
| High | aenon-far / maximum | 1280 × 720 | measured | measured | measured | measured | measured | measured | measured |
| Ultra | aenon-near / minimum | 1280 × 720 | measured | measured | measured | measured | measured | measured | measured |
| Ultra | aenon-far / maximum | 1280 × 720 | measured | measured | measured | measured | measured | measured | measured |

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build`. Tests cover all eight deterministic fixtures, real fight engagement, storage isolation, warmup/hidden-tab accounting, and the actual production bundle's exclusion of review entry points. Also inspect a production preview with `?review`: `typeof __aenonGame.reviewShot` and `typeof __aenonGame.measure` must both be `"undefined"`.

For browser save isolation, record all localStorage keys and exact values before entering review mode and compare after capturing and reloading the review URL, including after changing preset. Leave any pre-existing player save in place. Store only the equality verdict in evidence, not the player's saved contents. This verifies browser integration in addition to the unit-level storage boundary.
