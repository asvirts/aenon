import {
  copyState,
  initialState,
  presentAdventurer,
  trainedSkills,
  type Adventurer,
  type Carcass,
  type Fight,
  type Pickup,
  type QuestJournalEntry,
  type QuestProgress,
  type ReferenceFiling,
  type SeasonState,
  type StoredBurn,
} from "./lib/begin.ts"
import { requireGearCatalog } from "./lib/catalog.ts"
import { holdAdventurerExperience, holdTrainedExperience } from "./lib/experience.ts"
import {
  enterPlace,
  faceHostile,
  stepBack,
  swingAtHostile,
  type Blow,
  type EnterResult,
  type FaceResult,
  type StepBackResult,
  type SwingResult,
} from "./lib/fight.ts"
import { gatherAtSpot, requireGatheringSpots, type GatherResult } from "./lib/gather.ts"
import { takeOffPiece, wearPiece, type TakeOffResult, type WearResult } from "./lib/gear.ts"
import { hunt, pickUp, type Drop, type HuntResult, type PickUpResult } from "./lib/hunt.ts"
import { makePiece, requireGearMaking, type MakeResult } from "./lib/make.ts"
import {
  lookAtPerson,
  presentQuestJournal,
  reportMark,
  requireQuests,
  resolveReadySteps,
  speakToPerson,
  type LookResult,
  type QuestLoadFailure,
  type ReportResult,
  type SpeakResult,
} from "./lib/quest.ts"
import { readScripture, type ReadResult } from "./lib/scripture.ts"
import {
  buyFromVendor,
  openCache,
  requireCaches,
  requireGoods,
  requireVendors,
  sellToVendor,
  type BuyGood,
  type BuyResult,
  type OpenCacheResult,
  type SellGood,
  type SellResult,
} from "./lib/trade.ts"
import {
  requireDefeatGrants,
  requireHostilesInWilderness,
  requireLowBandAenon,
  requireNonNegativeDefeatLoss,
  requirePositiveSmallerGrant,
  type DefinitionFailure,
} from "./lib/definition.ts"
import type { ExperienceCurve, GearSlot, SeasonDefinition } from "./lib/types.ts"

export type {
  ArmorSlot,
  ArmorWeight,
  ExperienceCurve,
  GatheringSkill,
  Gear,
  GearPiece,
  GearRecipe,
  Good,
  Hostile,
  LevelBand,
  MaterialCost,
  PackEntry,
  SpecialEffect,
  Person,
  Place,
  QuestDefinition,
  Rarity,
  ScriptureObject,
  SeasonDefinition,
  Spot,
  SpotSkill,
  Station,
  StationKind,
  Cache,
  CatalogGood,
  Vendor,
  VendorPrice,
  VendorStockLine,
} from "./lib/types.ts"
export type { GearSlot }
export type { Adventurer, Carcass, Fight, Pickup, QuestJournalEntry, QuestProgress, ReferenceFiling, SeasonState, StoredBurn }
export type { Blow, EnterResult, FaceResult, StepBackResult, SwingResult }
export type { PassagePresentation, ReadingGrants, ReadResult } from "./lib/scripture.ts"
export type { GatherResult }
export type { Drop, HuntResult, PickUpResult }
export type { TakeOffResult, WearResult }
export type { LookResult, QuestLoadFailure, ReportResult, SpeakResult }
export type { MakeResult }
export type { BuyGood, BuyResult, OpenCacheResult, SellGood, SellResult }

export type Season = {
  adventurer: () => Adventurer
  exportState: () => SeasonState
  enter: (placeId: string) => EnterResult
  face: (hostileId: string) => FaceResult
  stepBack: () => StepBackResult
  swing: (
    rollDamage: (blow: Blow) => number,
    rollHostileDamage?: (blow: Blow) => number,
    rollDrop?: () => Drop,
  ) => SwingResult
  read: (scriptureObjectId: string) => ReadResult
  gather: (spotId: string) => GatherResult
  look: (personId: string) => LookResult
  speak: (personId: string) => SpeakResult
  report: (mark: string) => ReportResult
  hunt: () => HuntResult
  pickUp: (gearId: string) => PickUpResult
  wear: (pieceId: string) => WearResult
  takeOff: (slot: GearSlot) => TakeOffResult
  make: (stationId: string, recipeId: string) => MakeResult
  buy: (personId: string, good: BuyGood) => BuyResult
  sell: (personId: string, good: SellGood) => SellResult
  openCache: (cacheId: string, rollDrop: () => Drop) => OpenCacheResult
}

