import * as Phaser from "phaser"
import { loadSeason, type Season } from "../season/index.ts"
import { demoCurve, demoDefinition } from "./demoDefinition.ts"

const SAVE_KEY = "aenon-season-save-v1"
// Scrolling world: Aenon west of the river, the Jordan wilderness east.
// The viewport sees a portion; the camera follows the Adventurer, zoomed in.
const WORLD_W = 3200
const WORLD_H = 2000
const RIVER_WEST = 1600
const RIVER_EAST = 1680
const MID_X = 1640
const HUD_TOP = 116
const ZOOM = 1.2

/**
 * Isometric projection (2:1 dimetric). Game logic thinks in logical
 * top-down coordinates; only rendering converts. Depth sorts by x + y.
 */
const ISO_OX = 1600
const ISO_OY = 0
const isoX = (x: number, y: number): number => ISO_OX + (x - y) * 0.5
const isoY = (x: number, y: number): number => ISO_OY + (x + y) * 0.25
const isoDepth = (x: number, y: number): number => x + y
const v2 = (x: number, y: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(x, y)
function isoInverse(sx: number, sy: number): { x: number; y: number } {
  const a = (sx - ISO_OX) / 0.5
  const b = (sy - ISO_OY) / 0.25
  return { x: (a + b) / 2, y: (b - a) / 2 }
}
const SPEED = 240
const ART_SCALE = 2.5

/** Scripture object id -> USFM passage id for the passage server. */
const SCRIPTURE_USFM: Record<string, string> = { reeds: "JHN.1.29" }

function readSavedState(): unknown {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return undefined
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

function bootSeason(): Season | { error: string } {
  const saved = readSavedState()
  // The save is the rules module's exported state; anything else starts fresh.
  const loaded =
    saved !== undefined && typeof saved === "object" && saved !== null
      ? loadSeason(demoDefinition, demoCurve, saved as never)
      : loadSeason(demoDefinition, demoCurve)
  if (!loaded.ok) return { error: loaded.reason }
  return loaded.season
}

function passageNode(): HTMLElement | null {
  return window.document.getElementById("passage")
}

function showNotice(title: string, body: string): void {
  const node = passageNode()
  if (!node) return
  node.replaceChildren()
  const heading = window.document.createElement("h2")
  heading.textContent = title
  const text = window.document.createElement("p")
  text.textContent = body
  node.append(heading, text)
}

/**
 * Renders licensed passage HTML fetched from our own passage server
 * (the only YouVersion caller) with the version copyright beside it.
 * The HTML comes from the Platform API via our server, not from player
 * input, so it is rendered as markup rather than text.
 */
function showLivePassage(reference: string, html: string, copyright: string): void {
  const node = passageNode()
  if (!node) return
  node.replaceChildren()
  const heading = window.document.createElement("h2")
  heading.textContent = reference
  const passage = window.document.createElement("div")
  passage.innerHTML = html
  node.append(heading, passage)
  if (copyright) {
    const aside = window.document.createElement("p")
    aside.textContent = copyright
    node.append(aside)
  }
}

async function loadLivePassage(usfm: string): Promise<void> {
  try {
    const response = await fetch(`/api/passage?usfm=${encodeURIComponent(usfm)}`)
    const body = (await response.json()) as {
      reference?: string
      html?: string
      version?: { copyright?: string }
      error?: string
    }
    if (!response.ok || typeof body.html !== "string") {
      showNotice("Passage unavailable", body.error ?? "The passage server could not be reached.")
      return
    }
    showLivePassage(body.reference ?? usfm, body.html, body.version?.copyright ?? "")
  } catch {
    showNotice("Passage unavailable", "The passage server could not be reached.")
  }
}

/** Deterministic RNG so the scattered dressing is the same every visit. */
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Tiny procedural sound effects: zero assets, Web Audio only, very quiet.
// ---------------------------------------------------------------------------

let sharedAudio: AudioContext | null = null

function audioContext(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null
    if (!sharedAudio) sharedAudio = new AudioContext()
    if (sharedAudio.state === "suspended") void sharedAudio.resume()
    return sharedAudio
  } catch {
    return null
  }
}

function tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0): void {
  const ctx = audioContext()
  if (!ctx) return
  try {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0, ctx.currentTime + delay)
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(ctx.currentTime + delay)
    oscillator.stop(ctx.currentTime + delay + duration + 0.05)
  } catch {
    // Sound must never break the Season.
  }
}

function noiseBurst(duration: number, volume: number, delay = 0): void {
  const ctx = audioContext()
  if (!ctx) return
  try {
    const length = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = volume
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(ctx.currentTime + delay)
  } catch {
    // Sound must never break the Season.
  }
}

function playSfx(name: "gather" | "swing" | "face" | "hunt" | "read" | "buy" | "region"): void {
  switch (name) {
    case "gather":
      tone(150, 0.08, "square", 0.03)
      tone(85, 0.1, "sine", 0.05, 0.02)
      break
    case "swing":
      noiseBurst(0.16, 0.05)
      break
    case "face":
      tone(72, 0.25, "sawtooth", 0.04)
      break
    case "hunt":
      tone(65, 0.16, "sine", 0.06)
      break
    case "read":
      tone(523, 0.18, "sine", 0.04)
      tone(784, 0.25, "sine", 0.04, 0.12)
      break
    case "buy":
      tone(1318, 0.05, "square", 0.025)
      tone(1760, 0.07, "square", 0.025, 0.06)
      break
    case "region":
      tone(220, 0.3, "triangle", 0.035)
      tone(330, 0.35, "triangle", 0.03, 0.1)
      break
  }
}

/** Draw a pixel map into a texture key. Pads short rows with transparency. */
function pixelTexture(
  scene: Phaser.Scene,
  key: string,
  rows: string[],
  palette: Record<string, number>,
): void {
  if (scene.textures.exists(key)) return
  const width = Math.max(...rows.map((row) => row.length))
  const graphics = scene.make.graphics({ x: 0, y: 0 })
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const chip = row[x]
      if (chip === "." || chip === " ") continue
      const color = palette[chip]
      if (color === undefined) continue
      graphics.fillStyle(color, 1)
      graphics.fillRect(x, y, 1, 1)
    }
  })
  graphics.generateTexture(key, width, rows.length)
  graphics.destroy()
}

// ---------------------------------------------------------------------------
// Hi-fi sprite maps (20-32px base, dark outline + highlight + shade)
// ---------------------------------------------------------------------------

const ADV_PALETTE: Record<string, number> = {
  O: 0x2b2018,
  H: 0x5a4128,
  L: 0x8a6a45,
  S: 0xf2c194,
  T: 0x2fbfa0,
  W: 0x7de6cf,
  K: 0x1f7a66,
  B: 0x8a6a2f,
  G: 0xf2c14e,
  P: 0xe8dcc0,
  Q: 0xc4b394,
  F: 0x6b4a2f,
}

const ADV_TORSO = [
  "........................",
  "........OOOOOOOO........",
  "......OOHHHHHHHHOO......",
  ".....OHHHLLHHHHHHHO.....",
  ".....OHHHHHHHHHHHHO.....",
  ".....OHHSSSSSSSSHHO.....",
  ".....OHHSSSSSSSSHHO.....",
  ".....OHSSOSSSSOSSHO.....",
  ".....OHSSSSSSSSSSHO.....",
  ".....OHSSSDDSSSSSHO.....",
  "......OOSSSSSSSSOO......",
  "....OOTTTTTTTTTTTTOO....",
  "....OTTTTTTTTTTTTTTO....",
  "...OOTTTTTTTTTTTTTTOO...",
  "...OTWWTTTTTTTTKKTTTO...",
  "...OOSSTTTTTTTTTTTSOO...",
  "...OOSSTTTTTTTTTTTSOO...",
  "....OTTTTTTTTTTTTTTO....",
  "....OTTTKTTTTTKTTTTO....",
  ".....OBBBBBBBBBBBBO.....",
  ".....OBBBGGGGBBBBBO.....",
]

const JOHN_PALETTE: Record<string, number> = {
  O: 0x241a10,
  H: 0x3a2a18,
  L: 0x6a4a28,
  S: 0xe8b07d,
  B: 0x4a3421,
  C: 0xc9a06a,
  W: 0xe8c88f,
  K: 0xa67c4a,
  P: 0xd9c9a8,
  F: 0x6b4a2f,
  Q: 0xc4b394,
  "|": 0x7a5230,
  "*": 0xf2c14e,
}

const JOHN_ROWS = [
  "........................",
  "....OOHHHHHHHHHHHHOO....",
  "...OHHHHHHHHHHHHHHHHO*..",
  "...OHHLLHHHHHHHHHHHHO|..",
  "...OHHHSSSSSSSSSHHHHO|..",
  "...OHHHSSSSSSSSSHHHHO|..",
  "...OHHSSOSSSSOSSSHHHO|..",
  "...OHHHSSSSSSSSSHHHHO|..",
  "...OHHBBBBBBBBBBHHHHO|..",
  "....OHBBBBBBBBBBHHHHO|..",
  ".....OHBBBBBBBBBHHO..|..",
  ".....OHBBBBBBBBBHHO..|..",
  ".....OOCCCCCCCCCCOO..|..",
  "....OOCCCCCCCCCCCCOO.|..",
  "....OCCWWCCCCCCKKCCOO|..",
  "...OOCCCCCCCCCCCCCCOO|..",
  "...OSCCCCCCCCCCCCCCSO|..",
  "....OCCCCCCCCCCCCCCO.|..",
  "....OCKCCCKKCCCKKCCO.|..",
  "....OCKKCCCKKCCCKKCCO|..",
  ".....OPPP......PPPO.....",
  ".....OFFF......FFFO.....",
  ".....OFFF......FFFO.....",
  ".....OOOO......OOOO.....",
  "........................",
]

const MERCHANT_PALETTE: Record<string, number> = {
  O: 0x2b2018,
  W: 0xf5eeda,
  E: 0xd9cdb2,
  G: 0xf2c14e,
  S: 0xe8b07d,
  M: 0x4a3421,
  P: 0x7a4fb0,
  L: 0x9a7fd0,
  K: 0x5a3a8a,
  F: 0x5d3f2a,
  Q: 0xc4b394,
}

const MERCHANT_ROWS = [
  "........................",
  "......OOWWWWWWWWOO......",
  ".....OWWWWWWWWWWWWO.....",
  ".....OWEGGGGGGGEWWO.....",
  ".....OWWWWWWWWWWWWO.....",
  ".....OHHSSSSSSSSHHO.....",
  ".....OHHSSSSSSSSHHO.....",
  ".....OHHSOSSSOSSHHO.....",
  ".....OHSSSMSMSSSHHO.....",
  "......OOSSSSSSSSOO......",
  "....OOPPPPPPPPPPPPOO....",
  "...OGPLPPPPPPPPPPLPGO...",
  "...OGPLPPPPPPPPPPLPGO...",
  "..OOGPLPPPPPPPPPPLPGOO..",
  "..OOSPPLPPPPPPPLPPSSOO..",
  "...OGPLPPPPPPPPPPLPGO...",
  "...OGPLPPPPPPPPPPLPGO...",
  "....OGPPPPPPPPPPPPGO....",
  "....OOGGGGGGGGGGGGOO....",
  ".....OPPPPPPPPPPPPO.....",
  ".....OPPP......PPPO.....",
  ".....OFFF......FFFO.....",
  ".....OFFF......FFFO.....",
  ".....OOOO......OOOO.....",
  "........................",
]

const WOLF_PALETTE: Record<string, number> = {
  O: 0x23262e,
  F: 0xb8bec9,
  D: 0x7a7f89,
  K: 0x555a63,
  T: 0x8a8f98,
  A: 0xf2c14e,
  N: 0x1a1c22,
}

const WOLF_STAND = [
  "........................",
  "..OOO................TTT",
  ".OOFFFOO.....KKKKKTTTTTT",
  ".OFFFFFFOOOKKKKKKKKFTTTT",
  ".NFAFFFFFOOKKKKKKKKFFTTT",
  "..OFFFFFFFFFFFFFFFFFFT..",
  "..ODDFFFFFFFFFFFFFDDDT..",
  "....FF...FF...FF...FF...",
  "....FF...FF...FF...FF...",
  "....DD...DD...DD...DD...",
  "........................",
]

const TREE_PALETTE: Record<string, number> = {
  O: 0x1d5a33,
  G: 0x2f9e5f,
  L: 0x7de6a3,
  D: 0x1f7340,
  T: 0x7a5230,
  R: 0x5d3f2a,
}

const PINE_A = [
  ".........OO.........",
  "........OGGO........",
  "........OGGO........",
  ".......OGGLGO.......",
  "......OGGLLGGO......",
  "......OGGGGGGO......",
  ".....OGGGGGGGGO.....",
  "....OGGLLGGGGGGO....",
  "...OGGLLLGGGGGGO....",
  "...OGGGGGGDDDDDGO...",
  "..OGGGGGGGDDDDDDGO..",
  "..OGGGGGGGDDDDDDGO..",
  ".OGGLLGGGGGDDDDDDGO.",
  ".OGGLLLGGGGGDDDDDDGO",
  ".OGGGGGGGDDDDDDDDGO.",
  ".OGGGGGGGDDDDDDDDGO.",
  "..OGGGGGDDDDDDDDGO..",
  "...ODDDDDDDDDDDDO...",
  ".......OTTTTO.......",
  ".......OTTTTO.......",
  ".......OTTTTO.......",
  ".......OTTTTO.......",
  "......OOTTTTTOO.....",
  "......ORTTTTRO......",
  "....................",
]

