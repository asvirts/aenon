# Aenon

A single-player game set in the Galilee and Jordan during one season of Jesus' ministry, about 27–29 AD. The Adventurer starts in Aenon.

## Host

TypeScript in the browser.

- Phaser draws the top-down pixel world. Movement is click-to-walk or WASD.
- A React page around that canvas uses the YouVersion React SDK to show an NIV passage and that version's copyright beside it.
- A small Node server holds the YouVersion App Key and is the only caller of the Platform.
- The save is the rules module's exported state in that browser.

The Season's rules are specified in [Season rules on the logic surface](https://github.com/asvirts/aenon/issues/15). The map of decisions is [Aenon region spec](https://github.com/asvirts/aenon/issues/1). Domain language is in `GLOSSARY.md`.

## Earlier seed

The tree still contains a Godot 4 + C# loop from before the host was chosen: click-to-move, gathering, combat, loot, and one fetch quest. New Season work belongs to the TypeScript host above. Godot is MIT open-source.

### Run (GUI)

1. Install Godot 4.x **.NET build** (`Godot_mono`) + .NET SDK 8+.
2. Open this folder in Godot, let it build the solution.
3. Press **Play** (main scene: `scenes/world.tscn`).
   - Left-click: move / interact (chop, mine, fish, fight, loot, talk)
   - Right-click: cancel. F5: save. F9: load.

### Verify (headless CLI)

```sh
export DOTNET_ROOT="/opt/homebrew/opt/dotnet/libexec"
Godot --headless --editor --quit            # import + generate solution
Godot --headless --build-solutions --quit   # compile C#
Godot --headless --script res://tests/LogicTests.cs   # logic tests
Godot --headless res://scenes/world.tscn --quit-after 600  # scene smoke run
```

### Layout

- `src/core/` — pure logic, no engine deps: XpTable, XpSystem, Inventory, CombatMath
- `src/data/` — ItemDef / EnemyDef / NodeDef resources + GameData catalog
- `src/game/` — Player, combat, enemies, gathering, NPC/quest, HUD, save, World bootstrap
- `scenes/world.tscn` — one-node scene; World.cs builds everything in code
- `tests/LogicTests.cs` — headless SceneTree test runner
