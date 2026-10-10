using System;
using Godot;
using RuneLike.Combat;
using RuneLike.Game;
using RuneLike.Items;
using RuneLike.Skills;

/// <summary>
/// Headless logic tests. Run: godot --headless --script res://tests/LogicTests.cs
/// Covers XpTable, XpSystem, Inventory, CombatMath, and AStarGrid2D pathfinding.
/// </summary>
public partial class LogicTests : SceneTree
{
    private int _pass;
    private int _fail;

    public override void _Initialize()
    {
        TestXpTable();
        TestXpSystem();
        TestInventory();
        TestCombatMath();
        TestPathfinding();
        GD.Print($"LogicTests: {_pass} passed, {_fail} failed");
        Quit(_fail > 0 ? 1 : 0);
    }

    private void Eq<T>(T got, T want, string name)
    {
        if (Equals(got, want)) _pass++;
        else { _fail++; GD.PrintErr($"FAIL {name}: got {got} want {want}"); }
    }

    private void Ok(bool cond, string name)
    {
        if (cond) _pass++;
        else { _fail++; GD.PrintErr($"FAIL {name}"); }
    }

    private void TestXpTable()
    {
        Eq(XpTable.GetXpForLevel(1), 0, "xp L1");
        Eq(XpTable.GetXpForLevel(2), 83, "xp L2");
        Eq(XpTable.GetXpForLevel(99), 13034431, "xp L99");
        Eq(XpTable.GetLevelForXp(0), 1, "lvl 0xp");
        Eq(XpTable.GetLevelForXp(82), 1, "lvl 82xp");
        Eq(XpTable.GetLevelForXp(83), 2, "lvl 83xp");
        Eq(XpTable.GetLevelForXp(200000000), 99, "lvl max");
    }

    private void TestXpSystem()
    {
        var xp = new XpSystem();
        string firedSkill = null;
        int firedLvl = 0;
        xp.LevelUp += (s, l) => { firedSkill = s; firedLvl = l; };
        xp.AddXp("Attack", 83);
        Eq(xp.GetLevel("Attack"), 2, "xpsys lvl");
        Eq(firedSkill, "Attack", "xpsys event skill");
        Eq(firedLvl, 2, "xpsys event lvl");
    }

    private static bool Stackable(string id) => id != "bronze_sword";

    private void TestInventory()
    {
        var inv = new Inventory(28);
        Ok(inv.Add("logs", 5, Stackable) && inv.Add("logs", 10, Stackable), "inv add");
        Eq(inv.CountOf("logs"), 15, "inv merge");

        inv = new Inventory(28);
        inv.Add("bronze_sword", 1, Stackable);
        inv.Add("bronze_sword", 1, Stackable);
        Eq(inv.FreeSlots(), 26, "inv nonstack slots");

        inv = new Inventory(28);
        inv.Add("logs", 10, Stackable);
        Ok(inv.Remove("logs", 4), "inv remove ok");
        Eq(inv.CountOf("logs"), 6, "inv remove count");

        inv = new Inventory(1);
        inv.Add("logs", 3, Stackable);
        Ok(!inv.Remove("logs", 5), "inv over-remove fails");

        inv = new Inventory(1);
        inv.Add("bronze_sword", 1, Stackable);
        Ok(!inv.Add("bronze_sword", 1, Stackable), "inv full rejects");
    }

    private void TestCombatMath()
    {
        Ok(CombatMath.HitChance(1, 9999) >= 0.05 && CombatMath.HitChance(9999, 1) <= 0.95, "chance clamp");
        Ok(CombatMath.HitChance(50, 10) > CombatMath.HitChance(10, 10), "chance grows with atk");
        Ok(CombatMath.MaxHit(40, 10) > CombatMath.MaxHit(1, 0), "maxhit grows");
        Eq(CombatMath.MaxHit(1, 0), 1, "maxhit base");
        var rng = new Random(42);
        for (int i = 0; i < 200; i++)
            if (CombatMath.RollDamage(rng, 8, 1.0) > 8) { Ok(false, "roll bound"); return; }
        _pass++;
    }

    private void TestPathfinding()
    {
        // Real AStarGrid2D, same config as WorldGrid (4-dir).
        var astar = new AStarGrid2D();
        astar.Region = new Rect2I(Vector2I.Zero, new Vector2I(5, 5));
        astar.CellSize = new Vector2(48, 48);
        astar.DiagonalMode = AStarGrid2D.DiagonalModeEnum.Never;
        astar.Update();

        var open = astar.GetPointPath(new Vector2I(0, 0), new Vector2I(4, 4));
        Ok(open.Length > 0, "path open");

        // Wall with a gap at (2,2).
        for (int y = 0; y < 5; y++)
            if (y != 2) astar.SetPointSolid(new Vector2I(2, y), true);
        var routed = astar.GetPointPath(new Vector2I(0, 0), new Vector2I(4, 4));
        Ok(routed.Length > 0, "path gap");

        // Sealed start: no path.
        var sealed_ = new AStarGrid2D();
        sealed_.Region = new Rect2I(Vector2I.Zero, new Vector2I(3, 3));
        sealed_.CellSize = new Vector2(48, 48);
        sealed_.DiagonalMode = AStarGrid2D.DiagonalModeEnum.Never;
        sealed_.Update();
        sealed_.SetPointSolid(new Vector2I(1, 0), true);
        sealed_.SetPointSolid(new Vector2I(0, 1), true);
        sealed_.SetPointSolid(new Vector2I(1, 1), true);
        Eq(sealed_.GetPointPath(new Vector2I(0, 0), new Vector2I(2, 2)).Length, 0, "path sealed");
    }
}
