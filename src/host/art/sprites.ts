import type * as Phaser from "phaser"

/** Rig pivots for an adult silhouette; texture resolution is independent of world scale. */
export const BIPED_ART_LAYOUT = { armX: 5.3, armY: -0.5, legX: 2.3, legY: 7 } as const

const RESOLUTION = 4
type Painter = (context: CanvasRenderingContext2D) => void
type Point = readonly [number, number]

function texture(scene: Phaser.Scene, key: string, width: number, height: number, paint: Painter): void {
  if (scene.textures.exists(key)) scene.textures.remove(key)
  const canvas = document.createElement("canvas")
  canvas.width = width * RESOLUTION
  canvas.height = height * RESOLUTION
  const context = canvas.getContext("2d")
  if (!context) throw new Error(`Could not paint ${key}`)
  context.scale(RESOLUTION, RESOLUTION)
  context.lineJoin = "round"
  context.lineCap = "round"
  paint(context)
  const result = scene.textures.addCanvas(key, canvas)
  if (!result) throw new Error(`Could not register ${key}`)
  // Phaser's renderer divides cut dimensions by source resolution. The logical
  // frame controls display origins and bounds, while the cut retains all pixels.
  result.source[0]!.resolution = RESOLUTION
  result.get().setTrim(width, height, 0, 0, width, height)
}

function polygon(c: CanvasRenderingContext2D, color: string, points: readonly Point[]): void {
  c.beginPath()
  for (const [index, point] of points.entries()) {
    if (index === 0) c.moveTo(point[0], point[1])
    else c.lineTo(point[0], point[1])
  }
  c.closePath()
  c.fillStyle = color
  c.fill()
}

function ellipse(c: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number, rotation = 0): void {
  c.fillStyle = color
  c.beginPath()
  c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2)
  c.fill()
}

function stroke(c: CanvasRenderingContext2D, color: string, width: number, points: readonly Point[]): void {
  c.strokeStyle = color
  c.lineWidth = width
  c.beginPath()
  for (const [index, point] of points.entries()) {
    if (index === 0) c.moveTo(point[0], point[1])
    else c.lineTo(point[0], point[1])
  }
  c.stroke()
}

function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0
    return (state >>> 0) / 4294967296
  }
}

const OLIVE = ["#31483c", "#435c43", "#566d49", "#6d7e50", "#83925e", "#a4ad79"]
const SAGE = ["#304b42", "#416451", "#557862", "#719077", "#93a68a", "#bcc0a0"]

/** Small irregular facets read as foliage masses, without a heavy cartoon outline. */
function canopy(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, seed: number, palette = OLIVE): void {
  const rng = random(seed)
  const points: Point[] = []
  for (let i = 0; i < 17; i++) {
    const angle = i / 17 * Math.PI * 2
    const distance = 0.85 + rng() * 0.2
    points.push([x + Math.cos(angle) * rx * distance, y + Math.sin(angle) * ry * distance])
  }
  polygon(c, palette[0]!, points)
  c.save()
  c.beginPath()
  points.forEach(([px, py], i) => i === 0 ? c.moveTo(px, py) : c.lineTo(px, py))
  c.closePath()
  c.clip()
  ellipse(c, palette[1]!, x - rx * 0.15, y - ry * 0.2, rx, ry * 0.85)
  for (let i = 0; i < 32; i++) {
    const px = x + (rng() * 2 - 1) * rx
    const py = y + (rng() * 2 - 1) * ry
    const light = Math.max(1, Math.min(5, Math.round(3.5 - (px - x) / rx - (py - y) / ry + rng())))
    const w = 1.1 + rng() * rx * 0.35
    const h = 0.7 + rng() * ry * 0.3
    polygon(c, palette[light]!, [[px - w, py], [px - w * 0.4, py - h], [px + w * 0.55, py - h * 0.7], [px + w, py + h * 0.2], [px + w * 0.2, py + h]])
  }
  c.restore()
}

