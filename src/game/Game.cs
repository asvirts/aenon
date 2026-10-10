using RuneLike.Game;

namespace RuneLike
{
    /// <summary>
    /// Cross-scene refs wired by World at startup. Pragmatic static context
    /// (avoids autoload ordering issues in headless runs).
    /// Named GameContext (not Game) to avoid colliding with the RuneLike.Game namespace.
    /// </summary>
    public static class GameContext
    {
        public static Player Player { get; set; }
        public static Hud Hud { get; set; }
        public static WorldGrid Grid { get; set; }
        public static World World { get; set; }
    }
}
