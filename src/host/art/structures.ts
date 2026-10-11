import * as Phaser from "phaser"

type Point = readonly [number, number]
type Paint = CanvasRenderingContext2D

const RESOLUTION = 4
const WOOD = "#755841"
const WOOD_LIGHT = "#a68760"
const WOOD_DARK = "#514438"
const STONE_DARK = "#8b8f80"

function polygon(ctx: Paint, points: readonly Point[], fill: string): void {
  ctx.beginPath()
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

function line(ctx: Paint, points: readonly Point[], color: string, width = 0.4): void {
  ctx.beginPath()
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.stroke()
}

function ellipse(ctx: Paint, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

function shadow(ctx: Paint, x: number, y: number, rx: number, ry: number): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, rx)
  gradient.addColorStop(0, "rgba(40, 46, 35, .29)")
  gradient.addColorStop(0.65, "rgba(40, 46, 35, .17)")
  gradient.addColorStop(1, "rgba(40, 46, 35, 0)")
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1, ry / rx)
  ctx.translate(-x, -y)
  ctx.fillStyle = gradient
  ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2)
  ctx.restore()
}

/** A high resolution raster with the same logical dimensions as the old art. */
function texture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: Paint) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key)
  const canvas = document.createElement("canvas")
  canvas.width = width * RESOLUTION
  canvas.height = height * RESOLUTION
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.scale(RESOLUTION, RESOLUTION)
  draw(ctx)
  const result = scene.textures.addCanvas(key, canvas)
  if (!result) return
  result.source[0].resolution = RESOLUTION
  result.get().setTrim(width, height, 0, 0, width, height)
  result.setFilter(Phaser.Textures.FilterMode.LINEAR)
}

function jar(ctx: Paint, x: number, y: number, scale = 1, pale = false): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  const gradient = ctx.createLinearGradient(-3, 0, 3, 0)
  gradient.addColorStop(0, pale ? "#d4b487" : "#c48a60")
  gradient.addColorStop(0.35, pale ? "#e5c89c" : "#d79b6b")
  gradient.addColorStop(1, pale ? "#a47d59" : "#895542")
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(-1.1, -6.3)
  ctx.bezierCurveTo(-1.3, -4.9, -3.5, -4.3, -3.2, -1.7)
  ctx.bezierCurveTo(-3, 0.3, -1.7, 0.8, 0, 0.8)
  ctx.bezierCurveTo(2, 0.8, 3.1, 0, 3.1, -1.8)
  ctx.bezierCurveTo(3.1, -4.3, 1.2, -4.8, 1.1, -6.3)
  ctx.closePath()
  ctx.fill()
  ellipse(ctx, 0, -6.4, 1.7, 0.65, pale ? "#d8ba8a" : "#d59a6b")
  ellipse(ctx, 0, -6.45, 1.05, 0.34, "#73513f")
  line(ctx, [[-2.6, -2.7], [0, -2.3], [2.5, -2.7]], "rgba(237, 213, 167, .45)", 0.35)
  ctx.restore()
}