function broadleaf(c: CanvasRenderingContext2D, variant: number): void {
  const palette = variant === 0 ? OLIVE : SAGE
  ellipse(c, "#24372b28", 25, 53, 17, 4)
  polygon(c, "#594b35", [[19, 51], [20, 35], [15, 26], [18, 24], [24, 35], [27, 27], [29, 28], [25, 41], [26, 52], [31, 55], [24, 54], [20, 56], [14, 56]])
  polygon(c, "#8b7952", [[19, 51], [21, 37], [17, 28], [19, 29], [24, 39], [23, 51], [20, 54], [16, 55]])
  stroke(c, "#b09c6a", 0.65, [[20, 48], [22, 40], [20, 33]])
  canopy(c, 13, 26, 11, 10, 120 + variant, palette)
  canopy(c, 31, 26, 11, 10, 66 + variant, palette)
  canopy(c, 23, 17, 14, 13, 11 + variant, palette)
  canopy(c, 11, 19, 8, 8, 87 + variant, palette)
  canopy(c, 30, 14, 9, 9, 57 + variant, palette)
  canopy(c, 18, 8, 8, 7, 201 + variant, palette)
  canopy(c, 20, 28, 9, 7, 721 + variant, palette)
  // Dappled light rests on the upper left of every plant in the scene.
  for (const [x, y] of [[8, 17], [17, 8], [22, 12], [29, 11], [16, 25]]) {
    ellipse(c, palette[5]!, x!, y!, 0.55, 0.3, -0.4)
  }
}

function pine(c: CanvasRenderingContext2D): void {
  ellipse(c, "#24372b28", 20, 60, 14, 3)
  polygon(c, "#62543d", [[16, 39], [20, 39], [21, 60], [24, 62], [13, 62], [16, 59]])
  polygon(c, "#9b8760", [[16, 42], [18, 40], [18, 59], [15, 61]])
  for (let tier = 4; tier >= 0; tier--) {
    const y = 8 + tier * 9
    const half = 4.5 + tier * 2.8
    polygon(c, "#2e483c", [[18, y - 8], [18 + half * 0.8, y + 3], [18 + half, y + 7], [20 + half * 0.25, y + 9], [17, y + 8], [18 - half, y + 6], [18 - half * 0.6, y + 1]])
    polygon(c, "#49664c", [[18, y - 8], [18, y + 7], [18 - half, y + 6], [18 - half * 0.4, y + 1]])
    polygon(c, "#758866", [[18, y - 7], [16, y + 2], [18 - half * 0.8, y + 4], [18 - half * 0.55, y + 0.5]])
    stroke(c, "#8e9b7620", 0.6, [[18 - half + 2, y + 6], [18, y + 2], [18 + half - 2, y + 6]])
  }
}

function palm(c: CanvasRenderingContext2D): void {
  ellipse(c, "#24372b28", 19, 58, 13, 3)
  polygon(c, "#756040", [[14, 59], [18, 44], [20, 20], [24, 20], [23, 44], [19, 60]])
  polygon(c, "#af9465", [[14, 59], [18, 44], [20, 20], [21.5, 20], [20, 45], [17, 59]])
  for (let y = 25; y < 57; y += 3) stroke(c, "#665439", 0.45, [[18 + (57 - y) * 0.07, y], [21 + (57 - y) * 0.07, y + 1]])
  const fronds: Point[] = [[1, 12], [2, 28], [7, 6], [16, 1], [30, 4], [39, 12], [38, 28], [30, 20]]
  fronds.forEach(([x, y], i) => {
    const midX = (22 + x) / 2
    const midY = Math.max(1, Math.min(12, y) - 5)
    polygon(c, i % 2 ? "#476647" : "#627d51", [[22, 17], [midX - 3, midY], [x, y], [midX + 3, midY + 4]])
    stroke(c, "#a1ac72", 0.4, [[22, 17], [midX, midY + 1], [x, y]])
    for (let j = 0; j < 4; j++) {
      const t = j / 5 + 0.1
      const bx = 22 + (x - 22) * t
      const by = 17 + (midY - 17) * Math.sin(t * Math.PI / 2)
      stroke(c, "#365541", 0.35, [[bx, by], [bx + (i < 4 ? -2 : 2), by + 3.5]])
    }
  })
  ellipse(c, "#b6934c", 21, 18, 1.1, 1.5)
  ellipse(c, "#856736", 24, 18, 1.1, 1.6)
}

