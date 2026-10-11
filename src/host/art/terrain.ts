import * as Phaser from "phaser"

const project = (x: number, y: number): [number, number] => [1600 + (x - y) * 0.5, (x + y) * 0.25]
function seeded(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A continuous painted ground plane. Coordinates remain in the rules world's space. */
export function createTerrain(scene: Phaser.Scene): void {
  const texture = scene.textures.createCanvas("ground-baked", 3200, 1340)
  if (!texture) return
  const ctx = texture.context
  const random = seeded(712)
  const polygon = (points: Array<[number, number]>, color: string): void => {
    ctx.beginPath()
    points.forEach(([x, y], i) => { const p = project(x, y); if (i === 0) ctx.moveTo(...p); else ctx.lineTo(...p) })
    ctx.closePath(); ctx.fillStyle = color; ctx.fill()
  }
  polygon([[0, 0], [3200, 0], [3200, 2000], [0, 2000]], "#79845a")
  ctx.save()
  ctx.clip()
  // Large washes overlap softly; there is no visible tile lattice.
  const washes = ["#98a46c", "#64774e", "#b4b382", "#8e9963", "#536b49"]
  for (let i = 0; i < 450; i++) {
    const x = random() * 3200, y = random() * 2000
    const [px, py] = project(x, y)
    const radius = 35 + random() * 130
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius)
    gradient.addColorStop(0, washes[i % washes.length] + "88")
    gradient.addColorStop(1, washes[i % washes.length] + "00")
    ctx.fillStyle = gradient
    ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2)
  }
  // Eastern wilderness is dry sage and stone, still visibly part of the same land.
  polygon([[1690, 0], [3200, 0], [3200, 2000], [1690, 2000]], "#9a9a77")
  for (let i = 0; i < 190; i++) {
    const [x, y] = project(1720 + random() * 1450, random() * 2000)
    ctx.fillStyle = ["#7d8964", "#b0aa86", "#c0b291", "#909779"][i % 4] + "38"
    ctx.beginPath(); ctx.ellipse(x, y, 35 + random() * 70, 10 + random() * 25, -0.3, 0, Math.PI * 2); ctx.fill()
  }
  // Fine grasses and soil flecks are baked, so richness adds no per-frame work.
  for (let i = 0; i < 25500; i++) {
    const [x, y] = project(random() * 3200, random() * 2000)
    ctx.strokeStyle = ["#d3d0a340", "#455c3e35", "#e2d9af28", "#52694035"][i % 4]
    ctx.lineWidth = 0.55 + random() * 0.65
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1 + random() * 2, y - 1 - random() * 2); ctx.stroke()
  }
  const paths: Array<Array<[number, number]>> = [
    [[800, 950], [570, 790], [340, 555]],
    [[800, 950], [770, 680], [770, 500], [760, 300]],
    [[800, 950], [1030, 720], [1240, 800], [1450, 950], [1640, 1040], [1900, 1050], [2290, 1060], [2500, 720]],
    [[800, 950], [640, 1080], [440, 1260], [310, 1400]],
    [[800, 950], [810, 1170], [850, 1450], [880, 1730]],
    [[800, 950], [995, 1110], [1140, 1330]],
    [[420, 1270], [580, 1370], [850, 1450]],
  ]
  ctx.lineCap = "round"; ctx.lineJoin = "round"
  for (const path of paths) {
    for (const [width, color] of [[39, "#7c815644"], [30, "#b0a17b99"], [23, "#c5b38e"], [16, "#d0bd96"]] as const) {
      ctx.beginPath()
      const points = path.map(([x, y]) => project(x, y))
      ctx.moveTo(...points[0]!)
      for (let i = 1; i < points.length - 1; i++) {
        const current = points[i]!, next = points[i + 1]!
        ctx.quadraticCurveTo(current[0], current[1], (current[0] + next[0]) / 2, (current[1] + next[1]) / 2)
      }
      ctx.lineTo(...points[points.length - 1]!)
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke()
    }
  }
  const [plazaX, plazaY] = project(800, 950)
  for (let r = 112; r > 0; r -= 4) {
    ctx.fillStyle = "#d6c6a010"; ctx.beginPath(); ctx.ellipse(plazaX, plazaY, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill()
  }
  for (let i = 0; i < 260; i++) {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 95
    const x = plazaX + Math.cos(a) * r, y = plazaY + Math.sin(a) * r * 0.43
    ctx.fillStyle = ["#b6aa8b", "#ddd0ad", "#c1b291"][i % 3]
    ctx.beginPath(); ctx.ellipse(x, y, 2 + random() * 3, 1 + random(), 0.2, 0, Math.PI * 2); ctx.fill()
  }
  // Curving banks make the river read as a landscape, not a blue stripe.
  const bank = (offset: number, width: number, color: string): void => {
    const points: Array<[number, number]> = []
    for (let y = 0; y <= 2000; y += 25) points.push([offset + Math.sin(y / 175) * 11, y])
    for (let y = 2000; y >= 0; y -= 25) points.push([offset + width + Math.sin(y / 175) * 11, y])
    polygon(points, color)
  }
  bank(1568, 145, "#737d5f")
  bank(1582, 119, "#c4bd96")
  bank(1596, 92, "#79a79d")
  bank(1609, 66, "#508e8c")
  bank(1624, 37, "#447e81")
  for (let i = 0; i < 250; i++) {
    const y = random() * 2000, x = 1600 + random() * 79
    const [sx, sy] = project(x, y)
    ctx.strokeStyle = i % 4 ? "#beded044" : "#e5e7c78a"; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 3 + random() * 9, sy - 1); ctx.stroke()
  }
  // Shallow stepping stones at the river crossing.
  for (let x = 1593; x <= 1690; x += 18) {
    const [sx, sy] = project(x, 1040 + Math.sin(x) * 9)
    ctx.fillStyle = "#356c6b66"; ctx.beginPath(); ctx.ellipse(sx + 2, sy + 2, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = "#b9b49b"; ctx.beginPath(); ctx.ellipse(sx, sy, 6, 3, -0.2, 0, Math.PI * 2); ctx.fill()
  }
  for (const [x, y] of [[2500, 700], [2100, 1300], [2700, 1400]]) {
    const [sx, sy] = project(x, y)
    for (const [r, color] of [[37, "#6f8067"], [30, "#b5ae8d"], [25, "#749b8f"], [19, "#4d8480"]] as const) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.45, -0.12, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
  texture.refresh()
  scene.add.image(0, 0, "ground-baked").setOrigin(0).setDepth(-100)
}
