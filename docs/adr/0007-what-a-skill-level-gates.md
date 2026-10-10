# What a skill level gates

Doing one of Woodcutting, Mining, Fishing, Herbalism, Harvesting, Hunting, Scripture, Blacksmithing, Tailoring, Leatherworking, or Cooking raises that skill. Attack, Strength, Defence, and Hitpoints are the Adventurer level, recorded in `docs/adr/0009-combat-skills-are-the-adventurer-level.md`. A gathering spot refuses the gather below its skill level. A recipe is available once the skill reaches that recipe's level, and the station will not make it below that. Gear recipes and gathering spots in a higher level band demand a higher skill level than those in a lower band. Cooking is gated by Cooking level, at any hearth, and the settlement's band does not order those recipes. The spec sets no requirement numbers and no experience amounts between levels. Settlement and wilderness entries choose the spot and recipe levels. A fight is not gated: any hostile can be attacked, Hunting follows a win with no second check, and a first reading needs no Scripture level. Those ten skills cap at 99. Hitpoints caps at 60 with Adventurer level.

Adventurer level is not a skill. It caps at 60. The level bands are successive spans: low is 1–20, middle is 21–40, and high is 41–60. Settlements that share a band share that span. Once quests are offered at the previous ceiling. Low-band quests are offered from 1 and stop at 20. Middle-band quests are offered from 20 and raise the level from 20 through 40. High-band quests are offered from 40 and raise it from 40 through 60. They raise Adventurer level only through their span. At a ceiling, further once quests in that band still finish and may still pay skill experience, coin, and gear. A defeat raises Adventurer level only inside that place's span, and so does the smaller grant from a gather, a hunt, a gear recipe, or a meal. A first Scripture reading pays that smaller grant at any level. Repeatable quests pay no Adventurer experience. The Adventurer may fight and gather in a higher band before its once quests are offered. This narrows the rule that a quest may require an Adventurer level: a higher band's once quests wait for the previous ceiling.

Gating which hostiles can be fought would have locked the wilderness behind a second check, when Attack, Strength, Defence, and Hitpoints already decide the fight. A soft gate, or recipes available at any level, would have left the skill with nothing to refuse. One shared cap would have forced the three bands and the fourteen skills onto the same ladder. Taking a higher-band once quest early, banking its experience, or letting it jump the Adventurer into its span would have let the lake fill levels the Jordan had not finished. The seed's experience table stays a prototype curve.

## Considered options

- A skill level that also refuses a fight.
- Gathering spots gated, and every recipe available at its station.
- A soft gate: the work may be tried, and often fails.
- One cap of 99 on Adventurer level and on every skill.
- Skills capped at 60, on the same spans as Adventurer level.
- Skills capped at 99, with spot and recipe requirements on the 20-level spans.
- No skill cap fixed in the spec.
- Higher-band once quests taken early, with experience applying only inside the span.
- Higher-band once quests taken early, with experience kept until the span.
- A higher-band once quest that raises the Adventurer straight into its span.
