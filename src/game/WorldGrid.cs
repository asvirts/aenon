using Godot;

namespace RuneLike.Game
{
    /// <summary>
    /// Walkable grid + A* pathfinding (Godot's built-in AStarGrid2D).
    /// Wired by World at startup. All coordinates are world-space.
    /// </summary>
    public partial class WorldGrid : Node
    {
        public Vector2I MapSize = new Vector2I(40, 30);
        public float Cell = 48f;
        public Vector2 Origin { get; private set; } // top-left world pos

        private AStarGrid2D _astar;

        public void Setup(Vector2 origin)
        {
            Origin = origin;
            _astar = new AStarGrid2D();
            _astar.Region = new Rect2I(Vector2I.Zero, MapSize);
            _astar.CellSize = new Vector2(Cell, Cell);
            _astar.Offset = origin;
            _astar.DiagonalMode = AStarGrid2D.DiagonalModeEnum.Never; // 4-dir, like the RS feel
            _astar.Update();
        }

        public void SetSolid(Vector2I cell, bool solid)
        {
            if (IsInBounds(cell)) _astar.SetPointSolid(cell, solid);
        }

        public bool IsInBounds(Vector2I cell)
            => cell.X >= 0 && cell.Y >= 0 && cell.X < MapSize.X && cell.Y < MapSize.Y;

        public bool IsWalkable(Vector2I cell)
            => IsInBounds(cell) && !_astar.IsPointSolid(cell);

        public Vector2I WorldToCell(Vector2 world)
        {
            var local = (world - Origin - _astar.CellSize * 0.5f) / Cell;
            return new Vector2I(Mathf.FloorToInt(local.X), Mathf.FloorToInt(local.Y));
        }

        public Vector2 CellToWorld(Vector2I cell)
            => Origin + (new Vector2(cell.X, cell.Y) + new Vector2(0.5f, 0.5f)) * Cell;

        public Vector2[] FindPath(Vector2 fromWorld, Vector2 toWorld)
        {
            var from = WorldToCell(fromWorld);
            var to = WorldToCell(toWorld);
            if (!IsInBounds(from) || !IsInBounds(to)) return new Vector2[0];
            if (!_astar.IsPointSolid(to))
                return _astar.GetPointPath(from, to);
            // Clicked a wall: fall back to nearest walkable neighbor.
            var neighbors = new[]
            {
                to + Vector2I.Right, to + Vector2I.Left,
                to + Vector2I.Down, to + Vector2I.Up,
            };
            foreach (var n in neighbors)
                if (IsWalkable(n)) return _astar.GetPointPath(from, n);
            return new Vector2[0];
        }

        public Rect2 Bounds => new Rect2(Origin, new Vector2(MapSize.X, MapSize.Y) * Cell);
    }
}
