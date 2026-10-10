using Godot;
using RuneLike.Data;
using RuneLike.Skills;

namespace RuneLike.Game
{
    /// <summary>
    /// Clickable resource node (tree / rock / fishing spot).
    /// Walk-to, then roll per tick: +item +XP until depleted, then respawns.
    /// One script covers Woodcutting/Mining/Fishing via NodeDef data.
    /// </summary>
    public partial class GatheringNode : Area2D, IInteractable
    {
        public NodeDef Def { get; set; }

        public string DisplayName => Def != null ? Def.DisplayName : Name;
        public Vector2 InteractPosition => GlobalPosition;
        public float InteractRange => 100f;

        private bool _depleted;
        private float _respawnTimer;
        private float _tickTimer;
        private bool _gathering;
        private Sprite2D _sprite;
        private readonly System.Random _rng = new System.Random();

        public override void _Ready() => _sprite = GetNodeOrNull<Sprite2D>("Sprite2D");

        public override void _Process(double delta)
        {
            if (_depleted)
            {
                _respawnTimer -= (float)delta;
                if (_respawnTimer <= 0f)
                {
                    _depleted = false;
                    if (_sprite != null) _sprite.Modulate = Colors.White;
                }
                return;
            }
            if (!_gathering || Def == null) return;

            var player = GameContext.Player;
            if (player == null || GlobalPosition.DistanceTo(player.GlobalPosition) > InteractRange + 40f)
            {
                _gathering = false;
                return;
            }

            _tickTimer -= (float)delta;
            if (_tickTimer <= 0f)
            {
                _tickTimer = Def.TickSeconds;
                DoTick(player);
            }
        }

        public bool CanInteract() => Def != null && !_depleted;

        public void Interact(Player player)
        {
            if (!CanInteract() || player == null) return;
            if (player.GetLevel(Def.Skill) < Def.LevelReq)
            {
                GameContext.Hud?.Toast($"Requires {Def.Skill} level {Def.LevelReq}.");
                return;
            }
            if (!string.IsNullOrEmpty(Def.ToolItemId) && !player.Inventory.Has(Def.ToolItemId, 1))
            {
                var tool = GameData.GetItem(Def.ToolItemId);
                GameContext.Hud?.Toast($"You need {(tool != null ? tool.DisplayName : Def.ToolItemId)}.");
                return;
            }
            _gathering = true;
            _tickTimer = Def.TickSeconds * 0.5f; // first tick feels snappy
        }

        public void StopGathering() => _gathering = false;

        private void DoTick(Player player)
        {
            int count = _rng.Next(Def.YieldMin, Def.YieldMax + 1);
            bool added = player.Inventory.Add(Def.YieldItemId, count, GameData.IsStackable, GameData.MaxStack(Def.YieldItemId));
            if (!added)
            {
                _gathering = false;
                GameContext.Hud?.Toast("Inventory full.");
                return;
            }
            player.AddXp(Def.Skill, Def.XpPerTick);
            if (_rng.NextDouble() < Def.DepleteChance)
            {
                _depleted = true;
                _gathering = false;
                _respawnTimer = Def.RespawnSeconds;
                if (_sprite != null) _sprite.Modulate = new Color(1, 1, 1, 0.35f);
            }
        }
    }
}
