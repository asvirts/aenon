using Godot;
using RuneLike.Combat;
using RuneLike.Data;
using RuneLike.Skills;

namespace RuneLike.Game
{
    /// <summary>
    /// Player attack driver: click enemy -&gt; swing on 1.8s cooldown until it dies
    /// or the player walks away. Grants Attack/Strength/Hitpoints XP.
    /// </summary>
    public partial class PlayerCombat : Node
    {
        [Export] public float AttackRange = 90f;
        [Export] public float AttackCooldown = 1.8f;

        public string WeaponItemId; // equipped weapon id (MVP: single slot)

        private Enemy _current;
        private float _timer;
        private Player _player;
        private readonly System.Random _rng = new System.Random();

        public override void _Ready() => _player = GetParent<Player>();

        public void Attack(Enemy enemy)
        {
            if (enemy == null || enemy.IsDead) return;
            _current = enemy;
            _timer = 0f;
        }

        public void Cancel() => _current = null;

        public void EquipWeapon(string itemId) => WeaponItemId = itemId;

        public override void _PhysicsProcess(double delta)
        {
            if (_current == null || _current.IsDead) { _current = null; return; }
            if (_player.GlobalPosition.DistanceTo(_current.GlobalPosition) > AttackRange + 30f)
            {
                _current = null;
                return;
            }
            _timer -= (float)delta;
            if (_timer <= 0f)
            {
                _timer = AttackCooldown;
                Swing();
            }
        }

        private void Swing()
        {
            if (_current == null) return;
            int atk = _player.GetLevel(PlayerSkills.Attack);
            int str = _player.GetLevel(PlayerSkills.Strength);
            int weaponStr = 0;
            if (!string.IsNullOrEmpty(WeaponItemId))
            {
                var w = GameData.GetItem(WeaponItemId);
                if (w != null) { weaponStr = w.StrengthBonus; atk += w.AttackBonus; }
            }
            double chance = CombatMath.HitChance(atk + 5, _current.MaxHp / 2);
            int max = CombatMath.MaxHit(str, weaponStr);
            int dmg = CombatMath.RollDamage(_rng, max, chance);
            _current.TakeDamage(dmg);
            _player.AddXp(PlayerSkills.Attack, dmg > 0 ? 4 : 1);
            _player.AddXp(PlayerSkills.Strength, dmg > 0 ? 4 : 1);
            _player.AddXp(PlayerSkills.Hitpoints, dmg > 0 ? 3 : 1);
        }
    }
}
