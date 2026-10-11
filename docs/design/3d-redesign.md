# The Season: 3D redesign

The user confirmed this consolidated design and its implementation defaults in Q27 on October 11, 2026. After reviewing and correcting the playable sample, the user subsequently authorized the complete agreed first Aenon-to-Jordan gameplay area and making it the root game route. That later instruction supersedes the earlier sample-only implementation boundary; it does not by itself establish visual acceptance, provider access, or performance on every target device.

The root route now uses the Babylon 3D host. Authoritative real-time gameplay, original action assets, panels and versioned persistence are implemented; complete journey tests exercise the actual content and navigation. The first-area browser journey, short graphics-preset checks, and live NIV reading are verified. See [the gameplay review](../art/gameplay-review.md) for current evidence and outstanding visual and performance checks.

## Settled

- Use a real 3D world, with Albion Online as the visual reference. See [ADR 0015](../adr/0015-a-3d-world-with-the-existing-season-rules.md).
- Retain The Season's identity, progression, and existing gameplay except where explicitly revisited. The accepted changes include real-time melee, repeated timed gathering, renewable ordinary wilderness encounters, threat-based combat boundaries, and full recovery after defeat.
- Build the first 3D area in the browser using Babylon.js, retaining the TypeScript gameplay rules and evaluating visual quality and performance before wider production. A downloadable edition remains a later option. See [ADR 0016](../adr/0016-babylon-for-the-browser-world.md).
- Art direction: Albion-like chunky silhouettes, painterly surfaces, and readable scenery adapted to Galilee/Jordan, including limestone buildings, linen clothing, olive trees, reeds, and warm earth colors.
- Camera: perspective with a 32° vertical field of view, locked to the Adventurer with player-centered tracking and a constant viewing direction and elevation angle (alpha π/4, beta .83). Player-controlled zoom changes the radius from 12 to 44 metres, starting at 22 metres so the Adventurer occupies about 10% of the viewport height. The widest view retains settlement streets; the nearest allows inspecting a person. Free panning is unavailable.
- First milestone: one polished Aenon-to-Jordan playable area demonstrating movement, gathering, one fight, talking with John, and Scripture reading before expanding across the region.
- Graphics: a warm sun, cool sky fill, local prefiltered sky lighting, ACES tone mapping and warm haze light the PBR world. Low uses reduced resolution with no shadows or post-processing; Medium adds PCF shadows and FXAA; High adds contact-hardening shadows, MSAA ×4, subtle bloom and half-resolution SSAO2; Ultra uses four cascaded shadow maps and full-resolution SSAO2 with a higher pixel-ratio cap. Recommend a starting preset from CPU/GPU hints and preserve manual changes. Target at least 30 FPS at Low and 60 FPS where hardware permits; these remain validation targets, not hardware guarantees.
- Ground: six credited CC0 color/normal texture sets blend into lush and dry grass, ochre dirt, settlement cobbles, sand, wet mud and exposed rock. Existing road distances, settlements, water distance, height and slope drive the painting. Macro variation and offset texture sampling soften repeats; steep rock faces use a vertical projection. Low retains all color zones and skips normal sampling. Narrower worn path edges change only the paint, retaining terrain heights, routes and minimap data. See the [ground slice review](../art/reviews/issue-41/05-ground/README.md) for captured evidence and visual approval status.
- Controls: click-to-act is primary, with WASD retained. The Adventurer uses a running or jogging gait by default when moving, following the user's playable-sample feedback. Clicking an interaction moves into range; routes go around obstacles rather than through them. Movement speed and gait timing are tuned together through playable review.
- World authoring: primarily directed through Codex; a visual scene editor is optional.
- Art production: all art is made specifically for The Season through Codex-driven Blender modeling, original rigs and animations, and AI-assisted original concept/texture work. The initial playable sample established the pipeline and received running-gait and player-follow-camera corrections; the user then authorized first-area production. Issue #41 later reopened provenance: free third-party and AI-generated art is allowed when its licence permits public redistribution and modification, and every asset is credited in the repository and in the game. See [ADR 0023](../adr/0023-licensed-third-party-and-ai-art-with-credits.md), which supersedes [ADR 0017](../adr/0017-original-art-through-blender.md).
- Interface: most screen space belongs to the world, with a compact action bar and panels opened as needed for Gear, journals, trading, and Scripture. Use readable text and restrained parchment/stone styling.
- Occlusion: fade roofs, walls, and tree canopies that obscure the Adventurer or current interaction target, preserving their physical obstacles and routes around them.
- Panels: opening Scripture, journals, Gear, or trading stops movement and pauses gameplay until the panel closes. Existing action restrictions still apply, including not reading Scripture during a fight.
- Save continuity: preserve compatible existing progress, including skills, Gear, quests, and read passages. Spawn at a safe entry point in the saved place; precise old coordinates are not stored. Incompatible saves need a clear recovery path without silent overwriting.
- Combat: real-time melee with automatic basic attacks, independently timed hostile attacks, a small bar of active weapon techniques with cooldowns, and movement to avoid clearly signaled attacks. Selecting a hostile approaches and engages it. See [ADR 0018](../adr/0018-real-time-melee-with-weapon-techniques.md).
- Gathering: click a Spot to approach and repeat timed harvest cycles, awarding goods and experience only on completion. Stock is finite and replenishes during active play; an emptied Spot ends the action until the player starts again. See [ADR 0019](../adr/0019-renewable-wilderness-encounters-and-gathering.md).
- Repeat encounters: ordinary wilderness animals and bandits respawn after a delay. Completed quests and story-specific outcomes remain permanent.
- Danger and escape: appropriate wilderness hostiles notice, pursue, and attack the Adventurer; several may join a fight. Hostiles that lose pursuit return to their territory and recover. A fight ends only when all threats fall or disengage, or the Adventurer is defeated. Settlements stay safe. See [ADR 0020](../adr/0020-combat-boundaries-pause-and-recovery.md).
- Occupied routes: wilderness roads and lake shores carry camps and off-road one-time caches. The road center, the waterline, and the open country between routes stay clear. This population does not carry a level band. See [ADR 0022](../adr/0022-occupied-wilderness-routes.md).
- Cancellation: movement takes priority over automatic attacks; movement or a new order cancels unfinished gathering and uncommitted techniques. Being hit interrupts gathering. Only completed harvest cycles award goods and experience.
- Return from panels: timed gameplay, including cooldowns, effects, stock replenishment, and respawns, freezes while paused. Closing a panel leaves the Adventurer idle; any existing hostile threats remain.
- First combat kit: three weapon-specific melee technique roles—offensive, defensive, and repositioning—alongside basic attacks. Retain legendary Gear effects and express their durations in gameplay time. Tune the exact actions and values through play.
- Recovery: defeat returns the Adventurer to the last settlement with full current Hitpoints, Gear and possessions retained, and the existing small coin loss. Successful escape also ends the food restriction once every threat has disengaged.
- Gear: the panel permits inspection during a paused fight, but changing worn Gear requires being out of combat. Swapping Gear must not reset technique cooldowns.

