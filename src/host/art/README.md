# The Season art direction

The browser host uses original procedural illustrations: grounded adult figures, olive and sage vegetation, pale limestone, weathered timber, linen, and terracotta. The reference direction combines the readable rural detail of [Stardew Valley](https://www.stardewvalley.net/press/) with the dimensional, material-led environments of [Albion Online](https://albiononline.com/presskit). No game assets are copied.

- `terrain.ts` bakes continuous vegetation washes, paths, riverbanks, and plaza texture into one static ground image. Keep the logical 2:1 projection in sync with the host.
- `sprites.ts` paints people, animals, and vegetation at four times logical texture resolution. `BIPED_ART_LAYOUT` defines adult limb pivots; biped soles sit 18 local units below the torso center, so the host offsets the visual rig upward by 18.
- `structures.ts` paints dimensional props and houses with the same resolution convention. `addHouse` is anchored at the ground. Its depth must reflect the actual projected base, including any screen offset.
- `../ui.ts` keeps location, messages, minimap, character, and journal outside the world camera. `interfaceCovers` prevents HUD clicks from moving the adventurer.

Texture source pixels are high resolution while frame dimensions stay logical (`source.resolution` plus `frame.setTrim`). Keep smooth sampling enabled. Tree, pine, and palm origins are near the foot of their trunks; walkers move in logical coordinates and project only at `setPosition`. Display labels must never replace rules IDs such as `timber-stand`.

Verification: `npm test`, `npm run typecheck`, `npm run build`, then inspect movement, C/J panels, gathering, and world depth in the Codex in-app browser. Existing rules and browser-save format are unchanged by the art system.
