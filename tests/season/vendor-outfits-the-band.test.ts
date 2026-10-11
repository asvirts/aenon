import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loadSeason,
  type ExperienceCurve,
  type Gear,
  type LevelBand,
  type Rarity,
  type Fight,
  type PackEntry,
  type Season,
  type SeasonDefinition,
  type VendorPrice,
  type VendorStockLine,
} from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

describe("a vendor outfits the band", () => {
  it("buys an everyday supply at the supplied price", () => {
    const season = begin(market([{ kind: "everyday", id: "rope", price: 3 }]), { coin: 5 })
    const before = season.adventurer()

    assert.deepEqual(season.buy("merchant", { kind: "everyday", id: "rope" }), { ok: true })

    const after = season.adventurer()
    assert.equal(after.coin, 2)
    assert.deepEqual(after.pack, [{ kind: "everyday", id: "rope", count: 1 }])
    assert.equal(after.adventurerExperience, before.adventurerExperience)
    assert.equal(after.adventurerLevel, before.adventurerLevel)
    assert.equal(after.currentHitpoints, before.currentHitpoints)
    assert.equal(after.placeId, before.placeId)
    assert.deepEqual(after.worn, before.worn)
  })

  it("buys gear of the settlement's band at common, uncommon, and rare", () => {
    const common = sword("common", 1)
    const uncommon = sword("uncommon", 2)
    const rare = sword("rare", 3)
    const season = begin(
      market(
        [
          { kind: "gear", id: common.id, price: 4 },
          { kind: "gear", id: uncommon.id, price: 6 },
          { kind: "gear", id: rare.id, price: 8 },
        ],
        [common, uncommon, rare],
      ),
      { coin: 18 },
    )

    assert.deepEqual(season.buy("merchant", { kind: "gear", id: common.id }), { ok: true })
    assert.deepEqual(season.buy("merchant", { kind: "gear", id: uncommon.id }), { ok: true })
    assert.deepEqual(season.buy("merchant", { kind: "gear", id: rare.id }), { ok: true })

    assert.equal(season.adventurer().coin, 0)
    assert.deepEqual(season.adventurer().pack, [
      { kind: "gear", id: common.id },
      { kind: "gear", id: uncommon.id },
      { kind: "gear", id: rare.id },
    ])
  })

  it("fails to load epic gear on the stock", () => {
    const epic = sword("epic", 4)
    assert.deepEqual(loadSeason(market([{ kind: "gear", id: epic.id, price: 10 }], [epic]), onePointPerLevel), {
      ok: false,
      reason: "stock-above-rare",
    })
  })

  it("fails to load legendary gear on the stock", () => {
    const legendary = sword("legendary", 5)
    assert.deepEqual(
      loadSeason(market([{ kind: "gear", id: legendary.id, price: 20 }], [legendary]), onePointPerLevel),
      { ok: false, reason: "stock-above-rare" },
    )
  })

  it("fails to load a special find on the stock", () => {
    assert.deepEqual(
      loadSeason(market([{ kind: "special-find", band: "low", price: 15 }]), onePointPerLevel),
      { ok: false, reason: "special-find-on-stock" },
    )
  })

  it("refuses a purchase the Adventurer cannot afford and changes nothing", () => {
    const season = begin(market([{ kind: "everyday", id: "rope", price: 3 }]), { coin: 2 })
    const before = season.adventurer()
    assert.deepEqual(season.buy("merchant", { kind: "everyday", id: "rope" }), {
      ok: false,
      reason: "cannot-afford",
    })
    assert.deepEqual(season.adventurer(), before)
  })

  it("refuses a purchase the pack cannot hold and changes nothing", () => {
    const definition = market([{ kind: "everyday", id: "rope", price: 3 }])
    definition.packSize = 1
    const season = begin(definition, {
      coin: 5,
      pack: [{ kind: "gear", id: "low-common-sword" }],
    })
    const before = season.adventurer()
    assert.deepEqual(season.buy("merchant", { kind: "everyday", id: "rope" }), {
      ok: false,
      reason: "pack-full",
    })
    assert.deepEqual(season.adventurer(), before)
  })

  it("sells a carried legendary piece at the supplied price", () => {
    const legendary = sword("legendary", 5)
    const season = begin(
      market([], [legendary], [{ kind: "gear", id: legendary.id, price: 12 }]),
      { pack: [{ kind: "gear", id: legendary.id }] },
    )
    const before = season.adventurer()

    assert.deepEqual(season.sell("merchant", { kind: "gear", id: legendary.id }), { ok: true })

    const after = season.adventurer()
    assert.equal(after.coin, 12)
    assert.deepEqual(after.pack, [])
    assert.deepEqual(after.worn, before.worn)
    assert.equal(after.adventurerExperience, before.adventurerExperience)
    assert.equal(after.adventurerLevel, before.adventurerLevel)
    assert.equal(after.placeId, before.placeId)
  })

  it("sells worn gear only after it is taken off into the pack", () => {
    const legendary = sword("legendary", 5)
    const season = begin(
      market([], [legendary], [{ kind: "gear", id: legendary.id, price: 12 }]),
      { pack: [{ kind: "gear", id: legendary.id }] },
    )
    assert.deepEqual(season.wear(legendary.id), { ok: true })
    const worn = season.adventurer()

    assert.deepEqual(season.sell("merchant", { kind: "gear", id: legendary.id }), {
      ok: false,
      reason: "not-present",
    })
    assert.deepEqual(season.adventurer(), worn)
    assert.equal(worn.worn.weapon, legendary.id)
    assert.deepEqual(worn.pack, [])

    assert.deepEqual(season.takeOff("weapon"), { ok: true })
    assert.deepEqual(season.sell("merchant", { kind: "gear", id: legendary.id }), { ok: true })
    assert.equal(season.adventurer().coin, 12)
    assert.deepEqual(season.adventurer().pack, [])
    assert.equal(season.adventurer().worn.weapon, null)
  })

  it("refuses a good the vendor has no price for and leaves the Adventurer unchanged", () => {
    const season = begin(market([{ kind: "everyday", id: "rope", price: 3 }]), {
      coin: 5,
      pack: [{ kind: "everyday", id: "salt", count: 1 }],
    })
    const before = season.adventurer()

    assert.deepEqual(season.sell("merchant", { kind: "everyday", id: "salt" }), {
      ok: false,
      reason: "not-for-sale",
    })
    assert.deepEqual(season.sell("merchant", { kind: "everyday", id: "rope" }), {
      ok: false,
      reason: "not-for-sale",
    })
    assert.deepEqual(season.buy("merchant", { kind: "everyday", id: "salt" }), {
      ok: false,
      reason: "not-for-sale",
    })
    assert.deepEqual(season.adventurer(), before)
  })

  it("buys and sells only the priced good", () => {
    const season = begin(
      market([{ kind: "everyday", id: "rope", price: 5 }], [], [{ kind: "everyday", id: "rope", price: 2 }]),
      { coin: 5 },
    )

    assert.deepEqual(season.buy("merchant", { kind: "everyday", id: "rope" }), { ok: true })
    assert.equal(season.adventurer().coin, 0)
    assert.deepEqual(season.adventurer().pack, [{ kind: "everyday", id: "rope", count: 1 }])

    assert.deepEqual(season.sell("merchant", { kind: "everyday", id: "rope" }), { ok: true })
    assert.equal(season.adventurer().coin, 2)
    assert.deepEqual(season.adventurer().pack, [])
    assert.equal(season.adventurer().adventurerExperience, 0)
  })

  it("sells one of a stacked good and a special find at the supplied prices", () => {
    const season = begin(
      market(
        [],
        [],
        [
          { kind: "everyday", id: "salt", price: 2 },
          { kind: "special-find", band: "low", price: 7 },
        ],
      ),
      {
        pack: [
          { kind: "everyday", id: "salt", count: 2 },
          { kind: "special-find", band: "low", count: 1 },
        ],
      },
    )

    assert.deepEqual(season.sell("merchant", { kind: "everyday", id: "salt" }), { ok: true })
    assert.deepEqual(season.sell("merchant", { kind: "special-find", band: "low" }), { ok: true })
    assert.equal(season.adventurer().coin, 9)
    assert.deepEqual(season.adventurer().pack, [{ kind: "everyday", id: "salt", count: 1 }])
  })

  it("adds another everyday good onto the stack already in a full pack", () => {
    const definition = market([{ kind: "everyday", id: "rope", price: 3 }])
    definition.packSize = 1
    const season = begin(definition, { coin: 6, pack: [{ kind: "everyday", id: "rope", count: 1 }] })

    assert.deepEqual(season.buy("merchant", { kind: "everyday", id: "rope" }), { ok: true })
    assert.equal(season.adventurer().coin, 3)
    assert.deepEqual(season.adventurer().pack, [{ kind: "everyday", id: "rope", count: 2 }])
  })

  it("refuses a good when the vendor here has no prices", () => {
    const definition = market([])
    definition.vendors = []
    const season = begin(definition, { coin: 3, pack: [{ kind: "everyday", id: "rope", count: 1 }] })
    const before = season.adventurer()
    assert.deepEqual(season.buy("merchant", { kind: "everyday", id: "rope" }), {
      ok: false,
      reason: "not-for-sale",
    })
    assert.deepEqual(season.sell("merchant", { kind: "everyday", id: "rope" }), {
      ok: false,
      reason: "not-for-sale",
    })
    assert.deepEqual(season.adventurer(), before)
  })

  it("refuses a trade when the vendor is not in this place", () => {
    const season = begin(market([{ kind: "everyday", id: "rope", price: 3 }]), { coin: 5 })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    const before = season.adventurer()

    assert.deepEqual(season.buy("merchant", { kind: "everyday", id: "rope" }), {
      ok: false,
      reason: "not-present",
    })
    assert.deepEqual(season.sell("merchant", { kind: "everyday", id: "rope" }), {
      ok: false,
      reason: "not-present",
    })
    assert.deepEqual(season.adventurer(), before)
  })

  it("buys rare gear of a middle settlement's own band", () => {
    const middle = sword("rare", 3, "middle")
    const low = sword("common", 1)
    const places = [
      { id: "aenon", kind: "settlement" as const, band: "low" as const },
      { id: "cana", kind: "settlement" as const, band: "middle" as const },
      { id: "jordan", kind: "wilderness" as const, band: "low" as const },
    ]
    const stocked = market([{ kind: "gear", id: middle.id, price: 8 }], [middle])
    stocked.places = places
    stocked.people = [{ id: "merchant", placeId: "cana", kind: "ordinary", vendor: true }]
    const season = begin(stocked, { coin: 8 })
    assert.deepEqual(season.enter("cana"), { ok: true })
    assert.deepEqual(season.buy("merchant", { kind: "gear", id: middle.id }), { ok: true })
    assert.equal(season.adventurer().coin, 0)
    assert.deepEqual(season.adventurer().pack, [{ kind: "gear", id: middle.id }])

    const outside = market([{ kind: "gear", id: low.id, price: 4 }], [low])
    outside.places = places
    outside.people = [{ id: "merchant", placeId: "cana", kind: "ordinary", vendor: true }]
    assert.deepEqual(loadSeason(outside, onePointPerLevel), { ok: false, reason: "stock-outside-band" })
  })

  it("fails to load gear from another level band on the stock", () => {
    const middle = sword("common", 1, "middle")
    assert.deepEqual(loadSeason(market([{ kind: "gear", id: middle.id, price: 4 }], [middle]), onePointPerLevel), {
      ok: false,
      reason: "stock-outside-band",
    })
  })

  it("fails to load stock gear the catalog does not name", () => {
    assert.deepEqual(loadSeason(market([{ kind: "gear", id: "missing", price: 4 }]), onePointPerLevel), {
      ok: false,
      reason: "stock-gear-missing",
    })
  })

  it("fails to load a vendor who is not in a settlement", () => {
    const definition = market([])
    definition.people = [{ id: "merchant", placeId: "jordan", kind: "ordinary", vendor: true }]
    assert.deepEqual(loadSeason(definition, onePointPerLevel), {
      ok: false,
      reason: "vendor-not-in-settlement",
    })
  })

  it("fails to load an everyday good that carries a rarity", () => {
    const catalog = market([])
    catalog.goods = [{ kind: "everyday", id: "salt", rarity: "common" }]
    assert.deepEqual(loadSeason(catalog, onePointPerLevel), {
      ok: false,
      reason: "everyday-has-rarity",
    })

    assert.deepEqual(
      loadSeason(market([{ kind: "everyday", id: "salt", price: 1, rarity: "common" }]), onePointPerLevel),
      { ok: false, reason: "everyday-has-rarity" },
    )
  })

  it("grades fish and food as common, uncommon, rare, epic, or legendary", () => {
    for (const rarity of ["common", "uncommon", "rare", "epic", "legendary"] as const) {
      const definition = market([])
      definition.goods = [
        { kind: "fish", id: "tilapia", rarity },
        { kind: "food", id: "stew", rarity },
      ]
      assert.equal(loadSeason(definition, onePointPerLevel).ok, true, rarity)
    }

    const missing = market([])
    missing.goods = [{ kind: "fish", id: "tilapia" }]
    assert.deepEqual(loadSeason(missing, onePointPerLevel), { ok: false, reason: "rarity-not-graded" })

    const unnamed = market([])
    unnamed.goods = [{ kind: "food", id: "stew", rarity: "white" }]
    assert.deepEqual(loadSeason(unnamed, onePointPerLevel), { ok: false, reason: "rarity-not-graded" })
  })

  it("grades a special find as legendary", () => {
    const found = market([])
    found.goods = [{ kind: "special-find", band: "low", rarity: "legendary" }]
    assert.equal(loadSeason(found, onePointPerLevel).ok, true)

    const rare = market([])
    rare.goods = [{ kind: "special-find", band: "low", rarity: "rare" }]
    assert.deepEqual(loadSeason(rare, onePointPerLevel), {
      ok: false,
      reason: "special-find-not-legendary",
    })

    const missing = market([])
    missing.goods = [{ kind: "special-find", band: "high" }]
    assert.deepEqual(loadSeason(missing, onePointPerLevel), { ok: false, reason: "rarity-not-graded" })
  })

  it("loads gear at common, uncommon, rare, epic, and legendary", () => {
    const strength = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 } as const
    for (const rarity of ["common", "uncommon", "rare", "epic", "legendary"] as const) {
      const piece = sword(rarity, strength[rarity])
      assert.equal(loadSeason(market([], [piece]), onePointPerLevel).ok, true, rarity)
    }
  })
})