## Delivery and review

1. **Playable art sample.** Set up the original-art pipeline and a small Babylon scene showing the moving Adventurer, limestone building, olive tree, and riverbank. Include the actual fixed-follow camera and zoom, representative lighting, and original textures. Keep editable Blender source, original textures, animation source, and export scripts. This initial milestone was implemented and revised through user feedback; the subsequent full-area instruction authorizes the next stages. Actual play remains the basis for visual review.
2. **Complete Aenon-to-Jordan area.** Extend the approved art into the first playable area and integrate navigation, independent combat, the three technique roles, gathering/Hunting, ordinary hostile renewal, John, Scripture, progression, and the interface. Preserve the TypeScript rules boundary while intentionally revising the combat/gathering state and actions; reconcile the older issue specification with the accepted ADRs.
3. **Persistence and complete journeys.** Verify existing-progress migration, safe spawning, permanent quest and Scripture history, defeat recovery, cancellation, and panel behavior through complete play sequences. Ordinary hostile availability must be separate from historical quest completion. Retain recoverable original saves before migrating them.
4. **Measure and polish.** Exercise all quality presets on recorded hardware/browser/resolution conditions and both zoom extremes. Report measured frame rates and stalls against the 30 FPS Low / 60 FPS where feasible targets. Present the playable area, original-art source, migration evidence, performance results, and any unmet acceptance checks before expanding across the region.

## Acceptance checks

