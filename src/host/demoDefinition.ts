import {
  runeScapeSkillCurve,
  worldOfWarcraftAdventurerCurve,
  type ExperienceCurves,
  type SeasonDefinition,
} from "../season/index.ts"

/**
 * Trained skills use the Old School RuneScape table: level 1 is 0 experience,
 * and level 2 is 83, so one action is not a level. Adventurer level uses the
 * vanilla World of Warcraft table and starts at 1: level 2 is 400 experience,
 * and level 60 is 4,084,700.
 *
 * Early grants follow those games. A normal tree is 25 Woodcutting experience.
 * A level-1 kill is 50 Adventurer experience. The smaller grant stays below a defeat.
 */
export const demoCurves: ExperienceCurves = {
  adventurer: worldOfWarcraftAdventurerCurve,
  trained: runeScapeSkillCurve,
}

/**
 * Minimal playable Season for the browser MVP: Aenon (settlement, low band)
 * and the Jordan (wilderness, low band), with one gathering spot, one
 * hostile, one scripture object, John, and one vendor.
 *
 * The passage panel is a stub: it shows the reference and a placeholder
 * until the Node App Key server + YouVersion React SDK panel land.
 */
export const demoDefinition: SeasonDefinition = {
  places: [
    { id: "aenon", kind: "settlement", band: "low" },
    { id: "jordan", kind: "wilderness", band: "low" },
  ],
  smallerGrant: 10,
  defeatLoss: 2,
  hostiles: [
    {
      id: "wolf",
      kind: "animal",
      placeId: "jordan",
      hitpoints: 4,
      defeatGrant: 50,
      huntingExperience: 25,
    },
  ],
  scriptureObjects: [{ id: "reeds", placeId: "aenon", reference: "John 1:29", scriptureExperience: 25 }],
  packSize: 8,
  spots: [
    {
      id: "timber-stand",
      skill: "Woodcutting",
      requiredLevel: 1,
      placeId: "aenon",
      good: { kind: "material", id: "wood" },
      count: 1,
      skillExperience: 25,
    },
  ],
  people: [
    { id: "john", placeId: "aenon", kind: "biblical-figure", figure: "john" },
    { id: "merchant", placeId: "aenon", kind: "ordinary", vendor: true },
  ],
  vendors: [
    {
      personId: "merchant",
      stock: [{ kind: "everyday", id: "rope", price: 3 }],
      prices: [{ kind: "everyday", id: "rope", price: 1 }],
    },
  ],
  goods: [{ kind: "everyday", id: "rope" }],
}
