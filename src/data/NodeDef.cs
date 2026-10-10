using Godot;

namespace RuneLike.Skills
{
    public partial class NodeDef : Resource
    {
        [Export] public string Id = "tree";
        [Export] public string DisplayName = "Tree";
        [Export] public string Skill = PlayerSkills.Woodcutting;
        [Export] public int LevelReq = 1;
        [Export] public string ToolItemId = "bronze_axe";
        [Export] public string YieldItemId = "logs";
        [Export] public int YieldMin = 1;
        [Export] public int YieldMax = 1;
        [Export] public int XpPerTick = 25;
        [Export] public float TickSeconds = 2.4f;
        [Export(PropertyHint.Range, "0,1")] public float DepleteChance = 0.2f;
        [Export] public float RespawnSeconds = 15f;
    }

    public static class PlayerSkills
    {
        public const string Hitpoints = "Hitpoints";
        public const string Attack = "Attack";
        public const string Strength = "Strength";
        public const string Defence = "Defence";
        public const string Woodcutting = "Woodcutting";
        public const string Mining = "Mining";
        public const string Fishing = "Fishing";
    }
}