- The playable art sample establishes the intended proportions, painterly style, material treatment, and animation at the actual camera. Feet remain grounded, joints deform acceptably, and important silhouettes remain readable.
- Click-to-act routes around a fence or building. Unreachable or vanished targets cannot grant rewards or cause attacks through obstacles. Zoom and faded scenery preserve selection accuracy and physical boundaries.
- A hostile can attack while the Adventurer is not swinging. Several threats can coexist; movement and techniques matter. Changing the selected target does not end combat or enable food/Gear changes.
- Escaping the last threat ends combat; enemies return home and recover. Losing one target while another pursues does not count as escape. Defeat restores full Hitpoints, applies only the agreed coin loss, and retains possessions.
- Gathering awards exactly once per completed cycle, stops when stock is depleted, and requires a new command after replenishment. Canceling or being hit before completion awards nothing for that cycle. Respawns never replay completed quests or set scenes.
- Opening a panel freezes timed gameplay without erasing threats or permitting forbidden actions. Closing it leaves the Adventurer idle. Paused out-of-combat panel actions, such as changing Gear, remain usable.
- Compatible old saves retain earned progress, Gear, goods, quests, and read passages. Reloading or migration cannot duplicate rewards or reset cooldowns for an advantage; unsafe or incompatible state has a clear recovery path without overwriting the original save.
- Low through Ultra preserve gameplay objects, navigable boundaries, interaction cues, and readable Scripture/UI. Better hardware adds visual richness. Manual quality choices persist, and actual performance is reported rather than inferred from a successful build.
- Run the repository's appropriate rules tests, typecheck, and production build as implementation progresses. Verify the real browser experience in the Codex in-app browser; automated checks alone do not establish visual or interaction acceptance.

## Confirmed implementation defaults

These defaults were explicitly presented and accepted in Q27:

- Use active gameplay time throughout; also pause when the game tab is hidden, with no offline gathering, replenishment, or respawn catch-up. Begin with a recommended graphics preset plus a manual override rather than continuous automatic preset switching.
- Keep existing skill-level gates and the current food, rarity, gear-band, and progression systems except for the accepted changes above. Do not add tool-tier progression, durability, carrying weight, mana, or another skill-training ladder as part of this area.
- Hunting targets the clicked carcass and completes one timed harvest of its existing meat/hide/bone yield. Apply the same cancellation rules, keep Hunting unavailable during a fight, and consume the carcass only on successful completion.
- Preserve legendary effects on successful basic hits initially; do not multiply effect triggers across every target of an active technique. Tune durations and technique values through play. Repositioning does not itself imply invulnerability.
- Select representative test machines and initial tuning values during implementation, and report the exact conditions. These are engineering and balancing tasks, not claims that target performance or finished art already exists.

## Decision tree

- Real 3D presentation: settled.
  - Art direction: stylized Galilee/Jordan, settled.
    - Art provenance: original, free third-party, or AI-generated art, legally licensed and credited (ADR 0023, superseding the original-only rule), settled.
    - Production method and review: Codex-driven Blender, original rigs/animations, AI-assisted concept/texture work, and a playable art sample, settled.
    - Blender setup and original sample production were authorized by Q27. The subsequent instruction authorizes original assets for the complete first area; no asset purchases or commissions are part of this plan.
  - Camera: player-centered tracking with constant viewing direction and elevation, zoom around the Adventurer, and no free panning, settled.
    - Movement and navigation: click-to-act, WASD, and routes around obstacles, settled.
    - Scenery occlusion: fade blocking scenery while preserving physical obstacles, settled.
    - Combat and gathering click behavior: approach and engage in automatic basic attacks or repeated timed harvest cycles, settled.
  - First playable area: polished Aenon-to-Jordan, settled.
    - Visual review: the sample was revised from user feedback, followed by explicit full-area implementation authorization. Continue reviewing the actual playable area; authorization is not a claim of final visual acceptance.
    - Interaction, art, persistence, and performance acceptance checks are recorded above.
  - Interface: world-focused layout with compact action bar and panels as needed, settled.
    - World behavior while reading Scripture or using panels: stop movement and pause gameplay, settled.
- Existing gameplay: retained except where reopened by the user.
  - Albion-like combat and gathering: real-time melee with weapon techniques, finite replenishing Spots, and ordinary hostile respawns, settled.
  - Wilderness roads and lake shores carry camps and off-road caches; the route center and the open country between routes stay clear, settled.
  - Enemy aggression, escape, interruption/resumption, three technique roles, paused effect time, defeat recovery, and Gear restrictions: settled.
  - TypeScript rules retained; engine-independent boundary remains.
  - Preserve compatible saves and provide safe recovery for incompatible saves, settled.