const TREE_A = [
  "........................",
  "........OOOOOO..........",
  "......OOGGGGGGGGOO......",
  "....OGGLLGGGGGGGGGGO....",
  "...OGGLLGGGGGGDDDDDGO...",
  "..OGGGGLLGGGGGGDDDDDGO..",
  "..OGGLGGGGGGGGDDDDDDGO..",
  ".OGGGLLGGGGGGGDDDDDDDGO.",
  ".OGGLLLGGGLLGGDDDDDDDGO.",
  ".OGGGGGGGGGGGDDDDDDDDGO.",
  "..OGDDGGGGGGGDDDDDDDGO..",
  "..OGDDDGGGLLLGGDDDDDGO..",
  "...ODDDDDGGLLGGGGDDGO...",
  "...OODDDDDGGGGGGGGDGO...",
  ".....OODDGGGGGGGDGO.....",
  ".......OOGGGGGGOO.......",
  "..........TTTT..........",
  "..........TTTT..........",
  "..........TTTT..........",
  "..........TTTT..........",
  "..........TTTT..........",
  ".........TTTTTT.........",
  "........OOTTTTOO........",
  "........ORTTTTRO........",
  ".......OORTTTTRRO.......",
  "........................",
]

const TREE_B = [
  "........................",
  "..........OOOOOO........",
  "......OOGGGGGGGGOO......",
  "....OGGGGGGGGGGLLGGO....",
  "...OGDDDDDGGGGGGLLGGO...",
  "..OGDDDDDGGGGGGLLGGGGO..",
  "..OGDDDDDDGGGGGGGGLGGO..",
  ".OGDDDDDDDGGGGGGGLLGGGO.",
  ".OGDDDDDDDGGLLGGGLLLGGO.",
  ".OGDDDDDDDDGGGGGGGGGGGO.",
  "..OGDDDDDDDGGGGGGGDDGO..",
  "..OGDDDDDGGLLLGGGDDDGO..",
  "...OGDDGGGGLLGGDDDDDO...",
  "...OGDGGGGGGGGDDDDDOO...",
  ".....OGDGGGGGGGDDOO.....",
  ".......OOGGGGGGOO.......",
  "..........TTTT..........",
  "..........TTTT..........",
  "..........TTTT..........",
  "..........TTTT..........",
  "..........TTTT..........",
  ".........TTTTTT.........",
  "........OOTTTTOO........",
  "........ORTTTTRO........",
  ".......OORTTTTRRO.......",
  "........................",
]

const REEDS_ROWS = [
  "....................",
  "......C......C......",
  "......G......G..C...",
  "...C..G..C...G..G...",
  "...G..G..G...G..G...",
  "..CG..G..G...G..G...",
  "..GG..G..GG..G..CG..",
  "..GG..G..GG..G..GG..",
  "..GG..GG.GG..G..GG..",
  "..GG..GG.GG.GG..GG..",
  "..GG..GG..GGGG..GG..",
  "..GG..GG..GGGG..GG..",
  "..DG..DG..DGDG..DG..",
  "..DD..DD..DDDD..DD..",
  ".DDDDDDDDDDDDDDDDDD.",
  "....................",
]

const TENT_PALETTE: Record<string, number> = {
  O: 0x4a3421,
  C: 0xe8dcc0,
  K: 0xc4b394,
  R: 0xb8452e,
  D: 0x2b2018,
  P: 0x6b4a2f,
}

const TENT_ROWS = [
  "...............OOOO...............",
  "..............OOCCOO..............",
  ".............OCCCCCCO.............",
  "............OCCRRCCCCO............",
  "...........OCCCRRRCCCCO...........",
  "..........OCCCCRRRCCCCCO..........",
  ".........OCCCCCRRRRCCCCCO.........",
  "........OCCCCCCRRRRCCCCCCO........",
  ".......OCCCCCCCRRRRCCCCCCCO.......",
  "......OCCCCCCCCRRRRCCCCCCCCO......",
  ".....OCCCCCCCCCRRRRCCCCCCCCCO.....",
  "....OCCCCCCCCCCRRRRCCCCCCCCCCO....",
  "...OCCCCCCCCCCCRRRRCCCCCCCCCCCO...",
  "...OCCCCCCCCCCRRRRRCCCCCCCCCCCO...",
  "..OCCCCCOOOOORRRRRROOOOOCCCCCCCO..",
  "..OCCCCCOODDOORRRROODDDDOCCCCCCO..",
  "..OCCCCCOODDOORRRROODDDDOCCCCCCO..",
  ".OCCCCCCOODDDORRRRODDDOOCCCCCCCO.",
  ".OCCCCCCOODDDORRRRODDDOOCCCCCCCO.",
  ".OKKKKKKOODDDDOOOODDDDOOKKKKKKKO..",
  "..OOOOOOOOOOOOOOOOOOOOOOOOOOOOO...",
  "................................",
]

const FIRE_PALETTE: Record<string, number> = {
  S: 0x8a8f98,
  D: 0x5d6169,
  L: 0x7a5230,
  O: 0xe08a3c,
  Y: 0xf2c14e,
  W: 0xfff3c4,
}

const FIRE_A = [
  "................",
  "................",
  "......YY........",
  ".....YOOY.......",
  ".....YWWYY......",
  "....OYWWWYO.....",
  "....OYWWWYO.....",
  "...OOYWYWYYOO...",
  "..SSOOLLLLOOSS..",
  "..SSLLLLLLLLSS..",
  "..SSSLLLLLLSSS..",
  "...SSSSSSSSSS...",
  "................",
]

const FIRE_B = [
  "................",
  "................",
  ".......YY.......",
  "......YOOY......",
  ".....YYWWYO.....",
  ".....YWWWWYO....",
  "....OYWWWYO.....",
  "...OOYWYWYYOO...",
  "..SSOOLLLLOOSS..",
  "..SSLLLLLLLLSS..",
  "..SSSLLLLLLSSS..",
  "...SSSSSSSSSS...",
  "................",
]

const PROP_PALETTE: Record<string, number> = {
  O: 0x2b2018,
  J: 0xb8452e,
  Q: 0xe08a3c,
  K: 0x7a2e1f,
  R: 0x8a8f98,
  L: 0xb8bec9,
  D: 0x5d6169,
  G: 0x2f9e5f,
  W: 0x7de6a3,
  C: 0xe8d9a0,
  Y: 0xf2c14e,
  N: 0xd95f5f,
}

const JARS_ROWS = [
  "....................",
  ".....OO......OO.....",
  "....OQQO....OQQO....",
  ".....OO......OO.....",
  "....OJJO....OJJO....",
  "...OJQJOO..OJQJJO...",
  "..OJQJJJO..OJQJJJO..",
  "..OJQJJJO..OJQJJJO..",
  "..OJJJJJO..OJJJJJO..",
  "...OJJJO....OJJJO...",
  "....OKO......OKO....",
  "...OOKKO....OOKKO...",
  "....................",
]

const ROCK_ROWS = [
  "................",
  ".....OOLLOO.....",
  "....OLLLLDDO....",
  "...OLLLLDDDDDO..",
  "...OLLDDRDDDDO..",
  "....ODDDDDDDO...",
  ".....OOOOOOO....",
  "................",
]

const BUSH_ROWS = [
  "................",
  ".....OOGGOO.....",
  "....OGGLLGGO....",
  "...OGLWLLWGGO...",
  "...OGGLLLGGO....",
  "....OGGGGGO.....",
  ".....OOOOO......",
  "................",
]

const TUFT_ROWS = ["...G....", "...G..W.", "..GGG.W.", "..GGG...", ".DGDGD..", "........"]

const PEBBLE_ROWS = ["........", "..L.....", "..LD..R.", "....DDR.", "........"]

const FLOWER_R = ["...N....", "..NNN...", "...N....", "...G....", "...G....", "..GGG..."]
const FLOWER_Y = ["...Y....", "..YYY...", "...Y....", "...G....", "...G....", "..GGG..."]

const WAVE_ROWS = [
  "........................",
  "..LLL.......LLL.......",
  ".LL.LLL...LLL.LLL.....",
  "......................",
]

/** A decorative walker: villagers, sheep. Pure ambience, no Season rules. */
type Wanderer = {
  visual: WalkerVisual
  minX: number
  maxX: number
  minY: number
  maxY: number
  target: { x: number; y: number }
  speed: number
  cadence: number
  label: Phaser.GameObjects.Text | null
  graze: boolean
  grazeUntil: number
  nextGraze: number
}

type Butterfly = {
  sprite: Phaser.GameObjects.Sprite
  cx: number
  cy: number
  rx: number
  ry: number
  speed: number
  phase: number
}

const SHEEP_PALETTE: Record<string, number> = {
  O: 0x3a332c,
  F: 0xf5eeda,
  K: 0xd9cdb2,
  H: 0x4a3a30,
  W: 0xffffff,
  D: 0xcfc4ae,
}

const SHEEP_STAND = [
  "....................",
  "......OOOOOOOO......",
  "....OOFFFFFFFFOO....",
  "...OFFFFFKFFFFFFO...",
  "..OFFFFKFFFFFHHHHO..",
  "..OFWFFKFFFFFHHHHO..",
  "...OFFFFFKFFFFFFO...",
  "....OKKKFFFFKKOO....",
  "....OFF..FF..FFO....",
  "....ODD..DD..DDO....",
  "....................",
]

const BIRD_ROWS_A = [
  "............",
  ".WW......WW.",
  "..WWWWWWW...",
  "...WWWWW....",
  "............",
]

const BIRD_ROWS_B = [
  "............",
  "...WWWWW....",
  "..WWWWWWW...",
  ".WW......WW.",
  "............",
]

const BUTTERFLY_A = [
  ".OO..OO.",
  "OOOOOOOO",
  ".OOBBOO.",
  "...BB...",
  "...BB...",
]

const BUTTERFLY_B = [
  "........",
  "OOOBBOOO",
  ".OOBBOO.",
  "...BB...",
  "...BB...",
]

const FISH_ROWS = [
  "............",
  ".....FFF....",
  "...FFFFFFFT.",
  ".EFFFFFFFFF.",
  "...FFFFFFFT.",
  ".....FFF....",
  "............",
]

const WELL_PALETTE: Record<string, number> = {
  O: 0x2b2018,
  S: 0x8a8f98,
  L: 0xb8bec9,
  D: 0x5d6169,
  W: 0x1d3a4a,
  T: 0x7a5230,
  R: 0xb8452e,
  C: 0xe8dcc0,
}

const WELL_ROWS = [
  "..........TT......TT..........",
  "..........TT......TT..........",
  "..........TT......TT..........",
  ".........OTTOOOOOTTO..........",
  "........OOORRRRRRRROOO........",
  ".......ORRRRRRRRRRRRRRO.......",
  ".......ORCCRRRRRRRCCRO........",
  "........ORRRRRRRRRRRO.........",
  ".........OOOORROOOO...........",
  "..........TT....TT............",
  "..........TT....TT............",
  ".........OOSSSSSSSSOO.........",
  "........OSLSSSSSSSSLSO........",
  "........OSLSSWWWWWSSLSO.......",
  "........OSLSSWWWWWSSLSO.......",
  "........OSLSSWWWSSLSO.........",
  "........OSSLSSSSSSLSO.........",
  ".........OOSSLLSLSSOO.........",
  "...........OOOSSOOO...........",
  "..............................",
]

const STALL_PALETTE: Record<string, number> = {
  O: 0x2b2018,
  C: 0xe8dcc0,
  R: 0xb8452e,
  K: 0xc4b394,
  T: 0x6b4a2f,
  F: 0xd95f5f,
  Y: 0xf2c14e,
  G: 0x3fae5f,
}

const STALL_ROWS = [
  "................................",
  "..OO........................OO..",
  "..TTRRRCCCRRRCCCRRRCCCRRRCCCTT..",
  "..TTRRRCCCRRRCCCRRRCCCRRRCCCTT..",
  "..TTRRRCCCRRRCCCRRRCCCRRRCCCTT..",
  "..TT........................TT..",
  "..TT........................TT..",
  "..TT........................TT..",
  "..TTO......................OTT..",
  "..TTOOFFFFFFFFYYYYGGGGGFFFOOTT..",
  "..TTOOFFFFFFFFYYYYGGGGGFFFOOTT..",
  "..TTKKKKKKKKKKKKKKKKKKKKKKKKTT..",
  "..TTKKKOOOKKKOOOKKKOOOKKKKKKTT..",
  "..TTKKKOOOKKKOOOKKKOOOKKKKKKTT..",
  "..TTKKKKKKKKKKKKKKKKKKKKKKKKTT..",
  "..TTTOOOOOOOOOOOOOOOOOOOOTTT....",
  "..TTT...........................",
  "................................",
]

const PALM_PALETTE: Record<string, number> = {
  O: 0x1d5a33,
  G: 0x2f9e5f,
  L: 0x7de6a3,
  D: 0x1f7340,
  T: 0x7a5230,
  R: 0x5d3f2a,
  Y: 0xe08a3c,
}

const PALM_ROWS = [
  ".....OOGGGGGOO........",
  "...OGGGGGGGGGGGO......",
  "..OGGLLGGGGGGGGGGO....",
  ".OGGLLGGGGGGDDDDDGO...",
  ".OGGGGGGGGGDDDDDDDGO..",
  "..OGGGGGYYGGDDDDDDGO..",
  "...OOGGYYYYGDDDGGGO...",
  ".....OOGGGGGGGGOO.....",
  ".......OOTTTTOO.......",
  ".......OTTTTTOO.......",
  ".......OTTTTOO........",
  "......OOTTTTOO........",
  "......OTTTTOO.........",
  ".....OOTTTTOO.........",
  ".....ORTTTRO..........",
  "....OORTTTRRO.........",
  "....OOTTTTOOO.........",
  "......................",
]