function drawWell(ctx: Paint): void {
  shadow(ctx, 16.5, 18.2, 12, 2.5)
  // Back upright, then the circular limestone parapet.
  line(ctx, [[20.4, 4.7], [20.4, 13.6]], WOOD_DARK, 1.3)
  ellipse(ctx, 15, 15.2, 8.1, 3.5, STONE_DARK)
  ctx.fillStyle = STONE_DARK
  ctx.fillRect(6.9, 12, 16.2, 3.1)
  ellipse(ctx, 15, 12.2, 8.1, 3.5, "#d5cbb0")
  ellipse(ctx, 15, 12.3, 5.4, 2.1, "#586b65")
  ellipse(ctx, 15, 12.6, 4.2, 1.2, "#374f4b")
  ctx.beginPath()
  ctx.ellipse(15, 13.6, 7.75, 3.5, 0, 0, Math.PI)
  ctx.strokeStyle = "#b9b294"
  ctx.lineWidth = 2.6
  ctx.stroke()
  for (const x of [9, 13, 17, 21]) {
    const y = 14.5 + Math.sin((x - 7) / 16 * Math.PI) * 1.3
    line(ctx, [[x, y - 0.5], [x, y + 1.8]], "#898d7b", 0.35)
  }
  line(ctx, [[6.9, 12.4], [8.9, 14], [12, 15.1], [16, 15.5], [20.3, 14.6]], "#e1d6bb", 0.6)
  line(ctx, [[9, 5.5], [9, 14]], WOOD, 1.6)
  line(ctx, [[8.6, 5.5], [8.6, 13.5]], WOOD_LIGHT, 0.4)
  line(ctx, [[9, 7.4], [20.6, 7.4]], WOOD_DARK, 0.9)
  line(ctx, [[14.9, 7.5], [14.9, 12.6]], "#ac9971", 0.35)
  ellipse(ctx, 15, 7.4, 1, 1.2, "#8b704d")
  polygon(ctx, [[5, 6.2], [13.8, 1.2], [25, 4.2], [16.6, 9.1]], "#985f47")
  polygon(ctx, [[13.8, 1.2], [24.8, 4.2], [21.8, 1.3], [12, 0.2]], "#b97953")
  line(ctx, [[5, 6.2], [16.6, 9.1], [25, 4.2]], "#694d3d", 0.9)
  for (let i = 1; i < 5; i += 1) line(ctx, [[5 + i * 1.75, 6.2 - i], [16.6 + i * 1.68, 9.1 - i * 0.98]], "#b17a57", 0.4)
  for (let i = 1; i < 4; i += 1) line(ctx, [[5 + i * 2.9, 6.2 + i * 0.73], [13.8 + i * 2.8, 1.2 + i * 0.75]], "rgba(79, 52, 42, .24)", 0.3)
  jar(ctx, 25, 17.1, 0.48, true)
}

function drawStall(ctx: Paint): void {
  shadow(ctx, 16.5, 16.4, 15, 2)
  line(ctx, [[6, 3], [6, 15.4]], WOOD, 1.2)
  line(ctx, [[27, 5], [27, 16]], WOOD_DARK, 1.1)
  polygon(ctx, [[3, 10.5], [25, 12.6], [29, 9.6], [8, 7.8]], "#b4996f")
  polygon(ctx, [[3, 10.5], [25, 12.6], [25, 15.4], [3, 13.5]], "#947957")
  polygon(ctx, [[25, 12.6], [29, 9.6], [29, 12.5], [25, 15.4]], "#6e604a")
  for (let i = 0; i < 7; i += 1) line(ctx, [[5 + i * 3, 11], [5 + i * 3, 13.5 + i * 0.27]], "#806849", 0.3)
  line(ctx, [[4, 12.6], [4, 16.7]], WOOD_DARK, 1)
  line(ctx, [[24, 14.3], [24, 17]], WOOD_DARK, 1)
  // Produce in shallow wicker baskets.
  for (const [bx, by, color] of [[8, 9.6, "#a46048"], [15, 10.2, "#c5aa58"], [22, 10.8, "#758754"]] as const) {
    ellipse(ctx, bx, by, 3, 1.4, "#796342")
    for (let i = 0; i < 5; i += 1) ellipse(ctx, bx - 2 + i, by - 0.6 + (i % 2) * 0.4, 0.8, 0.7, color)
    line(ctx, [[bx - 2.8, by + 0.2], [bx, by + 0.8], [bx + 2.8, by + 0.2]], "#bd9e6a", 0.35)
  }
  // An angled linen canopy, sun-faded terracotta stripes and a soft scalloped hem.
  polygon(ctx, [[6, 0.6], [27, 2.2], [31, 6.4], [2, 4.3]], "#d9cba7")
  for (let i = 0; i < 5; i += 1) {
    const sx = 6 + i * 4.2
    const ex = 2 + i * 5.8
    polygon(ctx, [[sx, 0.6 + i * 0.32], [sx + 2.1, 0.76 + i * 0.32], [ex + 2.9, 4.51 + i * 0.42], [ex, 4.3 + i * 0.42]], "#a77560")
  }
  polygon(ctx, [[2, 4.3], [31, 6.4], [30.7, 7.8], [2.3, 5.6]], "#c2b28e")
  for (let i = 0; i < 5; i += 1) polygon(ctx, [[2 + i * 5.8, 4.3 + i * 0.42], [4.9 + i * 5.8, 4.51 + i * 0.42], [4.9 + i * 5.8, 5.8 + i * 0.42], [2.3 + i * 5.8, 5.6 + i * 0.42]], "#92654e")
  line(ctx, [[6, 0.6], [27, 2.2]], "#f0e2be", 0.45)
  line(ctx, [[2, 4.3], [31, 6.4]], "rgba(243, 229, 195, .6)", 0.35)
}

