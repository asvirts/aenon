using Godot;
using RuneLike.Data;

namespace RuneLike.Game
{
    /// <summary>Dropped loot on the ground. Click to pick up into inventory.</summary>
    public partial class GroundItem : Area2D, IInteractable
    {
        public string ItemId;
        public int Count = 1;

        public string DisplayName => GameData.GetItem(ItemId)?.DisplayName ?? ItemId;
        public Vector2 InteractPosition => GlobalPosition;
        public float InteractRange => 80f;

        public bool CanInteract() => !string.IsNullOrEmpty(ItemId) && Count > 0;

        public void Interact(Player player)
        {
            if (player == null) return;
            bool ok = player.Inventory.Add(ItemId, Count, GameData.IsStackable, GameData.MaxStack(ItemId));
            if (ok)
            {
                GameContext.Hud?.Toast($"Picked up {Count}x {DisplayName}.");
                QueueFree();
            }
            else GameContext.Hud?.Toast("Inventory full.");
        }
    }
}