const DEAD_PALETTE: Record<string, number> = {
  T: 0x8a7a68,
  D: 0x5d5045,
  O: 0x3a332c,
}

const DEAD_ROWS = [
  "......TT....TT........",
  ".......TT..TT.........",
  "....TT..TTTT....TT....",
  ".....TTTTTTTTTTTT.....",
  ".......TTTTTTTT.......",
  ".........TTTT.........",
  ".....TT..TTTT..TT.....",
  "......TTTTTTTTTT......",
  "........TTTTTT........",
  "..........TTTT........",
  "..........TTTT........",
  ".....TT...TTTT...TT...",
  "......TTTTTTTTTTT.....",
  "........TTTTTTT.......",
  "..........TTTT........",
  "..........TTTT........",
  ".........TTTTTT.......",
  ".........TTTTTT.......",
  "........OOTTTTOO......",
  "........OOTTTTOO......",
  "......................",
]

const STONE_PALETTE: Record<string, number> = {
  O: 0x2b2d33,
  R: 0x8a8f98,
  L: 0xb8bec9,
  D: 0x5d6169,
  M: 0x3f6f4a,
}

const STONE_ROWS = [
  "....OOOOOO....",
  "...ORRLLRRO...",
  "...ORLLLRRO...",
  "...ORLLLRDO...",
  "...ORLLLRDO...",
  "...ORLLMRDO...",
  "...ORLLMRDO...",
  "...ORLLLRDO...",
  "...ORLLLRDO...",
  "...ORLLLRDO...",
  "...ORDDDRDO...",
  "...OODDDDDO...",
  "....OOOOOO....",
  "..............",
]

/** Small shared limb maps for the paper-doll rigs. */
const BIPED_ARM = [
  "..OO..",
  ".OTTO.",
  ".OTTO.",
  ".OTTO.",
  ".OKKO.",
  ".OSSO.",
  "..OO..",
]

const BIPED_LEG = [
  "..OOOO..",
  "..OPPO..",
  "..OPPO..",
  "..OPPO..",
  "..OFFO..",
  "..OFFO..",
  "..OOOO..",
]

const JOHN_ARM = [
  "..OO..",
  ".OCCO.",
  ".OCCO.",
  ".OCCO.",
  ".OKKO.",
  ".OSSO.",
  "..OO..",
]

const MERCHANT_ARM = [
  "..OO..",
  ".OPPO.",
  ".OPPO.",
  ".OPPO.",
  ".OKKO.",
  ".OSSO.",
  "..OO..",
]

const STAFF_ROWS = [
  "OOOO",
  "O**O",
  "O**O",
  "OOOO",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
  ".||.",
]

const WOLF_LEG = [
  ".OOOO.",
  ".OFFO.",
  ".OFFO.",
  ".OFFO.",
  ".ODDO.",
]

const SHEEP_LEG = [
  ".OO.",
  ".OFO.",
  ".OFO.",
  ".ODO.",
]

const PROPS_PALETTE: Record<string, number> = {
  O: 0x2b2018,
  B: 0x7a5230,
  L: 0xa08050,
  K: 0x8a6a3f,
  D: 0x5d3f2a,
  Y: 0xf5e6b8,
  I: 0x3a3a3a,
  A: 0xc4b394,
}

const BARREL_ROWS = [
  "....OOOO....",
  "...OBBBBO...",
  "...OBLLBO...",
  "..OBBBBBBO..",
  "..OBLLLLBO..",
  "..OBBBBBBO..",
  "..OBLLLLBO..",
  "..OBBBBBBO..",
  "...OBBBBO...",
  "....OOOO....",
]

const CRATE_ROWS = [
  ".OOOOOOOOOOOO.",
  ".OKKKKKKKKKKO.",
  ".OKKOOOOOOKKO.",
  ".OKOKKKKKOKKO.",
  ".OKOKOOOOOKKO.",
  ".OKOKOOOOOKKO.",
  ".OKOKKKKKOKKO.",
  ".OKKOOOOOOKKO.",
  ".OKKKKKKKKKKO.",
  ".OOOOOOOOOOOO.",
]

const LAMP_ROWS = [
  "...OO.....",
  "...II.....",
  "...II.....",
  "..OIIO....",
  ".OOIIOO...",
  ".OIYYIO...",
  ".OIYYIO...",
  ".OOIIOO...",
  "...II.....",
  "..OIIO....",
  ".OOIIIOO..",
]

const SIGN_ROWS = [
  ".......OO...........",
  ".......LL...........",
  "..OOOOOLLOOOOOO.....",
  "..OAAAAAAAAAAAO.....",
  "..OOOOOLLOOOOOO.....",
  ".......LL...........",
  ".......LL.....OOOO..",
  ".......LL.....OAAO..",
  ".......LL.....OOOO..",
  ".......LL...........",
  "......OLLO..........",
  ".....OOLLOO.........",
]

const VILLAGER_A_PALETTE: Record<string, number> = {
  ...ADV_PALETTE,
  T: 0xc9a13a,
  W: 0xe8d27a,
  K: 0x8a6f24,
}

const VILLAGER_B_PALETTE: Record<string, number> = {
  ...ADV_PALETTE,
  T: 0xb85c38,
  W: 0xe08a6a,
  K: 0x7a3a24,
}

/** Paper-doll rigs: separate limbs on sine phases read as real locomotion.
 *  The root holds logic position/flip/depth; the bob holds visual-only
 *  offsets (bounce, squash, lunge) so game logic never wobbles. */
class BipedRig {
  readonly root: Phaser.GameObjects.Container
  readonly bob: Phaser.GameObjects.Container
  private jumper: Phaser.GameObjects.Container
  private scene: Phaser.Scene
  private torso: Phaser.GameObjects.Sprite
  private armL: Phaser.GameObjects.Sprite
  private armR: Phaser.GameObjects.Sprite
  private legL: Phaser.GameObjects.Sprite
  private legR: Phaser.GameObjects.Sprite
  private phase = 0
  private blend = 0
  private scale: number
  private lx = 0
  private ly = 0
  facingLeft = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textures: { torso: string; arm: string; leg: string },
    scale: number,
  ) {
    this.scene = scene
    this.scale = scale
    this.lx = x
    this.ly = y
    this.root = scene.add.container(isoX(x, y), isoY(x, y))
    this.jumper = scene.add.container(0, 0)
    this.bob = scene.add.container(0, 0)
    this.root.add(this.jumper)
    this.jumper.add(this.bob)
    this.torso = scene.add.sprite(0, 0, textures.torso)
    this.armL = scene.add.sprite(-9, 3, textures.arm).setOrigin(0.5, 0.12)
    this.armR = scene.add.sprite(9, 3, textures.arm).setOrigin(0.5, 0.12)
    this.legL = scene.add.sprite(-4.5, 9, textures.leg).setOrigin(0.5, 0)
    this.legR = scene.add.sprite(4.5, 9, textures.leg).setOrigin(0.5, 0)
    this.bob.add([this.legL, this.legR, this.torso, this.armL, this.armR])
    this.root.setScale(scale)
    this.root.setDepth(isoDepth(x, y))
  }

  get x(): number {
    return this.lx
  }

  get y(): number {
    return this.ly
  }

  setPosition(x: number, y: number): void {
    this.lx = x
    this.ly = y
    this.root.setPosition(isoX(x, y), isoY(x, y))
  }

  setDepth(): void {
    this.root.setDepth(isoDepth(this.lx, this.ly))
  }

  setFacing(left: boolean): void {
    this.facingLeft = left
    this.root.scaleX = left ? -this.scale : this.scale
  }

  setTint(color: number): void {
    for (const part of [this.torso, this.armL, this.armR, this.legL, this.legR]) part.setTint(color)
  }

  clearTint(): void {
    for (const part of [this.torso, this.armL, this.armR, this.legL, this.legR]) part.clearTint()
  }

  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha)
  }

  setAngle(angle: number): void {
    this.root.setAngle(angle)
  }

  /** Advance the gait by the distance just traveled. */
  step(distance: number, delta: number, cadence = 1): void {
    this.phase += distance * 0.11 * cadence
    this.blend += (1 - this.blend) * Math.min(1, delta * 0.008)
    this.pose()
  }

  /** Ease back to neutral and breathe. */
  rest(time: number, delta: number): void {
    this.blend += (0 - this.blend) * Math.min(1, delta * 0.008)
    this.pose()
    this.bob.scaleY = 1 + Math.sin(time * 0.0022) * 0.01
  }

  private pose(): void {
    const swing = Math.sin(this.phase) * this.blend
    this.legL.y = 9 + swing * 2.2
    this.legR.y = 9 - swing * 2.2
    this.armL.y = 3 - swing * 2.2
    this.armR.y = 3 + swing * 2.2
    this.bob.y = -Math.abs(Math.cos(this.phase)) * 1.6 * this.blend
    this.bob.scaleY = 1 - 0.03 * Math.abs(swing)
  }

  /** Quick visual jab that never touches logic position. */
  lunge(direction: 1 | -1): void {
    this.scene.tweens.killTweensOf(this.jumper)
    this.jumper.setPosition(0, 0)
    this.scene.tweens.add({ targets: this.jumper, x: direction * 13, duration: 85, yoyo: true, ease: "quad.out" })
  }

  hop(height = 7): void {
    this.scene.tweens.killTweensOf(this.jumper)
    this.jumper.setPosition(0, 0)
    this.scene.tweens.add({ targets: this.jumper, y: -height, duration: 130, yoyo: true, ease: "quad.out" })
  }
}

class QuadRig {
  readonly root: Phaser.GameObjects.Container
  readonly bob: Phaser.GameObjects.Container
  private jumper: Phaser.GameObjects.Container
  private scene: Phaser.Scene
  private body: Phaser.GameObjects.Sprite
  private legs: Phaser.GameObjects.Sprite[] = []
  private phase = Math.random() * 6
  private blend = 0
  private pitch = 0
  private pitchTarget = 0
  private stride: number
  private lx = 0
  private ly = 0
  facingLeft = true

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textures: { body: string; leg: string },
    scale: number,
    legXs: [number, number, number, number],
    legY: number,
    stride: number,
  ) {
    this.scene = scene
    this.stride = stride
    this.lx = x
    this.ly = y
    this.root = scene.add.container(isoX(x, y), isoY(x, y))
    this.jumper = scene.add.container(0, 0)
    this.bob = scene.add.container(0, 0)
    this.root.add(this.jumper)
    this.jumper.add(this.bob)
    this.body = scene.add.sprite(0, 0, textures.body)
    this.bob.add(this.body)
    for (const lx of legXs) {
      const leg = scene.add.sprite(lx, legY, textures.leg).setOrigin(0.5, 0.1)
      this.legs.push(leg)
      this.bob.add(leg)
    }
    this.root.setScale(scale)
    this.root.setDepth(isoDepth(x, y))
    this.setFacing(true)
  }

  get x(): number {
    return this.lx
  }

  get y(): number {
    return this.ly
  }

  setPosition(x: number, y: number): void {
    this.lx = x
    this.ly = y
    this.root.setPosition(isoX(x, y), isoY(x, y))
  }

  setDepth(): void {
    this.root.setDepth(isoDepth(this.lx, this.ly))
  }

  setFacing(left: boolean): void {
    this.facingLeft = left
    const s = Math.abs(this.root.scaleX) || 1
    this.root.scaleX = left ? s : -s
  }

  setBodyTexture(key: string): void {
    this.body.setTexture(key)
  }

  setTint(color: number): void {
    this.body.setTint(color)
    for (const leg of this.legs) leg.setTint(color)
  }

  clearTint(): void {
    this.body.clearTint()
    for (const leg of this.legs) leg.clearTint()
  }

  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha)
  }

  setAngle(angle: number): void {
    this.root.setAngle(angle)
  }

  setPitch(pitch: number): void {
    this.pitchTarget = pitch
  }

  step(distance: number, delta: number, cadence = 1): void {
    this.phase += distance * 0.09 * cadence
    this.blend += (1 - this.blend) * Math.min(1, delta * 0.008)
    this.pose(delta)
  }

  rest(time: number, delta: number): void {
    this.blend += (0 - this.blend) * Math.min(1, delta * 0.008)
    this.pose(delta)
    this.body.rotation = this.pitch + Math.sin(time * 0.0018) * 0.02
  }

  private pose(delta: number): void {
    const swing = Math.sin(this.phase) * this.blend
    this.legs[0].rotation = swing * this.stride
    this.legs[3].rotation = swing * this.stride
    this.legs[1].rotation = -swing * this.stride
    this.legs[2].rotation = -swing * this.stride
    this.pitch += (this.pitchTarget - this.pitch) * Math.min(1, delta * 0.006)
    this.body.rotation = 0.05 * swing + this.pitch
    this.bob.y = -Math.abs(Math.cos(this.phase)) * 1.1 * this.blend
  }

  hop(height = 8): void {
    this.scene.tweens.killTweensOf(this.jumper)
    this.jumper.setPosition(0, 0)
    this.scene.tweens.add({ targets: this.jumper, y: -height, duration: 140, yoyo: true, ease: "quad.out" })
  }
}