function drawTent(ctx: Paint): void {
  shadow(ctx, 18, 19.8, 16, 2)
  polygon(ctx, [[3, 16.2], [10.9, 2.2], [22.3, 5.4], [31, 19.2], [17.1, 21]], "#b6aa85")
  polygon(ctx, [[3, 16.2], [10.9, 2.2], [22.3, 5.4], [17.1, 21]], "#ded2ad")
  polygon(ctx, [[22.3, 5.4], [31, 19.2], [17.1, 21]], "#b3a27b")
  polygon(ctx, [[22.3, 7], [27.7, 19.3], [20, 20.2]], "#5e5c4c")
  polygon(ctx, [[22.3, 6.3], [24.3, 16.8], [27.8, 19.3]], "#ccbc92")
  line(ctx, [[10.9, 2.2], [22.3, 5.4]], "#f2e5c2", 0.7)
  line(ctx, [[3, 16.2], [17.1, 21], [22.3, 5.4]], "#a29370", 0.5)
  line(ctx, [[7.8, 8.2], [18.9, 11.6]], "#c8bc96", 0.35)
  line(ctx, [[6, 11.6], [17.9, 15.3]], "#c8bc96", 0.35)
  line(ctx, [[10.9, 2.2], [1.2, 17.3]], "#aa9673", 0.35)
  line(ctx, [[22.3, 5.4], [33, 19]], "#aa9673", 0.35)
  line(ctx, [[1.2, 16.3], [1.2, 18.4]], WOOD_DARK, 0.65)
  line(ctx, [[33, 18], [33, 20]], WOOD_DARK, 0.65)
  line(ctx, [[22.3, 4], [22.3, 6.3]], WOOD, 0.6)
}

function drawRock(ctx: Paint, standing = false): void {
  if (standing) {
    shadow(ctx, 7.3, 12.3, 6, 1.4)
    polygon(ctx, [[3.5, 11.8], [3.9, 2.1], [6.2, 0.8], [9.6, 1.4], [10.7, 11.4], [7.9, 13]], "#9ba18f")
    polygon(ctx, [[3.5, 11.8], [3.9, 2.1], [6.2, 0.8], [7.8, 2.5], [7.9, 13]], "#c8c8ad")
    polygon(ctx, [[7.8, 2.5], [9.6, 1.4], [10.7, 11.4], [7.9, 13]], "#8f998c")
    line(ctx, [[4.9, 3], [5.2, 7], [4.7, 9.2]], "#b0b49d", 0.35)
    line(ctx, [[8, 5.7], [6.6, 6.3], [6.2, 7.9]], "#a7ad98", 0.35)
    ellipse(ctx, 8.4, 11.1, 2.1, 0.6, "#7c8b68")
  } else {
    shadow(ctx, 8.5, 6.8, 7.3, 1.2)
    polygon(ctx, [[1.6, 5.6], [4.4, 1.8], [8.8, 0.5], [12.6, 2.1], [14.5, 5.5], [10.6, 7.2], [4.6, 7]], "#9eaa96")
    polygon(ctx, [[1.6, 5.6], [4.4, 1.8], [8.8, 0.5], [9.8, 3.4], [6.5, 5.5]], "#c5c9b0")
    polygon(ctx, [[8.8, 0.5], [12.6, 2.1], [14.5, 5.5], [10.6, 7.2], [9.8, 3.4]], "#8f9d8b")
    line(ctx, [[4.4, 1.8], [8.8, 0.5], [12.6, 2.1]], "#d8d7bd", 0.45)
    line(ctx, [[9.8, 3.4], [7.1, 4.5], [6.2, 6.2]], "#abb29c", 0.35)
    ellipse(ctx, 4.7, 6.4, 2, 0.55, "#83936c")
  }
}

