# What a legendary meal adds

A legendary meal restores the largest share of the Hitpoints skill and grants one meal buff: added Defence or a faster walk. A common, uncommon, rare, or epic meal only restores its share. Two meals of the same rarity still restore the same share, and two legendary meals may carry different meal buffs. Which food carries which meal buff is named with that food. Added Defence is a temporary amount the fight reads on top of the Defence skill and the armor. Eating leaves the Defence skill and the Adventurer level where they are, as recorded in `docs/adr/0010-when-a-meal-can-be-eaten.md`. A faster walk changes movement only. Attack, Strength, and the Hitpoints skill stay the Adventurer level. The spec names these two meal buffs and sets no amounts. A second hit, a stun, a burn, and a heal stay special effects on a legendary piece, as recorded in `docs/adr/0005-how-a-fight-uses-gear.md`. How much the rarity restores is recorded in `docs/adr/0012-how-much-a-meal-restores.md`.

One meal buff holds at a time. It starts at the bite. The settlement the Adventurer is already standing in does not clear it. It ends when they next enter a settlement, when they wake there after a defeat, or when they eat another legendary meal, which replaces it. A lesser meal leaves it in place. A fight underway or a playing set scene still keeps the meal uneaten.

A legendary meal that only restored a larger share would have left the orange fish doing the same kind of thing as an epic meal. Calling the meal buff a special effect would have put a second hit, a stun, a burn, or a heal on food, which already belong to legendary gear. Raising Attack, Strength, Defence, or Hitpoints by eating would have moved the Adventurer level. A meal buff on every rarity would have added a second ladder beside the restore share. Holding two meal buffs at once, or holding one through the next settlement, would have let a single orange meal cover the map.

## Considered options

- A legendary meal that only restores a larger share.
- A meal buff that is a second hit, a stun, a burn, or a heal.
- A meal that raises Attack, Strength, Defence, or Hitpoints.
- A meal buff on every rarity.
- Two meal buffs at once.
- A meal buff that holds through the next settlement.