export type SeasonLoad =
  | { ok: true; season: Season }
  | { ok: false; reason: DefinitionFailure | QuestLoadFailure }

export function loadSeason(
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  state?: SeasonState,
): SeasonLoad {
  const aenon = requireLowBandAenon(definition)
  if (!aenon.ok) return aenon
  const smallerGrant = requirePositiveSmallerGrant(definition)
  if (!smallerGrant.ok) return smallerGrant
  const defeatGrants = requireDefeatGrants(definition)
  if (!defeatGrants.ok) return defeatGrants
  const defeatLoss = requireNonNegativeDefeatLoss(definition)
  if (!defeatLoss.ok) return defeatLoss
  const wildernessHostiles = requireHostilesInWilderness(definition)
  if (!wildernessHostiles.ok) return wildernessHostiles
  const gatheringSpots = requireGatheringSpots(definition)
  if (!gatheringSpots.ok) return gatheringSpots
  const quests = requireQuests(definition)
  if (!quests.ok) return quests
  const catalog = requireGearCatalog(definition)
  if (!catalog.ok) return catalog
  const gearMaking = requireGearMaking(definition)
  if (!gearMaking.ok) return gearMaking
  const vendors = requireVendors(definition)
  if (!vendors.ok) return vendors
  const goods = requireGoods(definition)
  if (!goods.ok) return goods
  const caches = requireCaches(definition)
  if (!caches.ok) return caches

  const seasonState = copyState(state ?? initialState(aenon.placeId, curve))
  seasonState.adventurerExperience = holdAdventurerExperience(seasonState.adventurerExperience, curve)
  for (const skill of trainedSkills) {
    seasonState.trainedExperience[skill] = holdTrainedExperience(seasonState.trainedExperience[skill], curve)
  }
  resolveReadySteps(seasonState, definition)

  return {
    ok: true,
    season: {
      adventurer: () => presentAdventurer(seasonState, curve, presentQuestJournal(seasonState, definition)),
      exportState: () => copyState(seasonState),
      enter: (placeId) => enterPlace(seasonState, definition, placeId),
      face: (hostileId) => faceHostile(seasonState, definition, hostileId),
      stepBack: () => stepBack(seasonState),
      swing: (rollDamage, rollHostileDamage, rollDrop) =>
        swingAtHostile(seasonState, definition, curve, rollDamage, rollHostileDamage, rollDrop),
      read: (scriptureObjectId) => readScripture(seasonState, definition, curve, scriptureObjectId),
      gather: (spotId) => gatherAtSpot(seasonState, definition, curve, spotId),
      look: (personId) => lookAtPerson(seasonState, definition, curve, personId),
      speak: (personId) => speakToPerson(seasonState, definition, curve, personId),
      report: (mark) => reportMark(seasonState, definition, mark),
      hunt: () => hunt(seasonState, definition, curve),
      pickUp: (gearId) => pickUp(seasonState, definition, gearId),
      wear: (pieceId) => wearPiece(seasonState, definition, pieceId),
      takeOff: (slot) => takeOffPiece(seasonState, definition, slot),
      make: (stationId, recipeId) => makePiece(seasonState, definition, curve, stationId, recipeId),
      buy: (personId, good) => buyFromVendor(seasonState, definition, personId, good),
      sell: (personId, good) => sellToVendor(seasonState, definition, personId, good),
      openCache: (cacheId, rollDrop) => openCache(seasonState, definition, cacheId, rollDrop),
    },
  }
}
