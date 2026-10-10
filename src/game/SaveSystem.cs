using System.Collections.Generic;
using Godot;

namespace RuneLike.Game
{
    /// <summary>JSON save/load to user://save.json. F5 = save, F9 = load.</summary>
    public partial class SaveSystem : Node
    {
        private const string SavePath = "user://save.json";

        public override void _UnhandledInput(InputEvent @event)
        {
            if (@event is InputEventKey key && key.Pressed && !key.Echo)
            {
                if (key.Keycode == Key.F5) Save();
                else if (key.Keycode == Key.F9) Load();
            }
        }

        public void Save()
        {
            var player = GameContext.Player;
            if (player == null) return;
            var xpDict = new Godot.Collections.Dictionary();
            foreach (var kv in player.Xp.ToDict()) xpDict[kv.Key] = kv.Value;
            var slots = new Godot.Collections.Array();
            foreach (var s in player.Inventory.Slots)
            {
                var d = new Godot.Collections.Dictionary();
                d["id"] = s.ItemId ?? "";
                d["count"] = s.Count;
                slots.Add(d);
            }
            var data = new Godot.Collections.Dictionary();
            data["x"] = player.GlobalPosition.X;
            data["y"] = player.GlobalPosition.Y;
            data["hp"] = player.CurrentHp;
            data["xp"] = xpDict;
            data["inventory"] = slots;
            using var file = FileAccess.Open(SavePath, FileAccess.ModeFlags.Write);
            if (file != null) file.StoreString(Json.Stringify(data, "\t"));
            GameContext.Hud?.Toast("Saved.");
        }

        public void Load()
        {
            var player = GameContext.Player;
            if (player == null || !FileAccess.FileExists(SavePath)) return;
            using var file = FileAccess.Open(SavePath, FileAccess.ModeFlags.Read);
            if (file == null) return;
            var parsed = Json.ParseString(file.GetAsText());
            if (parsed.VariantType != Variant.Type.Dictionary) return;
            var data = (Godot.Collections.Dictionary)parsed;
            player.GlobalPosition = new Vector2(data["x"].AsSingle(), data["y"].AsSingle());
            var xp = new Dictionary<string, int>();
            foreach (var k in ((Godot.Collections.Dictionary)data["xp"]).Keys)
                xp[k.AsString()] = (int)((Godot.Collections.Dictionary)data["xp"])[k].AsInt32();
            player.Xp.Load(xp);
            player.Inventory.Slots.Clear();
            foreach (var entry in (Godot.Collections.Array)data["inventory"])
            {
                var d = (Godot.Collections.Dictionary)entry;
                var id = d["id"].AsString();
                player.Inventory.Slots.Add(new Items.Inventory.Slot
                {
                    ItemId = string.IsNullOrEmpty(id) ? null : id,
                    Count = (int)d["count"].AsInt32(),
                });
            }
            player.HealFull();
            GameContext.Hud?.Toast("Loaded.");
        }
    }
}