/** Minimal walker surface so bipeds and quads share wander logic. */
type WalkerVisual = {
  readonly root: Phaser.GameObjects.Container
  setFacing(left: boolean): void
  step(distance: number, delta: number, cadence?: number): void
  rest(time: number, delta: number): void
  setDepth(): void
}

/** Screen-fixed interface: HUD, banners, minimap, vignette.
 *  Lives in its own scene so camera zoom and scroll never touch it. */
class UIScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Text
  private message!: Phaser.GameObjects.Text
  private bannerTitle!: Phaser.GameObjects.Text
  private bannerSub!: Phaser.GameObjects.Text
  private minimapPlayer!: Phaser.GameObjects.Rectangle
  private minimapWolf!: Phaser.GameObjects.Rectangle
  private pendingHud: string[] | null = null
  private pendingMessage: string | null = null
  private pendingBanner: { title: string; sub: string } | null = null

  constructor() {
    super("ui")
  }

  private gameScene(): AenonScene | null {
    try {
      const scene = this.scene.get("aenon") as AenonScene | null
      return scene && scene.player ? scene : null
    } catch {
      return null
    }
  }

  private minimapXY(x: number, y: number): { x: number; y: number } {
    return { x: 792 + x * 0.05, y: 484 + y * 0.05 }
  }

  create(): void {
    this.add.rectangle(8, 8, 776, 100, 0x000000).setOrigin(0, 0).setFillStyle(0x101820, 1).setDepth(19)
    this.hud = this.add
      .text(16, 12, "", { color: "#ffffff", fontSize: "14px", lineSpacing: 4 })
      .setDepth(20)
    this.message = this.add
      .text(16, 500, "", { color: "#ffe9a8", fontSize: "14px" })
      .setDepth(20)
    this.add
      .rectangle(8, 492, 660, 34, 0x000000)
      .setOrigin(0, 0)
      .setFillStyle(0x101820, 1)
      .setDepth(19)
    this.message.setDepth(20)

    // Cinematic vignette.
    const vignette = this.add.graphics().setDepth(18)
    vignette.fillStyle(0x06090d, 0.3)
    vignette.fillRect(0, 0, 960, 40)
    vignette.fillRect(0, 560, 960, 40)
    vignette.fillRect(0, 0, 40, 600)
    vignette.fillRect(920, 0, 40, 600)

    // Region banner cards.
    this.bannerTitle = this.add
      .text(480, 140, "", {
        fontSize: "30px",
        fontStyle: "bold",
        color: "#fff8e6",
        backgroundColor: "#00000088",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0)
    this.bannerSub = this.add
      .text(480, 186, "", {
        fontSize: "15px",
        color: "#ffe9a8",
        backgroundColor: "#00000088",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0)

    // Minimap: regions, river, POIs, white Adventurer, red wolf.
    const frame = this.add.graphics().setDepth(60)
    frame.fillStyle(0x000000, 0.55)
    frame.fillRect(788, 480, 168, 108)
    frame.fillStyle(0x8a734f, 0.5)
    frame.fillRect(792, 484, 80, 100)
    frame.fillStyle(0x274156, 0.6)
    frame.fillRect(872, 484, 80, 100)
    frame.fillStyle(0x9fc6d8, 0.9)
    frame.fillRect(871, 484, 3, 100)
    const dot = (x: number, y: number, color: number): void => {
      const at = this.minimapXY(x, y)
      this.add.rectangle(at.x, at.y, 4, 4, color).setDepth(61)
    }
    dot(1050, 700, 0xf2c14e)
    dot(420, 1270, 0x9a7fd0)
    dot(1470, 950, 0x3fae5f)
    dot(852, 1460, 0xe08a3c)
    dot(2500, 700, 0x7fb8d4)
    dot(800, 950, 0xfff8e6)
    dot(830, 560, 0xc4a06a)
    this.minimapPlayer = this.add.rectangle(0, 0, 5, 5, 0xffffff).setDepth(62)
    this.minimapWolf = this.add.rectangle(0, 0, 5, 5, 0xd95f5f).setDepth(62)

    const game = this.gameScene()
    if (game) {
      this.setHud(game.hudLines())
      this.say(game.messageLine)
    }
    if (this.pendingHud) this.setHud(this.pendingHud)
    if (this.pendingMessage) this.say(this.pendingMessage)
    if (this.pendingBanner) this.showBanner(this.pendingBanner.title, this.pendingBanner.sub)
  }

  setHud(lines: string[]): void {
    if (!this.hud) {
      this.pendingHud = lines
      return
    }
    this.pendingHud = null
    this.hud.setText(lines.join("\n"))
  }

  say(line: string): void {
    if (!this.message) {
      this.pendingMessage = line
      return
    }
    this.pendingMessage = null
    this.message.setText(line)
  }

  showBanner(title: string, sub: string): void {
    if (!this.bannerTitle) {
      this.pendingBanner = { title, sub }
      return
    }
    this.bannerTitle.setText(title)
    this.bannerSub.setText(sub)
    for (const banner of [this.bannerTitle, this.bannerSub]) {
      this.tweens.killTweensOf(banner)
      banner.setAlpha(0)
    }
    this.tweens.add({ targets: [this.bannerTitle, this.bannerSub], alpha: 1, duration: 450, ease: "quad.out" })
    this.tweens.add({ targets: [this.bannerTitle, this.bannerSub], alpha: 0, duration: 700, delay: 2400 })
  }

  override update(): void {
    const game = this.gameScene()
    if (!game || !this.minimapPlayer) return
    const player = this.minimapXY(game.player.x, game.player.y)
    this.minimapPlayer.setPosition(player.x, player.y)
    const wolf = this.minimapXY(game.wolf.x, game.wolf.y)
    this.minimapWolf.setPosition(wolf.x, wolf.y)
  }
}

class AenonScene extends Phaser.Scene {
  private season!: Season
  player!: BipedRig
  private playerShadow!: Phaser.GameObjects.Image
  wolf!: QuadRig
  private wolfShadow!: Phaser.GameObjects.Image
  private wolfCry!: Phaser.GameObjects.Text
  private wolfTag!: Phaser.GameObjects.Text
  private john!: BipedRig
  private merchant!: BipedRig
  private reeds!: Phaser.GameObjects.Sprite
  private fire!: Phaser.GameObjects.Sprite
  private fireGlow!: Phaser.GameObjects.Image
  private sparkle!: Phaser.GameObjects.Image
  private slash!: Phaser.GameObjects.Image
  private waves: Phaser.GameObjects.Image[] = []
  private trees: Phaser.GameObjects.Sprite[] = []
  private wanderers: Wanderer[] = []
  private butterflies: Butterfly[] = []
  private fishes: Phaser.GameObjects.Sprite[] = []
  private birds: Array<{ sprite: Phaser.GameObjects.Sprite; phase: number }> = []
  private leafBurst!: Phaser.GameObjects.Particles.ParticleEmitter
  private emberBurst!: Phaser.GameObjects.Particles.ParticleEmitter
  private glintBurst!: Phaser.GameObjects.Particles.ParticleEmitter
  private ui!: UIScene
  private target: { x: number; y: number } | null = null
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  messageLine = ""
  private hereId = "aenon"
  private velX = 0
  private velY = 0
  private wolfTarget: { x: number; y: number } | null = null
  private wolfHoldUntil = 0
  private wolfFallen = false

  constructor() {
    super("aenon")
  }

  create(): void {
    const booted = bootSeason()
    if ("error" in booted) {
      this.add.text(24, 24, `Season failed to load: ${booted.error}`, { color: "#ff8080" })
      return
    }
    this.season = booted
    this.hereId = this.season.adventurer().placeId

    // Overlay interface scene, started explicitly for a deterministic order.
    // Moved above the world scene so HUD, banners, and minimap always win.
    this.scene.add("ui", UIScene, true)
    this.scene.moveUp("ui")
    this.ui = this.scene.get("ui") as UIScene

    this.createArt()

    // World: Aenon settlement (west of the river) and the Jordan
    // wilderness (east). One baked diamond floor; the camera follows the
    // Adventurer and the HUD lives in the overlay scene.
    this.add.rectangle(1600, 650, 3440, 1540, 0x1d3a24).setOrigin(0.5).setDepth(-200)
    this.add.text(isoX(80, 250), isoY(80, 250), "Aenon — settlement", { color: "#f5eeda" }).setDepth(6000)
    this.add.text(isoX(1760, 250), isoY(1760, 250), "The Jordan — wilderness", { color: "#dceef5" }).setDepth(6000)

    this.buildAenonDressing()
    this.buildJordanDressing()

    // Timber-stand: layered-canopy grove in the NW of Aenon.
    const treeSpots = [
      { x: 280, y: 520, tex: "tree-a" },
      { x: 380, y: 480, tex: "tree-b" },
      { x: 330, y: 610, tex: "tree-a" },
      { x: 450, y: 560, tex: "tree-b" },
      { x: 200, y: 650, tex: "tree-a" },
    ]
    for (const [index, spot] of treeSpots.entries()) {
      const tree = this.add.sprite(spot.x, spot.y, spot.tex).setScale(ART_SCALE)
      tree.setDepth(spot.y)
      this.trees.push(tree)
      this.tweens.add({
        targets: tree,
        angle: 1,
        duration: 2600 + index * 500,
        yoyo: true,
        repeat: -1,
        ease: "sine.inout",
        delay: index * 700,
      })
    }

    // Reeds: the scripture object, by the west bank of the river.
    this.reeds = this.add.sprite(1470, 950, "reeds").setScale(ART_SCALE)
    this.reeds.setDepth(this.reeds.y)

    // John + staff east of the plaza, on the trail to the river.
    this.john = new BipedRig(
      this,
      1050,
      700,
      { torso: "rig-john-t", arm: "rig-john-arm", leg: "rig-john-leg" },
      ART_SCALE,
    )
    this.john.setDepth()
    const staff = this.add.sprite(15, 8, "john-staff").setOrigin(0.5, 0.9)
    this.john.bob.add(staff)
    this.tweens.add({ targets: staff, rotation: 0.05, duration: 1600, yoyo: true, repeat: -1, ease: "sine.inout" })
    this.merchant = new BipedRig(
      this,
      420,
      1270,
      { torso: "rig-mer-t", arm: "rig-mer-arm", leg: "rig-mer-leg" },
      ART_SCALE,
    )
    this.merchant.setDepth()
    this.add.image(1050, 730, "shadow").setDepth(2).setAlpha(0.6)
    this.add.image(420, 1300, "shadow").setDepth(2).setAlpha(0.6)

    // Camp: two tents + campfire with breathing glow, south of the plaza.
    const tent = this.add.sprite(800, 1420, "tent").setScale(2)
    tent.setDepth(1420)
    const tent2 = this.add.sprite(905, 1440, "tent").setScale(1.7)
    tent2.setDepth(1440)
    this.fireGlow = this.add.image(852, 1475, "glow").setDepth(1474).setAlpha(0.5).setScale(2.4)
    this.fire = this.add.sprite(852, 1475, "fire-a").setScale(ART_SCALE).setDepth(1476)
    this.time.addEvent({
      delay: 280,
      loop: true,
      callback: () => {
        this.fire.setTexture(this.fire.texture.key === "fire-a" ? "fire-b" : "fire-a")
      },
    })
    this.tweens.add({
      targets: this.fireGlow,
      alpha: 0.32,
      scale: 2.8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "sine.inout",
    })

    // Wolf roams the deep wilderness, far east of the river.
    this.wolf = new QuadRig(
      this,
      2300,
      1050,
      { body: "rig-wolf-b", leg: "rig-wolf-leg" },
      ART_SCALE,
      [-6, -4, 5, 7],
      2.5,
      0.5,
    )
    this.wolf.setDepth()
    this.wolfCry = this.add
      .text(0, 0, "!", { color: "#ffd94e", fontSize: "24px", fontStyle: "bold" })
      .setVisible(false)
      .setDepth(30)
    this.wolfTag = this.add
      .text(0, 0, "wolf", {
        color: "#fff8e6",
        fontSize: "11px",
        backgroundColor: "#00000066",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(6000)

    // Soft shadows follow the walkers.
    this.playerShadow = this.add.image(0, 0, "shadow").setDepth(-10).setAlpha(0.8)
    this.wolfShadow = this.add.image(isoX(this.wolf.x, this.wolf.y), isoY(this.wolf.x, this.wolf.y) + 20, "shadow").setDepth(-10).setAlpha(0.8)
    this.wolfTag.setPosition(isoX(this.wolf.x, this.wolf.y), isoY(this.wolf.x, this.wolf.y) - 42)

    // Floating name tags keep the scene readable.
    const tag = (x: number, y: number, label: string): void => {
      this.add
        .text(isoX(x, y), isoY(x, y), label, { color: "#fff8e6", fontSize: "11px", backgroundColor: "#00000066", padding: { x: 4, y: 2 } })
        .setOrigin(0.5)
        .setDepth(6000)
    }
    tag(330, 448, "timber-stand")
    tag(1470, 912, "reeds · read")
    tag(1050, 652, "John")
    tag(420, 1232, "merchant · rope")
    tag(852, 1390, "camp")
    tag(2500, 648, "cache pool")
    tag(800, 902, "well")
    tag(1150, 1298, "sheep pen")

    const start = this.hereId === "jordan" ? { x: 2200, y: 1050 } : { x: 650, y: 1050 }
    this.player = new BipedRig(
      this,
      start.x,
      start.y,
      { torso: "rig-adv-t", arm: "rig-adv-arm", leg: "rig-adv-leg" },
      ART_SCALE,
    )
    this.player.setDepth()
    this.playerShadow.setPosition(isoX(start.x, start.y), isoY(start.x, start.y) + 32)

    // The camera follows the Adventurer through projected space.
    const camera = this.cameras.main
    camera.setBounds(0, 0, WORLD_W, 1340)
    camera.setZoom(ZOOM)
    camera.centerOn(isoX(start.x, start.y), isoY(start.x, start.y))
    camera.startFollow(this.player.root, false, 0.12, 0.12)

    // Slash + sparkle effects, hidden until an action fires them.
    this.slash = this.add.image(isoX(start.x, start.y), isoY(start.x, start.y), "slash").setVisible(false).setDepth(7000).setScale(1.6)
    this.sparkle = this.add.image(isoX(1470, 934), isoY(1470, 934), "sparkle").setVisible(false).setDepth(7000).setScale(2)

    // Particle bursts: leaves, embers, glints. Plus ambient fire embers.
    this.leafBurst = this.add.particles(0, 0, "tuft", {
      speed: { min: 40, max: 130 },
      lifespan: { min: 350, max: 700 },
      scale: { min: 0.7, max: 1.3 },
      alpha: { start: 1, end: 0 },
      gravityY: 170,
      frequency: -1,
    })
    this.leafBurst.setDepth(7000)
    this.emberBurst = this.add.particles(0, 0, "mote", {
      speed: { min: 30, max: 110 },
      lifespan: { min: 400, max: 900 },
      scale: { min: 0.8, max: 1.6 },
      alpha: { start: 1, end: 0 },
      gravityY: -60,
      frequency: -1,
      tint: 0xe08a3c,
    })
    this.emberBurst.setDepth(7000)
    this.glintBurst = this.add.particles(0, 0, "sparkle", {
      speed: { min: 30, max: 100 },
      lifespan: { min: 400, max: 800 },
      scale: { min: 0.5, max: 1 },
      alpha: { start: 1, end: 0 },
      gravityY: 40,
      frequency: -1,
    })
    this.glintBurst.setDepth(7000)
    const embers = this.add.particles(isoX(852, 1462), isoY(852, 1462), "mote", {
      speedX: { min: -10, max: 10 },
      speedY: { min: -46, max: -14 },
      lifespan: 1500,
      frequency: 280,
      scale: { min: 0.5, max: 1 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xe08a3c,
    })
    embers.setDepth(7000)

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Screen-space gate keeps HUD clicks from moving the Adventurer.
      // Unproject through the camera into logical world coordinates.
      if (pointer.y > HUD_TOP) {
        const camera = this.cameras.main
        const goal = isoInverse(camera.scrollX + pointer.x / camera.zoom, camera.scrollY + pointer.y / camera.zoom)
        this.target = { x: goal.x, y: goal.y }
      }
    })

    const keyboard = this.input.keyboard
    if (keyboard) {
      this.keys = keyboard.addKeys(
        "W,A,S,D,UP,DOWN,LEFT,RIGHT,G,F,H,R,J,T,B,SPACE",
      ) as Record<string, Phaser.Input.Keyboard.Key>
      keyboard.on("keydown-G", () => this.doGather())
      keyboard.on("keydown-F", () => this.doFace())
      keyboard.on("keydown-SPACE", () => this.doSwing())
      keyboard.on("keydown-H", () => this.doHunt())
      keyboard.on("keydown-R", () => this.doRead())
      keyboard.on("keydown-J", () => this.doLookJohn())
      keyboard.on("keydown-T", () => this.doSpeakJohn())
      keyboard.on("keydown-B", () => this.doBuyRope())
    }

    // The rigs breathe on their own; no positioned tweens needed here.

    this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        if (!this.wolfFallen) this.wolfTarget = this.randomJordanSpot()
      },
    })

    this.buildAmbience()
    if (this.hereId === "jordan") this.showBanner("The Jordan", "wilderness · the wolf roams here")
    else this.showBanner("Aenon", "where John is baptizing")

    showNotice(
      "Passage panel",
      "Read the reeds at Aenon (R) to file John 1:29. The text + copyright load live from the passage server.",
    )
    this.refreshHud()
    this.say(`You wake in ${this.hereId === "jordan" ? "the Jordan." : "Aenon, where John is baptizing."}`)
  }

  private createArt(): void {
    pixelTexture(this, "tree-a", TREE_A, TREE_PALETTE)
    pixelTexture(this, "tree-b", TREE_B, TREE_PALETTE)
    pixelTexture(this, "reeds", REEDS_ROWS, { C: 0xe8d9a0, G: 0x3fae5f, D: 0x257a48 })
    pixelTexture(this, "tent", TENT_ROWS, TENT_PALETTE)
    pixelTexture(this, "fire-a", FIRE_A, FIRE_PALETTE)
    pixelTexture(this, "fire-b", FIRE_B, FIRE_PALETTE)
    pixelTexture(this, "jars", JARS_ROWS, PROP_PALETTE)
    pixelTexture(this, "rock", ROCK_ROWS, PROP_PALETTE)
    pixelTexture(this, "bush", BUSH_ROWS, PROP_PALETTE)
    pixelTexture(this, "tuft", TUFT_ROWS, PROP_PALETTE)
    pixelTexture(this, "pebble", PEBBLE_ROWS, PROP_PALETTE)
    pixelTexture(this, "flower-r", FLOWER_R, PROP_PALETTE)
    pixelTexture(this, "flower-y", FLOWER_Y, PROP_PALETTE)
    pixelTexture(this, "wave", WAVE_ROWS, { L: 0x7fb8d4 })
    pixelTexture(this, "bird-0", BIRD_ROWS_A, { W: 0x3a3d45 })
    pixelTexture(this, "bird-1", BIRD_ROWS_B, { W: 0x3a3d45 })
    pixelTexture(this, "bfly-0", BUTTERFLY_A, { O: 0xe08a3c, B: 0x2b2018 })
    pixelTexture(this, "bfly-1", BUTTERFLY_B, { O: 0xe08a3c, B: 0x2b2018 })
    pixelTexture(this, "fish", FISH_ROWS, { F: 0x9fc6d8, E: 0x1b2f42, T: 0x7fb8d4 })
    pixelTexture(this, "well", WELL_ROWS, WELL_PALETTE)
    pixelTexture(this, "stall", STALL_ROWS, STALL_PALETTE)
    pixelTexture(this, "palm", PALM_ROWS, PALM_PALETTE)
    pixelTexture(this, "deadtree", DEAD_ROWS, DEAD_PALETTE)
    pixelTexture(this, "stone", STONE_ROWS, STONE_PALETTE)
    pixelTexture(this, "barrel", BARREL_ROWS, PROPS_PALETTE)
    pixelTexture(this, "crate", CRATE_ROWS, PROPS_PALETTE)
    pixelTexture(this, "lamp", LAMP_ROWS, PROPS_PALETTE)
    pixelTexture(this, "sign", SIGN_ROWS, PROPS_PALETTE)
    // Paper-doll rig parts. Torsos reuse the head/torso rows of each cast map.
    pixelTexture(this, "rig-adv-t", ADV_TORSO, ADV_PALETTE)
    pixelTexture(this, "rig-adv-arm", BIPED_ARM, ADV_PALETTE)
    pixelTexture(this, "rig-adv-leg", BIPED_LEG, ADV_PALETTE)
    pixelTexture(this, "rig-vila-t", ADV_TORSO, VILLAGER_A_PALETTE)
    pixelTexture(this, "rig-vila-arm", BIPED_ARM, VILLAGER_A_PALETTE)
    pixelTexture(this, "rig-vila-leg", BIPED_LEG, VILLAGER_A_PALETTE)
    pixelTexture(this, "rig-vilb-t", ADV_TORSO, VILLAGER_B_PALETTE)
    pixelTexture(this, "rig-vilb-arm", BIPED_ARM, VILLAGER_B_PALETTE)
    pixelTexture(this, "rig-vilb-leg", BIPED_LEG, VILLAGER_B_PALETTE)
    pixelTexture(this, "rig-john-t", JOHN_ROWS.slice(0, 20), JOHN_PALETTE)
    pixelTexture(this, "rig-john-arm", JOHN_ARM, JOHN_PALETTE)
    pixelTexture(this, "rig-john-leg", BIPED_LEG, JOHN_PALETTE)
    pixelTexture(this, "john-staff", STAFF_ROWS, JOHN_PALETTE)
    pixelTexture(this, "rig-mer-t", MERCHANT_ROWS.slice(0, 19), MERCHANT_PALETTE)
    pixelTexture(this, "rig-mer-arm", MERCHANT_ARM, MERCHANT_PALETTE)
    pixelTexture(this, "rig-mer-leg", BIPED_LEG, MERCHANT_PALETTE)
    pixelTexture(this, "rig-wolf-b", WOLF_STAND.slice(0, 7), WOLF_PALETTE)
    pixelTexture(this, "rig-wolf-leg", WOLF_LEG, WOLF_PALETTE)
    pixelTexture(this, "rig-sheep-b", SHEEP_STAND.slice(0, 8), SHEEP_PALETTE)
    pixelTexture(this, "rig-sheep-leg", SHEEP_LEG, SHEEP_PALETTE)

    // Soft drifting cloud-shade blob.
    if (!this.textures.exists("shadeblob")) {
      const blob = this.make.graphics({ x: 0, y: 0 })
      blob.fillStyle(0x0b1116, 0.1)
      blob.fillEllipse(48, 24, 96, 48)
      blob.fillStyle(0x0b1116, 0.08)
      blob.fillEllipse(48, 24, 64, 32)
      blob.generateTexture("shadeblob", 96, 48)
      blob.destroy()
    }

    // Soft oval shadow shared by every walker.
    if (!this.textures.exists("shadow")) {
      const shadow = this.make.graphics({ x: 0, y: 0 })
      shadow.fillStyle(0x000000, 0.28)
      shadow.fillEllipse(0, 0, 26, 9)
      shadow.generateTexture("shadow", 26, 9)
      shadow.destroy()
    }

    // Warm radial glow for the campfire.
    if (!this.textures.exists("glow")) {
      const glow = this.make.graphics({ x: 0, y: 0 })
      glow.fillStyle(0xf2a14e, 0.25)
      glow.fillCircle(16, 16, 16)
      glow.fillStyle(0xf2c14e, 0.35)
      glow.fillCircle(16, 16, 10)
      glow.generateTexture("glow", 32, 32)
      glow.destroy()
    }

    // Striped vendor rug.
    if (!this.textures.exists("rug")) {
      const rug = this.make.graphics({ x: 0, y: 0 })
      rug.fillStyle(0x7a2e1f, 1)
      rug.fillRect(0, 0, 72, 30)
      rug.fillStyle(0xb8452e, 1)
      rug.fillRect(3, 3, 66, 24)
      rug.fillStyle(0xe08a3c, 1)
      rug.fillRect(3, 6, 66, 4)
      rug.fillRect(3, 20, 66, 4)
      rug.fillStyle(0xf2c14e, 1)
      rug.fillRect(3, 13, 66, 4)
      rug.generateTexture("rug", 72, 30)
      rug.destroy()
    }

    // Bold ring slash for swings.
    if (!this.textures.exists("slash")) {
      const slash = this.make.graphics({ x: 0, y: 0 })
      slash.lineStyle(5, 0xfff3c4, 1)
      slash.strokeCircle(16, 16, 12)
      slash.lineStyle(4, 0xf2c14e, 1)
      slash.lineBetween(8, 24, 24, 8)
      slash.generateTexture("slash", 32, 32)
      slash.destroy()
    }

    // Four-point sparkle for readings and purchases.
    if (!this.textures.exists("sparkle")) {
      const sparkle = this.make.graphics({ x: 0, y: 0 })
      sparkle.fillStyle(0xfff3c4, 1)
      sparkle.fillRect(6, 0, 4, 16)
      sparkle.fillRect(0, 6, 16, 4)
      sparkle.fillStyle(0xffffff, 1)
      sparkle.fillRect(7, 7, 2, 2)
      sparkle.generateTexture("sparkle", 16, 16)
      sparkle.destroy()
    }

    // Tiny dust mote for ambient drift.
    if (!this.textures.exists("mote")) {
      const mote = this.make.graphics({ x: 0, y: 0 })
      mote.fillStyle(0xfff8e6, 1)
      mote.fillRect(0, 0, 3, 3)
      mote.generateTexture("mote", 3, 3)
      mote.destroy()
    }

    this.bakeGround()
  }

  /** Villagers, sheep, fish, butterflies, clouds, and birds. */
  private buildAmbience(): void {
    // Villagers stroll the plaza and the market. Sheep pace the pen and graze.
    const vilA = new BipedRig(
      this,
      800,
      950,
      { torso: "rig-vila-t", arm: "rig-vila-arm", leg: "rig-vila-leg" },
      ART_SCALE,
    )
    this.addWanderer(vilA, 650, 950, 850, 1100, 34, 2.5, "villager", false)
    const vilB = new BipedRig(
      this,
      420,
      1300,
      { torso: "rig-vilb-t", arm: "rig-vilb-arm", leg: "rig-vilb-leg" },
      ART_SCALE,
    )
    this.addWanderer(vilB, 280, 560, 1220, 1400, 34, 2.5, "villager", false)
    for (const [x, y] of [
      [1130, 1340],
      [1170, 1360],
      [1150, 1320],
    ] as Array<[number, number]>) {
      const sheep = new QuadRig(
        this,
        x,
        y,
        { body: "rig-sheep-b", leg: "rig-sheep-leg" },
        ART_SCALE,
        [-3.5, -1.5, 1.5, 3.5],
        3,
        0.3,
      )
      this.addWanderer(sheep, 1090, 1210, 1310, 1390, 20, 3, null, true)
    }

    // Fish work the river channel.
    for (const [x, y] of [
      [1615, 600],
      [1645, 1000],
      [1660, 1400],
      [1630, 1700],
    ] as Array<[number, number]>) {
      const fish = this.add.sprite(isoX(x, y), isoY(x, y), "fish").setScale(2).setDepth(3).setAlpha(0.85)
      this.fishes.push(fish)
      this.tweens.add({
        targets: fish,
        y: fish.y + 90,
        duration: 4200,
        yoyo: true,
        repeat: -1,
        ease: "sine.inout",
      })
    }

    // Butterflies loop over the flower patches.
    const butterflySpots: Array<[number, number]> = [
      [600, 1200],
      [950, 1100],
      [350, 900],
      [1200, 600],
      [800, 700],
      [1300, 1500],
    ]
    for (const [index, [cx, cy]] of butterflySpots.entries()) {
      const sprite = this.add.sprite(isoX(cx, cy), isoY(cx, cy), "bfly-0").setScale(2).setDepth(isoDepth(cx, cy))
      this.butterflies.push({ sprite, cx, cy, rx: 70, ry: 45, speed: 0.0011 + index * 0.0002, phase: index * 1.7 })
    }

    // Cloud-shade drifts over everything, slowly.
    for (const [x, y, scale, duration] of [
      [500, 750, 4, 110000],
      [2000, 1250, 5, 140000],
    ] as Array<[number, number, number, number]>) {
      const cloud = this.add.image(x, y, "shadeblob").setScale(scale).setDepth(16)
      this.tweens.add({
        targets: cloud,
        x: WORLD_W + 300,
        duration,
        repeat: -1,
        onRepeat: () => cloud.setX(-300),
      })
    }

    // Birds cross the sky every few seconds.
    this.time.addEvent({
      delay: 5500,
      loop: true,
      callback: () => this.spawnBird(),
    })
    this.spawnBird()
  }

  private addWanderer(
    visual: WalkerVisual,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    speed: number,
    cadence: number,
    label: string | null,
    graze: boolean,
  ): void {
    const tag = label
      ? this.add
          .text(visual.root.x, visual.root.y - 42, label, {
            color: "#fff8e6",
            fontSize: "11px",
            backgroundColor: "#00000066",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setDepth(20)
      : null
    this.wanderers.push({
      visual,
      minX,
      maxX,
      minY,
      maxY,
      target: { x: visual.root.x, y: visual.root.y },
      speed,
      cadence,
      label: tag,
      graze,
      grazeUntil: 0,
      nextGraze: this.time.now + 2000 + Math.random() * 4000,
    })
  }

  private spawnBird(): void {
    if (this.birds.length >= 3) return
    const y = 300 + Math.random() * 300
    const bird = this.add.sprite(-60, y, "bird-0").setScale(2).setDepth(y)
    this.birds.push({ sprite: bird, phase: Math.random() * 10 })
    this.tweens.add({
      targets: bird,
      x: WORLD_W + 60,
      duration: 30000,
      onComplete: () => {
        this.birds = this.birds.filter((entry) => entry.sprite !== bird)
        bird.destroy()
      },
    })
  }

  private showBanner(title: string, sub: string): void {
    this.ui.showBanner(title, sub)
  }

  private objectiveFor(me: {
    referenceJournal: readonly unknown[]
    trainedSkills: Record<string, { level: number }>
    fight: unknown
    carcasses: readonly unknown[]
    fallenHostiles: readonly string[]
  }): string {
    if (me.referenceJournal.length === 0) return "Read the reeds by the east riverbank (walk east, R)"
    if (me.trainedSkills["Woodcutting"]?.level <= 1) return "Cut wood at the timber-stand (G)"
    if (me.fight !== null) return "Finish the fight (SPACE to swing)"
    if (me.carcasses.length > 0) return "Hunt the fallen wolf (H)"
    if (!me.fallenHostiles.includes("wolf")) return "Cross the river and face the wolf (F)"
    return "Train skills, work the land, and return to John"
  }

  private updateWanderers(time: number, delta: number): void {
    for (const walker of this.wanderers) {
      const pos = walker.visual.root
      const dx = walker.target.x - pos.x
      const dy = walker.target.y - pos.y
      const distance = Math.hypot(dx, dy)
      if (distance < 8) {
        walker.target = {
          x: Phaser.Math.Between(walker.minX, walker.maxX),
          y: Phaser.Math.Between(walker.minY, walker.maxY),
        }
        walker.visual.rest(time, delta)
      } else {
        const step = (walker.speed * delta) / 1000
        const moveX = (dx / distance) * Math.min(step, distance)
        const moveY = (dy / distance) * Math.min(step, distance)
        pos.x += moveX
        pos.y += moveY
        if (Math.abs(dx) > 4) walker.visual.setFacing(dx < 0)
        walker.visual.step(Math.hypot(moveX, moveY), delta, walker.cadence)
      }
      walker.visual.setDepth()
      if (walker.label) walker.label.setPosition(isoX(pos.x, pos.y), isoY(pos.x, pos.y) - 42)
      if (walker.graze && walker.visual instanceof QuadRig) {
        if (time > walker.nextGraze) {
          walker.grazeUntil = time + 2600
          walker.nextGraze = time + 5200 + Math.random() * 3000
        }
        walker.visual.setPitch(time < walker.grazeUntil ? 0.3 : 0)
      }
    }
  }

  private updateButterflies(time: number): void {
    for (const fly of this.butterflies) {
      const t = time * fly.speed + fly.phase
      const x = fly.cx + Math.cos(t) * fly.rx
      const y = fly.cy + Math.sin(t * 1.4) * fly.ry
      fly.sprite.setPosition(isoX(x, y), isoY(x, y))
      fly.sprite.setTexture(Math.floor(time / 260 + fly.phase) % 2 === 0 ? "bfly-0" : "bfly-1")
    }
  }

  private updateFishAndBirds(time: number): void {
    for (const [index, fish] of this.fishes.entries()) {
      fish.setRotation(Math.sin(time * 0.004 + index * 2) * 0.2)
    }
    for (const bird of this.birds) {
      bird.sprite.setTexture(Math.floor(time / 220 + bird.phase) % 2 === 0 ? "bird-0" : "bird-1")
    }
  }

  /** Bakes the whole world floor once: diamond tiles, river, trails, plaza,
   *  pools. One static quad instead of thousands of objects. */
  private bakeGround(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 })
    const random = mulberry32(7)
    const shadesA = [0x8a734f, 0x877350, 0x8d7752, 0x847052]
    const shadesB = [0x274156, 0x294659, 0x253e50, 0x2b4a60]
    // Diamond field, one diamond per 48px logical cell.
    for (let gx = 0; gx < 67; gx += 1) {
      for (let gy = 0; gy < 42; gy += 1) {
        const cx = isoX(gx * 48 + 24, gy * 48 + 24)
        const cy = isoY(gx * 48 + 24, gy * 48 + 24)
        const west = gx * 48 + 24 < RIVER_WEST
        const shades = west ? shadesA : shadesB
        graphics.fillStyle(shades[Math.floor(random() * shades.length)], 1)
        graphics.fillPoints([v2(cx, cy - 12), v2(cx + 24, cy), v2(cx, cy + 12), v2(cx - 24, cy)], true)
      }
    }
    // Speckle.
    for (let i = 0; i < 1600; i += 1) {
      const x = random() * WORLD_W
      const y = random() * WORLD_H
      const west = x < RIVER_WEST
      graphics.fillStyle(west ? (random() < 0.5 ? 0x6f5a3c : 0xa89064) : 0x1b2f42, 0.5)
      graphics.fillRect(isoX(x, y), isoY(x, y), 2, 2)
    }
    // River: water band between sandy banks, full height.
    const riverPoly = (x0: number, x1: number, color: number): void => {
      graphics.fillStyle(color, 1)
      graphics.fillPoints(
        [v2(isoX(x0, 0), isoY(x0, 0)), v2(isoX(x1, 0), isoY(x1, 0)), v2(isoX(x1, WORLD_H), isoY(x1, WORLD_H)), v2(isoX(x0, WORLD_H), isoY(x0, WORLD_H))],
        true,
      )
    }
    riverPoly(RIVER_WEST - 30, RIVER_WEST, 0x9a8258)
    riverPoly(RIVER_EAST, RIVER_EAST + 32, 0x9a8258)
    riverPoly(RIVER_WEST, RIVER_EAST, 0x3a6280)
    graphics.lineStyle(3, 0x9fc6d8, 0.8)
    graphics.lineBetween(isoX(RIVER_WEST, 0), isoY(RIVER_WEST, 0), isoX(RIVER_WEST, WORLD_H), isoY(RIVER_WEST, WORLD_H))
    graphics.lineBetween(isoX(RIVER_EAST, 0), isoY(RIVER_EAST, 0), isoX(RIVER_EAST, WORLD_H), isoY(RIVER_EAST, WORLD_H))
    // Dirt trails from the plaza: grove, farms, John, market, camp, pen, reeds.
    graphics.fillStyle(0x9a8258, 0.85)
    const dots: Array<[number, number, number, number]> = [
      [650, 850, 60, 15],
      [520, 750, 60, 15],
      [420, 660, 60, 15],
      [780, 800, 56, 15],
      [760, 650, 56, 15],
      [750, 520, 56, 15],
      [920, 860, 64, 15],
      [990, 780, 60, 15],
      [1030, 730, 54, 14],
      [650, 1050, 64, 15],
      [540, 1150, 64, 15],
      [460, 1220, 60, 15],
      [800, 1100, 60, 15],
      [810, 1220, 60, 15],
      [825, 1330, 60, 15],
      [950, 1050, 64, 15],
      [1050, 1180, 64, 15],
      [1120, 1280, 60, 15],
      [1200, 760, 64, 15],
      [1320, 830, 64, 15],
      [1420, 900, 64, 15],
      [550, 1350, 60, 14],
      [650, 1400, 60, 14],
      [750, 1420, 60, 14],
    ]
    for (const [x, y, w, h] of dots) graphics.fillEllipse(isoX(x, y), isoY(x, y), w, h)
    graphics.fillStyle(0xa89064, 0.7)
    for (const [x, y, w, h] of dots) graphics.fillEllipse(isoX(x, y), isoY(x, y), w * 0.6, h * 0.55)
    // Plaza + cache pools, squashed to lie on the ground plane.
    graphics.fillStyle(0x9a8258, 0.8)
    graphics.fillEllipse(isoX(800, 950), isoY(800, 950), 230, 82)
    graphics.fillStyle(0xa89064, 0.7)
    graphics.fillEllipse(isoX(800, 950), isoY(800, 950), 150, 52)
    graphics.fillStyle(0x3f6f8f, 1)
    graphics.fillEllipse(isoX(2500, 700), isoY(2500, 700), 56, 22)
    graphics.fillStyle(0x5a93b5, 1)
    graphics.fillEllipse(isoX(2500, 700), isoY(2500, 700), 38, 14)
    for (const [px, py] of [
      [2100, 1300],
      [2700, 1400],
    ] as Array<[number, number]>) {
      graphics.fillStyle(0x3f6f8f, 1)
      graphics.fillEllipse(isoX(px, py), isoY(px, py), 44, 17)
      graphics.fillStyle(0x5a93b5, 1)
      graphics.fillEllipse(isoX(px, py), isoY(px, py), 30, 11)
    }
    const groundKey = "ground-baked"
    if (!this.textures.exists(groundKey)) {
      graphics.generateTexture(groundKey, WORLD_W, 1340)
    }
    graphics.destroy()
    this.add.image(0, 0, groundKey).setOrigin(0, 0).setDepth(-100)
  }

    /** Settlement dressing on the diamond: well plaza, mudbrick house, crop
   *  fields, market, sheep pen, groves, and verge scatter. */
  private buildAenonDressing(): void {
    const put = (x: number, y: number, tex: string, scale: number): Phaser.GameObjects.Sprite => {
      const sprite = this.add.sprite(isoX(x, y), isoY(x, y), tex).setScale(scale)
      sprite.setDepth(isoDepth(x, y))
      return sprite
    }

    // North fence run in chunks so each length sorts against walkers.
    for (let run = 0; run < 6; run += 1) {
      const x0 = 80 + run * 240
      const fence = this.add.graphics()
      fence.setDepth(isoDepth(x0 + 240, 300))
      const ax = isoX(x0, 300)
      const ay = isoY(x0, 300)
      const bx = isoX(x0 + 240, 300)
      const by = isoY(x0 + 240, 300)
      fence.lineStyle(3, 0x7a5230, 1)
      fence.lineBetween(ax, ay - 5, bx, by - 5)
      fence.lineBetween(ax, ay - 9, bx, by - 9)
      fence.fillStyle(0x5d3f2a, 1)
      for (let x = x0; x <= x0 + 240; x += 24) {
        fence.fillRect(isoX(x, 300) - 2, isoY(x, 300) - 12, 4, 12)
      }
    }

    // Well plaza: the well itself; the packed earth is baked into the floor.
    put(800, 950, "well", 2.5)

    // Mudbrick house with a thatch roof, north of the plaza. The drawing
    // stays in its own local frame; only the frame origin is projected.
    const house = this.add.graphics()
    house.setPosition(isoX(830, 600) - 830, isoY(830, 600) - 600)
    house.setDepth(isoDepth(830, 620))
    house.fillStyle(0x000000, 0.25)
    house.fillEllipse(830, 668, 150, 12)
    house.fillStyle(0xbb9663, 1)
    house.fillRect(775, 585, 110, 70)
    house.fillStyle(0x8a6a3f, 0.35)
    for (let y = 595; y <= 655; y += 10) house.fillRect(775, y, 110, 2)
    house.fillStyle(0x8a6a3f, 1)
    house.fillTriangle(755, 590, 905, 590, 830, 505)
    house.fillStyle(0xa3804f, 1)
    house.fillTriangle(775, 585, 885, 585, 830, 522)
    house.fillStyle(0x5d3f2a, 1)
    house.fillRect(828, 508, 4, 70)
    house.fillStyle(0x3a2a18, 1)
    house.fillRect(820, 620, 20, 35)
    house.fillStyle(0xf5e6b8, 1)
    house.fillRect(788, 610, 16, 14)
    house.fillRect(856, 610, 16, 14)
    house.fillStyle(0x3a2a18, 1)
    house.fillRect(795, 610, 2, 14)
    house.fillRect(863, 610, 2, 14)

    // Crop fields: soil parallelograms with sprout grids, railed in.
    for (const [fx0, fy0, fx1, fy1] of [
      [540, 365, 860, 495],
      [920, 365, 1200, 495],
    ] as Array<[number, number, number, number]>) {
      const field = this.add.graphics().setDepth(-50)
      field.fillStyle(0x6b5335, 1)
      field.fillPoints(
        [v2(isoX(fx0, fy0), isoY(fx0, fy0)), v2(isoX(fx1, fy0), isoY(fx1, fy0)), v2(isoX(fx1, fy1), isoY(fx1, fy1)), v2(isoX(fx0, fy1), isoY(fx0, fy1))],
        true,
      )
      field.fillStyle(0x46b464, 1)
      for (let lx = fx0 + 12; lx < fx1; lx += 16) {
        for (let ly = fy0 + 12; ly < fy1; ly += 16) {
          field.fillRect(isoX(lx, ly), isoY(lx, ly), 3, 3)
        }
      }
      this.railsRect(fx0, fy0, fx1, fy1)
    }

    // Market stalls southwest, jars by the merchant rug.
    put(300, 1350, "stall", 2)
    put(560, 1360, "stall", 2).setFlipX(true)
    // Stall keepers mind the counters (breathing rigs rooted in place).
    const keeperA = new BipedRig(
      this,
      300,
      1336,
      { torso: "rig-vila-t", arm: "rig-vila-arm", leg: "rig-vila-leg" },
      2,
    )
    keeperA.setDepth()
    const keeperB = new BipedRig(
      this,
      560,
      1346,
      { torso: "rig-vilb-t", arm: "rig-vilb-arm", leg: "rig-vilb-leg" },
      2,
    )
    keeperB.setDepth()
    this.wanderers.push(
      {
        visual: keeperA,
        minX: 300,
        maxX: 300,
        minY: 1336,
        maxY: 1336,
        target: { x: 300, y: 1336 },
        speed: 0,
        cadence: 1,
        label: null,
        graze: false,
        grazeUntil: 0,
        nextGraze: Number.POSITIVE_INFINITY,
      },
      {
        visual: keeperB,
        minX: 560,
        maxX: 560,
        minY: 1346,
        maxY: 1346,
        target: { x: 560, y: 1346 },
        speed: 0,
        cadence: 1,
        label: null,
        graze: false,
        grazeUntil: 0,
        nextGraze: Number.POSITIVE_INFINITY,
      },
    )
    this.add.image(isoX(300, 1362), isoY(300, 1362), "shadow").setDepth(-10).setAlpha(0.6)
    this.add.image(isoX(560, 1372), isoY(560, 1372), "shadow").setDepth(-10).setAlpha(0.6)
    for (const [x, y, tex] of [
      [250, 1382, "barrel"],
      [276, 1376, "barrel"],
      [612, 1390, "barrel"],
      [850, 1402, "crate"],
      [880, 1396, "crate"],
      [770, 920, "barrel"],
    ] as Array<[number, number, string]>) {
      put(x, y, tex, 2)
    }
    // Lamps along the plaza walks; signposts where trails meet.
    for (const [x, y] of [
      [700, 860],
      [900, 860],
      [700, 1040],
      [900, 1040],
    ] as Array<[number, number]>) {
      put(x, y, "lamp", 2)
    }
    for (const [x, y] of [
      [830, 1000],
      [1540, 950],
    ] as Array<[number, number]>) {
      put(x, y, "sign", 2)
    }
    const rug = this.add.image(isoX(420, 1302), isoY(420, 1302), "rug").setDepth(-40)
    rug.setRotation(Math.PI / 4)
    put(470, 1315, "jars", 2)

    // Sheep pen southeast: railed parallelogram.
    this.railsRect(1070, 1290, 1230, 1420)

    // Palms lean near the west bank.
    for (const [x, y] of [
      [1500, 700],
      [1530, 1100],
      [1480, 1300],
    ] as Array<[number, number]>) {
      put(x, y, "palm", ART_SCALE)
    }

    // Border woods: west edge + south edge read as the end of the land.
    const borderTrees: Array<[number, number, string]> = []
    for (let y = 380; y <= 1900; y += 120) borderTrees.push([52, y, y % 240 === 0 ? "tree-b" : "tree-a"])
    for (let x = 140; x <= 1520; x += 130) borderTrees.push([x, 1950, x % 260 === 0 ? "tree-b" : "tree-a"])
    for (const [x, y, tex] of borderTrees) {
      put(x, y, tex, ART_SCALE)
    }

    // Growth in drifts and clumps, the way real verges grow.
    const random = mulberry32(42)
    const scatter = (tex: string, cx: number, cy: number, spread: number, count: number): void => {
      for (let i = 0; i < count; i += 1) {
        const x = cx + (random() + random() - 1) * spread
        const y = cy + (random() + random() - 1) * spread * 0.7
        const sprite = this.add.image(isoX(x, y), isoY(x, y), tex).setScale(2)
        sprite.setDepth(1).setAlpha(0.9)
      }
    }
    // Undergrowth rings the grove; flower drifts mark the butterfly grounds.
    scatter("tuft", 330, 560, 140, 30)
    scatter("tuft", 900, 1500, 170, 22)
    scatter("pebble", 1300, 800, 120, 12)
    scatter("flower-r", 600, 1200, 90, 8)
    scatter("flower-y", 950, 1100, 90, 8)
    scatter("flower-r", 350, 900, 90, 8)
    scatter("flower-y", 1200, 600, 90, 8)
    for (let i = 0; i < 40; i += 1) {
      const x = 60 + random() * 1440
      const y = 340 + random() * 1580
      const tuft = this.add.image(isoX(x, y), isoY(x, y), "tuft").setScale(2)
      tuft.setDepth(1).setAlpha(0.9)
    }
    for (let i = 0; i < 16; i += 1) {
      const x = 60 + random() * 1440
      const y = 340 + random() * 1580
      const pebble = this.add.image(isoX(x, y), isoY(x, y), "pebble").setScale(2)
      pebble.setDepth(1).setAlpha(0.9)
    }
    const bushes: Array<[number, number]> = [
      [120, 700],
      [1300, 450],
      [700, 1250],
      [200, 1600],
      [950, 1100],
    ]
    for (const [x, y] of bushes) {
      put(x, y, "bush", 2.5)
    }

    // Ambient dust motes drifting over the settlement.
    for (let i = 0; i < 10; i += 1) {
      const mx = 80 + random() * 1400
      const my = 360 + random() * 1500
      const mote = this.add.image(isoX(mx, my), isoY(mx, my), "mote").setAlpha(0.25).setDepth(15)
      this.tweens.add({
        targets: mote,
        y: mote.y - 24 - random() * 20,
        x: mote.x + (random() < 0.5 ? -12 : 12),
        duration: 3200 + random() * 2400,
        yoyo: true,
        repeat: -1,
        ease: "sine.inout",
        delay: i * 350,
      })
    }
  }

  /** Railed parallelogram for fields and pens, sorted as one piece. */
  private railsRect(x0: number, y0: number, x1: number, y1: number): void {
    const rails = this.add.graphics()
    rails.setDepth(isoDepth(x1, y1))
    const corners: Array<[number, number]> = [
      [isoX(x0, y0), isoY(x0, y0)],
      [isoX(x1, y0), isoY(x1, y0)],
      [isoX(x1, y1), isoY(x1, y1)],
      [isoX(x0, y1), isoY(x0, y1)],
    ]
    rails.lineStyle(3, 0x5d3f2a, 1)
    for (let i = 0; i < 4; i += 1) {
      const [ax, ay] = corners[i]
      const [bx, by] = corners[(i + 1) % 4]
      rails.lineBetween(ax, ay, bx, by)
    }
    rails.fillStyle(0x5d3f2a, 1)
    for (const [px, py] of corners) rails.fillRect(px - 2, py - 12, 4, 12)
  }

    /** River life on the diamond: cache ring, rocks, ruins, reeds, waves. */
  private buildJordanDressing(): void {
    const put = (x: number, y: number, tex: string, scale: number): Phaser.GameObjects.Sprite => {
      const sprite = this.add.sprite(isoX(x, y), isoY(x, y), tex).setScale(scale)
      sprite.setDepth(isoDepth(x, y))
      return sprite
    }

    // Cache pool water is baked into the floor; the stone ring + glint sit on top.
    const ringX = 2500
    const ringY = 700
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2
      const stone = this.add.image(
        isoX(ringX + Math.cos(angle) * 30, ringY + Math.sin(angle) * 30),
        isoY(ringX + Math.cos(angle) * 30, ringY + Math.sin(angle) * 30),
        "pebble",
      ).setScale(3)
      stone.setDepth(2)
    }
    const glint = this.add.image(isoX(ringX, ringY), isoY(ringX, ringY), "sparkle").setScale(1.5).setAlpha(0.7).setDepth(3)
    this.tweens.add({ targets: glint, alpha: 0.2, scale: 2.2, duration: 1400, yoyo: true, repeat: -1 })

    // Rocks, a reed bed near the east bank, and brush.
    const rocks: Array<[number, number, number]> = [
      [1900, 600, 2.5],
      [2750, 1150, 3],
      [2050, 1500, 2],
      [2950, 900, 3],
    ]
    for (const [x, y, scale] of rocks) {
      put(x, y, "rock", scale)
    }
    // Rock borders: east, south, and north read as the end of the land.
    const borderRocks: Array<[number, number]> = []
    for (let y = 300; y <= 1900; y += 150) borderRocks.push([3150, y])
    for (let x = 1750; x <= 3150; x += 140) borderRocks.push([x, 1950])
    for (let x = 1750; x <= 3150; x += 160) borderRocks.push([x, 260])
    for (const [x, y] of borderRocks) {
      put(x, y, "rock", 3)
    }
    // Old stones: a ring of standing stones in the northeast.
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2
      put(2600 + Math.cos(angle) * 55, 450 + Math.sin(angle) * 40, "stone", 2.5)
    }
    const fallen = put(2600, 510, "stone", 2.5)
    fallen.setAngle(90)
    this.add
      .text(isoX(2600, 372), isoY(2600, 372), "old stones", {
        color: "#fff8e6",
        fontSize: "11px",
        backgroundColor: "#00000066",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(6000)
    // Dead trees dot the deep wilderness.
    for (const [x, y] of [
      [2000, 900],
      [2400, 1500],
      [2900, 800],
    ] as Array<[number, number]>) {
      put(x, y, "deadtree", 2.5)
    }
    put(1760, 1200, "reeds", 2)
    for (const [x, y] of [
      [2400, 900],
      [2000, 1500],
    ] as Array<[number, number]>) {
      put(x, y, "bush", 2.5)
    }
    // Dry tufts across the wilderness.
    const dryRandom = mulberry32(77)
    for (let i = 0; i < 40; i += 1) {
      const x = 1720 + dryRandom() * 1430
      const y = 320 + dryRandom() * 1610
      const tuft = this.add.image(isoX(x, y), isoY(x, y), "tuft").setScale(2)
      tuft.setDepth(1).setAlpha(0.7).setTint(0xc4b394)
    }

    // Animated wavelets: down the channel and across the open water.
    const waveSpots: Array<[number, number]> = [
      [1640, 350],
      [1640, 600],
      [1640, 850],
      [1640, 1100],
      [1640, 1350],
      [1640, 1600],
      [1640, 1850],
      [2000, 900],
      [2500, 1100],
      [1900, 1400],
    ]
    for (const [index, [x, y]] of waveSpots.entries()) {
      const wave = this.add.image(isoX(x, y), isoY(x, y), "wave").setAlpha(0.5).setDepth(1)
      this.waves.push(wave)
      this.tweens.add({
        targets: wave,
        x: x + 26,
        alpha: 0.2,
        duration: 2200 + index * 350,
        yoyo: true,
        repeat: -1,
        ease: "sine.inout",
        delay: index * 400,
      })
    }
  }

  override update(time: number, delta: number): void {
    if (!this.player || !this.keys) return
    let wantX = 0
    let wantY = 0
    if (
      this.keys["A"]?.isDown ||
      this.keys["D"]?.isDown ||
      this.keys["W"]?.isDown ||
      this.keys["S"]?.isDown ||
      this.keys["LEFT"]?.isDown ||
      this.keys["RIGHT"]?.isDown ||
      this.keys["UP"]?.isDown ||
      this.keys["DOWN"]?.isDown
    ) {
      this.target = null
      // Keyboard is screen-relative: W/Up = screen-up, S/Down = screen-down,
      // A/Left = screen-left, D/Right = screen-right. Convert that screen
      // intent through the inverse iso projection into logical movement, so
      // a single key moves straight on screen and diagonals need two keys.
      let sdx = 0
      let sdy = 0
      if (this.keys["A"]?.isDown || this.keys["LEFT"]?.isDown) sdx -= 1
      if (this.keys["D"]?.isDown || this.keys["RIGHT"]?.isDown) sdx += 1
      if (this.keys["W"]?.isDown || this.keys["UP"]?.isDown) sdy -= 1
      if (this.keys["S"]?.isDown || this.keys["DOWN"]?.isDown) sdy += 1
      const dx = sdx + 2 * sdy
      const dy = 2 * sdy - sdx
      const length = Math.hypot(dx, dy) || 1
      wantX = (dx / length) * SPEED
      wantY = (dy / length) * SPEED
    } else if (this.target) {
      const dxT = this.target.x - this.player.x
      const dyT = this.target.y - this.player.y
      const distance = Math.hypot(dxT, dyT)
      if (distance < 6) {
        this.player.setPosition(
          Phaser.Math.Clamp(this.target.x, 24, WORLD_W - 24),
          Phaser.Math.Clamp(this.target.y, 240, WORLD_H - 24),
        )
        this.target = null
      } else {
        // Ease out as the target approaches so arrivals settle softly.
        const ease = Math.min(1, distance / 70)
        wantX = (dxT / distance) * SPEED * ease
        wantY = (dyT / distance) * SPEED * ease
      }
    }
    // Eased velocity: no more ice-skating starts and stops.
    const blend = Math.min(1, (delta * 10) / 1000)
    this.velX += (wantX - this.velX) * blend
    this.velY += (wantY - this.velY) * blend
    const movedX = (this.velX * delta) / 1000
    const movedY = (this.velY * delta) / 1000
    const moved = Math.hypot(movedX, movedY)
    if (moved > 0.01) {
      this.player.setPosition(
        Phaser.Math.Clamp(this.player.x + movedX, 24, WORLD_W - 24),
        Phaser.Math.Clamp(this.player.y + movedY, 240, WORLD_H - 24),
      )
      // Facing follows screen-horizontal motion (isoX grows with x - y),
      // so straight screen-up/down holds its facing instead of flipping.
      const screenVX = this.velX - this.velY
      if (Math.abs(screenVX) > 30) this.player.setFacing(screenVX < 0)
      this.player.step(moved, delta)
      this.syncPlace()
    } else {
      this.velX = 0
      this.velY = 0
      this.player.rest(time, delta)
    }
    this.player.setDepth()
    this.playerShadow.setPosition(isoX(this.player.x, this.player.y), isoY(this.player.x, this.player.y) + 32)

    this.updateWolf(time, delta)
    this.updateWanderers(time, delta)
    this.updateButterflies(time)
    this.updateFishAndBirds(time)
  }

  private randomJordanSpot(): { x: number; y: number } {
    return { x: Phaser.Math.Between(1900, 2900), y: Phaser.Math.Between(600, 1600) }
  }

  private updateWolf(time: number, delta: number): void {
    if (!this.wolf || this.wolfFallen) return
    this.wolfTag.setPosition(isoX(this.wolf.x, this.wolf.y), isoY(this.wolf.x, this.wolf.y) - 42)
    if (time < this.wolfHoldUntil) {
      this.wolf.rest(time, delta)
      return
    }
    if (!this.wolfTarget) {
      this.wolfTarget = this.randomJordanSpot()
      this.wolf.rest(time, delta)
      return
    }
    const step = (46 * delta) / 1000
    const dx = this.wolfTarget.x - this.wolf.x
    const dy = this.wolfTarget.y - this.wolf.y
    const distance = Math.hypot(dx, dy)
    if (distance <= step) {
      this.wolfTarget = null
      this.wolf.rest(time, delta)
      return
    }
    const moveX = (dx / distance) * step
    const moveY = (dy / distance) * step
    this.wolf.setPosition(this.wolf.x + moveX, this.wolf.y + moveY)
    this.wolf.setFacing(dx < 0)
    this.wolf.step(Math.hypot(moveX, moveY), delta, 2.7)
    this.wolf.setDepth()
    this.wolfShadow.setPosition(isoX(this.wolf.x, this.wolf.y), isoY(this.wolf.x, this.wolf.y) + 18)
    this.wolfTag.setPosition(isoX(this.wolf.x, this.wolf.y), isoY(this.wolf.x, this.wolf.y) - 42)
    if (!this.wolfCry.visible) this.wolfCry.setPosition(isoX(this.wolf.x, this.wolf.y) - 4, isoY(this.wolf.x, this.wolf.y) - 52)
  }

  private placeAt(x: number): string {
    return x < MID_X ? "aenon" : "jordan"
  }

  private syncPlace(): void {
    const placeId = this.placeAt(this.player.x)
    if (placeId === this.hereId) return
    const entered = this.season.enter(placeId)
    if (entered.ok && "acquaintance" in entered && entered.acquaintance) {
      this.say("On the road you meet Jesus and the traveling company: one encouraging line.")
    } else if (entered.ok && "scene" in entered && entered.scene) {
      this.say("A set scene is waiting here.")
    } else if (entered.ok) {
      this.say(placeId === "aenon" ? "You enter Aenon." : "You wade into the Jordan wilderness.")
    } else {
      this.say(`The way is shut: ${entered.reason}.`)
      return
    }
    this.hereId = placeId
    this.persist()
    this.refreshHud()
    playSfx("region")
    if (placeId === "aenon") this.showBanner("Aenon", "settlement · where John is baptizing")
    else this.showBanner("The Jordan", "wilderness · the wolf roams here")
  }

  private refreshHud(): void {
    this.ui.setHud(this.hudLines())
  }

  hudLines(): string[] {
    const me = this.season.adventurer()
    const worn = me.worn.weapon ?? "bare hands"
    return [
      `Aenon MVP — ${me.placeId} · Adventurer ${me.adventurerLevel} · Hitpoints ${me.currentHitpoints}/${me.combatLevels.Hitpoints} · coin ${me.coin}`,
      `pack ${me.pack.length} · wielding ${worn} · Woodcutting ${me.trainedSkills.Woodcutting.level} · Scripture ${me.trainedSkills.Scripture.level}`,
      `journal: ${me.questJournal.length === 0 ? "no quests yet" : me.questJournal.map((entry) => entry.line).join(" / ")}`,
      `next: ${this.objectiveFor(me)}`,
    ]
  }

  private say(line: string): void {
    this.messageLine = line
    this.ui.say(line)
  }

  private persist(): void {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.season.exportState()))
    } catch {
      // A full or blocked store must not break the Season.
    }
  }

  private afterAction(ok: boolean, reason: string, good: string): void {
    if (ok) {
      this.persist()
      this.refreshHud()
      this.say(good)
    } else {
      this.say(`Nothing happens (${reason}).`)
    }
  }

  private nearestTree(): Phaser.GameObjects.Sprite {
    let best = this.trees[0]
    let bestDistance = Number.POSITIVE_INFINITY
    for (const tree of this.trees) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, tree.x, tree.y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = tree
      }
    }
    return best
  }

  private flashSparkle(x: number, y: number): void {
    this.sparkle.setPosition(isoX(x, y), isoY(x, y)).setVisible(true).setAlpha(1).setScale(1)
    this.tweens.killTweensOf(this.sparkle)
    this.tweens.add({
      targets: this.sparkle,
      scale: 2.5,
      alpha: 0,
      duration: 600,
      ease: "quad.out",
      onComplete: () => this.sparkle.setVisible(false),
    })
  }

  private showSlash(x: number, y: number, flip: boolean): void {
    this.slash.setPosition(isoX(x, y), isoY(x, y)).setVisible(true).setAlpha(1).setScale(1.6).setFlipX(flip)
    this.tweens.killTweensOf(this.slash)
    this.tweens.add({
      targets: this.slash,
      alpha: 0,
      scale: 0.9,
      duration: 220,
      ease: "quad.out",
      onComplete: () => this.slash.setVisible(false),
    })
  }

  private doGather(): void {
    const result = this.season.gather("timber-stand")
    if (result.ok) {
      playSfx("gather")
      const tree = this.nearestTree()
      this.player.hop(4)
      this.tweens.killTweensOf(tree)
      tree.setAngle(0)
      this.tweens.add({
        targets: tree,
        x: tree.x + 4,
        duration: 70,
        yoyo: true,
        repeat: 3,
        ease: "sine.inout",
        onComplete: () => {
          tree.x = Math.round(tree.x)
          this.tweens.add({
            targets: tree,
            angle: 1,
            duration: 2600,
            yoyo: true,
            repeat: -1,
            ease: "sine.inout",
          })
        },
      })
      this.flashSparkle(tree.x, tree.y - 44)
      this.leafBurst.explode(8, isoX(tree.x, tree.y - 30), isoY(tree.x, tree.y - 30))
    }
    this.afterAction(result.ok, result.ok ? "" : result.reason, "You cut wood at the timber-stand.")
  }

  private doFace(): void {
    const result = this.season.face("wolf")
    if (result.ok) {
      playSfx("face")
      this.wolfHoldUntil = this.time.now + 3000
      this.wolf.setFacing(this.wolf.x >= this.player.x)
      this.wolf.hop()
      this.wolfCry.setPosition(isoX(this.wolf.x, this.wolf.y) - 4, isoY(this.wolf.x, this.wolf.y) - 52).setVisible(true)
      this.time.delayedCall(900, () => this.wolfCry.setVisible(false))
    }
    this.afterAction(result.ok, result.ok ? "" : result.reason, "A wolf of the Jordan faces you.")
  }

  private doSwing(): void {
    const result = this.season.swing(() => 2)
    if (!result.ok) {
      this.say(`Nothing happens (${result.reason}).`)
      return
    }
    const facingLeft = this.player.facingLeft
    this.player.lunge(facingLeft ? -1 : 1)
    const slashX = this.player.x + (facingLeft ? -30 : 30)
    this.showSlash(slashX, this.player.y - 6, facingLeft)
    playSfx("swing")
    if (!result.hostileFell) {
      this.wolf.setTint(0xff8888)
      this.time.delayedCall(120, () => this.wolf.clearTint())
      const push = this.wolf.x < this.player.x ? -10 : 10
      this.tweens.add({
        targets: this.wolf.root,
        x: Phaser.Math.Clamp(this.wolf.x + push, 1850, 3050),
        duration: 120,
      })
      this.wolf.hop(5)
    } else {
      this.wolfFallen = true
      this.wolf.setTint(0x8a8f98)
      this.wolf.setAngle(90)
      this.wolf.setDepth()
      this.wolfCry.setVisible(false)
      this.wolfTag.setVisible(false)
    }
    this.persist()
    this.refreshHud()
    this.say(result.hostileFell ? "The wolf falls. Press H to hunt it." : "You swing at the wolf.")
  }

  private doHunt(): void {
    const result = this.season.hunt()
    if (result.ok) playSfx("hunt")
    if (result.ok && this.wolfFallen) {
      this.tweens.add({
        targets: this.wolf.root,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          const spot = this.randomJordanSpot()
          this.wolf.setPosition(spot.x, spot.y)
          this.wolf.setAngle(0)
          this.wolf.clearTint()
          this.wolf.setAlpha(1)
          this.wolfFallen = false
          this.wolfTarget = null
          this.wolfTag.setVisible(true)
        },
      })
    }
    this.afterAction(result.ok, result.ok ? "" : result.reason, "You hunt the fallen wolf for meat, hide, and bone.")
  }

  private doRead(): void {
    const result = this.season.read("reeds")
    if (!result.ok) {
      this.say(`Nothing happens (${result.reason}).`)
      return
    }
    this.persist()
    this.refreshHud()
    playSfx("read")
    this.flashSparkle(this.reeds.x, this.reeds.y - 34)
    this.glintBurst.explode(10, isoX(this.reeds.x, this.reeds.y - 24), isoY(this.reeds.x, this.reeds.y - 24))
    this.tweens.add({ targets: this.reeds, y: this.reeds.y - 4, duration: 140, yoyo: true, repeat: 1 })
    const usfm = SCRIPTURE_USFM["reeds"] ?? "JHN.1.29"
    void loadLivePassage(usfm)
    this.say("You read at the reeds; the passage is filed in the reference journal.")
  }

  private doLookJohn(): void {
    const result = this.season.look("john")
    if (!result.ok) {
      this.say(`Nothing happens (${result.reason}).`)
      return
    }
    this.john.hop(5)
    this.say("John stands at Aenon, baptizing. (Look: presence confirmed.)")
  }

  private doSpeakJohn(): void {
    const result = this.season.speak("john")
    if (!result.ok) {
      this.say(`Nothing happens (${result.reason}).`)
      return
    }
    this.john.hop(5)
    this.say("John answers with a short word and stays at Aenon.")
  }

  private doBuyRope(): void {
    const result = this.season.buy("merchant", { kind: "everyday", id: "rope" })
    if (result.ok) {
      playSfx("buy")
      this.flashSparkle(this.merchant.x, this.merchant.y - 38)
      this.glintBurst.explode(8, isoX(this.merchant.x, this.merchant.y - 30), isoY(this.merchant.x, this.merchant.y - 30))
      this.merchant.hop(5)
    }
    this.afterAction(result.ok, result.ok ? "" : result.reason, "You buy rope from the merchant.")
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 600,
  backgroundColor: "#101820",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 600,
  },
  scene: [AenonScene],
})
