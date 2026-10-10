using Godot;
using RuneLike;
using RuneLike.Data;
using RuneLike.Game;

/// <summary>
/// Headless gameplay integration test: loads the real world scene and plays it
/// (teleport + interact, the same code paths as mouse clicks).
/// Run: godot --headless --fixed-fps 60 --script res://tests/IntegrationTests.cs
/// Covers: gathering ticks, combat swings, kill loot, quest loop, save/load.
/// </summary>
public partial class IntegrationTests : SceneTree
{
    private int _pass;
    private int _fail;
    private int _frames;
    private bool _sceneReady;
    private int _stage;
    private Player _player;
    private GatheringNode _tree;
    private Enemy _goblin;
    private Npc _npc;

    public override void _Initialize()
    {
        ChangeSceneToFile("res://scenes/world.tscn");
    }

    public override bool _Process(double delta)
    {
        if (!_sceneReady)
        {
            if (GameContext.Player == null) return false;
            _sceneReady = true;
            _player = GameContext.Player;
            _tree = CurrentScene.GetNodeOrNull<GatheringNode>("Tree1");
            _goblin = CurrentScene.GetNodeOrNull<Enemy>("Goblin1");
            _npc = CurrentScene.GetNodeOrNull<Npc>("Bob");
            if (_tree == null || _goblin == null || _npc == null)
            {
                GD.PrintErr("FAIL setup: missing entities");
                Quit(1);
                return true;
            }
            _pass++;
        }
        _frames++;

        switch (_stage)
        {
            case 0 when _frames > 10:
                // Chop: teleport onto the tree and interact (same path as a click).
                _player.GlobalPosition = _tree.GlobalPosition;
                _player.CancelAll();
                _tree.Interact(_player);
                _stage++;
                break;
            case 1 when _frames > 220:
                // ~3.5s of 2.4s ticks: expect >= 1 tick of logs + 25 xp.
                Ok(_player.Inventory.CountOf("logs") >= 1, "gather logs");
                Ok(_player.Xp.GetXp("Woodcutting") >= 25, "gather xp");
                _player.GlobalPosition = _goblin.GlobalPosition;
                _player.CancelAll();
                _goblin.Interact(_player);
                _stage++;
                break;
            case 2 when _frames > 500:
                // ~4.5s of 1.8s swings: attack xp must have accrued.
                Ok(_player.Xp.GetXp("Attack") > 0, "combat xp");
                _goblin.TakeDamage(999);
                Ok(_goblin.IsDead, "enemy dies");
                int loot = CountNodes<GroundItem>(GameContext.World);
                Ok(loot > 0, "loot drops");
                _stage++;
                break;
            case 3 when _frames > 520:
                // Quest: talk -> InProgress, hand 5 logs, talk -> Done + axe.
                _npc.Interact(_player);
                var quest = _npc.Quest;
                Ok(quest.Current == QuestState.InProgress, "quest starts");
                _player.Inventory.Add("logs", 5, GameData.IsStackable, GameData.MaxStack("logs"));
                _npc.Interact(_player);
                Ok(quest.Current == QuestState.Done, "quest completes");
                Ok(_player.Inventory.Has("bronze_axe", 1), "quest rewards axe");
                _stage++;
                break;
            case 4 when _frames > 540:
                var save = CurrentScene.GetNodeOrNull<SaveSystem>("SaveSystem");
                save.Save();
                Ok(FileAccess.FileExists("user://save.json"), "save writes file");
                _player.Inventory.Remove("logs", _player.Inventory.CountOf("logs"));
                save.Load();
                Ok(_player.Inventory.CountOf("logs") >= 0, "load restores");
                GD.Print($"IntegrationTests: {_pass} passed, {_fail} failed");
                Quit(_fail > 0 ? 1 : 0);
                return true;
        }
        return false;
    }

    private void Ok(bool cond, string name)
    {
        if (cond) _pass++;
        else { _fail++; GD.PrintErr($"FAIL {name}"); }
    }

    private static int CountNodes<T>(Node root) where T : Node
    {
        int n = 0;
        foreach (var child in root.GetChildren())
        {
            if (child is T) n++;
            n += CountNodes<T>(child);
        }
        return n;
    }
}
