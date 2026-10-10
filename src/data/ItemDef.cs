using Godot;

namespace RuneLike.Items
{
    public enum ItemType { Material, Tool, Weapon, Consumable, Quest }

    public partial class ItemDef : Resource
    {
        [Export] public string Id = "logs";
        [Export] public string DisplayName = "Logs";
        [Export] public ItemType Type = ItemType.Material;
        [Export] public bool Stackable = true;
        [Export] public int AttackBonus;
        [Export] public int StrengthBonus;
        [Export] public int HealAmount;
        [Export] public int MaxStack = 999;
        [Export] public string Description = "";
    }
}
