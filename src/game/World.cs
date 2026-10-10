using Godot;
using RuneLike.Combat;
using RuneLike.Data;
using RuneLike.Items;
using RuneLike.Skills;

namespace RuneLike.Game
{
    /// <summary>
    /// Builds the entire MVP world in code: grid + walls, player + camera,
    /// HUD, gathering nodes, enemies, NPC + quest, save system.
    /// No .tscn authoring needed beyond the one-node world.tscn.
    /// </summary>
    public partial class World : Node2D
    {
        public const float CellPx = 48f;
        public static readonly Vector2I MapCells = new Vector2I(40, 30);

        [Signal]
        public delegate void PlayerDiedEventHandler();

        private Vector2 _spawn;
        private ImageTexture _texGrass;
        private ImageTexture _texWall;
        private ImageTexture _texPlayer;
        private ImageTexture _texTree;
        private ImageTexture _texRock;
        private ImageTexture _texWater;
        private ImageTexture _texGoblin;
        private ImageTexture _texNpc;
        private ImageTexture _texLoot;

        public override void _Ready()
        {
            GameContext.World = this;
            MakeTextures();

            var origin = new Vector2(-MapCells.X * CellPx / 2f, -MapCells.Y * CellPx / 2f);
            var grid = new WorldGrid();
            grid.MapSize = MapCells;
            grid.Cell = CellPx;
            AddChild(grid);
            grid.Setup(origin);
            GameContext.Grid = grid;

            BuildGroundVisuals(origin);
            BuildWalls(grid, origin);

            var player = BuildPlayer();
            AddChild(player);
            GameContext.Player = player;
            GrantStarterKit(player);
            _spawn = player.GlobalPosition;

            var hud = new Hud();
            AddChild(hud);
            GameContext.Hud = hud;

            var save = new SaveSystem();
            save.Name = "SaveSystem";
            AddChild(save);

            BuildNodes(grid);
            BuildEnemies(grid);
            BuildNpc(grid);

            Connect(SignalName.PlayerDied, Callable.From(OnPlayerDied));
            GD.Print("RuneLike: MVP world built. Click to move, chop, fight, talk to Bob.");
        }

        // ---------- textures ----------

        private static ImageTexture SolidTexture(Color color)
        {
            var img = Image.Create(32, 32, false, Image.Format.Rgba8);
            img.Fill(color);
            return ImageTexture.CreateFromImage(img);
        }

        private void MakeTextures()
        {
            _texGrass = SolidTexture(new Color(0.35f, 0.62f, 0.33f));
            _texWall = SolidTexture(new Color(0.45f, 0.42f, 0.38f));
            _texPlayer = SolidTexture(new Color(0.95f, 0.80f, 0.30f));
            _texTree = SolidTexture(new Color(0.15f, 0.45f, 0.20f));
            _texRock = SolidTexture(new Color(0.55f, 0.55f, 0.60f));
            _texWater = SolidTexture(new Color(0.25f, 0.50f, 0.85f));
            _texGoblin = SolidTexture(new Color(0.75f, 0.25f, 0.25f));
            _texNpc = SolidTexture(new Color(0.95f, 0.85f, 0.40f));
            _texLoot = SolidTexture(new Color(0.90f, 0.70f, 0.20f));
        }

        private static Sprite2D Sprite(ImageTexture tex, float scale = 1.5f)
            => new Sprite2D { Texture = tex, Scale = new Vector2(scale, scale) };

        // ---------- map ----------

        private void BuildGroundVisuals(Vector2 origin)
        {
            var ground = new ColorRect();
            ground.Color = new Color(0.32f, 0.58f, 0.30f);
            ground.Position = origin;
            ground.Size = new Vector2(MapCells.X, MapCells.Y) * CellPx;
            AddChild(ground);
        }

        private void BuildWalls(WorldGrid grid, Vector2 origin)
        {
            var bounds = grid.Bounds;
            var walls = new StaticBody2D();
            walls.Name = "Walls";
            AddChild(walls);

            void Segment(Vector2 center, Vector2 size)
            {
                var shape = new CollisionShape2D();
                shape.Shape = new RectangleShape2D { Size = size };
                shape.Position = center;
                walls.AddChild(shape);
                var rect = new ColorRect();
                rect.Color = new Color(0.42f, 0.39f, 0.35f);
                rect.Position = center - size / 2f;
                rect.Size = size;
                AddChild(rect);
            }

            float t = CellPx;
            float cx = origin.X + bounds.Size.X / 2f;
            float cy = origin.Y + bounds.Size.Y / 2f;
            Segment(new Vector2(cx, origin.Y - t / 2f), new Vector2(bounds.Size.X + 2 * t, t));
            Segment(new Vector2(cx, origin.Y + bounds.Size.Y + t / 2f), new Vector2(bounds.Size.X + 2 * t, t));
            Segment(new Vector2(origin.X - t / 2f, cy), new Vector2(t, bounds.Size.Y));
            Segment(new Vector2(origin.X + bounds.Size.X + t / 2f, cy), new Vector2(t, bounds.Size.Y));

            for (int x = 0; x < MapCells.X; x++)
                for (int y = 0; y < MapCells.Y; y++)
                {
                    if (x == 0 || y == 0 || x == MapCells.X - 1 || y == MapCells.Y - 1)
                        grid.SetSolid(new Vector2I(x, y), true);
                }
        }

        // ---------- entities ----------

