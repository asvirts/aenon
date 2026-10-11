# When a meal can be eaten

Food refills current Hitpoints, the pool bounded by the Hitpoints skill, and eating leaves Adventurer level where it is. The Adventurer eats from what they carry, in a settlement or in the wilderness. Any rarity eats at the same moment. How much each rarity restores is recorded in `docs/adr/0012-how-much-a-meal-restores.md`. The hearth is where the meal is made. While no fight is active and the pool is short, the next meal may follow at once. A shortfall spends the meal, and the pool stops at the skill. A full pool keeps the meal. Engaged or pursuing hostiles keep food unavailable until every threat falls or disengages, or the Adventurer wakes in the last settlement; pausing the fight does not lift this restriction. A set scene that is playing also keeps the meal. A scripture reading alone does not make eating unavailable, but its panel pauses timed gameplay. An eating command follows the action-cancellation rules in [ADR 0020](0020-combat-boundaries-pause-and-recovery.md). Raw fish, raw meat, and herbs restore nothing. Making the meal still pays the smaller Adventurer grant inside the place's span, recorded in `docs/adr/0009-combat-skills-are-the-adventurer-level.md`.

Food remains recovery outside combat; the heal on a legendary piece remains a combat effect. A wait between meals would carry a combat delay into peacetime. Spending a meal on a full pool would destroy food for no refill, while holding it until the whole restore fits would leave a shortfall unfilled. Letting food heal during a paused fight would bypass the combat restriction, and limiting eating to a hearth would take it off the road where the pool falls. The real-time redesign supersedes the earlier promise that ongoing walking, gathering, or Hunting continues through an eating command.

## Considered options

- Eating during a fight.
- A legendary meal eaten during a fight, and a lesser meal kept for the road.
- A wait between meals.
- Keeping the meal unless the whole restore fits in the pool.
- Spending the meal when the pool is already full.
- Raw meat or herbs restoring current Hitpoints.
- Eating only at a hearth.
- Eating stops the gather.
- A playing set scene allowing the meal.
- A scripture reading keeping the meal back.