describe("a cache opens once", () => {
  it("puts the roller's coin in the purse and leaves gear of any rarity waiting", () => {
    const common = sword("common", 1)
    const legendary = sword("legendary", 5)
    const definition = market([], [common, legendary])
    definition.caches = [{ id: "jar", placeId: "jordan" }]
    const season = begin(definition)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })

    let rolls = 0
    assert.deepEqual(
      season.openCache("jar", () => {
        rolls += 1
        return { coin: 4, gear: [{ id: common.id }, { id: legendary.id }] }
      }),
      { ok: true },
    )

    const adventurer = season.adventurer()
    assert.equal(rolls, 1)
    assert.equal(adventurer.coin, 4)
    assert.deepEqual(adventurer.pack, [])
    assert.deepEqual(adventurer.pickups, [
      { placeId: "jordan", gearId: common.id },
      { placeId: "jordan", gearId: legendary.id },
    ])
    assert.deepEqual(season.exportState().openedCaches, ["jar"])
    assert.equal(adventurer.adventurerExperience, 0)
    assert.equal(adventurer.adventurerLevel, 1)
  })

  it("refuses to open a cache that is already open and leaves the Adventurer unchanged", () => {
    const definition = market([])
    definition.caches = [{ id: "jar", placeId: "jordan" }]
    const season = begin(definition)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.openCache("jar", () => ({ coin: 4, gear: [{ id: "low-legendary-sword" }] })), {
      ok: true,
    })
    const before = season.adventurer()
    let rolls = 0

    assert.deepEqual(
      season.openCache("jar", () => {
        rolls += 1
        return { coin: 9, gear: [{ id: "extra" }] }
      }),
      { ok: false, reason: "already-open" },
    )

    assert.equal(rolls, 0)
    assert.deepEqual(season.adventurer(), before)
    assert.equal(before.coin, 4)
    assert.deepEqual(before.pickups, [{ placeId: "jordan", gearId: "low-legendary-sword" }])
    assert.deepEqual(season.exportState().openedCaches, ["jar"])
  })

  it("fails to load a cache that is not in the wilderness", () => {
    const definition = market([])
    definition.caches = [{ id: "jar", placeId: "aenon" }]
    assert.deepEqual(loadSeason(definition, onePointPerLevel), {
      ok: false,
      reason: "cache-not-in-wilderness",
    })
  })

  it("refuses a trade and a cache while a fight is underway", () => {
    const definition = market(
      [{ kind: "everyday", id: "rope", price: 3 }],
      [],
      [{ kind: "everyday", id: "rope", price: 1 }],
    )
    definition.caches = [{ id: "jar", placeId: "jordan" }]
    definition.hostiles = [
      {
        id: "wolf",
        kind: "animal",
        placeId: "jordan",
        hitpoints: 4,
        defeatGrant: 4,
        huntingExperience: 1,
      },
    ]
    const underway: Fight = { hostileId: "wolf", hostileHitpoints: 4, phase: "underway" }

    const trading = begin(definition, { coin: 5, fight: underway })
    const beforeTrade = trading.adventurer()
    assert.deepEqual(trading.buy("merchant", { kind: "everyday", id: "rope" }), {
      ok: false,
      reason: "fight-underway",
    })
    assert.deepEqual(trading.sell("merchant", { kind: "everyday", id: "rope" }), {
      ok: false,
      reason: "fight-underway",
    })
    assert.deepEqual(trading.adventurer(), beforeTrade)

    const caching = begin(definition, { placeId: "jordan", fight: underway })
    const beforeCache = caching.adventurer()
    let rolls = 0
    assert.deepEqual(
      caching.openCache("jar", () => {
        rolls += 1
        return { coin: 4, gear: [] }
      }),
      { ok: false, reason: "fight-underway" },
    )
    assert.equal(rolls, 0)
    assert.deepEqual(caching.adventurer(), beforeCache)
  })

  it("refuses a cache that is not in this place", () => {
    const definition = market([])
    definition.caches = [{ id: "jar", placeId: "jordan" }]
    const season = begin(definition)
    const before = season.adventurer()
    let rolls = 0

    assert.deepEqual(
      season.openCache("jar", () => {
        rolls += 1
        return { coin: 1, gear: [] }
      }),
      { ok: false, reason: "not-present" },
    )
    assert.equal(rolls, 0)
    assert.deepEqual(season.adventurer(), before)
  })

  it("opens a second cache after the first is open", () => {
    const definition = market([])
    definition.caches = [
      { id: "jar", placeId: "jordan" },
      { id: "chest", placeId: "jordan" },
    ]
    const season = begin(definition)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.openCache("jar", () => ({ coin: 1, gear: [] })), { ok: true })
    assert.deepEqual(season.openCache("chest", () => ({ coin: 2, gear: [{ id: "low-epic-sword" }] })), {
      ok: true,
    })
    assert.equal(season.adventurer().coin, 3)
    assert.deepEqual(season.adventurer().pickups, [{ placeId: "jordan", gearId: "low-epic-sword" }])
    assert.deepEqual(season.exportState().openedCaches, ["jar", "chest"])
  })

  it("takes cache gear with the pickup a fall leaves behind", () => {
    const definition = market([])
    definition.caches = [{ id: "jar", placeId: "jordan" }]
    const season = begin(definition)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.openCache("jar", () => ({ coin: 4, gear: [{ id: "blade" }] })), { ok: true })
    assert.deepEqual(season.pickUp("blade"), { ok: true })
    assert.equal(season.adventurer().coin, 4)
    assert.deepEqual(season.adventurer().pack, [{ kind: "gear", id: "blade" }])
    assert.deepEqual(season.adventurer().pickups, [])
  })

  it("restores an opened cache from the saved Season and derives level from experience", () => {
    const definition = market([])
    definition.caches = [{ id: "jar", placeId: "jordan" }]
    const season = begin(definition)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.openCache("jar", () => ({ coin: 4, gear: [{ id: "blade" }] })), { ok: true })

    const saved = season.exportState()
    assert.equal("adventurerLevel" in saved, false)
    assert.deepEqual(saved.openedCaches, ["jar"])
    const restored = loadSeason(definition, onePointPerLevel, saved)
    assert.equal(restored.ok, true)
    if (!restored.ok) return
    assert.equal(restored.season.adventurer().adventurerLevel, 1)
    assert.equal(restored.season.adventurer().coin, 4)
    assert.deepEqual(restored.season.adventurer().pickups, [{ placeId: "jordan", gearId: "blade" }])
    assert.deepEqual(restored.season.openCache("jar", () => ({ coin: 1, gear: [] })), {
      ok: false,
      reason: "already-open",
    })

    saved.openedCaches = []
    saved.adventurerExperience = 2
    const edited = loadSeason(definition, onePointPerLevel, saved)
    assert.equal(edited.ok, true)
    if (!edited.ok) return
    assert.equal(edited.season.adventurer().adventurerLevel, 3)
    assert.equal(edited.season.adventurer().combatLevels.Attack, 3)
    assert.equal(edited.season.adventurer().combatLevels.Hitpoints, 3)
    let rolls = 0
    assert.deepEqual(
      edited.season.openCache("jar", () => {
        rolls += 1
        return { coin: 1, gear: [] }
      }),
      { ok: true },
    )
    assert.equal(rolls, 1)
    assert.equal(edited.season.adventurer().coin, 5)
    assert.equal(edited.season.adventurer().adventurerLevel, 3)
  })
})

