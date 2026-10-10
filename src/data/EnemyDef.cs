using Godot;

namespace RuneLike.Combat
{
    public partial class LootEntry : Resource
    {
        [Export] public string ItemId = "coins";
        [Export] public int Min = 1;
        [Export] public int Max = 1;
        [Export(PropertyHint.Range, "0,1")] public float Chance = 1f;
    }

    public partial class EnemyDef : Resource
    {
        [Export] public string Id = "goblin";
        [Export] public string DisplayName = "Goblin";
        [Export] public int MaxHp = 10;
        [Export] public int AttackBonus = 3;
        [Export] public int StrengthBonus = 2;
        [Export] public int DefenceBonus = 2;
        [Export] public float AttackCooldown = 1.8f;
        [Export] public float AggroRange = 5f;
        [Export] public float LeashRange = 12f;
        [Export] public float RespawnSeconds = 10f;
        [Export] public int AttackXp = 12;
        [Export] public int HpXp = 8;
        [Export] public Godot.Collections.Array<LootEntry> Drops = new Godot.Collections.Array<LootEntry>();
    }
}