function drawBarrel(ctx: Paint): void {
  shadow(ctx, 6.3, 8.8, 5.4, 1)
  const gradient = ctx.createLinearGradient(2, 0, 10, 0)
  gradient.addColorStop(0, "#c1a171")
  gradient.addColorStop(0.45, "#a5855b")
  gradient.addColorStop(1, "#715a42")
  ctx.beginPath()
  ctx.moveTo(3, 1.4)
  ctx.bezierCurveTo(1.5, 4, 1.5, 7, 3.1, 8.5)
  ctx.bezierCurveTo(5, 9.8, 8.1, 9.5, 9, 8.4)
  ctx.bezierCurveTo(10.5, 5.7, 10, 3.2, 9, 1.5)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()
  for (const x of [3.7, 5.5, 7.6]) line(ctx, [[x, 1.8], [x - 0.2, 5], [x, 8.7]], "#826748", 0.22)
  ellipse(ctx, 6, 1.5, 3.1, 1.3, "#d3b181")
  ellipse(ctx, 6, 1.5, 2.6, 0.95, "#a3865e")
  line(ctx, [[3, 3.1], [4.4, 3.8], [7.3, 4], [9.3, 3.3]], "#686a59", 0.65)
  line(ctx, [[2.9, 6.8], [4.6, 7.5], [7.4, 7.6], [9.3, 6.9]], "#686a59", 0.65)
  line(ctx, [[4, 1], [7.6, 2]], "#d7b98c", 0.25)
}

function drawCrate(ctx: Paint): void {
  shadow(ctx, 8.2, 9.8, 7.5, 1)
  polygon(ctx, [[1.7, 3.3], [8.7, 5.5], [14, 3], [7, 0.8]], "#c1a273")
  polygon(ctx, [[1.7, 3.3], [8.7, 5.5], [8.7, 10.2], [1.7, 8.1]], "#a4865b")
  polygon(ctx, [[8.7, 5.5], [14, 3], [14, 7.9], [8.7, 10.2]], "#796448")
  for (const dy of [1.5, 3]) line(ctx, [[2, 3.5 + dy], [8.7, 5.6 + dy], [13.7, 3.3 + dy]], "#775f42", 0.25)
  line(ctx, [[2.4, 3.9], [2.4, 7.6], [8, 9.2], [8, 5.8], [2.4, 3.9], [8, 9.2]], "#d1ae79", 0.65)
  line(ctx, [[9.3, 5.8], [9.3, 9.1], [13.3, 7.4], [13.3, 4.1], [9.3, 5.8], [13.3, 7.4]], "#ac8e61", 0.6)
  line(ctx, [[2.4, 3.2], [8.6, 5.1], [13.2, 3.1]], "#dec396", 0.4)
}

function drawLamp(ctx: Paint): void {
  shadow(ctx, 5.1, 9.9, 4, 0.8)
  line(ctx, [[4.8, 9.6], [4.8, 1.4], [6.8, 1.4], [6.8, 3.2]], "#596052", 0.65)
  line(ctx, [[4.6, 8.7], [4.6, 1.5]], "#92947a", 0.2)
  polygon(ctx, [[5.4, 3.2], [8, 3.2], [8.3, 6.2], [5.1, 6.2]], "#675a45")
  polygon(ctx, [[5.9, 3.7], [7.5, 3.7], [7.7, 5.6], [5.7, 5.6]], "#e0be72")
  ellipse(ctx, 6.7, 4.7, 0.45, 0.8, "#fff0b8")
  line(ctx, [[6.7, 3.5], [6.7, 5.9]], "#a98550", 0.2)
  ellipse(ctx, 4.8, 9.7, 1.4, 0.5, "#676d59")
}

function drawSign(ctx: Paint): void {
  shadow(ctx, 9.7, 11, 5, 0.8)
  line(ctx, [[9, 1], [9, 11]], WOOD_DARK, 1.2)
  line(ctx, [[8.7, 1], [8.7, 10.7]], WOOD_LIGHT, 0.3)
  polygon(ctx, [[2.2, 2], [13.2, 2.6], [16.4, 4.1], [13.2, 5.2], [2.2, 4.6]], "#bda17a")
  polygon(ctx, [[4.7, 6.3], [14.7, 6], [14.7, 8.2], [4.7, 8.6], [2.8, 7.3]], "#a98e67")
  line(ctx, [[4, 3.4], [11.8, 3.8]], "#76634a", 0.3)
  line(ctx, [[6, 7.3], [12.5, 7.1]], "#6e5e45", 0.3)
  ellipse(ctx, 9, 3.7, 0.23, 0.23, "#6a6653")
}