function reeds(c: CanvasRenderingContext2D): void {
  const rng = random(19)
  ellipse(c, "#354d3930", 10, 14.5, 8, 1.2)
  for (let i = 0; i < 15; i++) {
    const x = 3 + rng() * 14
    const top = 1 + rng() * 8
    const lean = (rng() - 0.5) * 4
    stroke(c, i % 2 ? "#687c48" : "#96a26a", 0.35, [[x, 15], [x + lean * 0.4, top + 5], [x + lean, top]])
    polygon(c, "#5f7449", [[x, 13], [x - 2.5, top + 4], [x - 0.5, top + 5]])
    polygon(c, "#85955b", [[x, 12], [x + 3, top + 3], [x + 1, top + 5]])
    if (i % 3 === 0) ellipse(c, "#ad9560", x + lean, top + 0.7, 0.5, 1.4, lean * 0.1)
  }
}

interface Clothes { cloth: string; light: string; dark: string; skin: string; hair: string; mantle: string; role?: "john" | "merchant" }
const CAST: Record<string, Clothes> = {
  adv: { cloth: "#526f67", light: "#8ca290", dark: "#354e4b", skin: "#bd8c67", hair: "#493c2e", mantle: "#b4a180" },
  vila: { cloth: "#ac905a", light: "#d0b77b", dark: "#7e693e", skin: "#ba8862", hair: "#514332", mantle: "#e0d2ac" },
  vilb: { cloth: "#a46d56", light: "#c99270", dark: "#734d3d", skin: "#b48161", hair: "#493a2c", mantle: "#c1ab87" },
  john: { cloth: "#948469", light: "#b5a687", dark: "#695f4b", skin: "#a87755", hair: "#483c30", mantle: "#b4a28a", role: "john" },
  mer: { cloth: "#797480", light: "#a29ba0", dark: "#53515d", skin: "#bd8b64", hair: "#4a3a2d", mantle: "#c9b58a", role: "merchant" },
}

function person(c: CanvasRenderingContext2D, a: Clothes): void {
  // Cloth extends over the thigh joints. A small head and long draped torso
  // establish adult proportions without changing the movement/interaction rig.
  polygon(c, a.dark, [[8, 9], [11, 7.4], [14, 7.6], [17, 10], [16, 16], [17.5, 20.5], [7, 20.5], [8, 15]])
  polygon(c, a.cloth, [[8, 9], [11, 8], [15, 9], [15.5, 15], [16, 20.5], [8, 20.5], [9, 15]])
  polygon(c, a.light, [[8.4, 10], [10, 8.8], [11.2, 12], [9.5, 17], [8.2, 19]])
  polygon(c, a.dark, [[13, 11], [14.5, 16], [14, 20.5], [12.5, 20.5]])
  polygon(c, a.mantle, [[8, 8.8], [9.8, 8], [12, 10.8], [15.8, 12], [16.4, 10], [14.5, 8], [12.4, 7.6], [10.8, 7.6]])
  stroke(c, "#f0dfb655", 0.4, [[8.8, 9], [11.6, 11.4], [15.8, 12.5]])
  polygon(c, "#695338", [[8, 16], [16, 16.1], [16.2, 17.1], [7.8, 17]])
  polygon(c, "#c2a367", [[11.6, 16], [12.8, 16], [12.8, 17.2], [11.6, 17.2]])
  // A shoulder strap and worn leather satchel identify the traveller.
  if (a.role !== "john") {
    stroke(c, "#654e37", 0.85, [[8.3, 9], [14.7, 16]])
    polygon(c, "#795c3d", [[14, 15], [17.1, 15.5], [17, 18.6], [14, 18.1]])
    stroke(c, "#ae8b57", 0.35, [[14.2, 15.4], [15.5, 16.4], [16.7, 15.8]])
  }
  // Neck, ears and a three-quarter face; face detail stays restrained at scale.
  polygon(c, a.skin, [[10.7, 6.4], [13.3, 6.3], [13.6, 8.4], [12, 9.3], [10.7, 8.2]])
  c.save()
  c.translate(12, 8)
  c.scale(0.7, 0.7)
  c.translate(-12, -8)
  ellipse(c, a.hair, 12, 4.4, 3.15, 3.9)
  if (a.role === "john") {
    polygon(c, a.hair, [[9.1, 2.8], [14.8, 2.6], [15.6, 9.5], [13.9, 11], [9.3, 9.3], [8.2, 7]])
  }
  ellipse(c, a.skin, 12.1, 4.9, 2.45, 2.7)
  ellipse(c, "#dab18a", 10.3, 5, 0.6, 0.8)
  polygon(c, "#d2a27a", [[10.4, 3.5], [13.1, 3.4], [13.4, 5.8], [11.2, 6.7], [10.1, 5]])
  polygon(c, a.hair, [[8.9, 3.9], [9.3, 1.7], [11.3, 0.6], [13.7, 1], [15.1, 2.6], [14.9, 4.6], [13.5, 3.4], [12.2, 2.3], [10.4, 3.3]])
  stroke(c, "#836d4b", 0.45, [[9.9, 2.2], [11.3, 1.6], [12.9, 1.9]])
  stroke(c, "#4b4136", 0.35, [[12.7, 4.5], [13.4, 4.5]])
  stroke(c, "#946c4f", 0.35, [[13.5, 4.8], [13.9, 5.5], [13.3, 5.6]])
  if (a.role === "john") {
    polygon(c, a.hair, [[10.2, 5.9], [12, 6.6], [14.4, 5.8], [14.1, 8], [12.2, 10.1], [10.3, 8]])
    stroke(c, "#847056", 0.4, [[11.2, 7], [12.2, 9], [12.7, 7.4]])
    for (let y = 12; y < 20; y += 2) stroke(c, "#a69576", 0.3, [[8.3, y], [9.2, y + 0.6]])
  }
  if (a.role === "merchant") {
    polygon(c, "#e0d3b6", [[8.8, 3.5], [9.2, 1.2], [11.8, 0], [14.3, 0.7], [15.6, 2.8], [14.8, 4], [12.4, 2.8], [10.3, 3.5]])
    stroke(c, "#aa9774", 0.5, [[9.1, 2.9], [12, 1.9], [15, 2.4]])
    stroke(c, "#f0e5cb", 0.55, [[9.9, 1.5], [12, 1], [14.4, 1.6]])
  }
  c.restore()
}

