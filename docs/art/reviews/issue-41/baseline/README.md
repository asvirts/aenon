# Graphics baseline

Renderer/content base: `2778022a908ac3c7bd8608781c0fb07b42559f43`. Harness implementation: `c9f0a05c1a83de1cfb72937a2e7a33e9a8f1990f`. The baseline uses that development-only instrumentation on the unchanged base renderer. Slice 1 has no art change, so its before/after sets are two separate captures of this same renderer, not a claimed graphics improvement.

October 11, 2026. Apple MacBook Pro, M5 Pro (15 CPU / 16 GPU cores), 48 GB RAM; macOS 26.7.1; Codex in-app browser Chromium 155. CSS viewport 1280 × 720, device pixel ratio 1. Five seconds of visible warmup followed by ten seconds of completed frames per row. Review holds the simulation while skeletal animations continue. Development rendering timings; production transfer measured separately. These short samples do not establish sustained performance or the ordinary-laptop target.

Baseline production load at `2778022`: **7.47 MB** (7,465,593 Resource Timing transferred bytes, including its standardized response-header allowance; 7,402,593 encoded body bytes). Cache disabled; 210 navigation/resource entries; game ready. Runtime download is identical for every preset; this single cold-load result is repeated in the rows. Raw entries are in `production-transfer.json`.

| Preset | Shot / zoom | Viewport | Render size | Avg FPS | p95 ms | Draw calls | Active meshes | Triangles | First-load MB |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | aenon-near / 10 | 1280 × 720 | 914 × 514 | 120.0 | 12.7 | 205 | 210 | 76710 | 7.47 |
| Low | aenon-far / 32 | 1280 × 720 | 914 × 514 | 117.0 | 12.6 | 762 | 778 | 214682 | 7.47 |
| Medium | aenon-near / 10 | 1280 × 720 | 1280 × 720 | 104.3 | 20.1 | 1055 | 218 | 253228 | 7.47 |
| Medium | aenon-far / 32 | 1280 × 720 | 1280 × 720 | 88.7 | 21.3 | 1625 | 799 | 399220 | 7.47 |
| High | aenon-near / 10 | 1280 × 720 | 1280 × 720 | 106.1 | 19.4 | 1055 | 218 | 253228 | 7.47 |
| High | aenon-far / 32 | 1280 × 720 | 1280 × 720 | 92.9 | 20.7 | 1625 | 799 | 399220 | 7.47 |
| Ultra | aenon-near / 10 | 1280 × 720 | 1280 × 720 | 104.3 | 19.8 | 1055 | 218 | 253228 | 7.47 |
| Ultra | aenon-far / 32 | 1280 × 720 | 1280 × 720 | 91.5 | 21.3 | 1625 | 799 | 399220 | 7.47 |

## Complete shot set

| Shot | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| aenon-square | [Low](aenon-square-low.png) | [Medium](aenon-square-medium.png) | [High](aenon-square-high.png) | [Ultra](aenon-square-ultra.png) |
| aenon-near | [Low](aenon-near-low.png) | [Medium](aenon-near-medium.png) | [High](aenon-near-high.png) | [Ultra](aenon-near-ultra.png) |
| aenon-far | [Low](aenon-far-low.png) | [Medium](aenon-far-medium.png) | [High](aenon-far-high.png) | [Ultra](aenon-far-ultra.png) |
| aenon-riverbank | [Low](aenon-riverbank-low.png) | [Medium](aenon-riverbank-medium.png) | [High](aenon-riverbank-high.png) | [Ultra](aenon-riverbank-ultra.png) |
| jordan-bridge | [Low](jordan-bridge-low.png) | [Medium](jordan-bridge-medium.png) | [High](jordan-bridge-high.png) | [Ultra](jordan-bridge-ultra.png) |
| scythopolis-market | [Low](scythopolis-market-low.png) | [Medium](scythopolis-market-medium.png) | [High](scythopolis-market-high.png) | [Ultra](scythopolis-market-ultra.png) |
| sea-shore | [Low](sea-shore-low.png) | [Medium](sea-shore-medium.png) | [High](sea-shore-high.png) | [Ultra](sea-shore-ultra.png) |
| fight | [Low](fight-low.png) | [Medium](fight-medium.png) | [High](fight-high.png) | [Ultra](fight-ultra.png) |

Raw measurements: [performance.json](performance.json). Reporter visual acceptance remains pending.
