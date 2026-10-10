using System;
using System.Collections.Generic;

namespace RuneLike.Items
{
    /// <summary>
    /// Pure-C# 28-slot inventory. No engine dependencies.
    /// Stackable items merge; non-stackables take one slot each.
    /// </summary>
    public class Inventory
    {
        public const int DefaultSize = 28;

        public class Slot
        {
            public string ItemId;
            public int Count;
            public bool IsEmpty => string.IsNullOrEmpty(ItemId) || Count <= 0;
        }

        public List<Slot> Slots = new List<Slot>();
        public event Action Changed;

        public Inventory(int size = DefaultSize)
        {
            for (int i = 0; i < size; i++) Slots.Add(new Slot());
        }

        public int CountOf(string itemId)
        {
            int total = 0;
            foreach (var s in Slots)
                if (!s.IsEmpty && s.ItemId == itemId) total += s.Count;
            return total;
        }

        public bool Has(string itemId, int count)
            => CountOf(itemId) >= count;

        public bool Add(string itemId, int count, Func<string, bool> isStackable, int maxStack = 999)
        {
            if (count <= 0) return true;
            if (isStackable(itemId))
            {
                foreach (var s in Slots)
                {
                    if (s.ItemId == itemId && s.Count < maxStack)
                    {
                        int take = Math.Min(maxStack - s.Count, count);
                        s.Count += take;
                        count -= take;
                        if (count == 0) { Changed?.Invoke(); return true; }
                    }
                }
                foreach (var s in Slots)
                {
                    if (s.IsEmpty)
                    {
                        int take = Math.Min(maxStack, count);
                        s.ItemId = itemId;
                        s.Count = take;
                        count -= take;
                        if (count == 0) { Changed?.Invoke(); return true; }
                    }
                }
                Changed?.Invoke();
                return count == 0;
            }
            else
            {
                foreach (var s in Slots)
                {
                    if (count == 0) break;
                    if (s.IsEmpty)
                    {
                        s.ItemId = itemId;
                        s.Count = 1;
                        count--;
                    }
                }
                Changed?.Invoke();
                return count == 0;
            }
        }

        public bool Remove(string itemId, int count)
        {
            if (CountOf(itemId) < count) return false;
            foreach (var s in Slots)
            {
                if (count == 0) break;
                if (!s.IsEmpty && s.ItemId == itemId)
                {
                    int take = Math.Min(s.Count, count);
                    s.Count -= take;
                    count -= take;
                    if (s.Count == 0) s.ItemId = null;
                }
            }
            Changed?.Invoke();
            return true;
        }

        public int FreeSlots()
        {
            int n = 0;
            foreach (var s in Slots) if (s.IsEmpty) n++;
            return n;
        }
    }
}
