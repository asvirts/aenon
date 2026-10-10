using Godot;
using RuneLike.Data;
using RuneLike.Items;
using RuneLike.Skills;

namespace RuneLike.Game
{
    /// <summary>
    /// HUD: HP, skill levels, dialogue, toasts, quest tracker, 28-slot inventory.
    /// All controls built in code so the headless build needs no .tscn authoring.
    /// </summary>
    public partial class Hud : CanvasLayer
    {
        private Label _hpLabel;
        private Label _statsLabel;
        private Label _dialogueLabel;
        private Label _toastLabel;
        private Label _questLabel;
        private GridContainer _invGrid;
        private float _dialogueTimer;
        private float _toastTimer;
        private float _statsTimer;

        public override void _Ready()
        {
            var hp = MakeLabel("HP", 12, 12);
            _hpLabel = hp;
            _statsLabel = MakeLabel("stats", 12, 36);
            _toastLabel = MakeLabel("", 12, 60);
            _dialogueLabel = MakeLabel("", 12, 84);
            _dialogueLabel.Size = new Vector2(900, 60);
            _questLabel = MakeLabel("", 12, 150);

            _invGrid = new GridContainer();
            _invGrid.Columns = 4;
            _invGrid.SetAnchorsPreset(Control.LayoutPreset.BottomRight);
            _invGrid.Position = new Vector2(-660, -260);
            _invGrid.AddThemeConstantOverride("h_separation", 2);
            _invGrid.AddThemeConstantOverride("v_separation", 2);
            AddChild(_invGrid);

            var player = GameContext.Player;
            if (player != null)
            {
                player.HpChanged += (cur, max) => _hpLabel.Text = $"HP {cur}/{max}";
                player.LeveledUp += (skill, lvl) => Toast($"Level up! {skill} is now {lvl}.");
                player.Inventory.Changed += RebuildInventory;
                _hpLabel.Text = $"HP {player.CurrentHp}/{player.MaxHp}";
                RebuildInventory();
            }
        }

        private Label MakeLabel(string text, float x, float y)
        {
            var label = new Label();
            label.Text = text;
            label.Position = new Vector2(x, y);
            label.AddThemeFontSizeOverride("font_size", 16);
            label.AddThemeColorOverride("font_color", Colors.White);
            label.AddThemeColorOverride("font_shadow_color", Colors.Black);
            label.AddThemeConstantOverride("shadow_offset_x", 1);
            label.AddThemeConstantOverride("shadow_offset_y", 1);
            AddChild(label);
            return label;
        }

        public override void _Process(double delta)
        {
            if (_dialogueTimer > 0f)
            {
                _dialogueTimer -= (float)delta;
                if (_dialogueTimer <= 0f) _dialogueLabel.Text = "";
            }
            if (_toastTimer > 0f)
            {
                _toastTimer -= (float)delta;
                if (_toastTimer <= 0f) _toastLabel.Text = "";
            }
            _statsTimer -= (float)delta;
            if (_statsTimer <= 0f && GameContext.Player != null)
            {
                _statsTimer = 0.5f;
                var s = GameContext.Player;
                _statsLabel.Text = $"Atk {s.GetLevel(PlayerSkills.Attack)}  Str {s.GetLevel(PlayerSkills.Strength)}  " +
                    $"WC {s.GetLevel(PlayerSkills.Woodcutting)}  Mine {s.GetLevel(PlayerSkills.Mining)}  Fish {s.GetLevel(PlayerSkills.Fishing)}";
            }
        }

        public void ShowDialogue(string speaker, string text)
        {
            _dialogueLabel.Text = $"{speaker}: {text}";
            _dialogueTimer = 6f;
        }

        public void Toast(string msg, float seconds = 3f)
        {
            _toastLabel.Text = msg;
            _toastTimer = seconds;
        }

        public void SetQuestText(string text) => _questLabel.Text = text;

        public void RebuildInventory()
        {
            foreach (var c in _invGrid.GetChildren()) c.QueueFree();
            var player = GameContext.Player;
            if (player == null) return;
            var inv = player.Inventory;
            for (int i = 0; i < inv.Slots.Count; i++)
            {
                var slot = inv.Slots[i];
                var btn = new Button();
                btn.CustomMinimumSize = new Vector2(150, 28);
                if (!slot.IsEmpty)
                {
                    var def = GameData.GetItem(slot.ItemId);
                    btn.Text = $"{(def != null ? def.DisplayName : slot.ItemId)} x{slot.Count}";
                }
                else btn.Text = "-";
                int index = i;
                btn.Pressed += () => UseSlot(index);
                _invGrid.AddChild(btn);
            }
        }

        private void UseSlot(int index)
        {
            var player = GameContext.Player;
            if (player == null) return;
            var slot = player.Inventory.Slots[index];
            if (slot.IsEmpty) return;
            var def = GameData.GetItem(slot.ItemId);
            if (def == null) return;
            if (def.Type == ItemType.Consumable && def.HealAmount > 0)
            {
                if (player.Inventory.Remove(def.Id, 1)) player.Heal(def.HealAmount);
            }
            else if (def.Type == ItemType.Weapon)
            {
                player.GetNodeOrNull<PlayerCombat>("PlayerCombat")?.EquipWeapon(def.Id);
                Toast($"Equipped {def.DisplayName}.");
            }
        }
    }
}
