# How much a meal restores

A meal restores a share of the Hitpoints skill. A higher rarity restores a larger share than the rarity below it. Two foods of the same rarity restore the same share. Cooking level gates the recipe and leaves that share unchanged, so a meal restores the same whoever cooked it. Where the fish was caught, and which hearth cooked it, leave the share unchanged. The spec sets no fractions. A shortfall still spends the whole meal, and the pool still stops at the skill, as recorded in `docs/adr/0010-when-a-meal-can-be-eaten.md`. The fish's rarity is the meal's rarity, as recorded in `docs/adr/0006-how-crafting-reaches-legendary.md`.

Food has no level band. Cooking recipes are gated by Cooking level at any hearth, and the settlement's band does not order them, as recorded in `docs/adr/0007-what-a-skill-level-gates.md`. The five rarities are the meal's only grade, so the share stays in proportion as the Hitpoints skill grows from 1 to 60. A label that left the restore untouched would have spent a legendary fish for the same refill as a common one. A separate restore on each food would have given the settlement entries a second ladder beside the fish's rarity. Putting Cooking level on the finished meal would have made a traded meal depend on who cooked it. A flat amount would have been sized for one pool and wrong for the others, from the Jordan to the lake. Letting the place change the restore would have put a level band on fish.

## Considered options

- Rarity as a label that leaves the restore unchanged.
- A separate restore on each food.
- Cooking level changing the restore.
- A flat amount.
- The place the fish was caught, or the hearth, changing the restore.
