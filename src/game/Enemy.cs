using System;
using Godot;
using RuneLike.Combat;
using RuneLike.Data;
using RuneLike.Skills;

namespace RuneLike.Game
{
    /// <summary>
    /// Clickable enemy: aggro/leash, 1.8s attack ticks, dies -&gt; drops loot -&gt; respawns.
    /// </summary>
    public partial class Enemy : Area2D, IInteractable
    {
        public EnemyDef Def { get; set; }

        public string DisplayName => Def != null ? Def.DisplayName : Name;
        public Vector2 InteractPosition => GlobalPosition;
        public float InteractRange => 90f;
        public bool IsDead => _dead;
        public int Hp => _hp;
        public int MaxHp => Def != null ? Def.MaxHp : 10;

        public event Action<Enemy> Died;
        public event Action<int, int> HpChanged;

        private int _hp;
        private Vector2 _home;
        private float _attackTimer;
        private bool _dead;
        private float _respawnTimer;
        private readonly Random _rng = new Random();

        public override void _Ready()
        {
            _home = GlobalPosition;
            if (Def != null) _hp = Def.MaxHp;
        }

        public override void _PhysicsProcess(double delta)
        {
            if (Def == null) return;
            if (_dead)
            {
                _respawnTimer -= (float)delta;
                if (_respawnTimer <= 0f) Respawn();
                return;
            }

            var player = GameContext.Player;
            if (player == null) return;
            float dist = GlobalPosition.DistanceTo(player.GlobalPosition);
            if (GlobalPosition.DistanceTo(_home) > Def.LeashRange) return; // leashed: hold ground

            if (dist <= InteractRange + 12f)
            {
                _attackTimer -= (float)delta;
                if (_attackTimer <= 0f)
                {
                    _attackTimer = Def.AttackCooldown;
                    AttackPlayer(player);
                }
            }
            else if (dist <= Def.AggroRange * World.CellPx)
            {
                GlobalPosition = GlobalPosition.MoveToward(player.GlobalPosition, 150f * (float)delta);
            }
        }

        public bool CanInteract() => !_dead;
        public void Interact(Player player)
        {
            var combat = player.GetNodeOrNull<PlayerCombat>("PlayerCombat");
            combat?.Attack(this);
        }

        public void TakeDamage(int amount)
        {
            if (_dead) return;
            _hp = Math.Max(0, _hp - Math.Max(0, amount));
            HpChanged?.Invoke(_hp, MaxHp);
            GameContext.World?.SpawnDamageSplat(GlobalPosition + new Vector2(0, -30), amount);
            if (_hp == 0) Die();
        }

        private void AttackPlayer(Player player)
        {
            int def = player.GetLevel(PlayerSkills.Defence);
            double chance = CombatMath.HitChance(Def.AttackBonus, def);
            int max = CombatMath.MaxHit(5, Def.StrengthBonus);
            int dmg = CombatMath.RollDamage(_rng, max, chance);
            player.TakeDamage(dmg);
            GameContext.World?.SpawnDamageSplat(player.GlobalPosition + new Vector2(0, -30), dmg);
        }

        private void Die()
        {
            _dead = true;
            _respawnTimer = Def.RespawnSeconds;
            Died?.Invoke(this);
            DropLoot();
            Hide();
            SetPhysicsProcess(false);
            var shape = GetNodeOrNull<CollisionShape2D>("CollisionShape2D");
            if (shape != null) shape.SetDeferred("disabled", true);
        }

        private void Respawn()
        {
            _dead = false;
            _hp = Def.MaxHp;
            GlobalPosition = _home;
            HpChanged?.Invoke(_hp, MaxHp);
            Show();
            SetPhysicsProcess(true);
            var shape = GetNodeOrNull<CollisionShape2D>("CollisionShape2D");
            if (shape != null) shape.SetDeferred("disabled", false);
        }

        private void DropLoot()
        {
            if (Def.Drops == null || GameContext.World == null) return;
            foreach (var drop in Def.Drops)
            {
                if (_rng.NextDouble() > drop.Chance) continue;
                int count = _rng.Next(drop.Min, drop.Max + 1);
                var pos = GlobalPosition + new Vector2(_rng.Next(-30, 30), _rng.Next(-30, 30));
                GameContext.World.SpawnGroundItem(drop.ItemId, count, pos);
            }
        }
    }
}