- Platform: Babylon.js in the browser first; downloadable edition remains a later option.
  - Scalable graphics: four quality presets and ordinary-laptop baseline, settled as design targets; representative benchmark devices remain to be selected.
  - Browser delivery for the first 3D area: settled.
  - World-authoring workflow: Codex-directed, with an optional visual editor, settled.
  - Engine: Babylon.js, settled. Downloadable packaging is deferred.
- Shared-understanding confirmation and full first-area implementation authorization are complete. The current review is the integrated root-route game, recorded in [the gameplay review](../art/gameplay-review.md). The [sample review](../art/sample-review.md) is historical evidence for the earlier milestone. Numeric tuning and reference-device measurements remain implementation and acceptance tasks.

## Starting point recorded during the interview

- At the interview start, the active host was TypeScript and Phaser, projecting logical positions into a 2D isometric view. The implemented root route now uses Babylon; the Phaser host remains in source.
- `src/season/` is independent of the renderer. The active browser save stores exported Season state in localStorage.
- The playable demo covers Aenon and the Jordan; the larger region design is substantially broader.
- README and AGENTS describe React and the YouVersion React SDK, but the current entry uses plain HTML, direct DOM rendering, and a server passage request. Do not assume that integration already exists.
- Earlier GitHub specs describe top-down pixel presentation. Issue #15 excluded Three.js within its rules-module scope. The new visual direction reopens the host presentation choice without changing the rules-module boundary.
- Existing host, terrain, UI, and progression work changed and was committed concurrently during the interview. Preserve that work and refresh the baseline before any implementation.

## Platform decision evidence

Accepted direction: evaluate a browser 3D slice in Babylon.js while retaining the TypeScript rules. Actual performance and visual quality remain unmeasured. The sources below informed the choice.

