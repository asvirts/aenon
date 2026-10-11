import { Color3, DynamicTexture, Mesh, MeshBuilder, ShaderMaterial, StandardMaterial, Vector3, VertexData } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'

export const riverCenter = (z: number) => 10 + Math.sin(z * .12) * 1.7 + Math.sin(z * .33) * .35
export const riverHalfWidth = (z: number) => 3 + Math.sin(z * .2) * .35
export const riverEdge = (z: number) => riverCenter(z) - riverHalfWidth(z)
export function heightAt(x: number, z: number): number {
  const distance = Math.abs(x - riverCenter(z)) - riverHalfWidth(z)
  const land = .38 + Math.sin(x * .38) * Math.cos(z * .24) * .035
  return distance < 0 ? -.3 : Math.min(1, distance / .95) * land
}
export const dryLand = (x: number, z: number) => Math.abs(x - riverCenter(z)) > riverHalfWidth(z) + .5
function random(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function noise(x: number, z: number) { return Math.sin(x * .37 + Math.sin(z * .21)) * .5 + Math.cos(z * .53 - x * .18) * .28 + Math.sin(x * 1.8 + z * 1.3) * .1 }
const path = [{ x: -6, z: 1 }, { x: -5, z: 4.3 }, { x: -.5, z: 5.6 }, { x: 2.8, z: 3 }, { x: 3, z: -4 }, { x: -.5, z: -11 }, { x: -3, z: -20 }]
function pathDistance(x: number, z: number) {
  let d = Infinity
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!, dx = b.x - a.x, dz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)))
    d = Math.min(d, Math.hypot(x - a.x - dx * t, z - a.z - dz * t))
  }
  return d
}
function makeVertexMesh(name: string, positions: number[], indices: number[], colors: number[], scene: Scene, uvs?: number[]) {
  const normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals)
  const data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = normals; data.colors = colors; if (uvs) data.uvs = uvs
  const mesh = new Mesh(name, scene); data.applyToMesh(mesh); mesh.useVertexColors = true; return mesh
}
export function createEnvironment(scene: Scene, size = 60) {
  const rand = random(72028), positions: number[] = [], indices: number[] = [], colors: number[] = [], uvs: number[] = []
  const sand = Color3.FromHexString('#c8b586'), sage = Color3.FromHexString('#929669'), pathColor = Color3.FromHexString('#dbc69b')
  const steps = Math.ceil(size * 2)
  for (let row = 0; row <= steps; row++) for (let col = 0; col <= steps; col++) {
    const x = col / steps * size - size / 2, z = row / steps * size - size / 2
    positions.push(x, heightAt(x, z), z); uvs.push(col / steps * 10, row / steps * 10)
    const n = noise(x, z), blend = Math.max(0, Math.min(.82, .36 + n * .43))
    let c = Color3.Lerp(sand, sage, blend)
    const pd = pathDistance(x, z) + noise(x * 2, z * 2) * .2
    c = Color3.Lerp(c, pathColor, Math.max(0, Math.min(1, (1.9 - pd) * 1.3)))
    const edge = Math.abs(x - riverCenter(z)) - riverHalfWidth(z)
    if (edge < 1.8) c = Color3.Lerp(c, Color3.FromHexString('#baa57b'), .5)
    const shade = .98 + rand() * .06; colors.push(c.r * shade, c.g * shade, c.b * shade, 1)
    if (col < steps && row < steps) { const i = row * (steps + 1) + col; indices.push(i, i + 1, i + steps + 1, i + 1, i + steps + 2, i + steps + 1) }
  }
  const ground = makeVertexMesh('earth', positions, indices, colors, scene, uvs)
  ground.receiveShadows = true; ground.metadata = { walkSurface: true }
  const groundMat = new StandardMaterial('hand-brushed-earth', scene); groundMat.specularColor = Color3.Black()
  const texture = new DynamicTexture('original-earth-brushwork', { width: 512, height: 512 }, scene, true)
  const ctx = texture.getContext(); ctx.fillStyle = '#efebd9'; ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 26000; i++) {
    const v = Math.floor(185 + rand() * 65)
    ctx.fillStyle = `rgba(${v},${v - 2},${v - 10},${.08 + rand() * .12})`
    ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 8, .5 + rand() * 2)
  }
  texture.update(); groundMat.diffuseTexture = texture; ground.material = groundMat

  const waterPositions: number[] = [], waterIndices: number[] = [], waterUV: number[] = []
  const waterSteps = 120, across = 10
  for (let row = 0; row <= waterSteps; row++) for (let col = 0; col <= across; col++) {
    const z = row / waterSteps * (size + 4) - (size + 4) / 2, t = col / across
    waterPositions.push(riverCenter(z) + (t * 2 - 1) * riverHalfWidth(z), .025, z); waterUV.push(t, z)
    if (row < waterSteps && col < across) { const i = row * (across + 1) + col; waterIndices.push(i, i + across + 1, i + 1, i + 1, i + across + 1, i + across + 2) }
  }
  const water = new Mesh('Jordan-water', scene), waterData = new VertexData()
  waterData.positions = waterPositions; waterData.indices = waterIndices; waterData.uvs = waterUV; waterData.applyToMesh(water)
  const waterMat = new ShaderMaterial('original-painted-river', scene, {
    vertexSource: `precision highp float; attribute vec3 position; attribute vec2 uv; uniform mat4 worldViewProjection; varying vec2 vUV; varying vec3 p; void main(){vUV=uv;p=position;gl_Position=worldViewProjection*vec4(position,1.);}`,
    fragmentSource: `precision highp float; varying vec2 vUV; varying vec3 p; uniform float time;
      void main(){float edge=min(vUV.x,1.-vUV.x);float flow=sin(p.z*2.6+p.x*1.8+time*.48)+sin(p.z*7.4-p.x*3.6-time*.65)*.28;
      vec3 deep=vec3(.13,.36,.38), shallow=vec3(.34,.57,.51);vec3 col=mix(shallow,deep,smoothstep(0.,.28,edge));
      col+=vec3(.033,.05,.045)*flow;
      float ripple=pow(max(0.,sin(p.z*8.+p.x*2.+sin(p.x*2.5+time*.22)*1.5+time*.8)),34.);
      float glint=smoothstep(.15,.7,sin(p.x*4.3-p.z*.85));col+=vec3(.23,.26,.20)*ripple*glint*.45;
      float foam=(1.-smoothstep(.008,.035,edge))*(.55+.3*sin(p.z*5.+time*.5)); col=mix(col,vec3(.72,.76,.58),foam*.8);
      gl_FragColor=vec4(col,1.);}`
  }, { attributes: ['position', 'uv'], uniforms: ['worldViewProjection', 'time'] })
  water.material = waterMat; water.isPickable = false; waterMat.backFaceCulling = false; waterMat.setFloat('time', 0)

  const grassPos: number[] = [], grassIdx: number[] = [], grassColor: number[] = []
  const grassMaterial = new StandardMaterial('original-meadow-colors', scene); grassMaterial.specularColor = Color3.Black(); grassMaterial.backFaceCulling = false
  function blade(x: number, y: number, z: number, h: number, w: number, angle: number, color: Color3) {
    const i = grassPos.length / 3, dx = Math.cos(angle) * w, dz = Math.sin(angle) * w
    grassPos.push(x - dx, y, z - dz, x + dx, y, z + dz, x + .09 * Math.cos(angle + 1), y + h, z + .09 * Math.sin(angle + 1))
    grassIdx.push(i, i + 1, i + 2)
    for (let k = 0; k < 3; k++) { const m = k === 2 ? 1.13 : .88; grassColor.push(color.r * m, color.g * m, color.b * m, 1) }
  }
  for (let i = 0; i < 2600; i++) {
    const x = rand() * 47 - 24, z = rand() * 47 - 24
    if (!dryLand(x, z) || pathDistance(x, z) < 1.2 || (x > -9.5 && x < -2.5 && z > -6 && z < 1.4)) continue
    const c = Color3.Lerp(Color3.FromHexString('#7d8553'), Color3.FromHexString('#bbb077'), rand())
    for (let b = 0; b < 3; b++) blade(x + rand() * .15, heightAt(x, z), z + rand() * .15, .17 + rand() * .26, .028 + rand() * .025, rand() * 6.28, c)
  }
  const meadow = makeVertexMesh('meadow-brushes', grassPos, grassIdx, grassColor, scene); meadow.material = grassMaterial; meadow.isPickable = false; meadow.receiveShadows = true

  const reeds: Mesh[] = [], rocks: Mesh[] = []
  const stemMat = new StandardMaterial('reeds-ochre', scene); stemMat.diffuseColor = Color3.FromHexString('#8c8856'); stemMat.specularColor = Color3.Black()
  const reedLeafMat = new StandardMaterial('reeds-sage', scene); reedLeafMat.diffuseColor = Color3.FromHexString('#687e50'); reedLeafMat.specularColor = Color3.Black(); reedLeafMat.backFaceCulling = false
  const rockMat = new StandardMaterial('river-limestone', scene); rockMat.diffuseColor = Color3.FromHexString('#c6bd9e').scale(.66); rockMat.specularColor = Color3.Black()
  for (let i = 0; i < 105; i++) {
    const z = rand() * 49 - 25, side = rand() > .65 ? 1 : -1, x = riverCenter(z) + side * (riverHalfWidth(z) + rand() * .9 + .05)
    const h = .5 + rand() * .95, y = heightAt(x, z)
    const stem = MeshBuilder.CreateCylinder('reed-stem', { height: h, diameterTop: .023, diameterBottom: .045, tessellation: 4 }, scene)
    stem.position.set(x, y + h / 2, z); stem.rotation.z = (rand() - .5) * .22; stem.material = stemMat; reeds.push(stem)
    for (let j = 0; j < 3; j++) {
      const angle = rand() * Math.PI * 2, dx = Math.cos(angle), dz = Math.sin(angle), reach = h * (.3 + rand() * .2), width = .035
      const leaf = new Mesh('tapered-reed-blade', scene), data = new VertexData()
      const base = y + h * (.2 + j * .16)
      data.positions = [x, base, z, x + dx * reach * .5 - dz * width, base + h * .2, z + dz * reach * .5 + dx * width,
        x + dx * reach * .5 + dz * width, base + h * .2, z + dz * reach * .5 - dx * width, x + dx * reach, base + h * .28, z + dz * reach]
      data.indices = [0, 1, 2, 1, 3, 2]; data.uvs = [.5, 0, 0, .5, 1, .5, .5, 1]
      const normals: number[] = []; VertexData.ComputeNormals(data.positions, data.indices, normals); data.normals = normals
      data.applyToMesh(leaf); leaf.material = reedLeafMat; reeds.push(leaf)
    }
  }
  for (let i = 0; i < 130; i++) {
    let x: number, z: number
    if (i < 65) { z = rand() * 46 - 23; x = riverEdge(z) - rand() * 1.1 }
    else { x = rand() * 43 - 22; z = rand() * 43 - 22; if (!dryLand(x, z) || pathDistance(x, z) < 1) continue }
    const rock = MeshBuilder.CreateIcoSphere('river-stone', { radius: .12 + rand() * .32, subdivisions: 1, flat: true }, scene)
    rock.scaling.set(1 + rand() * .5, .4 + rand() * .5, .75 + rand() * .65)
    rock.position.set(x, heightAt(x, z) + .04, z); rock.rotation.y = rand() * 6.28; rock.material = rockMat; rocks.push(rock)
  }
  const merge = (meshes: Mesh[], name: string) => { const mesh = Mesh.MergeMeshes(meshes, true, true, undefined, false, true); if (mesh) { mesh.name = name; mesh.isPickable = false; mesh.receiveShadows = true } return mesh }
  const reedMesh = merge(reeds, 'river-reeds'), rockMesh = merge(rocks, 'scattered-limestone')
  const dustPositions: Vector3[] = []
  for (let i = 0; i < 14; i++) dustPositions.push(new Vector3(rand() * 18 - 12, 1 + rand() * 4, rand() * 18 - 9))
  return { ground, water, waterMat, meadow, reedMesh, rockMesh, dustPositions }
}