        private Player BuildPlayer()
        {
            var player = new Player();
            player.Name = "Player";
            player.GlobalPosition = Vector2.Zero;

            var shape = new CollisionShape2D();
            shape.Shape = new CircleShape2D { Radius = 16f };
            player.AddChild(shape);

            var sprite = Sprite(_texPlayer);
            sprite.Name = "Sprite2D";
            player.AddChild(sprite);

            var combat = new PlayerCombat();
            combat.Name = "PlayerCombat";
            player.AddChild(combat);

            var cam = new Camera2D();
            // Enabled defaults to true: first camera in tree becomes current automatically.
            cam.PositionSmoothingEnabled = true;
            var bounds = GameContext.Grid.Bounds;
            cam.LimitLeft = (int)bounds.Position.X;
            cam.LimitTop = (int)bounds.Position.Y;
            cam.LimitRight = (int)(bounds.Position.X + bounds.Size.X);
            cam.LimitBottom = (int)(bounds.Position.Y + bounds.Size.Y);
            player.AddChild(cam);
            return player;
        }

        private static void GrantStarterKit(Player player)
        {
            string[] kit = { "bronze_axe", "bronze_pickaxe", "fishing_rod", "bronze_sword", "cooked_fish", "cooked_fish", "cooked_fish" };
            foreach (var id in kit)
            {
                if (GameData.GetItem(id) == null) continue;
                if (player.Inventory.Has(id, 1)) continue;
                player.Inventory.Add(id, 1, GameData.IsStackable, GameData.MaxStack(id));
            }
        }

        private void SpawnNode(string nodeName, Vector2I cell, NodeDef def, ImageTexture tex)
        {
            var node = new GatheringNode();
            node.Name = nodeName;
            node.GlobalPosition = GameContext.Grid.CellToWorld(cell);
            var sprite = Sprite(tex);
            sprite.Name = "Sprite2D";
            node.AddChild(sprite);
            var shape = new CollisionShape2D();
            shape.Shape = new RectangleShape2D { Size = new Vector2(36, 36) };
            node.AddChild(shape);
            node.Def = def;
            AddChild(node);
        }

        private void BuildNodes(WorldGrid grid)
        {
            var nodes = GameData.Nodes;
            SpawnNode("Tree1", new Vector2I(8, 10), nodes["tree"], _texTree);
            SpawnNode("Tree2", new Vector2I(6, 18), nodes["tree"], _texTree);
            SpawnNode("Tree3", new Vector2I(30, 8), nodes["tree"], _texTree);
            SpawnNode("Rock1", new Vector2I(26, 20), nodes["rock"], _texRock);
            SpawnNode("Rock2", new Vector2I(32, 16), nodes["rock"], _texRock);
            SpawnNode("FishSpot", new Vector2I(20, 6), nodes["spot"], _texWater);
        }

        private void SpawnEnemy(string nodeName, Vector2I cell, EnemyDef def)
        {
            var enemy = new Enemy();
            enemy.Name = nodeName;
            enemy.GlobalPosition = GameContext.Grid.CellToWorld(cell);
            var sprite = Sprite(_texGoblin);
            sprite.Name = "Sprite2D";
            enemy.AddChild(sprite);
            var shape = new CollisionShape2D();
            shape.Name = "CollisionShape2D";
            shape.Shape = new CircleShape2D { Radius = 20f };
            enemy.AddChild(shape);
            enemy.Def = def;
            AddChild(enemy);
        }

        private void BuildEnemies(WorldGrid grid)
        {
            var enemies = GameData.Enemies;
            SpawnEnemy("Goblin1", new Vector2I(24, 14), enemies["goblin"]);
            SpawnEnemy("Goblin2", new Vector2I(14, 20), enemies["goblin"]);
            SpawnEnemy("Wolf1", new Vector2I(30, 22), enemies["wolf"]);
        }

        private void BuildNpc(WorldGrid grid)
        {
            var npc = new Npc();
            npc.Name = "Bob";
            npc.GlobalPosition = grid.CellToWorld(new Vector2I(22, 16));
            npc.AddChild(Sprite(_texNpc));
            var shape = new CollisionShape2D();
            shape.Shape = new RectangleShape2D { Size = new Vector2(40, 40) };
            npc.AddChild(shape);
            var quest = new Quest();
            quest.Name = "Quest";
            npc.AddChild(quest);
            npc.Quest = quest;
            AddChild(npc);

            quest.Changed += q => GameContext.Hud?.SetQuestText($"{q.QuestName}: {q.ProgressText}");
            GameContext.Hud?.SetQuestText($"{quest.QuestName}: {quest.ProgressText}");
        }

        // ---------- runtime spawns ----------

        public void SpawnGroundItem(string itemId, int count, Vector2 pos)
        {
            var item = new GroundItem();
            item.ItemId = itemId;
            item.Count = count;
            item.GlobalPosition = pos;
            item.AddChild(Sprite(_texLoot, 1f));
            var shape = new CollisionShape2D();
            shape.Shape = new CircleShape2D { Radius = 14f };
            item.AddChild(shape);
            var label = new Label();
            label.Text = GameData.GetItem(itemId)?.DisplayName ?? itemId;
            label.Position = new Vector2(-40, -44);
            label.AddThemeFontSizeOverride("font_size", 12);
            item.AddChild(label);
            AddChild(item);
        }

        public void SpawnDamageSplat(Vector2 pos, int damage)
        {
            AddChild(DamageSplat.Create(damage, pos));
        }

        // ---------- death / respawn (keep-all MVP) ----------

        private void OnPlayerDied()
        {
            var player = GameContext.Player;
            if (player == null) return;
            GameContext.Hud?.Toast("You died! Respawning...");
            GetTree().CreateTimer(3.0).Timeout += () =>
            {
                if (GameContext.Player == null) return;
                GameContext.Player.GlobalPosition = _spawn;
                GameContext.Player.CancelAll();
                GameContext.Player.HealFull();
            };
        }
    }
}