- [Babylon.js](https://www.babylonjs.com/specifications/) supplies models, animation, lighting, picking, and game-oriented facilities while allowing direct reuse of the TypeScript Season module.
- [Three.js](https://threejs.org/manual/pages/game.html) also permits direct rules reuse, but its own game guide identifies collision, input, physics, and pathfinding as systems to provide separately.
- [Godot](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/index.html) offers integrated scene authoring and native exports. Its [official language support](https://docs.godotengine.org/en/stable/about/faq.html#which-programming-languages-are-supported-in-godot) does not include TypeScript, so retaining the current rules requires an additional runtime/bridge or a deliberate port. Its [JavaScriptBridge](https://docs.godotengine.org/en/stable/classes/class_javascriptbridge.html) is web-export-specific.
- A downloadable edition can package a web game using [Electron](https://www.electronjs.org/docs/latest/tutorial/process-model) or [Tauri](https://v2.tauri.app/reference/webview-versions/). Installation alone does not establish a rendering-quality or frame-rate advantage; Tauri's webview differences require platform-specific testing.
- Existing saves need explicit consideration if the origin or app container changes because [localStorage is origin-specific](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage). The live passage service remains separate; a downloadable game does not by itself make Scripture reading work offline.

## Graphics settings research

The user accepted Low/Medium/High/Ultra presets with at least 30 FPS at Low and 60 FPS where hardware permits as targets. Stronger hardware should produce a better visual experience. This design document records targets, not measured device performance.

Babylon offers controls for [resolution, shadows, and other scene costs](https://doc.babylonjs.com/features/featuresDeepDive/scene/sceneOptimizer/), [antialiasing and post-processing](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/defaultRenderingPipeline/), and [model level of detail](https://doc.babylonjs.com/features/featuresDeepDive/mesh/LOD/). These establish technical options, not measured Aenon performance.

Implementation criteria for the accepted quality direction:

- Scale rendering and noninteractive decoration while retaining all gameplay objects, collision geometry, interaction cues, and readable interface text across settings.
- Offer a recommended starting preset and persistent manual overrides. Automatic ongoing adjustment is a separate choice.
- Evaluate representative scenes at both zoom extremes after loading and shader warm-up. Ignore hidden-tab time when judging performance.
- Do not equate more post-processing with better art; preserve the chosen painterly style and readable silhouettes.
- If the minimum acceptable preset misses the target, report the benchmark rather than sacrificing essential visibility.

## Original-art production research

All art being specific to this game, the Codex-driven Blender workflow, AI-assisted original concept/texture imagery, and playable visual review are accepted. Original sample and gameplay assets now exist; see their source and review records under `docs/art/`. The notes below describe the research available at the interview start.

- Blender was not found in the standard application or command locations inspected. Python and Node are available; no modeling tool was installed or launched for this interview.
- Blender supports [scripted authoring](https://docs.blender.org/api/main/info_quickstart.html) and [glTF export of meshes, materials, skins, and animations](https://docs.blender.org/api/dev/bpy.ops.export_scene.html). This is a possible pipeline for editable original source assets and runtime models.
- Raster image generation can assist original concepts or textures. It does not itself produce a rigged mesh, skin weights, or animation clips.
- Code-generated geometry alone does not establish the chosen visual quality. The first art review is a playable composition with an animated Adventurer, limestone building, olive tree, and riverbank at the actual camera and zoom range.
- Organic proportions, joint deformation, foot contact, and action timing require inspection in the exported game scene. The art process must prove those results before expanding to the full area.

## Combat and gathering: reopened scope

The user requested that combat and gathering be pretty similar to Albion Online rather than accepting one action per click. This establishes the reference, not every mechanic of Albion's MMO.

Earlier rules that motivated the decision (retained in shared/legacy modules; the new host uses `src/season/realtime.ts`):

- `src/season/lib/fight.ts` resolves the Adventurer's hit and surviving hostile's retaliation in one `swingAtHostile` call. Repeating it on a timer would produce repeated paired exchanges, not independent attacks.
- Fight state currently supports one hostile, and burns/stuns are measured through exchanges. Independent timing, active abilities, evasion, and successful retreat require explicit new rules.
- `src/season/lib/gather.ts` grants one completed yield per call. Spots have no remaining stock or refill timer; `src/season/lib/pack.ts` allows an existing material stack to grow without a limit. Repeating gathering until the pack fills is therefore not a reliable stop condition.
- Defeated hostile IDs are permanent in current state. A visual wolf reappearance does not clear that rule. Renewable opponents must preserve quest completion history separately.
- `src/season/lib/hunt.ts` harvests a carcass by place rather than a selected carcass ID; explicit carcass targeting would need to be added.

Real-time combat, finite/replenishing gathering, repeat encounters, aggression, escape, interruption/resumption, the three technique roles, and timed effects are accepted. ADRs 0005, 0010, and 0011 have been reconciled with the new decisions. The existing skill gates and progression decisions remain in force; implementation must reconcile the older issue specification without treating it as a veto over the user's later choices.

Albion reference evidence: the [official Battleaxe guide](https://albiononline.com/news/basic-builds-battleaxe) describes auto-attacks, active abilities, cooldowns, and positioning. [Official resource patch notes](https://albiononline.com/news/patch-8-is-live) describe depletion and replenishment, and the [Learning Points guide](https://albiononline.com/news/guide-learning-points) connects gathering progression to tool tiers and yield/speed. Exact current automatic-repeat and interruption behavior was not conclusively verified from primary documentation. The proposed Aenon harvesting loop is therefore an explicit design proposal, not a claim to reproduce every Albion control or rule.

Resolved question round:

- Q19 accepted: real-time melee with independent enemy attacks, automatic basic attacks, and a small bar of active weapon techniques.
- Q20 accepted: repeated timed harvest cycles with finite stock and replenishment during active play, stopping when depleted or canceled.
- Q21 accepted: ordinary wilderness hostiles respawn while quest completion remains permanent.

- Q22 accepted: nearby threats, pursuit, multiple hostile opponents, successful escape, enemy return/recovery, and peaceful settlements.
- Q23 accepted: explicit cancellation and return to idle after paused panels.
- Q24 accepted: offensive, defensive, and repositioning technique roles, with legendary effects and cooldowns using paused gameplay time.
- Q25 accepted: full Hitpoints on waking after defeat, possessions retained, existing small coin loss.
- Q26 accepted: inspect Gear during combat, but change worn Gear only outside combat.

- Q27 accepted: confirmed the consolidated design and defaults, and initially authorized the playable original-art sample, including Blender setup.
- Later implementation instruction, October 11, 2026: implement the complete agreed 3D first area and make it the main root route. This supersedes the earlier sample-only production gate. Keep the sample separately available and retain the Phaser implementation as source.
