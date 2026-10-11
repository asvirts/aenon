# Playable original-art sample review

Status: playable sample implemented; corrected running gait is available, and final user art review is pending. Checked items below have observed evidence; unchecked items remain unverified or await approval.

The user confirmed the [3D redesign](../design/3d-redesign.md) and its explicit implementation defaults in Q27 on October 11, 2026. That initial authorization covered the playable art sample and Blender setup. After reviewing the playable sample and requesting running/camera corrections, the user explicitly authorized the complete agreed first area and its promotion to the root route. This is the historical sample review; current gameplay evidence is in [the gameplay review](gameplay-review.md).

## Sample scope

The sample at `/art-sample.html` is a small Babylon.js scene establishing the original art direction at the real game camera:

- A moving Adventurer in linen clothing, with original modeling, rigging, and animation.
- A limestone building with readable proportions and material treatment.
- An olive tree with a clear silhouette and original foliage treatment.
- A riverbank with water, reeds, and warm earth colors that connect the scene to the Jordan setting.
- A camera locked to the Adventurer, with player-centered tracking, constant viewing direction and elevation angle, zoom around the Adventurer, and no free panning. Click-to-move and WASD movement use a running or jogging gait by default while exploring the art.
- Representative lighting, original textures, and Low/Medium/High/Ultra settings for evaluating the composition on the current device.
- A restrained interface that leaves most of the screen to the world, with movement guidance and graphics controls.
- Editable Blender source, texture and animation source, and a repeatable export script.

All artwork is made specifically for The Season. No reusable third-party art packs, asset purchases, or commissions are included. This sample does not complete combat, gathering, John, Scripture, progression, or save migration; those belong to the later complete-area work described in the design.

## Review conditions

Use the Codex in-app browser for the actual playable review. Record the URL, build or working-tree state, operating system, device/GPU when available, viewport size, browser version when available, selected preset, and zoom position beside any observations. Use the deployed or local scene that was actually inspected; a concept image, export, build, or source inspection is not visual acceptance.

## Manual checklist

### Art at the game camera

- [x] The Adventurer, limestone building, olive tree, and riverbank are present together in the playable scene.
- [ ] The composition reads as stylized Galilee/Jordan: warm earth, limestone, linen, olive foliage, and a riverbank form a cohesive original world.
- [ ] The Adventurer is easy to distinguish from the ground at both zoom extremes.
- [ ] Run and idle animations are readable; foot contacts match movement without conspicuous sliding, and joints deform acceptably.
- [ ] Building edges, openings, roof, and wall treatment remain legible at the normal camera distance.
- [ ] Olive foliage reads as a tree canopy, with a convincing trunk and branches visible where appropriate.
- [ ] Water and shoreline meet cleanly, with no visible holes or distracting intersections.
- [ ] Light, shadows, and textures support the chosen painterly style without obscuring the Adventurer or flattening the scene.
- [ ] Camera motion, zoom, and any scenery fading preserve stable silhouettes and comfortable visibility.

### Movement and interface

- [x] Clicking reachable ground moves the Adventurer to the selected place.
- [ ] A click across the limestone building takes a route around it; neither click movement nor WASD passes through its physical boundary.
- [ ] Unreachable destinations produce clear feedback and do not strand the Adventurer.
- [ ] WASD provides predictable movement; releasing the keys stops movement, and losing focus does not leave a key held.
- [ ] The camera tracks the Adventurer at the center of the view throughout movement, preserving its viewing direction and elevation angle rather than remaining fixed over the map.
- [ ] Scrolling and the settings slider zoom around the Adventurer with consistent limits; no free panning or unexpected rotation changes the framing.
- [x] Return to start places the Adventurer safely at the sample entry point.
- [ ] Settings controls can be operated with the keyboard; moving focus through them does not move the Adventurer.
- [ ] Settings pause world movement and animation as intended; closing them leaves the Adventurer idle until a new command.
- [ ] Hiding and returning to the tab causes no movement catch-up or surprising resumed command.
- [ ] Fullscreen works where the browser permits it, and leaving fullscreen restores the layout.
- [ ] The minimap position follows the Adventurer and does not contradict the visible world.
- [ ] Controls, text, and settings remain readable at a narrow viewport of at least 480 pixels wide.
- [ ] The sample does not alter the existing game's save or imply that later gameplay systems are already available.

### Quality and performance

- [ ] Each preset produces the intended visual changes while preserving navigation boundaries and essential visibility.
- [x] A manual quality selection survives reloading the sample.
- [ ] Inspect both zoom extremes after the scene and shaders have warmed up; note frame rates, stalls, and visible artifacts with the exact device and viewport conditions.
- [ ] Treat 30 FPS on Low and 60 FPS where hardware permits as targets to test. One current-device observation does not establish ordinary-laptop performance.
- [ ] Note any unmet target or untested hardware explicitly before broader production.