function drawDeadTree(ctx: Paint): void {
  shadow(ctx, 11.7, 19.2, 8, 1.5)
  polygon(ctx, [[8.1, 19.3], [10.1, 13], [9.4, 8.5], [10.4, 2.4], [12.1, 3.2], [11.3, 9], [12.6, 14.2], [14.6, 19.6]], "#928d71")
  polygon(ctx, [[11.5, 3], [11.2, 10], [12.6, 14.2], [14.6, 19.6], [11.1, 18.7]], "#6d715f")
  line(ctx, [[10.7, 10.8], [5.9, 7.2], [4.9, 3.1]], "#8d8a70", 1.5)
  line(ctx, [[6.2, 7.3], [2.5, 6.2], [1.2, 3.5]], "#929078", 0.8)
  line(ctx, [[11.5, 12.1], [16.9, 8.8], [18.1, 3.8]], "#797e68", 1.2)
  line(ctx, [[16.9, 8.8], [20.4, 8], [21, 5.9]], "#8b8b72", 0.6)
  line(ctx, [[10.3, 5.4], [7.9, 2.4], [8.5, 0.5]], "#a39b7e", 0.7)
  line(ctx, [[10.3, 17.5], [10.7, 13], [9.9, 10.2]], "#b0a98b", 0.4)
  line(ctx, [[8.1, 19.3], [6, 20.1]], "#8d9073", 0.8)
}

function drawFire(ctx: Paint, alternate: boolean): void {
  shadow(ctx, 8, 11.5, 7, 1.2)
  ellipse(ctx, 8, 10.1, 6, 2, "#7e8470")
  ellipse(ctx, 8, 9.8, 4.8, 1.4, "#56594c")
  for (let i = 0; i < 8; i += 1) {
    const a = i / 8 * Math.PI * 2
    ellipse(ctx, 8 + Math.cos(a) * 5.4, 10.1 + Math.sin(a) * 1.9, 1.15, 0.7, i < 4 ? "#a7aa91" : "#b9b89a")
  }
  line(ctx, [[4.8, 10.1], [11, 8.9]], "#72583e", 1.2)
  line(ctx, [[5.3, 8.6], [10.8, 10.7]], "#976741", 1.3)
  ctx.beginPath()
  ctx.moveTo(4.8, 8.8)
  ctx.bezierCurveTo(3.7, 6.4, 7, 5.6, alternate ? 7.5 : 6.5, 2.7)
  ctx.bezierCurveTo(9.3, 3.5, 8.4, 5.2, 9.7, 5.8)
  ctx.bezierCurveTo(10.4, 4.3, 10.1, 3.8, 11, 4.2)
  ctx.bezierCurveTo(12.1, 6.3, 12.3, 8.4, 10, 9.4)
  ctx.closePath()
  ctx.fillStyle = "#d9954f"
  ctx.fill()
  polygon(ctx, [[6, 9], [7.8, 5.5], [8.5, 7.1], [9.4, 6.2], [10, 9.3], [7.7, 9.8]], "#efc276")
  ellipse(ctx, 8, 9, 1.25, 1, "#f5dda0")
}

