using System;
using Godot;

namespace RuneLike.Game
{
    public enum QuestState { NotStarted, InProgress, ReadyToTurnIn, Done }

    /// <summary>
    /// Template fetch quest: talk to giver, bring N x item, return for reward XP + item.
    /// </summary>
    public partial class Quest : Node
    {
        [Export] public string QuestId = "first_axe";
        [Export] public string QuestName = "A Sharp Start";
        [Export] public string GiverName = "Bob";
        [Export] public string RequiredItemId = "logs";
        [Export] public int RequiredCount = 5;
        [Export] public string RewardItemId = "bronze_axe";
        [Export] public string RewardXpSkill = "Woodcutting";
        [Export] public int RewardXpAmount = 100;

        public QuestState Current { get; private set; } = QuestState.NotStarted;

        public string ProgressText => Current switch
        {
            QuestState.NotStarted => $"Talk to {GiverName} to start.",
            QuestState.InProgress => $"Bring {RequiredCount}x {RequiredItemId} to {GiverName}.",
            QuestState.ReadyToTurnIn => $"Return to {GiverName}.",
            QuestState.Done => "Complete!",
            _ => "",
        };

        public event Action<Quest> Changed;

        public void TalkTo(string npc, Player player)
        {
            if (npc != GiverName || player == null) return;
            switch (Current)
            {
                case QuestState.NotStarted:
                    Current = QuestState.InProgress;
                    GameContext.Hud?.Toast($"Quest started: {QuestName}");
                    Changed?.Invoke(this);
                    break;
                case QuestState.InProgress:
                case QuestState.ReadyToTurnIn:
                    if (player.Inventory.Has(RequiredItemId, RequiredCount))
                    {
                        player.Inventory.Remove(RequiredItemId, RequiredCount);
                        if (!string.IsNullOrEmpty(RewardItemId))
                            player.Inventory.Add(RewardItemId, 1, Data.GameData.IsStackable, Data.GameData.MaxStack(RewardItemId));
                        player.AddXp(RewardXpSkill, RewardXpAmount);
                        Current = QuestState.Done;
                        GameContext.Hud?.Toast($"Quest complete: {QuestName}!");
                        Changed?.Invoke(this);
                    }
                    else GameContext.Hud?.Toast(ProgressText);
                    break;
            }
        }

        public void RefreshTurnInFlag(Player player)
        {
            if (Current == QuestState.InProgress && player != null &&
                player.Inventory.Has(RequiredItemId, RequiredCount))
            {
                Current = QuestState.ReadyToTurnIn;
                Changed?.Invoke(this);
            }
        }
    }

    /// <summary>Clickable NPC with simple dialogue + quest hook.</summary>
    public partial class Npc : Area2D, IInteractable
    {
        [Export] public string NpcName = "Bob";
        [Export] public string[] Lines = new[]
        {
            "Hello, traveller! Chop me 5 logs and I'll give you a bronze axe.",
            "Trees are south and east. Click a tree to chop it.",
        };

        public Quest Quest { get; set; }

        public string DisplayName => NpcName;
        public Vector2 InteractPosition => GlobalPosition;
        public float InteractRange => 110f;

        public bool CanInteract() => true;

        public void Interact(Player player)
        {
            foreach (var line in Lines)
                GameContext.Hud?.ShowDialogue(NpcName, line);
            Quest?.TalkTo(NpcName, player);
            if (player != null) Quest?.RefreshTurnInFlag(player);
        }
    }
}
