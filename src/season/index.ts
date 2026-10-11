import {
  copyState,
  initialState,
  presentAdventurer,
  trainedSkills,
  type Adventurer,
  type Carcass,
  type Fight,
  type Pace,
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
import { makePiece, requireCooking, requireGearMaking, type MakeResult } from "./lib/make.ts"
import { eatMeal, requireMealBuffs, requireRestoreShares, type EatResult, type EatTarget } from "./lib/meal.ts"
import {
  finishScene,
  lookAtPerson,
  presentQuestJournal,
  reportMark,
  requireQuests,
  resolveAttendance,
  resolveReadySteps,
  speakToPerson,
  type FinishResult,
  type LookResult,
  type QuestLoadFailure,
  type ReportResult,
  type SpeakResult,
} from "./lib/quest.ts"
import { readScripture, type ReadResult } from "./lib/scripture.ts"
import { presentHere, travelingCompany } from "./lib/scene.ts"
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
  CookingRecipe,
  Fish,
  Food,
  MealBuff,
  RestoreShares,
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
export type { Adventurer, Carcass, Fight, Pace, Pickup, QuestJournalEntry, QuestProgress, ReferenceFiling, SeasonState, StoredBurn }
export type { Blow, EnterResult, FaceResult, StepBackResult, SwingResult }
export type { PassagePresentation, ReadingGrants, ReadResult } from "./lib/scripture.ts"
export type { GatherResult }
export type { Drop, HuntResult, PickUpResult }
export type { TakeOffResult, WearResult }
export type { FinishResult, LookResult, QuestLoadFailure, ReportResult, SpeakResult }
export type { MakeResult }
export type { EatResult, EatTarget }
export type { BuyGood, BuyResult, OpenCacheResult, SellGood, SellResult }
export { travelingCompany }

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
  finish: () => FinishResult
  hunt: () => HuntResult
  pickUp: (gearId: string) => PickUpResult
  wear: (pieceId: string) => WearResult
  takeOff: (slot: GearSlot) => TakeOffResult
  make: (stationId: string, recipeId: string) => MakeResult
  eat: (target: EatTarget) => EatResult
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
  const cooking = requireCooking(definition)
  if (!cooking.ok) return cooking
  const shares = requireRestoreShares(definition)
  if (!shares.ok) return shares
  const mealBuffs = requireMealBuffs(definition)
  if (!mealBuffs.ok) return mealBuffs

  const seasonState = copyState(state ?? initialState(aenon.placeId, curve))
  seasonState.adventurerExperience = holdAdventurerExperience(seasonState.adventurerExperience, curve)
  for (const skill of trainedSkills) {
    seasonState.trainedExperience[skill] = holdTrainedExperience(seasonState.trainedExperience[skill], curve)
  }
  resolveReadySteps(seasonState, definition)
  resolveAttendance(seasonState, definition)
  const blockedByScene = (): { ok: false; reason: "scene-playing" } | undefined =>
    seasonState.playingSceneId === null ? undefined : { ok: false, reason: "scene-playing" }

  return {
    ok: true,
    season: {
      adventurer: () =>
        presentAdventurer(
          seasonState,
          curve,
          presentQuestJournal(seasonState, definition),
          presentHere(seasonState, definition),
        ),
      exportState: () => copyState(seasonState),
      enter: (placeId) => {
        const blocked = blockedByScene()
        if (blocked) return blocked
        const entered = enterPlace(seasonState, definition, placeId)
        if (!entered.ok) return entered
        const scene = resolveAttendance(seasonState, definition)
        return scene ? { ok: true, scene } : entered
      },
      face: (hostileId) => blockedByScene() ?? faceHostile(seasonState, definition, hostileId),
      stepBack: () => blockedByScene() ?? stepBack(seasonState),
      swing: (rollDamage, rollHostileDamage, rollDrop) => {
        const blocked = blockedByScene()
        if (blocked) return blocked
        const swung = swingAtHostile(seasonState, definition, curve, rollDamage, rollHostileDamage, rollDrop)
        if (swung.ok) resolveAttendance(seasonState, definition)
        return swung
      },
      read: (scriptureObjectId) =>
        blockedByScene() ?? readScripture(seasonState, definition, curve, scriptureObjectId),
      gather: (spotId) => blockedByScene() ?? gatherAtSpot(seasonState, definition, curve, spotId),
      look: (personId) => blockedByScene() ?? lookAtPerson(seasonState, definition, curve, personId),
      speak: (personId) => blockedByScene() ?? speakToPerson(seasonState, definition, curve, personId),
      report: (mark) => blockedByScene() ?? reportMark(seasonState, definition, mark),
      finish: () => finishScene(seasonState, definition),
      hunt: () => blockedByScene() ?? hunt(seasonState, definition, curve),
      pickUp: (gearId) => blockedByScene() ?? pickUp(seasonState, definition, gearId),
      wear: (pieceId) => blockedByScene() ?? wearPiece(seasonState, definition, pieceId),
      takeOff: (slot) => blockedByScene() ?? takeOffPiece(seasonState, definition, slot),
      make: (stationId, recipeId) =>
        blockedByScene() ?? makePiece(seasonState, definition, curve, stationId, recipeId),
      eat: (target) => blockedByScene() ?? eatMeal(seasonState, definition, curve, target),
      buy: (personId, good) =>
        blockedByScene() ?? buyFromVendor(seasonState, definition, personId, good),
      sell: (personId, good) =>
        blockedByScene() ?? sellToVendor(seasonState, definition, personId, good),
      openCache: (cacheId, rollDrop) =>
        blockedByScene() ?? openCache(seasonState, definition, cacheId, rollDrop),
    },
  }
}
