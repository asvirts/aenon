import type { ExperienceCurve, SeasonDefinition } from "../season/index.ts"

/**
 * One experience per level: experience N reads as Adventurer level N + 1.
 * Matches the shape the season behavior tests use.
 */
export const demoCurve: ExperienceCurve = (experience) => experience + 1

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
  smallerGrant: 1,
  defeatLoss: 2,
  hostiles: [
    {
      id: "wolf",
      kind: "animal",
      placeId: "jordan",
      hitpoints: 4,
      defeatGrant: 4,
      huntingExperience: 1,
    },
  ],
  scriptureObjects: [{ id: "reeds", placeId: "aenon", reference: "John 1:29", scriptureExperience: 1 }],
  packSize: 8,
  spots: [
    {
      id: "timber-stand",
      skill: "Woodcutting",
      requiredLevel: 1,
      placeId: "aenon",
      good: { kind: "material", id: "wood" },
      count: 1,
      skillExperience: 1,
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
