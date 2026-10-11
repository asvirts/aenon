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
const HUD_TOP = 142
const ZOOM = 1.2
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

const ADV_STAND = [
  ...ADV_TORSO,
  ".....OPPPPPPPPPPPPO.....",
  ".....OPPQPPPPPPQPPO.....",
  ".....OPPP......PPPO.....",
  ".....OFFF......FFFO.....",
  ".....OFFF......FFFO.....",
  ".....OOOO......OOOO.....",
  "........................",
]
const ADV_WALK_A = [
  ...ADV_TORSO,
  ".....OPPPPPPPPPPPPO.....",
  ".....OPPQPPPPPPQPPO.....",
  "....OPPPP......PPPO.....",
  "....OFFFF......FFFO.....",
  "....OFFFF......FFFO.....",
  "....OOOOO......OOOO.....",
  "........................",
]
const ADV_WALK_B = [
  ...ADV_TORSO,
  ".....OPPPPPPPPPPPPO.....",
  ".....OPPQPPPPPPQPPO.....",
  "......OPPP......PPPPO...",
  "......OFFF......FFFFO...",
  "......OFFF......FFFFO...",
  "......OOOO......OOOOO...",
  "........................",
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

const WOLF_TROT = [
  "........................",
  "..OOO................TTT",
  ".OOFFFOO.....KKKKKTTTTTT",
  ".OFFFFFFOOOKKKKKKKKFTTTT",
  ".NFAFFFFFOOKKKKKKKKFFTTT",
  "..OFFFFFFFFFFFFFFFFFFT..",
  "..ODDFFFFFFFFFFFFFDDDT..",
  "..FF....FF....FF....FF..",
  "..FF....FF....FF....FF..",
  "..DD....DD....DD....DD..",
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

const TREE_A = [
  "........................",
  "..........OOOO..........",
  "........OOGGGGOO........",
  "......OOGGLLGGGGOO......",
  ".....OGGLLGGGGGGGGO.....",
  "....OGGLGGGGGGDDDDGO....",
  "....OGGGGGGGGGDDDDGO....",
  "...OGGGGGGLLGGDDDDDGO...",
  "...OGGLLGGGLLGGDDDDGO...",
  "..OGGGLLGGGGGGGGDDDDGO..",
  "..OGGGGGGGGLLGGDDDDDGO..",
  "..OGGDDGGGGGGGGDDDDGO...",
  "..OGDDDDGGGLLGGGDDDGO...",
  "...ODDDDDGGGLLGGGDDGO...",
  "...OODDDDGGGGGGGGDGO....",
  ".....OODDGGGGGGGGO......",
  ".......OOGGGGGGOO.......",
  ".........OOTTTTOO.......",
  "..........OTTTTO........",
  "..........OTTTTO........",
  ".........OOTTTTOO.......",
  ".........ORTTTTRO.......",
  "........OORTTTTRRO......",
  "........OOOTTTTOOO......",
  "........................",
]

const TREE_B = [
  "........................",
  "..........OOOO..........",
  "........OOGGGGOO........",
  "......OOGGGGLLGGOO......",
  ".....OGGGGGGLLGGGGO.....",
  "....OGGDDGGGGGGGLLGO....",
  "....OGDDDGGGGGGLLGGO....",
  "....OGDDDGGGLLGGGGGO....",
  "...OGDDDGGGLLLGGGGGGO...",
  "...OGDDGGGGGGGGGLLGGO...",
  "..OGGDDGGGLLGGGGGGLLGO..",
  "..OGGGGGGLLLGGGGGGGGGO..",
  "..OGGLLGGGDDDGGGGGGGO...",
  "..OGGLLGGDDDDDGGGLLGO...",
  "...OGGGGGDDDDDGGLLGO....",
  "...OOGGGDDDDDGGGGGO.....",
  ".....OOGGDDDDGGGO.......",
  ".......OOTTTTTOO........",
  "........OOTTTTOO........",
  "..........TTTT..........",
  ".........OTTTTO.........",
  ".........ORTTRO.........",
  "........OORTTRRO........",
  "........OOOTTTTTOO......",
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
  sprite: Phaser.GameObjects.Sprite
  minX: number
  maxX: number
  minY: number
  maxY: number
  target: { x: number; y: number }
  speed: number
  phase: number
  frames: [string, string, string, string]
  label: Phaser.GameObjects.Text | null
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

const SHEEP_STEP = [
  "....................",
  "......OOOOOOOO......",
  "....OOFFFFFFFFOO....",
  "...OFFFFFKFFFFFFO...",
  "..OFFFFKFFFFFHHHHO..",
  "..OFWFFKFFFFFHHHHO..",
  "...OFFFFFKFFFFFFO...",
  "....OKKKFFFFKKOO....",
  ".....OFF..FF..FFO...",
  ".....ODD..DD..DDO...",
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

const CROP_PALETTE: Record<string, number> = {
  S: 0x6b5335,
  G: 0x46b464,
}

const CROP_ROWS = [
  "................................",
  ".GG........................GG...",
  ".GGGG..................GGGGG....",
  "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
  "...GG..........GG..........GG...",
  "...GGGG........GGGG........GGGG.",
  "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
  "......GG..........GG............",
  "......GGGG........GGGG....GG....",
  "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
  ".GG........................GG...",
  ".GGGG..................GGGGG....",
  "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
  "................................",
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
    this.add.rectangle(8, 8, 776, 134, 0x000000).setOrigin(0, 0).setFillStyle(0x101820, 1).setDepth(19)
    this.hud = this.add
      .text(16, 12, "", { color: "#ffffff", fontSize: "14px", lineSpacing: 4 })
      .setDepth(20)
    this.add
      .text(
        16,
        120,
        "G gather · F face wolf · SPACE swing · H hunt · R read reeds · J look John · T speak John · B buy rope",
        { color: "#9fb4c7", fontSize: "13px" },
      )
      .setDepth(20)
    this.message = this.add
      .text(16, 560, "", { color: "#ffe9a8", fontSize: "14px" })
      .setDepth(20)
    this.add
      .rectangle(8, 552, 660, 34, 0x000000)
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
  player!: Phaser.GameObjects.Sprite
  private playerShadow!: Phaser.GameObjects.Image
  wolf!: Phaser.GameObjects.Sprite
  private wolfShadow!: Phaser.GameObjects.Image
  private wolfCry!: Phaser.GameObjects.Text
  private wolfTag!: Phaser.GameObjects.Text
  private john!: Phaser.GameObjects.Sprite
  private merchant!: Phaser.GameObjects.Sprite
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
  private ui!: UIScene
  private target: { x: number; y: number } | null = null
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  messageLine = ""
  private hereId = "aenon"
  private walkPhase = 0
  private wolfPhase = 0
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
    // wilderness (east). Tiled textures cover each region; the camera
    // follows the Adventurer and the HUD stays fixed to the viewport.
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W + 120, WORLD_H + 120, 0x1d3a24).setOrigin(0.5)
    this.add.tileSprite(RIVER_WEST / 2, WORLD_H / 2, RIVER_WEST, WORLD_H, "tile-a").setDepth(0)
    this.add.tileSprite((RIVER_WEST + WORLD_W) / 2, WORLD_H / 2, WORLD_W - RIVER_WEST, WORLD_H, "tile-b").setDepth(0)
    this.add.rectangle(RIVER_WEST / 2, WORLD_H / 2, RIVER_WEST, WORLD_H).setStrokeStyle(3, 0x5d4c33).setFillStyle(0x000000, 0)
    this.add
      .rectangle((RIVER_WEST + WORLD_W) / 2, WORLD_H / 2, WORLD_W - RIVER_WEST, WORLD_H)
      .setStrokeStyle(3, 0x18293a)
      .setFillStyle(0x000000, 0)
    this.add.text(80, 250, "Aenon — settlement", { color: "#f5eeda" }).setDepth(20)
    this.add.text(1760, 250, "The Jordan — wilderness", { color: "#dceef5" }).setDepth(20)

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
    this.john = this.add.sprite(1050, 700, "john").setScale(ART_SCALE)
    this.john.setDepth(this.john.y)
    this.merchant = this.add.sprite(420, 1270, "merchant").setScale(ART_SCALE)
    this.merchant.setDepth(this.merchant.y)
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
    this.wolf = this.add.sprite(2300, 1050, "wolf-0").setScale(ART_SCALE)
    this.wolf.setDepth(this.wolf.y)
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
      .setDepth(20)

    // Soft shadows follow the walkers.
    this.playerShadow = this.add.image(0, 0, "shadow").setDepth(2).setAlpha(0.8)
    this.wolfShadow = this.add.image(this.wolf.x, this.wolf.y + 20, "shadow").setDepth(2).setAlpha(0.8)
    this.wolfTag.setPosition(this.wolf.x, this.wolf.y - 42)

    // Floating name tags keep the scene readable.
    const tag = (x: number, y: number, label: string): void => {
      this.add
        .text(x, y, label, { color: "#fff8e6", fontSize: "11px", backgroundColor: "#00000066", padding: { x: 4, y: 2 } })
        .setOrigin(0.5)
        .setDepth(20)
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
    this.player = this.add.sprite(start.x, start.y, "adventurer-0").setScale(ART_SCALE)
    this.player.setDepth(start.y)
    this.playerShadow.setPosition(start.x, start.y + 32)

    // The camera follows the Adventurer; the viewport sees one portion.
    const camera = this.cameras.main
    camera.setBounds(0, 0, WORLD_W, WORLD_H)
    camera.setZoom(ZOOM)
    camera.centerOn(start.x, start.y)
    camera.startFollow(this.player, false, 0.12, 0.12)

    // Slash + sparkle effects, hidden until an action fires them.
    this.slash = this.add.image(start.x, start.y, "slash").setVisible(false).setDepth(40).setScale(1.6)
    this.sparkle = this.add.image(1470, 934, "sparkle").setVisible(false).setDepth(40).setScale(2)

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Screen-space gate keeps HUD clicks from moving the Adventurer.
      if (pointer.y > HUD_TOP) this.target = { x: pointer.worldX, y: pointer.worldY }
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

    // Gentle idle bob for the settlement figures.
    this.tweens.add({ targets: this.john, y: this.john.y - 2, duration: 1200, yoyo: true, repeat: -1, ease: "sine.inout" })
    this.tweens.add({
      targets: this.merchant,
      y: this.merchant.y - 2,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "sine.inout",
      delay: 400,
    })

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
    pixelTexture(this, "adventurer-0", ADV_STAND, ADV_PALETTE)
    pixelTexture(this, "adventurer-1", ADV_WALK_A, ADV_PALETTE)
    pixelTexture(this, "adventurer-2", ADV_WALK_B, ADV_PALETTE)
    pixelTexture(this, "john", JOHN_ROWS, JOHN_PALETTE)
    pixelTexture(this, "merchant", MERCHANT_ROWS, MERCHANT_PALETTE)
    pixelTexture(this, "wolf-0", WOLF_STAND, WOLF_PALETTE)
    pixelTexture(this, "wolf-1", WOLF_TROT, WOLF_PALETTE)
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
    pixelTexture(this, "sheep-0", SHEEP_STAND, SHEEP_PALETTE)
    pixelTexture(this, "sheep-1", SHEEP_STEP, SHEEP_PALETTE)
    pixelTexture(this, "sheep-2", SHEEP_STAND, SHEEP_PALETTE)
    pixelTexture(this, "bird-0", BIRD_ROWS_A, { W: 0x3a3d45 })
    pixelTexture(this, "bird-1", BIRD_ROWS_B, { W: 0x3a3d45 })
    pixelTexture(this, "bfly-0", BUTTERFLY_A, { O: 0xe08a3c, B: 0x2b2018 })
    pixelTexture(this, "bfly-1", BUTTERFLY_B, { O: 0xe08a3c, B: 0x2b2018 })
    pixelTexture(this, "fish", FISH_ROWS, { F: 0x9fc6d8, E: 0x1b2f42, T: 0x7fb8d4 })
    pixelTexture(this, "well", WELL_ROWS, WELL_PALETTE)
    pixelTexture(this, "stall", STALL_ROWS, STALL_PALETTE)
    pixelTexture(this, "palm", PALM_ROWS, PALM_PALETTE)
    pixelTexture(this, "deadtree", DEAD_ROWS, DEAD_PALETTE)
    pixelTexture(this, "crop", CROP_ROWS, CROP_PALETTE)
    pixelTexture(this, "stone", STONE_ROWS, STONE_PALETTE)
    pixelTexture(this, "barrel", BARREL_ROWS, PROPS_PALETTE)
    pixelTexture(this, "crate", CRATE_ROWS, PROPS_PALETTE)
    pixelTexture(this, "lamp", LAMP_ROWS, PROPS_PALETTE)
    pixelTexture(this, "sign", SIGN_ROWS, PROPS_PALETTE)
    for (const [key, rows, palette] of [
      ["vil-a-0", ADV_STAND, VILLAGER_A_PALETTE],
      ["vil-a-1", ADV_WALK_A, VILLAGER_A_PALETTE],
      ["vil-a-2", ADV_WALK_B, VILLAGER_A_PALETTE],
      ["vil-b-0", ADV_STAND, VILLAGER_B_PALETTE],
      ["vil-b-1", ADV_WALK_A, VILLAGER_B_PALETTE],
      ["vil-b-2", ADV_WALK_B, VILLAGER_B_PALETTE],
    ] as Array<[string, string[], Record<string, number>]>) {
      pixelTexture(this, key, rows, palette)
    }

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

    this.makeTile("tile-a", 0x8a734f, 0x6f5a3c, 0xa89064, 7)
    this.makeTile("tile-b", 0x274156, 0x1b2f42, 0x33566e, 13)
  }

  /** Villagers, sheep, fish, butterflies, clouds, and birds. */
  private buildAmbience(): void {
    // Villagers stroll the plaza and the market. Sheep pace the pen.
    this.addWanderer(800, 950, 650, 950, 850, 1100, "vil-a", 34, "villager")
    this.addWanderer(420, 1300, 280, 560, 1220, 1400, "vil-b", 34, "villager")
    this.addWanderer(1130, 1340, 1090, 1210, 1310, 1390, "sheep", 20, null)
    this.addWanderer(1170, 1360, 1090, 1210, 1310, 1390, "sheep", 20, null)
    this.addWanderer(1150, 1320, 1090, 1210, 1310, 1390, "sheep", 20, null)

    // Fish work the river channel.
    for (const [x, y] of [
      [1615, 600],
      [1645, 1000],
      [1660, 1400],
      [1630, 1700],
    ] as Array<[number, number]>) {
      const fish = this.add.sprite(x, y, "fish").setScale(2).setDepth(3).setAlpha(0.85)
      this.fishes.push(fish)
      this.tweens.add({
        targets: fish,
        y: y + 90,
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
      const sprite = this.add.sprite(cx, cy, "bfly-0").setScale(2).setDepth(12)
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
    x: number,
    y: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    prefix: string,
    speed: number,
    label: string | null,
  ): void {
    const sprite = this.add.sprite(x, y, `${prefix}-0`).setScale(ART_SCALE).setDepth(y)
    const frames: [string, string, string, string] = [`${prefix}-0`, `${prefix}-1`, `${prefix}-0`, `${prefix}-2`]
    for (const frame of frames) {
      if (!this.textures.exists(frame)) console.warn(`[aenon] missing wander frame: ${frame}`)
    }
    const tag = label
      ? this.add
          .text(x, y - 42, label, {
            color: "#fff8e6",
            fontSize: "11px",
            backgroundColor: "#00000066",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setDepth(20)
      : null
    this.wanderers.push({
      sprite,
      minX,
      maxX,
      minY,
      maxY,
      target: { x, y },
      speed,
      phase: Math.random() * 10,
      frames: [`${prefix}-0`, `${prefix}-1`, `${prefix}-0`, `${prefix}-2`],
      label: tag,
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

  private updateWanderers(delta: number): void {
    for (const walker of this.wanderers) {
      const dx = walker.target.x - walker.sprite.x
      const dy = walker.target.y - walker.sprite.y
      const distance = Math.hypot(dx, dy)
      if (distance < 6) {
        walker.target = {
          x: Phaser.Math.Between(walker.minX, walker.maxX),
          y: Phaser.Math.Between(walker.minY, walker.maxY),
        }
        walker.sprite.setTexture(walker.frames[0])
        continue
      }
      const step = (walker.speed * delta) / 1000
      walker.sprite.x += (dx / distance) * step
      walker.sprite.y += (dy / distance) * step
      walker.sprite.setFlipX(dx < 0)
      walker.phase += delta * 0.011
      const frames = walker.frames
      walker.sprite.setTexture(frames[Math.floor(walker.phase) % frames.length])
      walker.sprite.setDepth(walker.sprite.y)
      if (walker.label) walker.label.setPosition(walker.sprite.x, walker.sprite.y - 42)
    }
  }

  private updateButterflies(time: number): void {
    for (const fly of this.butterflies) {
      const t = time * fly.speed + fly.phase
      fly.sprite.setPosition(fly.cx + Math.cos(t) * fly.rx, fly.cy + Math.sin(t * 1.4) * fly.ry)
      fly.sprite.setTexture(Math.floor(time / 260 + fly.phase) % 2 === 0 ? "bfly-0" : "bfly-1")
      fly.sprite.setDepth(fly.sprite.y)
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

  /** Small speckled tile with soft tonal patches, repeated by TileSprites. */
  private makeTile(key: string, base: number, dark: number, light: number, seed: number): void {
    if (this.textures.exists(key)) return
    const graphics = this.make.graphics({ x: 0, y: 0 })
    graphics.fillStyle(base, 1)
    graphics.fillRect(0, 0, 256, 256)
    const random = mulberry32(seed)
    // Broad tonal patches first (kept off the edges so tiling stays seamless).
    for (let i = 0; i < 12; i += 1) {
      const color = random() < 0.5 ? dark : light
      graphics.fillStyle(color, 0.22)
      graphics.fillEllipse(40 + random() * 176, 40 + random() * 176, 24 + random() * 44, 18 + random() * 32)
    }
    for (let i = 0; i < 320; i += 1) {
      const color = random() < 0.5 ? dark : light
      graphics.fillStyle(color, 0.35 + random() * 0.4)
      const size = 1 + Math.floor(random() * 3)
      graphics.fillRect(Math.floor(random() * 256), Math.floor(random() * 256), size, size === 3 ? 2 : size)
    }
    graphics.generateTexture(key, 256, 256)
    graphics.destroy()
  }

  /** Dirt trail, fences, rug, jars, scatter, and border woods for Aenon. */
  private buildAenonDressing(): void {
    // Dirt trail: merchant camp -> John -> river reeds.
    const path = this.add.graphics().setDepth(1)
    path.fillStyle(0x9a8258, 0.85)
    const dots: Array<[number, number, number, number]> = [
      [650, 850, 60, 26],
      [520, 750, 60, 26],
      [420, 660, 60, 26],
      [780, 800, 56, 26],
      [760, 650, 56, 26],
      [750, 520, 56, 26],
      [920, 860, 64, 26],
      [990, 780, 60, 26],
      [1030, 730, 54, 24],
      [650, 1050, 64, 26],
      [540, 1150, 64, 26],
      [460, 1220, 60, 26],
      [800, 1100, 60, 26],
      [810, 1220, 60, 26],
      [825, 1330, 60, 26],
      [950, 1050, 64, 26],
      [1050, 1180, 64, 26],
      [1120, 1280, 60, 26],
      [1200, 760, 64, 26],
      [1320, 830, 64, 26],
      [1420, 900, 64, 26],
      [550, 1350, 60, 24],
      [650, 1400, 60, 24],
      [750, 1420, 60, 24],
    ]
    for (const [x, y, w, h] of dots) path.fillEllipse(x, y, w, h)
    path.fillStyle(0xa89064, 0.7)
    for (const [x, y, w, h] of dots) path.fillEllipse(x, y, w * 0.6, h * 0.55)

    // Fence run along the north edge of the settlement, one graphics object.
    const fence = this.add.graphics().setDepth(2)
    for (let x = 80; x <= 1520; x += 24) {
      fence.fillStyle(0x5d3f2a, 1)
      fence.fillRect(x, 300, 4, 14)
      fence.fillStyle(0x7a5230, 1)
      fence.fillRect(x + 4, 302, 20, 3)
      fence.fillRect(x + 4, 308, 20, 3)
    }

    // Plaza: packed-earth hub with the well at its heart.
    const plaza = this.add.graphics().setDepth(1)
    plaza.fillStyle(0x9a8258, 0.8)
    plaza.fillEllipse(800, 950, 230, 150)
    plaza.fillStyle(0xa89064, 0.7)
    plaza.fillEllipse(800, 950, 150, 95)
    const well = this.add.sprite(800, 950, "well").setScale(2.5)
    well.setDepth(950)

    // Mudbrick house with a thatch roof, north of the plaza.
    const house = this.add.graphics().setDepth(630)
    house.fillStyle(0x000000, 0.25)
    house.fillEllipse(830, 668, 150, 22)
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

    // Crop fields north of the plaza, railed in.
    for (const [cx, cy, w, h] of [
      [700, 430, 320, 130],
      [1060, 430, 280, 130],
    ] as Array<[number, number, number, number]>) {
      this.add.tileSprite(cx, cy, w, h, "crop").setDepth(1)
      const rails = this.add.graphics().setDepth(2)
      rails.lineStyle(3, 0x5d3f2a, 1)
      rails.strokeRect(cx - w / 2, cy - h / 2, w, h)
    }

    // Market stalls southwest, jars by the merchant rug.
    const stallA = this.add.sprite(300, 1350, "stall").setScale(2)
    stallA.setDepth(1350)
    const stallB = this.add.sprite(560, 1360, "stall").setScale(2).setFlipX(true)
    stallB.setDepth(1360)
    // Stall keepers mind the counters; barrels and crates pile nearby.
    const keeperA = this.add.sprite(300, 1336, "vil-a-0").setScale(2)
    keeperA.setDepth(1336)
    const keeperB = this.add.sprite(560, 1346, "vil-b-0").setScale(2)
    keeperB.setDepth(1346)
    this.add.image(300, 1362, "shadow").setDepth(2).setAlpha(0.6)
    this.add.image(560, 1372, "shadow").setDepth(2).setAlpha(0.6)
    for (const [x, y, tex] of [
      [250, 1382, "barrel"],
      [276, 1376, "barrel"],
      [612, 1390, "barrel"],
      [850, 1402, "crate"],
      [880, 1396, "crate"],
      [770, 920, "barrel"],
    ] as Array<[number, number, string]>) {
      const prop = this.add.sprite(x, y, tex).setScale(2)
      prop.setDepth(y)
    }
    // Lamps along the plaza walks; signposts where trails meet.
    for (const [x, y] of [
      [700, 860],
      [900, 860],
      [700, 1040],
      [900, 1040],
    ] as Array<[number, number]>) {
      const lamp = this.add.sprite(x, y, "lamp").setScale(2)
      lamp.setDepth(y)
    }
    for (const [x, y] of [
      [830, 1000],
      [1540, 950],
    ] as Array<[number, number]>) {
      const sign = this.add.sprite(x, y, "sign").setScale(2)
      sign.setDepth(y)
    }
    this.add.image(420, 1302, "rug").setDepth(1)
    const jars = this.add.sprite(470, 1315, "jars").setScale(2)
    jars.setDepth(1315)

    // Sheep pen southeast: railed square.
    const pen = this.add.graphics().setDepth(2)
    pen.lineStyle(3, 0x5d3f2a, 1)
    pen.strokeRect(1070, 1290, 160, 130)
    for (let x = 1070; x <= 1230; x += 32) {
      pen.fillStyle(0x5d3f2a, 1)
      pen.fillRect(x, 1286, 5, 16)
      pen.fillRect(x, 1408, 5, 16)
    }

    // Palms lean near the west bank.
    for (const [x, y] of [
      [1500, 700],
      [1530, 1100],
      [1480, 1300],
    ] as Array<[number, number]>) {
      const palm = this.add.sprite(x, y, "palm").setScale(2.5)
      palm.setDepth(y)
    }

    // Border woods: west edge + south edge read as the end of the land.
    const borderTrees: Array<[number, number, string]> = []
    for (let y = 380; y <= 1900; y += 120) borderTrees.push([52, y, y % 240 === 0 ? "tree-b" : "tree-a"])
    for (let x = 140; x <= 1520; x += 130) borderTrees.push([x, 1950, x % 260 === 0 ? "tree-b" : "tree-a"])
    for (const [x, y, tex] of borderTrees) {
      const tree = this.add.sprite(x, y, tex).setScale(ART_SCALE)
      tree.setDepth(y)
    }

    // Growth in drifts and clumps, the way real verges grow.
    const random = mulberry32(42)
    const scatter = (tex: string, cx: number, cy: number, spread: number, count: number, depth: number): void => {
      for (let i = 0; i < count; i += 1) {
        const x = cx + (random() + random() - 1) * spread
        const y = cy + (random() + random() - 1) * spread * 0.7
        const sprite = this.add.image(x, y, tex).setScale(2)
        sprite.setDepth(depth).setAlpha(0.9)
      }
    }
    // Undergrowth rings the grove; flower drifts mark the butterfly grounds.
    scatter("tuft", 330, 560, 140, 30, 1)
    scatter("tuft", 900, 1500, 170, 22, 1)
    scatter("pebble", 1300, 800, 120, 12, 1)
    scatter("flower-r", 600, 1200, 90, 8, 2)
    scatter("flower-y", 950, 1100, 90, 8, 2)
    scatter("flower-r", 350, 900, 90, 8, 2)
    scatter("flower-y", 1200, 600, 90, 8, 2)
    for (let i = 0; i < 40; i += 1) {
      const tuft = this.add.image(60 + random() * 1440, 340 + random() * 1580, "tuft").setScale(2)
      tuft.setDepth(1).setAlpha(0.9)
    }
    for (let i = 0; i < 16; i += 1) {
      const pebble = this.add.image(60 + random() * 1440, 340 + random() * 1580, "pebble").setScale(2)
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
      const bush = this.add.sprite(x, y, "bush").setScale(2.5)
      bush.setDepth(y)
    }

    // Ambient dust motes drifting over the settlement.
    for (let i = 0; i < 10; i += 1) {
      const mote = this.add.image(80 + random() * 1400, 360 + random() * 1500, "mote").setAlpha(0.25).setDepth(15)
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

  /** River channel, banks, waves, rocks, and the cache ring for the Jordan. */
  private buildJordanDressing(): void {
    // The river itself: light water between sandy banks, full height.
    const river = this.add.graphics().setDepth(1)
    river.fillStyle(0x9a8258, 1)
    river.fillRect(RIVER_WEST - 30, 0, 30, WORLD_H)
    river.fillRect(RIVER_EAST, 0, 32, WORLD_H)
    river.fillStyle(0x7a6540, 1)
    river.fillRect(RIVER_WEST - 34, 0, 4, WORLD_H)
    river.fillRect(RIVER_EAST + 32, 0, 4, WORLD_H)
    river.fillStyle(0x3a6280, 1)
    river.fillRect(RIVER_WEST, 0, RIVER_EAST - RIVER_WEST, WORLD_H)
    river.fillStyle(0x9fc6d8, 0.8)
    river.fillRect(RIVER_WEST + 2, 0, 3, WORLD_H)
    river.fillRect(RIVER_EAST - 5, 0, 3, WORLD_H)
    const sandRandom = mulberry32(99)
    for (let i = 0; i < 220; i += 1) {
      river.fillStyle(sandRandom() < 0.5 ? 0x7a6540 : 0xb5986a, 0.8)
      const west = sandRandom() < 0.5
      river.fillRect(
        west ? RIVER_WEST - 30 + Math.floor(sandRandom() * 30) : RIVER_EAST + Math.floor(sandRandom() * 32),
        Math.floor(sandRandom() * WORLD_H),
        2,
        2,
      )
    }
    // Lily pads ride the channel.
    const padRandom = mulberry32(7)
    const pads = this.add.graphics().setDepth(2)
    pads.fillStyle(0x2f9e5f, 1)
    for (let i = 0; i < 12; i += 1) {
      pads.fillEllipse(RIVER_WEST + 12 + padRandom() * 56, 100 + padRandom() * 1800, 10, 5)
    }

    // Cache pool: ring of stones with a still blue heart.
    const ringX = 2500
    const ringY = 700
    const pool = this.add.graphics().setDepth(1)
    pool.fillStyle(0x3f6f8f, 1)
    pool.fillEllipse(ringX, ringY, 56, 40)
    pool.fillStyle(0x5a93b5, 1)
    pool.fillEllipse(ringX, ringY, 38, 26)
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2
      const stone = this.add.image(ringX + Math.cos(angle) * 32, ringY + Math.sin(angle) * 23, "pebble").setScale(3)
      stone.setDepth(2)
    }
    const glint = this.add.image(ringX, ringY, "sparkle").setScale(1.5).setAlpha(0.7).setDepth(3)
    this.tweens.add({ targets: glint, alpha: 0.2, scale: 2.2, duration: 1400, yoyo: true, repeat: -1 })

    // Rocks, a reed bed near the east bank, and brush.
    const rocks: Array<[number, number, number]> = [
      [1900, 600, 2.5],
      [2750, 1150, 3],
      [2050, 1500, 2],
      [2950, 900, 3],
    ]
    for (const [x, y, scale] of rocks) {
      const rock = this.add.sprite(x, y, "rock").setScale(scale)
      rock.setDepth(y)
    }
    // Rock borders: east, south, and north read as the end of the land.
    const borderRocks: Array<[number, number]> = []
    for (let y = 300; y <= 1900; y += 150) borderRocks.push([3150, y])
    for (let x = 1750; x <= 3150; x += 140) borderRocks.push([x, 1950])
    for (let x = 1750; x <= 3150; x += 160) borderRocks.push([x, 260])
    for (const [x, y] of borderRocks) {
      const rock = this.add.sprite(x, y, "rock").setScale(3)
      rock.setDepth(y)
    }
    // Old stones: a ring of standing stones in the northeast.
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2
      const stone = this.add.sprite(2600 + Math.cos(angle) * 55, 450 + Math.sin(angle) * 40, "stone").setScale(2.5)
      stone.setDepth(450 + Math.sin(angle) * 40)
    }
    const fallen = this.add.sprite(2600, 510, "stone").setScale(2.5).setAngle(90)
    fallen.setDepth(510)
    this.add
      .text(2600, 372, "old stones", {
        color: "#fff8e6",
        fontSize: "11px",
        backgroundColor: "#00000066",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(20)
    // Dead trees and quiet still pools dot the deep wilderness.
    for (const [x, y] of [
      [2000, 900],
      [2400, 1500],
      [2900, 800],
    ] as Array<[number, number]>) {
      const dead = this.add.sprite(x, y, "deadtree").setScale(2.5)
      dead.setDepth(y)
    }
    for (const [px, py] of [
      [2100, 1300],
      [2700, 1400],
    ] as Array<[number, number]>) {
      const still = this.add.graphics().setDepth(1)
      still.fillStyle(0x3f6f8f, 1)
      still.fillEllipse(px, py, 44, 30)
      still.fillStyle(0x5a93b5, 1)
      still.fillEllipse(px, py, 30, 20)
    }
    const reeds2 = this.add.sprite(1760, 1200, "reeds").setScale(2)
    reeds2.setDepth(1200)
    for (const [x, y] of [
      [2400, 900],
      [2000, 1500],
    ] as Array<[number, number]>) {
      const bush = this.add.sprite(x, y, "bush").setScale(2.5)
      bush.setDepth(y)
    }
    // Dry tufts across the wilderness.
    const dryRandom = mulberry32(77)
    for (let i = 0; i < 40; i += 1) {
      const tuft = this.add.image(1720 + dryRandom() * 1430, 320 + dryRandom() * 1610, "tuft").setScale(2)
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
      const wave = this.add.image(x, y, "wave").setAlpha(0.5).setDepth(1)
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
    const step = (SPEED * delta) / 1000
    let dx = 0
    let dy = 0
    if (this.keys["A"]?.isDown || this.keys["LEFT"]?.isDown) dx -= 1
    if (this.keys["D"]?.isDown || this.keys["RIGHT"]?.isDown) dx += 1
    if (this.keys["W"]?.isDown || this.keys["UP"]?.isDown) dy -= 1
    if (this.keys["S"]?.isDown || this.keys["DOWN"]?.isDown) dy += 1
    if (dx !== 0 || dy !== 0) {
      this.target = null
      const length = Math.hypot(dx, dy)
      this.player.x = Phaser.Math.Clamp(this.player.x + (dx / length) * step, 24, WORLD_W - 24)
      this.player.y = Phaser.Math.Clamp(this.player.y + (dy / length) * step, 220, WORLD_H - 24)
      if (dx !== 0) this.player.setFlipX(dx < 0)
      this.animateWalk(delta)
      this.syncPlace()
    } else if (this.target) {
      const dxT = this.target.x - this.player.x
      const dyT = this.target.y - this.player.y
      const distance = Math.hypot(dxT, dyT)
      if (distance <= step) {
        this.player.x = Phaser.Math.Clamp(this.target.x, 24, WORLD_W - 24)
        this.player.y = Phaser.Math.Clamp(this.target.y, 220, WORLD_H - 24)
        this.target = null
        this.player.setTexture("adventurer-0")
      } else {
        this.player.x += (dxT / distance) * step
        this.player.y += (dyT / distance) * step
        this.player.setFlipX(dxT < 0)
        this.animateWalk(delta)
      }
      this.syncPlace()
    }
    this.player.setDepth(this.player.y)
    this.playerShadow.setPosition(this.player.x, this.player.y + 32)

    this.updateWolf(time, delta)
    this.updateWanderers(delta)
    this.updateButterflies(time)
    this.updateFishAndBirds(time)
  }

  private animateWalk(delta: number): void {
    this.walkPhase += delta * 0.012
    const frames = ["adventurer-0", "adventurer-1", "adventurer-0", "adventurer-2"]
    const frame = frames[Math.floor(this.walkPhase) % frames.length]
    this.player.setTexture(frame)
  }

  private randomJordanSpot(): { x: number; y: number } {
    return { x: Phaser.Math.Between(1900, 2900), y: Phaser.Math.Between(600, 1600) }
  }

  private updateWolf(time: number, delta: number): void {
    if (!this.wolf || this.wolfFallen) return
    this.wolfTag.setPosition(this.wolf.x, this.wolf.y - 42)
    if (time < this.wolfHoldUntil) return
    if (!this.wolfTarget) {
      this.wolfTarget = this.randomJordanSpot()
      return
    }
    const step = (46 * delta) / 1000
    const dx = this.wolfTarget.x - this.wolf.x
    const dy = this.wolfTarget.y - this.wolf.y
    const distance = Math.hypot(dx, dy)
    if (distance <= step) {
      this.wolfTarget = null
      this.wolf.setTexture("wolf-0")
      return
    }
    this.wolf.x += (dx / distance) * step
    this.wolf.y += (dy / distance) * step
    this.wolf.setFlipX(dx > 0)
    this.wolfPhase += delta * 0.014
    this.wolf.setTexture(Math.floor(this.wolfPhase) % 2 === 0 ? "wolf-0" : "wolf-1")
    this.wolf.setDepth(this.wolf.y)
    this.wolfShadow.setPosition(this.wolf.x, this.wolf.y + 18)
    this.wolfTag.setPosition(this.wolf.x, this.wolf.y - 42)
    if (!this.wolfCry.visible) this.wolfCry.setPosition(this.wolf.x - 4, this.wolf.y - 52)
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
    this.sparkle.setPosition(x, y).setVisible(true).setAlpha(1).setScale(1)
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
    this.slash.setPosition(x, y).setVisible(true).setAlpha(1).setScale(1.6).setFlipX(flip)
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
    }
    this.afterAction(result.ok, result.ok ? "" : result.reason, "You cut wood at the timber-stand.")
  }

  private doFace(): void {
    const result = this.season.face("wolf")
    if (result.ok) {
      playSfx("face")
      this.wolfHoldUntil = this.time.now + 3000
      this.wolf.setFlipX(this.wolf.x < this.player.x ? false : true)
      this.wolfCry.setPosition(this.wolf.x - 4, this.wolf.y - 52).setVisible(true)
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
    const facingLeft = this.player.flipX
    const slashX = this.player.x + (facingLeft ? -30 : 30)
    this.showSlash(slashX, this.player.y - 6, facingLeft)
    playSfx("swing")
    if (!result.hostileFell) {
      this.wolf.setTint(0xff8888)
      this.time.delayedCall(120, () => this.wolf.clearTint())
      const push = this.wolf.x < this.player.x ? -10 : 10
      this.tweens.add({ targets: this.wolf, x: Phaser.Math.Clamp(this.wolf.x + push, 1850, 3050), duration: 120 })
    } else {
      this.wolfFallen = true
      this.wolf.setTexture("wolf-0").setTint(0x8a8f98).setAngle(90).setDepth(this.wolf.y)
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
        targets: this.wolf,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          const spot = this.randomJordanSpot()
          this.wolf.setPosition(spot.x, spot.y).setAngle(0).clearTint().setAlpha(1)
          this.wolf.setTexture("wolf-0")
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
    this.tweens.add({ targets: this.john, y: this.john.y - 5, duration: 130, yoyo: true, repeat: 1 })
    this.say("John stands at Aenon, baptizing. (Look: presence confirmed.)")
  }

  private doSpeakJohn(): void {
    const result = this.season.speak("john")
    if (!result.ok) {
      this.say(`Nothing happens (${result.reason}).`)
      return
    }
    this.tweens.add({ targets: this.john, y: this.john.y - 5, duration: 130, yoyo: true, repeat: 1 })
    this.say("John answers with a short word and stays at Aenon.")
  }

  private doBuyRope(): void {
    const result = this.season.buy("merchant", { kind: "everyday", id: "rope" })
    if (result.ok) {
      playSfx("buy")
      this.flashSparkle(this.merchant.x, this.merchant.y - 38)
      this.tweens.add({ targets: this.merchant, y: this.merchant.y - 5, duration: 130, yoyo: true, repeat: 1 })
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
  scene: [AenonScene],
})
