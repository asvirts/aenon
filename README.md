# runescape-like-godot

2D top-down single-player RuneScape-like in **Godot 4 + C#** (ported from the Unity prototype — same design, XP math, item IDs, and quest).

No license, no activation, no accounts. Godot is MIT open-source.

## Run (GUI)
1. Install Godot 4.x **.NET build** (`Godot_mono`) + .NET SDK 8+.
2. Open this folder in Godot, let it build the solution.
3. Press **Play** (main scene: `scenes/world.tscn`).
   - Left-click: move / interact (chop, mine, fish, fight, loot, talk)
   - Right-click: cancel. F5: save. F9: load.

## Verify (headless CLI)
```sh
export DOTNET_ROOT="/opt/homebrew/opt/dotnet/libexec"
Godot --headless --editor --quit            # import + generate solution
Godot --headless --build-solutions --quit   # compile C#
Godot --headless --script res://tests/LogicTests.cs   # logic tests
Godot --headless res://scenes/world.tscn --quit-after 600  # scene smoke run
```

## Layout
- `src/core/` — pure logic, no engine deps: XpTable, XpSystem, Inventory, CombatMath
- `src/data/` — ItemDef / EnemyDef / NodeDef resources + GameData catalog
- `src/game/` — Player, combat, enemies, gathering, NPC/quest, HUD, save, World bootstrap
- `scenes/world.tscn` — one-node scene; World.cs builds everything in code
- `tests/LogicTests.cs` — headless SceneTree test runner
