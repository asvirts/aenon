# Original gameplay assets

`scripts/art/build_gameplay.py` authors The Season's gameplay characters in Blender
4.5. It builds on the game's own original Adventurer source; no external models,
rigs, textures, or animation packs are used. The approved sample source is read
without modification, preserving its original Idle and Run actions.

```sh
blender --background --python scripts/art/build_gameplay.py
```

Append `-- --asset adventurer`, `wolf`, `john`, `merchant`, or `bandit` to rebuild
one asset. Outputs are under `public/game-assets/`. Character variants and wolf
also retain editable `.blend` sources under `art/source/`. The new player action
clips are reproducible from this script and the unchanged `adventurer.blend`.

All assets use meters, ground origins, Blender Z up and −Y forward. Their glTF
exports use +Y up and +Z forward. Navigation owns world movement. Play in-place
Run at the authored speed ratio; do not translate the skeleton to move the actor.

The Adventurer keeps `Idle` (2 s) and `Run` (2/3 s, 3.2 m/s at ratio 1), and gains
`Attack` (0.8 s), `Gather` (1.2 s), `Guard` (1 s), and `Hit` (0.4 s). Attack, Gather,
and Hit return toward neutral; Guard is a held, breathing defense pose intended
for a loop and runtime blending. Weapon/tool attachments belong on `Hand.R`;
shield attachments belong on `Hand.L`. Motion timing is presentation only:
the game rules determine when a strike, gather cycle, or cooldown takes effect.

| Export | Original modeled identity | Clips |
| --- | --- | --- |
| `adventurer.glb` | Approved linen-clad Adventurer | Idle, Run, Attack, Gather, Guard, Hit |
| `wolf.glb` | Grey-brown coat, layered ruff, tapered muzzle, articulated jaw, pointed ears, paws and brush tail | Idle, Run, Attack, Hit, Death |
| `john.glb` | Long camel-hair robe, long hair, modeled beard with silver-brown strands | Idle, Run |
| `merchant.glb` | Teal linen, terracotta shawl, ochre trim, wrapped linen headcloth | Idle, Run |
| `bandit.glb` | Rough olive cloth, open brown hood, short ragged cloak | Idle, Run, Attack, Gather, Guard, Hit, Death |

The wolf uses `WolfRig` with Spine, Neck, Head, Jaw, two tail bones, and Upper,
Lower, and Paw bones for FL/FR/HL/HR legs. Its diagonal Run loop is **0.6 seconds
at 3.0 m/s**; use playback ratio `speed / 3.0`. Each paw is stationary in world
space during its authored supporting interval when matched to that speed.
Wolf Attack is 0.7 seconds, Hit is 0.4 seconds, and Death is 1.1 seconds. Death
ends collapsed and must play once and hold its final pose; it is not a loop.
The bandit's separate original Death clip also lasts 1.1 seconds.

Held swords, maces, shields, axes, picks, sickles, fishing rods, and hunting knives
are original runtime geometry in `src/game3d/world.ts`. Their palm attachments
derive from the character's inverse bind matrices; they are not part of these
character GLBs. The current worn weapon kind and shield slot control their visible
variants, while gathering temporarily displays the relevant tool.

John and the vendor are intended to stand in Idle for the current authored
encounters. John's robe is skinned geometry rather than simulated cloth; a future
moving robe performance needs a separate visual review. The names `john` and
`merchant` are runtime asset filenames; the domain terms remain Biblical figure
and Vendor. Generated assets depict those roles without supplying dialogue or
changing gameplay rules.

Every export is checked for finite binary float data. Export success and a named
clip do not replace live review of skinning, motion, silhouettes, and transitions.

## Regional runtime art

`src/game3d/world.ts` and `src/game3d/terrain.ts` also author original geometry and
materials directly for this game. These editable TypeScript sources supply
regional house additions (porticos, basalt facing, roof tiles, ladders, cisterns,
linen screens, and garden details), resource props, work stations, shoreline docks,
river causeways, and the boat hull, benches, and oars used during boat journeys.
Inland fishing markers have small stone-lined irrigation pools with reeds and
ripples; these are modeled scenery beside the approach marker, not terrain-cut
basins or a simulated water system.

The regional terrain uses independently culled 32-meter chunks, an original
painted grit texture, vertex-color road and village pigments, and original water
shaders. Grass and stones are generated as nearby chunks first become visible.
This is a rendering strategy, not evidence of any measured frame-rate target.
Terrain, roads, and water heights remain separate from the rules for travel and
interaction.

The renderer loads each GLB into a reusable asset container. Static houses and
olive trees share source geometry through instances; animated characters clone
their model hierarchy and skeleton so their poses remain independent. Materials
are shared where appropriate, with separate copies for the Adventurer and
characters whose attire is recolored. The regional appearances reuse this game's
original modeled assets; they do not import an external art pack.

A single reusable ensemble represents Jesus and the 15 traveling companions at
the current scene or acquaintance anchor. Muted tunic and cloak colors and modest
scale differences distinguish the figures. Other Jesus scene-marker models stay
hidden, so they do not create simultaneous copies. A separate pool of four
original villager variants represents episode-only standing roles while that
specific scene is playing. Group entries such as “Four friends,” “Wedding
servants,” or a crowd use one representative figure per authored standing entry;
they are not full modeled crowds. These appearances add no dialogue or quests.

Worn head, body, leg, and foot Gear changes material colors, cloth/leather/metal
response, and fitted cover geometry attached to the original rig. The armor
pieces and weapon variants share authored geometry; the 255-item Gear catalog
does **not** have 255 individually modeled outfits. The implementation preserves
the source character skeleton and motion clips and does not add cloth simulation.
These source descriptions do not establish browser visual acceptance, device
compatibility, or measured performance.
