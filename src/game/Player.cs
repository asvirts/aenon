using System;
using System.Collections.Generic;
using Godot;
using RuneLike.Items;
using RuneLike.Skills;

namespace RuneLike.Game
{
    /// <summary>
    /// Click-to-move player: left-click ground = move, left-click IInteractable =
    /// walk-then-interact, right-click = cancel. Holds HP, XP and inventory.
    /// </summary>
    public partial class Player : CharacterBody2D
    {
        [Export] public float Speed = 240f;
        [Export] public float ArriveDistance = 6f;

        public XpSystem Xp { get; private set; } = new XpSystem();
        public Inventory Inventory { get; private set; }

        public int MaxHp => 10 + Math.Max(1, Xp.GetLevel(PlayerSkills.Hitpoints)) * 2;
        public int CurrentHp { get; private set; }

        public event Action<int, int> HpChanged; // (current, max)
        public event Action<string, int> LeveledUp;

        private readonly List<Vector2> _path = new List<Vector2>();
        private IInteractable _pending;
        private PlayerCombat _combat;
        private bool _dead;

        public bool IsMoving => _path.Count > 0;

        public override void _Ready()
        {
            Inventory = new Inventory(Inventory.DefaultSize);
            Xp.LevelUp += (skill, lvl) => LeveledUp?.Invoke(skill, lvl);
            CurrentHp = MaxHp;
            _combat = GetNodeOrNull<PlayerCombat>("PlayerCombat");
        }

        public int GetLevel(string skill) => Math.Max(1, Xp.GetLevel(skill));
        public void AddXp(string skill, int amount) => Xp.AddXp(skill, amount);

        public void HealFull()
        {
            CurrentHp = MaxHp;
            _dead = false;
            HpChanged?.Invoke(CurrentHp, MaxHp);
        }

        public void Heal(int amount)
        {
            CurrentHp = Math.Min(MaxHp, CurrentHp + Math.Max(0, amount));
            HpChanged?.Invoke(CurrentHp, MaxHp);
        }

        public void TakeDamage(int amount)
        {
            if (_dead) return;
            CurrentHp = Math.Max(0, CurrentHp - Math.Max(0, amount));
            HpChanged?.Invoke(CurrentHp, MaxHp);
            if (CurrentHp == 0)
            {
                _dead = true;
                CancelAll();
                (GetParent() as Node)?.EmitSignal("PlayerDied");
            }
        }

        public override void _UnhandledInput(InputEvent @event)
        {
            if (_dead) return;
            if (@event is InputEventMouseButton mb && mb.Pressed)
            {
                if (mb.ButtonIndex == MouseButton.Left) HandleLeftClick(GetGlobalMousePosition());
                else if (mb.ButtonIndex == MouseButton.Right) CancelAll();
            }
        }

        private void HandleLeftClick(Vector2 world)
        {
            var hit = PickInteractable(world);
            if (hit != null && hit.CanInteract())
            {
                _pending = hit;
                SetPathTo(hit.InteractPosition);
                return;
            }
            _pending = null;
            _combat?.Cancel();
            SetPathTo(world);
        }

        private IInteractable PickInteractable(Vector2 world)
        {
            var space = GetWorld2D().DirectSpaceState;
            var query = new PhysicsPointQueryParameters2D();
            query.Position = world;
            query.CollideWithAreas = true;
            query.CollideWithBodies = false;
            var hits = space.IntersectPoint(query);
            foreach (var d in hits)
            {
                var collider = (GodotObject)d["collider"];
                if (collider is Node node)
                {
                    var interact = FindInteractable(node);
                    if (interact != null) return interact;
                }
            }
            return null;
        }

        private static IInteractable FindInteractable(Node node)
        {
            if (node is IInteractable direct) return direct;
            foreach (var child in node.GetChildren())
                if (child is IInteractable c) return c;
            if (node.GetParent() is IInteractable parent) return parent;
            return null;
        }

        public void SetPathTo(Vector2 world)
        {
            _path.Clear();
            if (GameContext.Grid != null)
            {
                var pts = GameContext.Grid.FindPath(GlobalPosition, world);
                if (pts.Length > 0) { _path.AddRange(pts); return; }
            }
            _path.Add(world); // fallback: straight line
        }

        public void CancelAll()
        {
            _path.Clear();
            _pending = null;
            _combat?.Cancel();
        }

        public override void _PhysicsProcess(double delta)
        {
            if (_dead)
            {
                Velocity = Vector2.Zero;
                return;
            }
            if (_path.Count == 0)
            {
                Velocity = Vector2.Zero;
                MoveAndSlide();
                return;
            }
            Vector2 target = _path[0];
            Vector2 to = target - GlobalPosition;
            float step = Speed * (float)delta;
            if (to.Length() <= Math.Max(ArriveDistance, step))
            {
                GlobalPosition = target;
                _path.RemoveAt(0);
            }
            else
            {
                Velocity = to.Normalized() * Speed;
                MoveAndSlide();
            }

            if (_pending != null)
            {
                if (GlobalPosition.DistanceTo(_pending.InteractPosition) <= _pending.InteractRange)
                {
                    var it = _pending;
                    _pending = null;
                    _path.Clear();
                    Velocity = Vector2.Zero;
                    if (it.CanInteract()) it.Interact(this);
                }
            }
        }
    }
}
