using Godot;

namespace RuneLike.Game
{
    /// <summary>
    /// Anything the player can click to walk-to-and-use:
    /// gathering nodes, enemies, ground items, NPCs.
    /// </summary>
    public interface IInteractable
    {
        Vector2 InteractPosition { get; }
        float InteractRange { get; }
        string DisplayName { get; }
        bool CanInteract();
        void Interact(Player player);
    }
}
