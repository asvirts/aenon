using System.Collections.Generic;
using RuneLike.Combat;
using RuneLike.Items;
using RuneLike.Skills;

namespace RuneLike.Data
{
    /// <summary>
    /// Canonical catalog: every item/enemy/node id referenced by code.
    /// Built in code so the headless build needs no .tres authoring.
    /// </summary>
    public static class GameData
    {
        public static Dictionary<string, ItemDef> Items { get; private set; }
        public static Dictionary<string, EnemyDef> Enemies { get; private set; }
        public static Dictionary<string, NodeDef> Nodes { get; private set; }

        static GameData() => Build();

        public static void Build()
        {
            Items = new Dictionary<string, ItemDef>
            {
                ["logs"] = new ItemDef { Id = "logs", DisplayName = "Logs", Type = ItemType.Material, Stackable = true },
                ["copper_ore"] = new ItemDef { Id = "copper_ore", DisplayName = "Copper ore", Type = ItemType.Material, Stackable = true },
                ["raw_fish"] = new ItemDef { Id = "raw_fish", DisplayName = "Raw fish", Type = ItemType.Material, Stackable = true },
                ["cooked_fish"] = new ItemDef { Id = "cooked_fish", DisplayName = "Cooked fish", Type = ItemType.Consumable, Stackable = true, HealAmount = 3 },
                ["coins"] = new ItemDef { Id = "coins", DisplayName = "Coins", Type = ItemType.Material, Stackable = true },
                ["bronze_axe"] = new ItemDef { Id = "bronze_axe", DisplayName = "Bronze axe", Type = ItemType.Tool, Stackable = false },
                ["bronze_pickaxe"] = new ItemDef { Id = "bronze_pickaxe", DisplayName = "Bronze pickaxe", Type = ItemType.Tool, Stackable = false },
                ["fishing_rod"] = new ItemDef { Id = "fishing_rod", DisplayName = "Fishing rod", Type = ItemType.Tool, Stackable = false },
                ["bronze_sword"] = new ItemDef { Id = "bronze_sword", DisplayName = "Bronze sword", Type = ItemType.Weapon, Stackable = false, AttackBonus = 2, StrengthBonus = 3 },
            };

            LootEntry Drop(string id, int min, int max, float chance)
                => new LootEntry { ItemId = id, Min = min, Max = max, Chance = chance };

            var goblinDrops = new Godot.Collections.Array<LootEntry> { Drop("coins", 1, 5, 1f) };
            var wolfDrops = new Godot.Collections.Array<LootEntry>
            {
                Drop("raw_fish", 1, 2, 0.6f),
                Drop("coins", 2, 8, 1f),
            };

            Enemies = new Dictionary<string, EnemyDef>
            {
                ["goblin"] = new EnemyDef { Id = "goblin", DisplayName = "Goblin", MaxHp = 10, AttackBonus = 3, StrengthBonus = 2, DefenceBonus = 2, AttackCooldown = 1.8f, AggroRange = 5f, LeashRange = 12f, RespawnSeconds = 10f, AttackXp = 12, HpXp = 8, Drops = goblinDrops },
                ["wolf"] = new EnemyDef { Id = "wolf", DisplayName = "Wolf", MaxHp = 20, AttackBonus = 6, StrengthBonus = 4, DefenceBonus = 4, AttackCooldown = 1.8f, AggroRange = 6f, LeashRange = 14f, RespawnSeconds = 15f, AttackXp = 20, HpXp = 12, Drops = wolfDrops },
            };

            Nodes = new Dictionary<string, NodeDef>
            {
                ["tree"] = new NodeDef { Id = "tree", DisplayName = "Tree", Skill = PlayerSkills.Woodcutting, ToolItemId = "bronze_axe", YieldItemId = "logs", XpPerTick = 25, TickSeconds = 2.4f, DepleteChance = 0.2f, RespawnSeconds = 15f },
                ["rock"] = new NodeDef { Id = "rock", DisplayName = "Copper rock", Skill = PlayerSkills.Mining, ToolItemId = "bronze_pickaxe", YieldItemId = "copper_ore", XpPerTick = 30, TickSeconds = 2.8f, DepleteChance = 0.25f, RespawnSeconds = 18f },
                ["spot"] = new NodeDef { Id = "spot", DisplayName = "Fishing spot", Skill = PlayerSkills.Fishing, ToolItemId = "fishing_rod", YieldItemId = "raw_fish", XpPerTick = 20, TickSeconds = 2.0f, DepleteChance = 0.15f, RespawnSeconds = 12f },
            };
        }

        public static ItemDef GetItem(string id)
            => Items.TryGetValue(id, out var d) ? d : null;

        public static bool IsStackable(string id)
        {
            var d = GetItem(id);
            return d == null || d.Stackable;
        }

        public static int MaxStack(string id)
        {
            var d = GetItem(id);
            return d != null ? d.MaxStack : 999;
        }
    }
}