/** Original props, with a restrained material palette and light from the upper left. */
export function createStructureTextures(scene: Phaser.Scene): void {
  texture(scene, "well", 30, 20, drawWell)
  texture(scene, "stall", 32, 18, drawStall)
  texture(scene, "tent", 34, 22, drawTent)
  texture(scene, "jars", 20, 13, ctx => {
    shadow(ctx, 10, 11, 9, 1.5)
    jar(ctx, 6, 10.5, 1.25)
    jar(ctx, 14.2, 10.3, 1.05, true)
  })
  texture(scene, "rock", 16, 8, ctx => drawRock(ctx))
  texture(scene, "stone", 14, 14, ctx => drawRock(ctx, true))
  texture(scene, "barrel", 12, 10, drawBarrel)
  texture(scene, "crate", 16, 11, drawCrate)
  texture(scene, "lamp", 10, 11, drawLamp)
  texture(scene, "sign", 20, 12, drawSign)
  texture(scene, "deadtree", 22, 21, drawDeadTree)
  texture(scene, "fire-a", 16, 13, ctx => drawFire(ctx, false))
  texture(scene, "fire-b", 16, 13, ctx => drawFire(ctx, true))
  texture(scene, "rug", 72, 40, ctx => {
    const corners: Point[] = [[3, 19], [28, 6], [68, 25], [43, 38]]
    polygon(ctx, corners, "#765d4e")
    polygon(ctx, [[6, 19], [28, 8], [64, 25], [43, 36]], "#a77960")
    polygon(ctx, [[12, 19], [28, 11], [58, 25], [43, 33]], "#c1a07d")
    polygon(ctx, [[17, 19], [28, 13.5], [53, 25], [43, 30.5]], "#8e725c")
    for (let i = 0; i < 6; i += 1) {
      const x = 17 + i * 5
      polygon(ctx, [[x, 19 + i * 2.4], [x + 5, 16.5 + i * 2.4], [x + 10, 19 + i * 2.4], [x + 5, 21.5 + i * 2.4]], "#d0b68c")
    }
    for (let i = 0; i < 12; i += 1) {
      line(ctx, [[3 + i * 2.05, 19 - i * 1.06], [1 + i * 2.05, 18 - i * 1.06]], "#bba47f", 0.65)
      line(ctx, [[43 + i * 2.05, 38 - i * 1.06], [45 + i * 2.05, 39 - i * 1.06]], "#bba47f", 0.65)
    }
  })
}

function color(number: number, amount = 0): string {
  return `rgb(${[16, 8, 0].map(shift => Math.max(0, Math.min(255, ((number >> shift) & 255) + amount))).join(",")})`
}