function arm(c: CanvasRenderingContext2D, a: Clothes): void {
  polygon(c, a.dark, [[1.6, 0], [4, 0.6], [4.5, 4.8], [3.2, 6.8], [1.3, 5.8]])
  polygon(c, a.cloth, [[1.6, 0], [3.1, 0.2], [3.3, 4.5], [1.5, 4.6]])
  stroke(c, a.light, 0.45, [[1.8, 0.8], [1.8, 3.7]])
  polygon(c, a.skin, [[1.6, 4.4], [3.4, 4.5], [3.3, 6.3], [2.6, 7], [1.7, 6.3]])
}

function leg(c: CanvasRenderingContext2D, a: Clothes): void {
  polygon(c, "#9e9279", [[2.6, 0], [5.2, 0], [4.9, 7.9], [2.8, 7.9]])
  polygon(c, "#c4b49a", [[2.6, 0], [3.5, 0], [3.6, 7.2], [2.8, 7.2]])
  polygon(c, a.role === "john" ? "#846547" : "#5e4b35", [[2.7, 6.5], [4.9, 6.5], [5, 9.2], [5.9, 10.1], [5.7, 11], [2.5, 11]])
  stroke(c, "#af8d5d", 0.35, [[2.8, 7], [4.5, 7.2]])
}

function wolf(c: CanvasRenderingContext2D): void {
  polygon(c, "#747b77", [[1, 3], [3, 0.2], [5, 1.4], [8, 1.2], [10, 2.4], [18, 2.1], [21, 3.7], [23.8, 2.7], [22.6, 5.3], [19, 6.2], [9, 6], [5.6, 5], [2, 5.9], [0.2, 4.2]])
  polygon(c, "#a4a79b", [[1.2, 3.2], [3, 1.4], [5.5, 2.2], [8.5, 3.2], [18, 3.3], [20, 4.4], [17.4, 5.1], [9.3, 5.2], [4.8, 3.9], [2, 4.4]])
  polygon(c, "#c5c5b3", [[3, 4], [6, 3.7], [9, 5], [17, 4.9], [18.7, 6], [9, 6], [5.6, 5.2], [2.1, 5.1]])
  polygon(c, "#515b55", [[3, 0.2], [4.5, 1.5], [2.8, 2.3]])
  ellipse(c, "#273a33", 0.9, 4.1, 0.7, 0.45)
  ellipse(c, "#d8bc78", 3.7, 3, 0.35, 0.3)
}