### Editable source and review outcome

- [x] Blender source, original textures, original animation source, and export instructions are present and identify the sample assets they produce.
- [ ] Inspect the exported scene against the editable source for lost materials, incorrect transforms, and missing animations.
- [ ] Record defects and the user's art feedback separately from checks that passed.
- [ ] Obtain the user's review of the actual playable sample before expanding into the complete Aenon-to-Jordan area.

## User feedback

- The user rejected the initial walking gait, describing the animation as weird.
- The user requested a running animation when moving instead of walking. Default locomotion should read as a run or jog, with movement speed and animation timing tuned together.
- The corrected running gait is loaded in the playable preview and awaits the user’s follow-up review. This feedback does not constitute approval of the animation or the complete art sample.
- The user clarified that a fixed camera means it is locked to the player, referencing Albion's player-following view. The requested behavior is player-centered tracking with a constant viewing direction and elevation, zoom around the Adventurer, and no free panning. The clarified camera behavior remains pending playable review.

## Results

October 11, 2026, local working tree at `http://127.0.0.1:5180/art-sample.html`, Codex in-app browser (Chromium 155), Apple M5 Pro / 48 GB. Viewport 996 × 853 CSS pixels, device pixel ratio 2. High renders at 1494 × 1279; Low at 711 × 609. Warm scene observations were approximately 120 FPS on both presets, with transient drops during setting changes. This is a short current-device observation, not a sustained benchmark or ordinary-laptop acceptance.

- All 388 repository tests passed, including 8 obstacle/river navigation tests and 2 player-camera regression tests. Typecheck and the initial production build passed. The production build reports large JavaScript chunks; download/bundle optimization remains a future consideration.
- The actual browser loaded all three original GLBs, displayed the riverbank, and played the original Idle and initial movement clips. Click movement reached its destination; WASD moved after closing settings, and release returned to Idle. Settings froze the sample clock; closing left the Adventurer idle. Low/High changed resolution and decorative grass/shadows, and the manual choice persisted across reloads. Slider endpoints 10 and 24 were exercised.
- Blender 4.5.14 LTS is installed in `~/Applications/Blender.app`. The application signature and installer checksum were verified. Editable sources and embedded original materials were exported successfully. Blender emitted NumPy floating-point warnings on finite identity-transform inputs; binary accessor scans found no NaN/Inf, and the exported skin/animation data loaded in the browser.
- Initial browser checks exposed and corrected terrain normal winding, keyboard focus after panels/fullscreen, stationary collision animation, and reed merge attribute mismatches. The initial gait was rejected by the user and replaced with an original Run clip. It is now loaded and observed in motion in the in-app browser; final user animation acceptance remains open.
- Hidden-tab behavior, fullscreen, narrow layouts, all-preset comparisons, and lower-powered hardware remain to be verified. Combat, gathering, story interactions, and save migration are outside this sample.

### Running revision

The original `Run` clip replaces `Walk`: a two-thirds-second loop at playback ratio 1, matched to 3.2 m/s movement. It uses coordinated support/swing phases, forward-bending knees, level support feet, a slight forward torso lean, and bent elbows with arm counter-swing. The runtime reduces cadence when collision sliding reduces actual movement.

A separate exported-animation audit checked 200 interpolated poses: support feet remain planted at authored frame samples, swing clearance is about 16 cm, worst short ground penetration is about 5 mm, and the first and last poses match. The exported GLB contains one skin, Idle/Run clips with 54 channels each, and finite numeric accessors. The actual in-app browser confirmed Run while moving and Idle at rest. These checks support the correction; they do not substitute for the user's judgment of how the run feels.

Final `npm test` (388 passing), `npm run typecheck`, and `npm run build` passed after this revision. The build retains its large-chunk warning.

### Player-locked camera correction

The user clarified that the camera must stay centered on the Adventurer. The previous ArcRotateCamera target setter rebuilt its angle and radius while retaining the camera position. `lockCameraToPlayer` now translates the camera with the character and preserves its angle and distance; zoom remains centered on the character's body. Regression tests check large horizontal/elevation moves and viewport-center projection at zoom 10, 14, and 24. Browser readback confirmed a constant heading, tilt, and radius after movement and zoom, with the character centered. The updated preview is open for user review.

The glTF material's explicit opaque mode also needed clearing so mesh visibility can fade obstructing scenery. Further visual review of occlusion remains on the checklist.