/** A limestone cottage whose screen position is the front corner at ground level. */
export function addHouse(
  scene: Phaser.Scene,
  xScreen: number,
  yScreen: number,
  width = 160,
  height = 145,
  roofColor = 0x9a634c,
): Phaser.GameObjects.Container {
  const key = `cottage-${width}-${height}-${roofColor}`
  if (!scene.textures.exists(key)) texture(scene, key, width, height, ctx => {
    ctx.scale(width / 160, height / 145)
    shadow(ctx, 87, 123, 72, 20)
    // Stone plinth follows the same two-to-one ground projection as the map.
    polygon(ctx, [[13, 100], [89, 138], [149, 108], [73, 70]], "#97937a")
    polygon(ctx, [[13, 100], [89, 138], [89, 142], [13, 104]], "#b2a98c")
    polygon(ctx, [[89, 138], [149, 108], [149, 112], [89, 142]], "#848775")
    polygon(ctx, [[16, 54], [90, 91], [90, 136], [16, 99]], "#d3c5a0")
    polygon(ctx, [[90, 91], [146, 63], [146, 108], [90, 136]], "#afa88b")
    // The gable faces southeast; pale masonry catches a little reflected light.
    polygon(ctx, [[90, 91], [118, 44], [146, 63]], "#c2b695")
    polygon(ctx, [[16, 54], [90, 91], [90, 98], [16, 61]], "rgba(111, 94, 69, .2)")
    polygon(ctx, [[90, 91], [146, 63], [146, 70], [90, 98]], "rgba(81, 80, 62, .2)")
    // Broken plaster exposes occasional ashlar blocks without a grid of outlines.
    for (const [x, y] of [[21, 90], [27, 94], [76, 119], [81, 123], [20, 65], [73, 90]]) {
      polygon(ctx, [[x, y], [x + 7, y + 3.5], [x + 7, y + 7], [x, y + 3.5]], "#c5b792")
      line(ctx, [[x, y], [x + 7, y + 3.5]], "#e4d8b7", 0.5)
    }
    for (const [x, y] of [[95, 119], [136, 101], [131, 105]]) polygon(ctx, [[x, y], [x + 6, y - 3], [x + 6, y], [x, y + 3]], "#9f9e81")
    // Recessed timber door and a worn limestone doorstep.
    polygon(ctx, [[42, 87], [59, 95.5], [59, 120.4], [42, 112]], "#9f8c68")
    polygon(ctx, [[44, 89], [57, 95.5], [57, 119.5], [44, 113]], WOOD_DARK)
    polygon(ctx, [[46, 91], [56, 96], [56, 118], [46, 113]], "#7e6849")
    for (let x = 48; x < 56; x += 2.5) line(ctx, [[x, 92 + (x - 48) * 0.5], [x, 114 + (x - 48) * 0.5]], "#64553f", 0.4)
    ellipse(ctx, 53.5, 107.2, 0.7, 0.9, "#b4a572")
    polygon(ctx, [[40, 112], [59, 121.5], [53, 124.5], [34, 115]], "#d8ccb0")
    polygon(ctx, [[34, 115], [53, 124.5], [53, 128], [34, 118.5]], "#b8b195")
    // Small shutters and deep shadow create dimension without luminous UI-like windows.
    polygon(ctx, [[22, 71], [35, 77.5], [35, 89.5], [22, 83]], "#9c8d69")
    polygon(ctx, [[24, 73.5], [33, 78], [33, 87], [24, 82.5]], "#53645b")
    line(ctx, [[28.5, 76], [28.5, 84.5]], "#b5a780", 0.8)
    polygon(ctx, [[20, 71], [23, 72.5], [23, 84], [20, 82.5]], "#7a8065")
    polygon(ctx, [[34, 78], [38, 80], [38, 91.5], [34, 89.5]], "#929272")
    line(ctx, [[21, 83.7], [35, 90.7]], "#e0d0a8", 1.2)
    polygon(ctx, [[112, 91], [129, 82.5], [129, 97], [112, 105.5]], "#938f73")
    polygon(ctx, [[114, 92], [127, 85.5], [127, 96], [114, 102.5]], "#4f635d")
    line(ctx, [[120.5, 88.8], [120.5, 99.2]], "#a3a07d", 0.9)
    line(ctx, [[113, 106], [130, 97.5]], "#c4bc97", 1.7)
    // Roof planes share a ridge; tile courses follow the perspective rather than a flat triangle.
    polygon(ctx, [[10, 54], [90, 94], [119, 44], [44, 6]], color(roofColor, 3))
    polygon(ctx, [[44, 6], [119, 44], [152, 63], [73, 24]], color(roofColor, 24))
    for (let i = 1; i < 9; i += 1) {
      const t = i / 9
      line(ctx, [[10 + 34 * t, 54 - 48 * t], [90 + 29 * t, 94 - 50 * t]], color(roofColor, -15), 1)
      line(ctx, [[10 + 34 * t, 53.5 - 48 * t], [90 + 29 * t, 93.5 - 50 * t]], color(roofColor, 17), 0.6)
      for (let j = 1; j < 11; j += 1) {
        const u = (j + (i % 2) * 0.5) / 11
        const x = 10 + 34 * t + (80 - 5 * t) * u
        const y = 54 - 48 * t + (40 - 2 * t) * u
        line(ctx, [[x, y], [x + 3.7, y - 5.3]], "rgba(87, 58, 45, .27)", 0.55)
      }
    }
    line(ctx, [[10, 55], [90, 95], [152, 64]], "#796348", 2.7)
    line(ctx, [[11, 53], [90, 92.5]], color(roofColor, 27), 1.3)
    line(ctx, [[44, 6], [119, 44]], color(roofColor, 43), 2.1)
    line(ctx, [[119, 44], [152, 63]], color(roofColor, 14), 1.8)
    // A small roof vent and climbing vines add signs of habitation.
    polygon(ctx, [[73, 22], [80, 25.5], [85, 23], [78, 19.5]], "#d5c3a0")
    polygon(ctx, [[73, 22], [80, 25.5], [80, 39], [73, 35.5]], "#c6b390")
    polygon(ctx, [[80, 25.5], [85, 23], [85, 36.5], [80, 39]], "#a89f80")
    polygon(ctx, [[74.5, 22], [79, 24.2], [82.8, 22.6], [78, 20.4]], "#6e6a56")
    line(ctx, [[16, 99], [17, 87], [19, 78]], "#687c55", 1)
    for (const [x, y, r] of [[16, 90, 3.5], [18, 84, 3], [16, 78, 3], [19, 97, 4], [23, 99, 3]]) {
      ellipse(ctx, x, y, r, r * 0.65, "#778b5b")
      ellipse(ctx, x - 0.7, y - 0.8, r * 0.6, r * 0.4, "#96a373")
    }
    jar(ctx, 135, 117, 1.8, true)
    jar(ctx, 144, 112, 1.2)
  })
  const image = scene.add.image(0, 0, key).setOrigin(0.56, 0.96)
  return scene.add.container(xScreen, yScreen, [image])
}
