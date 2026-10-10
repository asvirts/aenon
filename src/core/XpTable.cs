namespace RuneLike.Skills
{
    /// <summary>
    /// Pure-C# RuneScape XP table. No engine dependencies — unit-testable anywhere.
    /// Formula: XP(L) = floor(sum_{i=1}^{L-1} floor(i + 300 * 2^(i/7)) / 4).
    /// Level 2 = 83 XP, 99 = 13,034,431 XP. Cap XP at 200M like OSRS.
    /// </summary>
    public static class XpTable
    {
        public const int MaxLevel = 99;
        public const int MaxXp = 200_000_000;

        private static readonly int[] XpForLevel = BuildTable();

        private static int[] BuildTable()
        {
            var table = new int[MaxLevel + 2]; // 1-indexed; table[1] = 0
            double points = 0;
            for (int lvl = 1; lvl <= MaxLevel; lvl++)
            {
                table[lvl] = (int)points;
                points += System.Math.Floor(lvl + 300.0 * System.Math.Pow(2.0, lvl / 7.0)) / 4.0;
            }
            return table;
        }

        public static int GetXpForLevel(int level)
        {
            if (level <= 1) return 0;
            if (level > MaxLevel) level = MaxLevel;
            return XpForLevel[level];
        }

        public static int GetLevelForXp(int xp)
        {
            if (xp < 0) return 1;
            if (xp >= XpForLevel[MaxLevel]) return MaxLevel;
            for (int lvl = MaxLevel - 1; lvl >= 1; lvl--)
            {
                if (xp >= XpForLevel[lvl]) return lvl;
            }
            return 1;
        }
    }
}
