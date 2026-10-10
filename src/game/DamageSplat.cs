using Godot;

namespace RuneLike.Game
{
    /// <summary>Floating damage number: drifts up, fades, frees itself.</summary>
    public partial class DamageSplat : Label
    {
        private float _life = 0.9f;
        private float _age;

        public static DamageSplat Create(int damage, Vector2 pos)
        {
            var label = new DamageSplat();
            label.Text = damage.ToString();
            label.Position = pos + new Vector2(-10, -10);
            label.ZIndex = 50;
            label.AddThemeFontSizeOverride("font_size", 20);
            label.AddThemeColorOverride("font_color", damage > 0 ? Colors.Red : Colors.Gray);
            label.AddThemeColorOverride("font_shadow_color", Colors.Black);
            label.AddThemeConstantOverride("shadow_offset_x", 1);
            label.AddThemeConstantOverride("shadow_offset_y", 1);
            return label;
        }

        public override void _Process(double delta)
        {
            _age += (float)delta;
            Position += new Vector2(0, -50) * (float)delta;
            if (_age >= _life) QueueFree();
            else Modulate = new Color(1, 1, 1, 1f - _age / _life);
        }
    }
}
