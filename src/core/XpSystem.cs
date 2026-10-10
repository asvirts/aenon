using System;
using System.Collections.Generic;

namespace RuneLike.Skills
{
    /// <summary>
    /// Pure-C# XP ledger: skill name -&gt; xp. Level derived from XpTable.
    /// Fires LevelUp(skill, newLevel) so UI/toasts can react.
    /// </summary>
    public class XpSystem
    {
        private readonly Dictionary<string, int> _xp = new Dictionary<string, int>();
        public event Action<string, int> LevelUp;

        public int GetXp(string skill)
            => _xp.TryGetValue(skill, out var v) ? v : 0;

        public int GetLevel(string skill)
            => XpTable.GetLevelForXp(GetXp(skill));

        /// <summary>Returns levels gained (0+).</summary>
        public int AddXp(string skill, int amount)
        {
            if (amount <= 0) return 0;
            int before = GetLevel(skill);
            int total = Math.Min(XpTable.MaxXp, GetXp(skill) + amount);
            _xp[skill] = total;
            int after = GetLevel(skill);
            if (after > before)
            {
                LevelUp?.Invoke(skill, after);
                return after - before;
            }
            return 0;
        }

        public Dictionary<string, int> ToDict() => new Dictionary<string, int>(_xp);

        public void Load(Dictionary<string, int> data)
        {
            _xp.Clear();
            if (data == null) return;
            foreach (var kv in data) _xp[kv.Key] = Math.Max(0, kv.Value);
        }
    }
}