function sword(rarity: Rarity, strength: number, band: LevelBand = "low"): Gear {
  return {
    id: `${band}-${rarity}-sword`,
    slot: "weapon",
    hold: "one-handed",
    kind: "sword",
    band,
    rarity,
    accuracyModifier: 2,
    strengthModifier: strength,
    ...(rarity === "legendary" ? { effects: [{ kind: "second-hit" as const }] } : {}),
  }
}

function market(
  stock: readonly VendorStockLine[],
  gear: readonly Gear[] = [],
  prices: readonly VendorPrice[] = [],
): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
    ],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: 4,
    spots: [],
    people: [{ id: "merchant", placeId: "aenon", kind: "ordinary", vendor: true }],
    gear,
    vendors: [{ personId: "merchant", stock, prices }],
  }
}

function begin(
  definition: SeasonDefinition,
  patch: { coin?: number; pack?: readonly PackEntry[]; placeId?: string; fight?: Fight | null } = {},
): Season {
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  if (
    patch.coin === undefined &&
    patch.pack === undefined &&
    patch.placeId === undefined &&
    patch.fight === undefined
  ) {
    return started.season
  }
  const state = started.season.exportState()
  if (patch.coin !== undefined) state.coin = patch.coin
  if (patch.pack !== undefined) state.pack = patch.pack
  if (patch.placeId !== undefined) state.placeId = patch.placeId
  if (patch.fight !== undefined) state.fight = patch.fight
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}