function sheep(c: CanvasRenderingContext2D): void {
  const wool = ["#c8c3aa", "#e1d9bf", "#eee6cf"]
  ellipse(c, wool[0]!, 13, 4.3, 8.5, 3.5)
  for (let i = 0; i < 12; i++) ellipse(c, wool[i % 3]!, 7 + i % 5 * 2.6, 2.2 + Math.floor(i / 5) * 1.6, 2.2, 1.6)
  polygon(c, "#777965", [[2, 2.5], [5.5, 2], [7.3, 3.8], [5, 6.7], [2, 7], [0.6, 5.3]])
  ellipse(c, "#aea68b", 3.2, 3.6, 1.6, 1.7)
  ellipse(c, "#4d5547", 1.9, 5, 0.3, 0.25)
  polygon(c, "#8f927a", [[5, 3], [8, 2.2], [6.6, 4.1]])
}

/** Replaces the development pixel maps with original, high-density painted sprites. */
export function createIllustratedSprites(scene: Phaser.Scene): void {
  texture(scene, "tree-a", 44, 58, c => broadleaf(c, 0))
  texture(scene, "tree-b", 44, 58, c => broadleaf(c, 1))
  texture(scene, "pine", 36, 64, pine)
  texture(scene, "palm", 40, 62, palm)
  texture(scene, "reeds", 20, 16, reeds)
  texture(scene, "bush", 16, 8, c => {
    ellipse(c, "#24372b20", 8, 6.5, 7, 1)
    canopy(c, 5, 4.5, 4, 2.5, 43)
    canopy(c, 10, 3.8, 4.5, 3.3, 75)
    ellipse(c, "#c8b271", 6, 2.5, 0.4, 0.3)
  })
  texture(scene, "tuft", 8, 6, c => {
    for (let i = 0; i < 7; i++) {
      const x = 1.4 + i * 0.8
      polygon(c, i % 2 ? "#7f8b59" : "#a1a36b", [[x, 5.3], [x - 1.3 + i * 0.15, 0.4 + i % 3], [x + 0.6, 5.4]])
    }
  })
  for (const [key, petal] of [["flower-r", "#c99c7c"], ["flower-y", "#d2bd7c"]]) {
    texture(scene, key!, 8, 6, c => {
      stroke(c, "#627850", 0.35, [[3, 5.5], [3.7, 1.6]])
      polygon(c, "#879361", [[3.3, 4.5], [1.5, 3], [3.5, 3.8], [5.3, 3], [3.8, 4.8]])
      for (let i = 0; i < 5; i++) ellipse(c, petal!, 3.7 + Math.cos(i * 1.26) * 0.65, 1.6 + Math.sin(i * 1.26) * 0.6, 0.55, 0.4)
      ellipse(c, "#ebd39b", 3.7, 1.6, 0.3, 0.3)
    })
  }
  for (const [id, clothes] of Object.entries(CAST)) {
    texture(scene, `rig-${id}-t`, 24, 21, c => person(c, clothes))
    texture(scene, `rig-${id}-arm`, 6, 7, c => arm(c, clothes))
    texture(scene, `rig-${id}-leg`, 8, 11, c => leg(c, clothes))
  }
  texture(scene, "john-staff", 4, 20, c => {
    stroke(c, "#624e32", 0.8, [[1.4, 19.5], [2.5, 4], [2.2, 1], [1, 0.8]])
    stroke(c, "#b69a63", 0.3, [[1.2, 19], [2.1, 4], [1.9, 1.2]])
  })
  texture(scene, "rig-wolf-b", 24, 7, wolf)
  texture(scene, "rig-sheep-b", 24, 8, sheep)
  for (const [key, color] of [["rig-wolf-leg", "#858d80"], ["rig-sheep-leg", "#a29b81"]]) {
    texture(scene, key!, 6, 5, c => {
      polygon(c, color!, [[2, 0], [4, 0], [3.8, 3.5], [4.5, 4.3], [4, 5], [2, 4.8]])
      stroke(c, "#51584a", 0.6, [[2.3, 4.4], [4, 4.5]])
    })
  }
}
