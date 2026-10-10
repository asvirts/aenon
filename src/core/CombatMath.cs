using System;

namespace RuneLike.Combat
{
    /// <summary>
    /// Pure-C# combat math. No engine dependencies.
    /// </summary>
    public static class CombatMath
    {
        public static double HitChance(int attackBonus, int defenceBonus)
        {
            int atk = Math.Max(1, attackBonus);
            int def = Math.Max(0, defenceBonus);
            double chance = (double)atk / (atk + def + 1);
            return Math.Min(0.95, Math.Max(0.05, chance));
        }

        public static int MaxHit(int strengthLevel, int weaponStrength)
        {
            int str = Math.Max(1, strengthLevel);
            return 1 + (str + Math.Max(0, weaponStrength)) / 8;
        }

        public static int RollDamage(Random rng, int maxHit, double hitChance)
        {
            if (rng.NextDouble() > hitChance) return 0;
            return rng.Next(0, maxHit + 1);
        }
    }
}
