# The Season: 3D redesign interview

Design discussion in progress. This document records answers and open decisions; it is not implementation authorization.

## Settled

- Use a real 3D world, with Albion Online as the visual reference. See [ADR 0015](../adr/0015-a-3d-world-with-the-existing-season-rules.md).
- Retain The Season's existing gameplay and identity. The redesign covers presentation and interaction.
- A downloadable game is worth considering if there is a concrete advantage. This does not yet choose downloadable delivery or reject the browser.
- Art direction: Albion-like chunky silhouettes, painterly surfaces, and readable scenery adapted to Galilee/Jordan, including limestone buildings, linen clothing, olive trees, reeds, and warm earth colors.
- Camera: fixed viewing direction, following the Adventurer, with player-controlled zoom.
- First milestone: one polished Aenon-to-Jordan playable area demonstrating walking, gathering, one fight, talking with John, and Scripture reading before expanding across the region.
- Graphics should offer settings suited to hardware so stronger machines can deliver a better visual experience. Minimum supported hardware, presets, default selection, and frame-rate targets remain open.

## Decision tree

- Real 3D presentation: settled.
  - Art direction: stylized Galilee/Jordan, settled.
    - Model sources, animation workflow, and production budget: open.
  - Camera: fixed direction with follow and zoom, settled.
    - Movement, targeting, scenery occlusion, and navigation: open.
  - First playable area: polished Aenon-to-Jordan, settled.
    - Visual and interaction acceptance criteria, model inventory, and delivery stages: open.
  - Interface layout and presentation: open.
- Existing gameplay: retained.
  - Rules-module boundary and compatibility with existing saves: to confirm during architecture decisions.
- Platform: open; browser is current, downloadable is an option.
  - Scalable graphics: desired; exact presets, minimum hardware, and performance targets remain open.
  - Audience/device requirements and distribution priorities: open.
  - World-authoring workflow: visual scene editor versus code and asset authoring remains open.
  - Engine and packaging: depend on platform constraints and technical research.
- Shared understanding and implementation start: await completion of the interview and explicit confirmation.

## Verified starting point

- The active host is TypeScript and Phaser, projecting logical positions into a 2D isometric view. It has no existing 3D world renderer.
- `src/season/` is independent of the renderer. The active browser save stores exported Season state in localStorage.
- The playable demo covers Aenon and the Jordan; the larger region design is substantially broader.
- README and AGENTS describe React and the YouVersion React SDK, but the current entry uses plain HTML, direct DOM rendering, and a server passage request. Do not assume that integration already exists.
- Earlier GitHub specs describe top-down pixel presentation. Issue #15 excluded Three.js within its rules-module scope. The new visual direction reopens the host presentation choice without changing the rules-module boundary.
- Existing host, terrain, UI, and progression work is uncommitted and changed during inspection. Preserve it and refresh the baseline before any implementation.

## Platform research for the next round

Recommendation to discuss, not an accepted decision: evaluate a browser 3D slice while retaining the TypeScript rules, with Babylon.js as a candidate. Actual performance and visual quality remain unmeasured.

- [Babylon.js](https://www.babylonjs.com/specifications/) supplies models, animation, lighting, picking, and game-oriented facilities while allowing direct reuse of the TypeScript Season module.
- [Three.js](https://threejs.org/manual/pages/game.html) also permits direct rules reuse, but its own game guide identifies collision, input, physics, and pathfinding as systems to provide separately.
- [Godot](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/index.html) offers integrated scene authoring and native exports. Its [official language support](https://docs.godotengine.org/en/stable/about/faq.html#which-programming-languages-are-supported-in-godot) does not include TypeScript, so retaining the current rules requires an additional runtime/bridge or a deliberate port. Its [JavaScriptBridge](https://docs.godotengine.org/en/stable/classes/class_javascriptbridge.html) is web-export-specific.
- A downloadable edition can package a web game using [Electron](https://www.electronjs.org/docs/latest/tutorial/process-model) or [Tauri](https://v2.tauri.app/reference/webview-versions/). Installation alone does not establish a rendering-quality or frame-rate advantage; Tauri's webview differences require platform-specific testing.
- Existing saves need explicit consideration if the origin or app container changes because [localStorage is origin-specific](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage). The live passage service remains separate; a downloadable game does not by itself make Scripture reading work offline.

## Graphics settings research

The user wants stronger hardware to produce a better visual experience. Specific presets and performance targets are still questions, not commitments.

Babylon offers controls for [resolution, shadows, and other scene costs](https://doc.babylonjs.com/features/featuresDeepDive/scene/sceneOptimizer/), [antialiasing and post-processing](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/defaultRenderingPipeline/), and [model level of detail](https://doc.babylonjs.com/features/featuresDeepDive/mesh/LOD/). These establish technical options, not measured Aenon performance.

Proposed implementation criteria to revisit after the quality policy is accepted:

- Scale rendering and noninteractive decoration while retaining all gameplay objects, collision geometry, interaction cues, and readable interface text across settings.
- Offer a recommended starting preset and persistent manual overrides. Automatic ongoing adjustment is a separate choice.
- Evaluate representative scenes at both zoom extremes after loading and shader warm-up. Ignore hidden-tab time when judging performance.
- Do not equate more post-processing with better art; preserve the chosen painterly style and readable silhouettes.
- If the minimum acceptable preset misses the target, report the benchmark rather than sacrificing essential visibility.
