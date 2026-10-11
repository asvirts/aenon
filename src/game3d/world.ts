import { Color3, InstancedMesh, LoadAssetContainerAsync, Matrix, Mesh, MeshBuilder, MultiMaterial, PBRMaterial, Quaternion, StandardMaterial, TransformNode, Vector3, VertexData } from '@babylonjs/core'
import type { AbstractMesh, AnimationGroup, ArcRotateCamera, AssetContainer, Scene } from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import { heightAt, bridgeAt, waterDistance } from './terrain.ts'
import { definition as gearDefinition, houses, trees, objects, navigation, landscapeDetails, layout } from './content.ts'
import { regionPlaces, regionRoads, ports } from './region.ts'
import { specialFindNames } from './economy.ts'
import { canTraverseRegion } from './regionNavigation.ts'
import { travelingCompany } from '../season/lib/scene.ts'
import { anchorHeight, plateKind, subtitleFor } from './nameplates.ts'
import type { GameEvent, GameSnapshot, Point, WorldObject } from './types.ts'

type Actor = { root: TransformNode; clips: AnimationGroup[]; active?: AnimationGroup; actionUntil: number; prior?: Point; deathUntil?: number; culled?: boolean }
export async function createWorld(scene: Scene, interact: (id: string) => void) {
  const shadowCasters: AbstractMesh[] = [], occluders: AbstractMesh[] = []
  const actors = new Map<string, Actor>(), props = new Map<string, TransformNode>()
  const scenery: TransformNode[] = [], containers = new Map<string, Promise<AssetContainer>>()
  const objectById = new Map(objects.map(object => [object.id, object]))
  const labels = new Map<string, HTMLButtonElement>(), telegraphs = new Map<string, AbstractMesh>()
  const labelLayer = document.createElement('div'); labelLayer.className = 'world-labels'; document.body.append(labelLayer)
  const floating: { element: HTMLElement; point: Point; until: number }[] = []
  const material = (name: string, hex: string, glow = 0) => {
    const mat = new StandardMaterial(name, scene); mat.diffuseColor = Color3.FromHexString(hex); mat.specularColor = Color3.Black(); mat.emissiveColor = mat.diffuseColor.scale(glow); return mat
  }
  const wood = material('olive-wood', '#795331'), stone = material('worked-limestone', '#b9ad8f'), iron = material('hammered-bronze', '#846840'), leaf = material('herb-green', '#56704c'), linen = material('woven-linen', '#c7bda0'), copper = material('exposed-copper', '#a36d44'), flower = material('flax-blossom', '#809caf'), ember = material('hearth-coals', '#df8744', .7)
  const tile = material('regional-terracotta', '#9f6547'), basalt = material('Galilee-basalt', '#5d6258'), indigo = material('regional-indigo-cloth', '#556571'), garden = material('garden-vine', '#59764b')
  const hullMat = material('original-hull-pigments', '#ddcbaa'); hullMat.backFaceCulling = false
  const register = (meshes: AbstractMesh[], id?: string, fade = false) => {
    for (const mesh of meshes) {
      if (!mesh.getTotalVertices()) continue
      mesh.metadata = id ? { objectId: id } : {}; mesh.isPickable = Boolean(id)
      // Babylon instances inherit shadow reception from their shared source mesh.
      ;(mesh instanceof InstancedMesh ? mesh.sourceMesh : mesh).receiveShadows = true
      shadowCasters.push(mesh)
      if (fade) { occluders.push(mesh); if (mesh.material) mesh.material.transparencyMode = null }
    }
  }
  const nameplateContext = {
    vendorIds: (gearDefinition.vendors ?? []).map(vendor => vendor.personId),
    questGiverIds: (gearDefinition.quests ?? []).map(quest => quest.giverId),
    biblicalFigureIds: (gearDefinition.people ?? []).filter(person => person.kind === 'biblical-figure').map(person => person.id),
  }
  function label(id: string, name: string, kind: string, object?: WorldObject) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.objectId = id; button.hidden = true
    const full = object ? plateKind(object) === 'full' : kind === 'hostile' || kind === 'person'
    button.className = `world-label ${kind} ${full ? 'full' : 'hint'}`
    const title = document.createElement('span'); title.className = 'plate-name'; title.textContent = name; button.append(title)
    if (full) {
      const subtitle = document.createElement('span'); subtitle.className = 'plate-subtitle'
      subtitle.textContent = subtitleFor({ id, kind: (object?.kind ?? kind) as WorldObject['kind'], name, subtitle: object?.subtitle }, nameplateContext)
      button.append(subtitle)
      if ((object?.kind ?? kind) === 'hostile') {
        const track = document.createElement('span'); track.className = 'plate-health-track'
        const fill = document.createElement('span'); fill.className = 'plate-health-fill'; track.append(fill); button.append(track)
      }
    }
    const detail = document.createElement('small'); button.append(detail)
    button.addEventListener('click', () => { interact(id); (document.querySelector('#world') as HTMLCanvasElement)?.focus() })
    labelLayer.append(button); labels.set(id, button); return button
  }
  for (const object of objects) label(object.id, object.name, object.kind, object)
  const setPosition = (root: TransformNode, p: Point, y = 0) => root.position.set(p.x, heightAt(p.x, p.z) + y, p.z)
  function container(filename: string) {
    let cached = containers.get(filename)
    if (!cached) { cached = LoadAssetContainerAsync(filename, scene); containers.set(filename, cached) }
    return cached
  }
  function attireMaterials(root: TransformNode): PBRMaterial[] {
    const materials = new Set<PBRMaterial>()
    for (const mesh of root.getChildMeshes()) {
      const candidates = mesh.material instanceof MultiMaterial ? mesh.material.subMaterials : [mesh.material]
      for (const item of candidates) if (item instanceof PBRMaterial) materials.add(item)
    }
    return [...materials]
  }
  async function actor(id: string, filename: string, p: Point, uniqueAttire = false) {
    const source = await container(filename), entries = source.instantiateModelsToScene(name => `${id}|${name}`, false, { doNotInstantiate: true })
    const root = new TransformNode(id, scene)
    for (const child of entries.rootNodes) child.parent = root
    if (uniqueAttire) {
      const copies = new Map()
      for (const mesh of root.getChildMeshes()) if (mesh.material) {
        const original = mesh.material
        let copy = copies.get(original)
        if (!copy) { copy = original instanceof MultiMaterial ? original.clone(`${id}|${original.name}`, true) : original.clone(`${id}|${original.name}`); copies.set(original, copy) }
        mesh.material = copy
      }
    }
    setPosition(root, p); register(root.getChildMeshes(), id === 'adventurer' || id.startsWith('company-') || id.startsWith('episode-extra-') ? undefined : id)
    for (const clip of entries.animationGroups) { clip.name = clip.name.split('|').at(-1)!; clip.stop(); clip.enableBlending = true; clip.blendingSpeed = .18 }
    const asset = { transformNodes: root.getChildTransformNodes(), skeletons: entries.skeletons }
    const model: Actor = { root, clips: entries.animationGroups, actionUntil: 0 }; actors.set(id, model)
    animate(model, 'Idle'); return { model, asset }
  }
  function animate(actor: Actor, name: string, loop = true, restart = false) {
    const clip = actor.clips.find(item => item.name.toLowerCase().split(/[|.]/).pop() === name.toLowerCase()) ?? actor.clips.find(item => item.name.toLowerCase().includes(name.toLowerCase()))
    if (!clip || actor.active === clip && !restart) return
    actor.active?.stop(); clip.start(loop, 1); actor.active = clip
  }
  function showActor(model: Actor, visible: boolean) {
    model.root.setEnabled(visible)
    if (!visible && !model.culled) model.active?.pause()
    else if (visible && model.culled && model.active?.isStarted) model.active.play(model.active.loopAnimation)
    model.culled = !visible
  }
  async function staticModel(filename: string, id: string, point: Point, scale: number, rotation = 0, objectId?: string) {
    const source = await container(filename), entries = source.instantiateModelsToScene(name => `${id}|${name}`)
    const root = new TransformNode(id, scene)
    for (const child of entries.rootNodes) child.parent = root
    setPosition(root, point); root.scaling.setAll(scale); root.rotation.y = rotation
    register(root.getChildMeshes(), objectId, true); scenery.push(root)
    return root
  }
  await Promise.all(houses.map(async (house, i) => {
    const root = await staticModel('/game-assets/house-painted.glb', `village-house-${i}`, house, house.scale, house.rotation)
    const place = regionPlaces.filter(place => place.kind === 'settlement').reduce((a, b) => Math.hypot(a.x - house.x, a.z - house.z) < Math.hypot(b.x - house.x, b.z - house.z) ? a : b)
    decorateHouse(root, place.id, i)
  }))
  const plantedSpots = new Set<string>()
  await Promise.all(trees.map(async (tree, i) => {
    const spot = objects.find(object => object.model === 'tree' && Math.hypot(object.x - tree.x, object.z - tree.z) < .5)
    const root = await staticModel('/art-sample/olive.glb', `olive-${i}`, tree, tree.scale, i * 1.4, spot?.id)
    if (spot) { props.set(spot.id, root); plantedSpots.add(spot.id) }
  }))
  await Promise.all(objects.filter(object => object.model === 'tree' && !plantedSpots.has(object.id)).map(async object => { const root = await staticModel('/art-sample/olive.glb', `olive-spot-${object.id}`, object, 1, 0, object.id); props.set(object.id, root) }))
  const player = await actor('adventurer', '/game-assets/adventurer.glb', layout.spawns.aenon!, true)
  await Promise.all(objects.filter(o => o.kind === 'hostile' || o.kind === 'person').map(o => actor(o.id, `/game-assets/${o.model === 'villager' ? 'merchant' : o.model}.glb`, o)))
  const companyColors = ['#ead9b8', '#a99068', '#7a8991', '#b48967', '#978b63', '#8e6350', '#768e7e', '#bea47c', '#677b85', '#977c88', '#b9ac86', '#8a735b', '#7d8b61', '#846c88', '#9f8068', '#6a9290']
  const company = await Promise.all(['Jesus', ...travelingCompany].map(async (name, i) => {
    const result = await actor(`company-${name}`, `/game-assets/${i === 0 ? 'john' : i % 3 === 0 || i > 12 ? 'merchant' : 'adventurer'}.glb`, { x: 0, z: 0 }, true)
    for (const mat of attireMaterials(result.model.root)) {
      if (/linen|robe|camel hair|shawl|sash|edging|head wrap/i.test(mat.name)) {
        mat.albedoTexture = null; mat.albedoColor = Color3.FromHexString(companyColors[i]!); mat.roughness = .94
        if (/fold|edging/i.test(mat.name)) mat.albedoColor.scaleInPlace(.83)
      }
    }
    result.model.root.scaling.setAll(i === 0 ? 1.04 : .94 + (i % 5) * .025)
    showActor(result.model, false)
    return { name, ...result }
  }))
  let companyKey = ''
  function positionCompany(snapshot: GameSnapshot) {
    const presence = snapshot.company
    const close = presence && Math.hypot(presence.anchor.x - snapshot.position.x, presence.anchor.z - snapshot.position.z) < 58
    if (!presence || !close) { for (const member of company) showActor(member.model, false); if (!presence) companyKey = ''; return }
    const key = `${presence.kind}:${presence.sceneId ?? ''}:${presence.anchor.x}:${presence.anchor.z}`
    if (key !== companyKey) {
      companyKey = key
      const anchor = presence.anchor, angle = Math.atan2(snapshot.position.x - anchor.x, snapshot.position.z - anchor.z)
      const positions: Point[] = []
      const sceneObject = presence.sceneId ? objects.find(object => object.sceneId === presence.sceneId) : undefined
      for (const [i, member] of company.entries()) {
        let point: Point = { ...anchor }
        const row = Math.floor((i - 1) / 5), side = ((i - 1) % 5 - 2) * 1.1
        const desired = i ? { x: anchor.x + Math.cos(angle) * side - Math.sin(angle) * (1.8 + row * 1.2), z: anchor.z - Math.sin(angle) * side - Math.cos(angle) * (1.8 + row * 1.2) } : anchor
        for (let step = 0; step < 80; step++) {
          const radius = step ? .38 * Math.sqrt(step) : 0, turn = step * 2.4
          const candidate = { x: desired.x + Math.cos(turn) * radius, z: desired.z + Math.sin(turn) * radius }
          if (canTraverseRegion(candidate, candidate, navigation) && positions.every(p => Math.hypot(p.x - candidate.x, p.z - candidate.z) > .78)) { point = candidate; break }
        }
        positions.push(point); setPosition(member.model.root, point); member.model.root.rotation.y = angle
        for (const mesh of member.model.root.getChildMeshes()) { mesh.isPickable = i === 0 && Boolean(sceneObject); mesh.metadata = i === 0 && sceneObject ? { objectId: sceneObject.id } : {} }
      }
    }
    for (const member of company) showActor(member.model, true)
  }
  const recurringPeople = new Set(['Jesus', 'John', 'John the Baptist', 'Judas son of James', ...travelingCompany].map(name => name.toLowerCase()))
  const episodeStanding = (sceneId: string) => [...new Set(gearDefinition.setScenes?.find(item => item.id === sceneId)?.standing ?? [])].filter(name => !recurringPeople.has(name.toLowerCase()))
  const episodeCapacity = Math.max(0, ...(gearDefinition.setScenes ?? []).map(item => episodeStanding(item.id).length))
  const episodePeople = await Promise.all(Array.from({ length: episodeCapacity }, async (_, i) => {
    const result = await actor(`episode-extra-${i}`, `/game-assets/${i % 3 === 1 ? 'adventurer' : 'merchant'}.glb`, { x: 0, z: 0 }, true)
    const color = Color3.FromHexString(['#8d8eae', '#ad9173', '#9b735d', '#7f9381'][i % 4]!)
    for (const mat of attireMaterials(result.model.root)) if (/linen|robe|shawl|sash|edging|head wrap/i.test(mat.name)) {
      mat.albedoTexture = null; mat.albedoColor = /fold|edging/i.test(mat.name) ? color.scale(.8) : color.clone(); mat.roughness = .94
    }
    result.model.root.scaling.setAll(.94 + (i % 4) * .025)
    showActor(result.model, false)
    return result.model
  }))
  let episodeKey = ''
  function positionEpisodePeople(snapshot: GameSnapshot) {
    const sceneId = snapshot.adventurer.playingScene?.sceneId
    const names = sceneId ? episodeStanding(sceneId) : []
    const sceneObject = sceneId ? objects.find(object => object.sceneId === sceneId) : undefined
    const anchor = snapshot.company && snapshot.company.sceneId === sceneId ? snapshot.company.anchor : sceneObject
    if (!sceneId || !anchor || !names.length || Math.hypot(anchor.x - snapshot.position.x, anchor.z - snapshot.position.z) >= 58) {
      for (const person of episodePeople) showActor(person, false)
      episodeKey = ''; return
    }
    const key = `${sceneId}:${anchor.x}:${anchor.z}`
    if (key !== episodeKey) {
      episodeKey = key
      const angle = Math.atan2(snapshot.position.x - anchor.x, snapshot.position.z - anchor.z)
      const occupied: Point[] = [snapshot.position, ...company.filter(member => member.model.root.isEnabled()).map(member => member.model.root.position)]
      for (const [i, person] of episodePeople.entries()) {
        if (!names[i]) continue
        const side = (i - (names.length - 1) / 2) * 1.12
        const desired = { x: anchor.x + Math.cos(angle) * side + Math.sin(angle) * 1.75, z: anchor.z - Math.sin(angle) * side + Math.cos(angle) * 1.75 }
        let point = desired
        for (let step = 0; step < 100; step++) {
          const radius = step ? .4 * Math.sqrt(step) : 0, turn = step * 2.4
          const candidate = { x: desired.x + Math.cos(turn) * radius, z: desired.z + Math.sin(turn) * radius }
          if (canTraverseRegion(candidate, candidate, navigation) && occupied.every(other => Math.hypot(other.x - candidate.x, other.z - candidate.z) > .8)) { point = candidate; break }
        }
        occupied.push(point); setPosition(person.root, point); person.root.rotation.y = Math.atan2(anchor.x - point.x, anchor.z - point.z)
        person.root.metadata = { sceneId, personName: names[i] }
      }
    }
    for (const [i, person] of episodePeople.entries()) showActor(person, Boolean(names[i]))
  }

  function box(parent: TransformNode, name: string, size: [number, number, number], position: [number, number, number], mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene); mesh.parent = parent; mesh.position.set(...position); mesh.material = mat; return mesh
  }
  function sphere(parent: TransformNode, name: string, diameter: number, position: [number, number, number], mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateIcoSphere(name, { radius: diameter / 2, subdivisions: 1, flat: true }, scene); mesh.parent = parent; mesh.position.set(...position); mesh.material = mat; return mesh
  }
  function cylinder(parent: TransformNode, name: string, height: number, diameter: number, position: [number, number, number], mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateCylinder(name, { height, diameter, tessellation: 8 }, scene); mesh.parent = parent; mesh.position.set(...position); mesh.material = mat; return mesh
  }
  function decorateHouse(root: TransformNode, placeId: string, index: number) {
    // All additions remain within the house's authored navigation footprint.
    if (placeId === 'aenon') {
      for (let i = 0; i < 4; i++) {
        const jar = sphere(root, 'aenon-fired-water-jar', .45, [-2.2 + i * .5, .32, 2.05], tile); jar.scaling.y = 1.25
        cylinder(root, 'aenon-jar-neck', .15, .2, [-2.2 + i * .5, .65, 2.05], tile)
      }
      box(root, 'aenon-potters-bench', [1.8, .12, .6], [-1.1, .58, 2.65], wood)
      cylinder(root, 'aenon-roof-water-store', .8, .72, [-1.5, 3.75, -.7], tile)
    }
    if (['scythopolis', 'pella', 'sepphoris', 'tiberias', 'hippus', 'gadara'].includes(placeId)) {
      for (const x of [-2.25, 2.25]) {
        cylinder(root, 'original-portico-column', 2.35, .26, [x, 1.18, 2.25], stone)
        box(root, 'column-capital', [.46, .14, .44], [x, 2.37, 2.25], stone)
        cylinder(root, 'column-base', .15, .43, [x, .075, 2.25], stone)
      }
      box(root, 'portico-lintel', [5.1, .24, .5], [0, 2.55, 2.25], stone)
      for (let t = 0; t < 12; t++) { const roofTile = cylinder(root, 'original-roof-tile', 3.9, .18, [-2.1 + t * .38, 3.55, -.2], tile); roofTile.rotation.x = Math.PI / 2 }
    }
    if (['capernaum', 'bethsaida', 'gamla', 'hippus'].includes(placeId)) {
      for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
        const x = -2.52 + col * .72 + (row % 2 ? .18 : 0)
        if (Math.abs(x) < .85 && row < 4) continue
        box(root, 'original-basalt-facing', [.68, .4, .10], [x, .23 + row * .43, 1.87], basalt)
      }
    }
    if (['jotapata', 'nazareth', 'gath-hepher', 'gamla', 'nain'].includes(placeId)) {
      cylinder(root, 'roof-cistern', .9, 1.1, [-1.25, 3.8, -.6], stone)
      cylinder(root, 'cistern-mouth', .14, .45, [-1.25, 4.3, -.6], basalt)
      for (let rung = 0; rung < 8; rung++) box(root, 'roof-ladder-rung', [.66, .065, .09], [2.58, .24 + rung * .36, -.5], wood)
      for (const x of [2.23, 2.92]) box(root, 'roof-ladder-upright', [.065, 3.25, .09], [x, 1.63, -.5], wood)
    }
    if (['salim', 'cana', 'magdala', 'legio'].includes(placeId)) {
      for (const x of [-2.35, 2.35]) cylinder(root, 'garden-lattice-post', 2.5, .09, [x, 1.25, 2.55], wood)
      for (let i = 0; i < 7; i++) box(root, 'garden-lattice', [.08, .07, 1.1], [-2.25 + i * .75, 2.47, 2.2], wood)
      for (let i = 0; i < 5; i++) { const foliage = sphere(root, 'garden-vine-leaves', .9, [-1.9 + i * .92, 2.52, 2.25], garden); foliage.scaling.y = .24 }
      for (let i = 0; i < (placeId === 'cana' ? 6 : 2); i++) cylinder(root, 'courtyard-water-jar', .75, .42, [-2.35 + i * .45, .38, 2.2], tile)
    }
    if (index % 2) { const cloth = box(root, 'dyed-linen-screen', [1.2, 1.45, .035], [-1.8, 1.5, 1.96], indigo); cloth.rotation.z = .06 }
    register(root.getChildMeshes().filter(mesh => !shadowCasters.includes(mesh)), undefined, true)
  }
  function boat(parent: TransformNode, name: string) {
    // Hand-authored clinker-like hull: tapered ends, open gunwales and cross benches.
    const positions: number[] = [], indices: number[] = [], colors: number[] = []
    const sections = [{ z: -2.05, w: .04, y: .46 }, { z: -1.5, w: .59, y: .31 }, { z: -.65, w: .83, y: .26 }, { z: .65, w: .83, y: .26 }, { z: 1.5, w: .59, y: .31 }, { z: 2.05, w: .04, y: .46 }]
    for (const [j, section] of sections.entries()) for (const [k, factor] of [-1, -.7, .7, 1].entries()) {
      positions.push(section.w * factor, Math.abs(factor) === 1 ? section.y + .22 : -.12, section.z)
      const c = (j + k) % 2 ? [.42, .29, .17] : [.53, .38, .23]; colors.push(...c, 1)
      if (j && k) { const i = j * 4 + k; indices.push(i - 5, i - 4, i, i - 5, i, i - 1) }
    }
    const hull = new Mesh(name, scene), data = new VertexData(), normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals)
    data.positions = positions; data.indices = indices; data.normals = normals; data.colors = colors; data.applyToMesh(hull); hull.useVertexColors = true; hull.parent = parent; hull.material = hullMat
    for (const z of [-1.08, 0, 1.08]) box(parent, 'boat-cross-bench', [1.25, .09, .24], [0, .2, z], wood)
    for (const x of [-.76, .76]) { const oar = cylinder(parent, 'olive-wood-oar', 2.6, .04, [x, .49, -.6], wood); oar.rotation.x = Math.PI / 2; box(parent, 'oar-blade', [.16, .035, .48], [x, .49, -1.8], wood) }
    register(parent.getChildMeshes())
  }
  const travelingBoat = new TransformNode('Adventurer-lake-boat', scene); boat(travelingBoat, 'original-traveling-hull'); travelingBoat.setEnabled(false)
  for (const port of ports) {
    const dock = new TransformNode(`landing-${port.placeId}`, scene); setPosition(dock, port); scenery.push(dock)
    for (let i = 0; i < 8; i++) box(dock, 'landing-plank', [2.1, .11, .29], [0, .10, -.95 + i * .3], wood)
    for (const x of [-.97, .97]) for (const z of [-.9, .9]) cylinder(dock, 'landing-mooring-post', 1.15, .13, [x, .24, z], wood)
    register(dock.getChildMeshes())
  }
  for (const road of regionRoads) {
    const from = regionPlaces.find(place => place.id === road.from)!, to = regionPlaces.find(place => place.id === road.to)!
    const dx = to.x - from.x, dz = to.z - from.z, steps = Math.ceil(Math.hypot(dx, dz) * 2)
    const wet: Point[] = []
    for (let i = 0; i <= steps; i++) { const p = { x: from.x + dx * i / steps, z: from.z + dz * i / steps }; if (waterDistance(p.x, p.z) < 1.3 && bridgeAt(p.x, p.z)) wet.push(p) }
    if (!wet.length) continue
    const a = wet[0]!, b = wet.at(-1)!, bridge = new TransformNode(`bridge-${road.from}-${road.to}`, scene)
    bridge.position.set((a.x + b.x) / 2, .57, (a.z + b.z) / 2); bridge.rotation.y = Math.atan2(dx, dz); scenery.push(bridge)
    const length = Math.hypot(a.x - b.x, a.z - b.z) + 2
    box(bridge, 'stone-causeway-deck', [5.6, .18, length], [0, -.09, 0], stone)
    for (const x of [-2.65, 2.65]) { box(bridge, 'causeway-low-rail', [.22, .38, length], [x, .25, 0], stone); for (let i = 0; i < length; i += 2) cylinder(bridge, 'causeway-pier', 1.2, .56, [x, -.55, i - length / 2 + .4], stone) }
    register(bridge.getChildMeshes())
  }
  function makeProp(object: WorldObject) {
    const root = new TransformNode(object.id, scene); setPosition(root, object); props.set(object.id, root)
    switch (object.model) {
      case 'ore':
        for (let i = 0; i < 6; i++) { const rock = sphere(root, 'copper-bearing-rock', .55 + (i % 3) * .17, [Math.sin(i * 2.3) * .45, .22 + (i % 2) * .18, Math.cos(i * 2.3) * .35], i % 2 ? copper : stone); rock.scaling.y = .8 }
        break
      case 'herbs': case 'flax':
        for (let i = 0; i < 12; i++) { const x = Math.sin(i * 2.4) * (.15 + i * .04), z = Math.cos(i * 2.4) * (.15 + i * .04), h = object.model === 'flax' ? .62 : .3
          cylinder(root, 'plant-stem', h, .025, [x, h / 2, z], leaf)
          const sprig = sphere(root, 'plant-leaves', .24, [x, h * .55, z], leaf); sprig.scaling.set(1, .35, 1)
          sphere(root, 'plant-flower', .1, [x, h, z], object.model === 'flax' ? flower : linen)
        } break
      case 'fish':
        cylinder(root, 'fishing-stake', 1.1, .07, [0, .55, 0], wood); box(root, 'fishing-line', [.012, .6, .012], [.05, .42, .14], linen)
        { const basket = cylinder(root, 'reed-basket', .33, .48, [-.3, .17, 0], wood); basket.scaling.y = .85; const fish = sphere(root, 'silver-fish', .28, [-.3, .33, 0], stone); fish.scaling.set(.5, .4, 1.2) }
        break
      case 'forge':
        box(root, 'stone-forge', [1.0, .7, .8], [0, .35, 0], stone); box(root, 'forge-coals', [.65, .06, .5], [0, .73, 0], ember)
        box(root, 'anvil-base', [.48, .12, .34], [.7, .12, .15], iron); box(root, 'anvil-top', [.6, .16, .28], [.7, .48, .15], iron); box(root, 'anvil-neck', [.2, .26, .24], [.7, .28, .15], iron)
        break
      case 'loom': case 'rack':
        for (const x of [-.48, .48]) { cylinder(root, 'timber-upright', 1.55, .09, [x, .78, 0], wood); box(root, 'timber-foot', [.15, .08, .7], [x, .05, 0], wood) }
        box(root, 'timber-crossbar', [1.12, .09, .09], [0, 1.45, 0], wood); box(root, 'woven-panel', [.78, 1.12, .035], [0, .79, .015], object.model === 'loom' ? linen : wood)
        if (object.model === 'loom') for (let i = 0; i < 14; i++) box(root, 'linen-warp', [.018, 1.13, .045], [-.34 + i * .052, .79, .05], stone)
        break
      case 'hearth':
        for (let i = 0; i < 8; i++) sphere(root, 'hearth-stone', .3, [Math.sin(i * Math.PI / 4) * .46, .12, Math.cos(i * Math.PI / 4) * .46], stone)
        sphere(root, 'glowing-coals', .45, [0, .13, 0], ember).scaling.y = .28
        cylinder(root, 'cooking-pot', .32, .42, [0, .42, 0], iron)
        break
      case 'scroll':
        box(root, 'reading-stone', [.48, .65, .4], [0, .325, 0], stone); box(root, 'parchment', [.5, .025, .38], [0, .69, 0], linen)
        for (const x of [-.24, .24]) { const roll = cylinder(root, 'scroll-roll', .44, .08, [x, .73, 0], linen); roll.rotation.x = Math.PI / 2 }
        break
      case 'chest':
        box(root, 'chest', [.8, .5, .48], [0, .25, 0], wood); box(root, 'chest-lid', [.86, .13, .54], [0, .54, 0], wood)
        for (const x of [-.27, .27]) box(root, 'chest-band', [.06, .56, .495], [x, .3, 0], iron)
        break
      case 'boat':
        boat(root, `moored-hull-${object.id}`)
        break
      case 'signpost':
        cylinder(root, 'road-sign-post', 1.75, .1, [0, .87, 0], wood)
        box(root, 'road-sign-board', [.95, .29, .06], [.2, 1.44, 0], linen)
        break
    }
    register(root.getChildMeshes(), object.id)
  }
  for (const object of objects) if (!['hostile', 'person'].includes(object.kind) && object.model !== 'tree') makeProp(object)
  const poolWater = material('original-irrigated-pool-water', '#294e51'); poolWater.specularColor = new Color3(.1, .15, .14); poolWater.specularPower = 38
  const poolRipple = material('original-pool-ripple', '#53736e')
  for (const detail of landscapeDetails) {
    const root = new TransformNode(detail.id, scene); setPosition(root, detail); root.rotation.y = detail.rotation ?? 0; root.scaling.setAll(detail.scale ?? 1); scenery.push(root)
    switch (detail.kind) {
      case 'pottery':
        box(root, 'potters-drying-bench', [2.1, .15, .8], [0, .7, 0], wood)
        for (const x of [-.8, .8]) box(root, 'potters-bench-leg', [.16, .7, .65], [x, .35, 0], wood)
        for (let i = 0; i < 5; i++) {
          sphere(root, 'clay-water-vessel', .35, [-.8 + i * .39, .95, 0], tile).scaling.y = 1.2
          cylinder(root, 'clay-vessel-mouth', .1, .15, [-.8 + i * .39, 1.18, 0], tile)
        }
        for (const x of [-.7, .6]) { sphere(root, 'stored-water-jar', .55, [x, .35, .9], tile).scaling.y = 1.25; cylinder(root, 'stored-jar-mouth', .12, .25, [x, .71, .9], tile) }
        break
      case 'spring':
        cylinder(root, 'spring-basin', .18, 4.1, [0, .07, 0], stone)
        cylinder(root, 'spring-water', .025, 3.65, [0, .18, 0], poolWater)
        for (let i = 0; i < 15; i++) { const angle = i * Math.PI * 2 / 15; sphere(root, 'spring-edge-stone', .5, [Math.cos(angle) * 1.96, .16, Math.sin(angle) * 1.96], stone).scaling.y = .65 }
        box(root, 'spring-water-spout', [.5, .32, .6], [0, .37, -1.65], stone)
        break
      case 'garden':
        for (const x of [-2.3, 2.3]) box(root, 'salim-garden-wall', [.35, .65, 3.8], [x, .325, 0], stone)
        box(root, 'salim-garden-back-wall', [4.9, .65, .35], [0, .325, -1.8], stone)
        for (const z of [-.9, .15, 1.2]) {
          box(root, 'salim-irrigated-bed', [3.8, .16, .65], [0, .08, z], wood)
          for (let i = 0; i < 6; i++) sphere(root, 'salim-garden-crop', .42, [-1.65 + i * .65, .31, z], garden)
        }
        break
      case 'market':
        for (const x of [-2, 2]) for (const z of [-1.6, 1.6]) {
          cylinder(root, 'scythopolis-market-column', 2.8, .34, [x, 1.4, z], stone)
          box(root, 'scythopolis-market-capital', [.62, .19, .62], [x, 2.83, z], stone)
        }
        box(root, 'scythopolis-market-awning', [4.8, .1, 4.1], [0, 2.96, 0], indigo)
        box(root, 'scythopolis-market-table', [2.7, .15, .8], [0, .88, .2], wood)
        for (const x of [-1, 1]) box(root, 'scythopolis-table-leg', [.16, .8, .6], [x, .4, .2], wood)
        for (let i = 0; i < 5; i++) sphere(root, 'scythopolis-grain-sack', .52, [-1.4 + i * .67, .32, -1], linen).scaling.y = 1.15
        break
      case 'terrace':
        for (let row = 0; row < 3; row++) {
          const z = -.9 + row * 1.05, y = .16 + row * .14
          box(root, 'pella-terrace-retaining-wall', [4.7, y * 2, .32], [0, y, z], stone)
          for (let i = 0; i < 6; i++) sphere(root, 'pella-terrace-planting', .4, [-1.8 + i * .7, y * 2 + .1, z + .44], garden).scaling.y = .75
        }
        break
      case 'reeds':
        for (let i = 0; i < 13; i++) {
          const x = Math.sin(i * 2.4) * 1.4, z = Math.cos(i * 1.7) * .85, height = 1.05 + (i % 4) * .22
          cylinder(root, 'jordan-reed-stem', height, .035, [x, height / 2, z], garden)
          cylinder(root, 'jordan-reed-head', .28, .1, [x, height, z], wood)
          const blade = box(root, 'jordan-reed-blade', [.035, .6, .14], [x + .13, height * .48, z], leaf); blade.rotation.z = -.4
        }
        break
      case 'rocks':
        for (let i = 0; i < 4; i++) { const rock = sphere(root, 'valley-weathered-outcrop', .75 + i * .13, [Math.sin(i * 2.6) * .67, .28, Math.cos(i * 2.6) * .67], stone); rock.scaling.y = .72; rock.rotation.y = i }
        break
      case 'waymarker':
        cylinder(root, 'valley-road-distance-stone', 1.5, .45, [0, .75, 0], stone)
        for (let mark = 0; mark < 3; mark++) box(root, 'road-stone-carved-mark', [.2, .03, .025], [0, .85 + mark * .13, -.23], wood)
        break
      case 'camp':
        for (const x of [-1.8, 1.8]) cylinder(root, 'roadside-shelter-post', 2.25, .1, [x, 1.12, -.9], wood)
        const cloth = box(root, 'roadside-shade-cloth', [4, .05, 2.9], [0, 1.86, 0], linen); cloth.rotation.x = -.2
        for (let i = 0; i < 7; i++) sphere(root, 'old-campfire-ring', .25, [Math.sin(i) * .52, .12, Math.cos(i) * .52 + 1.35], stone)
        box(root, 'roadside-resting-bench', [1.7, .35, .45], [-.9, .18, .5], wood)
        break
    }
    register(root.getChildMeshes(), undefined, true)
  }
  for (const object of objects.filter(object => object.model === 'fish' && waterDistance(object.x, object.z) > 4)) {
    // A shallow, managed pool sits beside the approach marker, leaving its route intact.
    let center = { x: object.x + 1.85, z: object.z }
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, candidate = { x: object.x + Math.cos(angle) * 1.85, z: object.z + Math.sin(angle) * 1.85 }
      if (canTraverseRegion(candidate, candidate, navigation)) { center = candidate; break }
    }
    const pool = new TransformNode(`managed-fishing-pool-${object.id}`, scene)
    const highBank = Math.max(...Array.from({ length: 12 }, (_, i) => heightAt(center.x + Math.cos(i * Math.PI / 6) * .85, center.z + Math.sin(i * Math.PI / 6) * 1.3)))
    pool.position.set(center.x, highBank + .045, center.z); scenery.push(pool)
    const water = cylinder(pool, 'irrigated-water-surface', .025, 2, [0, 0, 0], poolWater); water.scaling.set(.85, 1, 1.3)
    for (let i = 0; i < 20; i++) { const angle = i * Math.PI / 10; const bank = sphere(pool, 'field-pool-lining', .29, [Math.cos(angle) * .9, -.055, Math.sin(angle) * 1.34], stone); bank.scaling.y = .8 }
    for (let i = 0; i < 3; i++) {
      const ring = MeshBuilder.CreateTorus('quiet-fish-ripple', { diameter: .26 + i * .17, thickness: .009, tessellation: 20 }, scene)
      ring.parent = pool; ring.position.set(.14, .022, -.12); ring.scaling.z = .65; ring.material = poolRipple; ring.isPickable = false
    }
    for (let i = 0; i < 4; i++) cylinder(pool, 'pool-reed-stem', .48 + i * .07, .025, [-.71, .2 + i * .03, -.6 + i * .2], leaf)
    register(pool.getChildMeshes())
  }
  // Every held object is modeled here for this game; no external prop pack is used.
  const polishedBronze = material('weapon-bronze-edge', '#ba9a61'), gripLeather = material('weapon-grip-leather', '#4e3425')
  const emberBronze = material('legendary-ember-bronze', '#d68a40', .22), shieldPaint = material('shield-painted-linen', '#3b625c')
  function palmSocket(name: string, side: 'L' | 'R') {
    const hand = player.asset.transformNodes.find(node => node.name === `Hand.${side}` || node.name.endsWith(`|Hand.${side}`))
    const bone = player.asset.skeletons.flatMap(skeleton => skeleton.bones).find(item => item.name === `Hand.${side}` || item.name.endsWith(`|Hand.${side}`))
    const socket = new TransformNode(name, scene)
    socket.parent = hand ?? player.model.root
    if (hand && bone) {
      // Calibrate against the exported bind pose, not a guessed bone Euler axis.
      // The grip crosses the palm; its +Y shaft points forward with a slight dip.
      const inverseBind = bone.getAbsoluteInverseBindMatrix(), bind = Matrix.Invert(inverseBind)
      const wrist = Vector3.TransformCoordinates(Vector3.Zero(), bind)
      socket.position.copyFrom(Vector3.TransformCoordinates(wrist.add(new Vector3(0, -.053, .006)), inverseBind))
      const x = Vector3.TransformNormal(new Vector3(1, 0, 0), inverseBind).normalize()
      const y = Vector3.TransformNormal(new Vector3(0, -.16, 1).normalize(), inverseBind).normalize()
      const z = Vector3.Cross(x, y).normalize()
      socket.rotation.copyFrom(Vector3.RotationFromAxis(x, y, z))
    } else {
      socket.parent = player.model.root
      socket.position.set(side === 'R' ? -.38 : .38, .83, .03)
      socket.rotation.x = Math.PI / 2 + .16
    }
    return socket
  }
  const held = palmSocket('right-palm-grip', 'R'), leftHeld = palmSocket('left-palm-grip', 'L')
  const sword = new TransformNode('worn-weapon', scene); sword.parent = held
  const blade = new TransformNode('sword-variant', scene); blade.parent = sword
  const bladeBody = box(blade, 'forged-bronze-sword-blade', [.074, .54, .022], [0, .405, 0], polishedBronze)
  const bladeTip = MeshBuilder.CreateCylinder('tapered-sword-point', { height: .16, diameterBottom: .105, diameterTop: 0, tessellation: 4 }, scene)
  bladeTip.parent = blade; bladeTip.position.y = .755; bladeTip.scaling.z = .22; bladeTip.material = polishedBronze
  cylinder(blade, 'wrapped-sword-grip', .19, .052, [0, 0, 0], gripLeather)
  box(blade, 'sword-crossguard', [.23, .038, .06], [0, .111, 0], polishedBronze)
  sphere(blade, 'sword-pommel', .082, [0, -.124, 0], polishedBronze)
  const mace = new TransformNode('mace-variant', scene); mace.parent = sword
  cylinder(mace, 'olive-wood-mace-shaft', .63, .054, [0, .22, 0], wood)
  cylinder(mace, 'leather-mace-grip', .19, .064, [0, 0, 0], gripLeather)
  const maceHead = sphere(mace, 'cast-bronze-mace-head', .25, [0, .555, 0], polishedBronze)
  maceHead.scaling.y = 1.08
  for (let i = 0; i < 5; i++) { const flange = box(mace, 'mace-flange', [.035, .22, .28], [0, .555, 0], polishedBronze); flange.rotation.y = i * Math.PI / 5 }
  const shield = new TransformNode('worn-round-shield', scene); shield.parent = leftHeld
  cylinder(shield, 'round-olive-wood-shield', .055, .49, [0, .07, 0], wood)
  cylinder(shield, 'shield-dyed-linen-face', .009, .443, [0, .104, 0], shieldPaint)
  const shieldRim = MeshBuilder.CreateTorus('shield-bronze-rim', { diameter: .475, thickness: .028, tessellation: 24 }, scene)
  shieldRim.parent = shield; shieldRim.position.y = .10; shieldRim.material = polishedBronze
  sphere(shield, 'shield-boss', .13, [0, .13, 0], polishedBronze).scaling.y = .6
  box(shield, 'shield-central-grip', [.115, .03, .035], [0, .02, 0], gripLeather)
  const tool = new TransformNode('harvesting-tool', scene); tool.parent = held
  const toolVariants = new Map<string, TransformNode>()
  for (const kind of ['axe', 'pick', 'sickle', 'rod', 'knife']) {
    const prop = new TransformNode(`held-${kind}`, scene); prop.parent = tool; toolVariants.set(kind, prop)
    if (kind === 'rod') { cylinder(prop, 'reed-fishing-rod', 1.38, .025, [0, .59, 0], wood); cylinder(prop, 'rod-bound-grip', .18, .039, [0, 0, 0], gripLeather) }
    else if (kind === 'knife') { box(prop, 'hunting-knife-blade', [.045, .21, .012], [0, .16, 0], polishedBronze); cylinder(prop, 'hunting-knife-grip', .12, .04, [0, 0, 0], wood) }
    else {
      cylinder(prop, `${kind}-wood-haft`, kind === 'sickle' ? .31 : .65, .038, [0, kind === 'sickle' ? .07 : .20, 0], wood)
      if (kind === 'axe') { const head = box(prop, 'gathering-axe-head', [.26, .16, .039], [.092, .45, 0], polishedBronze); head.rotation.z = -.12 }
      if (kind === 'pick') { const head = cylinder(prop, 'mining-pick-head', .44, .037, [0, .46, 0], iron); head.rotation.z = Math.PI / 2 }
      if (kind === 'sickle') { const path = Array.from({ length: 15 }, (_, i) => { const angle = Math.PI * (.2 + i / 14 * 1.4); return new Vector3(.063 + Math.cos(angle) * .12, .25 + Math.sin(angle) * .12, 0) }); const curve = MeshBuilder.CreateTube('bronze-sickle-curve', { path, radius: .012, tessellation: 6 }, scene); curve.parent = prop; curve.material = polishedBronze }
    }
  }
  register(sword.getChildMeshes()); register(tool.getChildMeshes()); register(shield.getChildMeshes())
  sword.setEnabled(false); mace.setEnabled(false); tool.setEnabled(false); shield.setEnabled(false)
  function updateHeldGear(snapshot: GameSnapshot) {
    const gathering = snapshot.activity === 'gather' || snapshot.activity === 'hunt'
    const weapon = gearDefinition.gear?.find(piece => piece.id === snapshot.adventurer.worn.weapon && piece.slot === 'weapon')
    sword.setEnabled(Boolean(weapon) && !gathering)
    blade.setEnabled(weapon?.slot === 'weapon' && weapon.kind === 'sword')
    mace.setEnabled(weapon?.slot === 'weapon' && weapon.kind === 'mace')
    sword.scaling.setAll(weapon?.slot === 'weapon' && weapon.hold === 'two-handed' ? 1.22 : 1)
    bladeBody.material = bladeTip.material = weapon?.rarity === 'legendary' ? emberBronze : polishedBronze
    shield.setEnabled(Boolean(snapshot.adventurer.worn.shield) && !gathering && !(weapon?.slot === 'weapon' && weapon.hold === 'two-handed'))
    tool.setEnabled(gathering)
    const skill = gearDefinition.spots.find(spot => spot.id === snapshot.targetId)?.skill
    const kind = snapshot.activity === 'hunt' ? 'knife' : skill === 'Woodcutting' ? 'axe' : skill === 'Mining' ? 'pick' : skill === 'Fishing' ? 'rod' : 'sickle'
    for (const [id, prop] of toolVariants) prop.setEnabled(id === kind)
  }
  const playerMaterials = attireMaterials(player.model.root)
  const originalAttire = playerMaterials.map(mat => ({ mat, color: mat.albedoColor.clone(), texture: mat.albedoTexture, metallic: mat.metallic, roughness: mat.roughness }))
  const originalLeather = originalAttire.find(entry => /worn leather/i.test(entry.mat.name))?.texture ?? null
  function armorFrame(boneName: string) {
    const node = player.asset.transformNodes.find(node => node.name.endsWith(`|${boneName}`))
    const bone = player.asset.skeletons.flatMap(skeleton => skeleton.bones).find(bone => bone.name === boneName || bone.name.endsWith(`|${boneName}`))
    const root = new TransformNode(`worn-armor-${boneName}`, scene); root.parent = node ?? player.model.root
    if (node && bone) { root.rotationQuaternion = Quaternion.Identity(); bone.getAbsoluteInverseBindMatrix().decompose(root.scaling, root.rotationQuaternion, root.position) }
    return root
  }
  const headArmor = armorFrame('Head'), bodyArmor = armorFrame('Spine')
  const headMat = material('worn-head-covering', '#8d8b75'), bodyMat = material('worn-body-covering', '#8d8b75'), legMat = material('worn-leg-covering', '#8d8b75'), bootMat = material('worn-foot-covering', '#735237')
  const cap = MeshBuilder.CreateSphere('original-fitted-head-covering', { diameterX: .325, diameterY: .34, diameterZ: .285, segments: 12, slice: .51 }, scene)
  cap.parent = headArmor; cap.position.set(0, 1.585, 0); cap.material = headMat
  const rim = MeshBuilder.CreateTorus('head-covering-edging', { diameter: .303, thickness: .026, tessellation: 16 }, scene)
  rim.parent = headArmor; rim.position.set(0, 1.585, 0); rim.material = headMat
  // Original faceted front plate, kept close to the existing torso and carried by Spine.
  const plate = new Mesh('original-fitted-body-panel', scene), plateData = new VertexData(), plateNormals: number[] = []
  const platePositions = [-.18, 1.34, .13, .18, 1.34, .13, -.245, 1.21, .105, .245, 1.21, .105, -.18, 1.01, .105, .18, 1.01, .105, 0, 1.24, .164, 0, 1.02, .133]
  const plateIndices = [0, 6, 1, 0, 2, 6, 1, 6, 3, 2, 4, 7, 2, 7, 6, 6, 7, 3, 3, 7, 5]
  VertexData.ComputeNormals(platePositions, plateIndices, plateNormals); plateData.positions = platePositions; plateData.indices = plateIndices; plateData.normals = plateNormals; plateData.applyToMesh(plate)
  plate.parent = bodyArmor; plate.material = bodyMat; bodyMat.backFaceCulling = false
  const legArmor: TransformNode[] = [], footArmor: TransformNode[] = []
  for (const [side, x] of [['L', .13], ['R', -.13]] as const) {
    const shin = armorFrame(`Shin.${side}`), foot = armorFrame(`Foot.${side}`)
    cylinder(shin, 'original-fitted-greave', .25, .156, [x, .285, -.003], legMat)
    box(foot, 'original-fitted-boot-toe', [.16, .108, .235], [x, .062, .054], bootMat)
    cylinder(foot, 'original-boot-upper', .19, .15, [x, .18, -.005], bootMat)
    legArmor.push(shin); footArmor.push(foot)
  }
  for (const root of [headArmor, bodyArmor, ...legArmor, ...footArmor]) { register(root.getChildMeshes()); root.setEnabled(false) }
  let attireKey = ''
  function updateAttire(snapshot: GameSnapshot) {
    const key = JSON.stringify(snapshot.adventurer.worn)
    if (key === attireKey) return
    attireKey = key
    const find = (id: string | null) => gearDefinition.gear?.find(piece => piece.id === id)
    const body = find(snapshot.adventurer.worn.body), legs = find(snapshot.adventurer.worn.legs), head = find(snapshot.adventurer.worn.head), feet = find(snapshot.adventurer.worn.feet)
    for (const original of originalAttire) {
      const mat = original.mat; mat.albedoColor.copyFrom(original.color); mat.albedoTexture = original.texture; mat.metallic = original.metallic; mat.roughness = original.roughness
      const piece = /olive wool trousers/i.test(mat.name) ? legs : /linen/i.test(mat.name) ? body : undefined
      if (!piece || !('armorWeight' in piece)) continue
      const clothColor = piece.band === 'high' ? '#9bb8bc' : piece.band === 'middle' ? '#b6bba1' : '#eee0c2'
      mat.albedoColor = Color3.FromHexString(piece.armorWeight === 'heavy' ? '#aaa890' : piece.armorWeight === 'medium' ? '#baa58b' : clothColor)
      mat.albedoTexture = piece.armorWeight === 'heavy' ? null : piece.armorWeight === 'medium' ? originalLeather : original.texture
      mat.metallic = piece.armorWeight === 'heavy' ? .6 : 0; mat.roughness = piece.armorWeight === 'heavy' ? .43 : .86
    }
    function finish(mat: StandardMaterial, piece: typeof body) {
      const weight = piece && 'armorWeight' in piece ? piece.armorWeight : 'cloth'
      mat.diffuseColor = Color3.FromHexString(weight === 'heavy' ? '#969783' : weight === 'medium' ? '#70513a' : '#b7ad91')
      mat.specularColor = weight === 'heavy' ? new Color3(.55, .53, .4) : Color3.Black(); mat.specularPower = weight === 'heavy' ? 28 : 8
      if (piece?.rarity === 'legendary') mat.diffuseColor = Color3.Lerp(mat.diffuseColor, Color3.FromHexString('#b89a59'), .32)
    }
    finish(headMat, head); finish(bodyMat, body); finish(legMat, legs); finish(bootMat, feet)
    headArmor.setEnabled(Boolean(head)); bodyArmor.setEnabled(Boolean(body && 'armorWeight' in body && body.armorWeight !== 'cloth'))
    for (const root of legArmor) root.setEnabled(Boolean(legs && 'armorWeight' in legs && legs.armorWeight !== 'cloth'))
    for (const root of footArmor) root.setEnabled(Boolean(feet && feet.id !== 'leather-sandals'))
  }
  const target = MeshBuilder.CreateTorus('selected-target', { diameter: 1.3, thickness: .045, tessellation: 40 }, scene)
  target.material = material('selection-gold', '#efd18c', .4); target.isPickable = false; target.setEnabled(false)
  const destination = MeshBuilder.CreateTorus('destination', { diameter: .48, thickness: .025, tessellation: 32 }, scene)
  destination.material = target.material; destination.isPickable = false; destination.setEnabled(false)
  for (const object of objects.filter(o => o.kind === 'hostile')) {
    const disc = MeshBuilder.CreateCylinder(`danger-${object.id}`, { height: .018, diameter: 2.3, tessellation: 48 }, scene)
    const mat = material(`danger-red-${object.id}`, '#c54a2e', .65); mat.alpha = .3; disc.material = mat; disc.isPickable = false; disc.setEnabled(false); telegraphs.set(object.id, disc)
  }
  function float(point: Point, text: string, isPlayer: boolean, time: number) {
    const element = document.createElement('span'); element.className = `world-float${isPlayer ? ' hurt' : ''}`; element.textContent = text; labelLayer.append(element); floating.push({ element, point: { ...point }, until: time + 1.05 })
  }
  function events(events: GameEvent[], snapshot: GameSnapshot) {
    for (const event of events) {
      if (event.kind === 'damage') float(event.point, `−${Number(event.amount.toFixed(2))}`, event.targetId === 'player', snapshot.time)
      if (event.kind === 'harvest') float(event.point, '+ goods', false, snapshot.time)
      if (event.kind === 'attack' && event.targetId !== 'adventurer') { animate(player.model, 'Attack', false, true); player.model.actionUntil = snapshot.time + .8 }
    }
  }
  let previousTime = 0
  function update(snapshot: GameSnapshot, camera: ArcRotateCamera, width: number, height: number) {
    const frameSeconds = Math.max(.0001, snapshot.time - previousTime); previousTime = snapshot.time
    const p = snapshot.position; setPosition(player.model.root, p); player.model.root.rotation.y = snapshot.heading
    const onBoat = snapshot.journey?.kind === 'boat'
    travelingBoat.setEnabled(onBoat)
    if (onBoat) {
      const journey = snapshot.journey!, surface = Math.max(.05, heightAt(p.x, p.z) + .04)
      travelingBoat.position.set(p.x, surface, p.z); travelingBoat.rotation.y = Math.atan2(journey.to.x - journey.from.x, journey.to.z - journey.from.z)
      player.model.root.position.y = surface + .25; player.model.root.rotation.y = travelingBoat.rotation.y
      animate(player.model, 'Idle')
    } else if (snapshot.moving) {
      animate(player.model, 'Run'); player.model.actionUntil = 0
      const prior = player.model.prior
      const distance = prior ? Math.hypot(p.x - prior.x, p.z - prior.z) : frameSeconds * 3.2
      if (player.model.active) player.model.active.speedRatio = Math.min(2, distance / frameSeconds / 3.2)
    }
    else if (snapshot.activity === 'gather' || snapshot.activity === 'hunt') animate(player.model, 'Gather')
    else if (snapshot.guardRemaining > 0) animate(player.model, 'Guard')
    else if (snapshot.time >= player.model.actionUntil) animate(player.model, 'Idle')
    player.model.prior = { x: p.x, z: p.z }
    updateHeldGear(snapshot)
    updateAttire(snapshot); positionCompany(snapshot); positionEpisodePeople(snapshot)
    const visiblePeople = snapshot.visiblePeople ? new Set(snapshot.visiblePeople) : undefined
    for (const root of scenery) root.setEnabled(Math.hypot(root.position.x - p.x, root.position.z - p.z) < 78)
    for (const root of props.values()) root.setEnabled(Math.hypot(root.position.x - p.x, root.position.z - p.z) < 70)
    for (const object of objects) if (object.kind === 'person') {
      const model = actors.get(object.id)
      const jesusScene = Boolean(object.sceneId && gearDefinition.setScenes?.some(scene => scene.id === object.sceneId && scene.figure === 'jesus'))
      if (model) showActor(model, !jesusScene && (!visiblePeople || visiblePeople.has(object.id)) && Math.hypot(object.x - p.x, object.z - p.z) < 60)
    }
    const points = new Map<string, Point>(objects.map(o => [o.id, o]))
    for (const enemy of snapshot.hostiles) {
      points.set(enemy.id, enemy); const model = actors.get(enemy.id)!
      const hasCarcass = snapshot.carcasses.some(c => c.hostileId === enemy.id)
      if (enemy.status === 'dead') model.deathUntil ??= snapshot.time + 1.1
      else model.deathUntil = undefined
      // Keep non-huntable enemies visible through their one-shot collapse.
      const nearby = Math.hypot(enemy.x - p.x, enemy.z - p.z) < 60
      showActor(model, nearby && (enemy.status !== 'dead' || hasCarcass || snapshot.time < (model.deathUntil ?? 0)))
      setPosition(model.root, enemy)
      if (!nearby) { telegraphs.get(enemy.id)?.setEnabled(false); model.prior = { x: enemy.x, z: enemy.z }; continue }
      const dx = enemy.x - (model.prior?.x ?? enemy.x), dz = enemy.z - (model.prior?.z ?? enemy.z), walking = Math.hypot(dx, dz) > .0001
      if (walking) model.root.rotation.y = Math.atan2(dx, dz)
      else if (enemy.status === 'windup') model.root.rotation.y = Math.atan2(p.x - enemy.x, p.z - enemy.z)
      animate(model, enemy.status === 'dead' ? 'Death' : walking ? 'Run' : enemy.status === 'windup' ? 'Attack' : 'Idle', enemy.status !== 'dead' && enemy.status !== 'windup')
      if (walking && enemy.status !== 'dead' && model.active) model.active.speedRatio = Math.min(2, Math.hypot(dx, dz) / frameSeconds / (objectById.get(enemy.id)?.model === 'wolf' ? 3 : 3.2))
      model.prior = { x: enemy.x, z: enemy.z }
      const danger = telegraphs.get(enemy.id)!; danger.setEnabled(enemy.status === 'windup' && Boolean(enemy.attackPoint))
      if (enemy.attackPoint) { setPosition(danger, enemy.attackPoint, .05); (danger.material as StandardMaterial).alpha = .2 + .4 * (1 - enemy.windup / .7) }
      const button = labels.get(enemy.id)!
      button.querySelector('small')!.textContent = `${Math.ceil(enemy.hitpoints)} / ${enemy.maxHitpoints}${enemy.stunned > 0 ? ' · stunned' : enemy.burning ? ' · burning' : ''}`
      const fill = button.querySelector('.plate-health-fill') as HTMLElement | null
      if (fill) fill.style.width = `${Math.max(0, Math.min(1, enemy.hitpoints / enemy.maxHitpoints)) * 100}%`
    }
    for (const spot of snapshot.spots) {
      labels.get(spot.id)!.querySelector('small')!.textContent = spot.stock ? `${spot.stock} / ${spot.capacity}` : `Regrowing · ${Math.ceil(spot.replenishIn)}s`
      const prop = props.get(spot.id); if (prop && objectById.get(spot.id)?.model !== 'tree') for (const mesh of prop.getChildMeshes()) mesh.visibility = spot.stock > 0 ? 1 : .4
    }
    for (const carcass of snapshot.carcasses) {
      points.set(carcass.id, carcass); if (!labels.has(carcass.id)) label(carcass.id, 'Hunt carcass', 'carcass')
    }
    for (const pickup of snapshot.pickups ?? []) {
      points.set(pickup.id, pickup)
      if (!labels.has(pickup.id)) {
        label(pickup.id, `Take ${pickup.gearId.replaceAll('-', ' ')}`, 'pickup')
        const bag = new TransformNode(pickup.id, scene); setPosition(bag, pickup); props.set(pickup.id, bag)
        sphere(bag, 'dropped-gear-bundle', .38, [0, .2, 0], linen); register(bag.getChildMeshes(), pickup.id)
      }
    }
    for (const pickup of snapshot.goodsPickups ?? []) {
      points.set(pickup.id, pickup)
      if (!labels.has(pickup.id)) {
        const name = pickup.good.kind === 'special-find' ? specialFindNames[pickup.good.band] : pickup.good.id.replaceAll('-', ' ')
        label(pickup.id, `Take ${name}`, 'pickup')
        const bag = new TransformNode(pickup.id, scene); setPosition(bag, pickup); props.set(pickup.id, bag)
        const find = sphere(bag, 'found-material-bundle', .3, [0, .2, 0], pickup.good.kind === 'special-find' ? copper : linen)
        find.scaling.y = .72; register(bag.getChildMeshes(), pickup.id)
      }
    }
    for (const [id, element] of labels) {
      const point = points.get(id), enemy = snapshot.hostiles.find(e => e.id === id)
      const object = objectById.get(id)
      const jesusScene = object?.sceneId && gearDefinition.setScenes?.some(scene => scene.id === object.sceneId && scene.figure === 'jesus')
      const present = jesusScene ? snapshot.company?.sceneId === object.sceneId : object?.kind !== 'person' || !visiblePeople || visiblePeople.has(id)
      const visible = present && point && !snapshot.paused && Math.hypot(point.x - p.x, point.z - p.z) < 20 && enemy?.status !== 'dead'
      element.hidden = !visible
      if (point && visible) {
        const anchor = anchorHeight(object?.model ?? (enemy ? objectById.get(enemy.id)?.model : undefined))
        const pos = Vector3.Project(new Vector3(point.x, heightAt(point.x, point.z) + anchor, point.z), Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(width, height))
        element.style.transform = `translate(${pos.x}px,${pos.y}px) translate(-50%,-100%)`; element.hidden = pos.x < 15 || pos.x > width - 15 || pos.y < 55 || pos.y > height - 95
        element.classList.toggle('selected', snapshot.targetId === id)
      }
      if (!point && (id.startsWith('carcass:') || id.startsWith('pickup:') || id.startsWith('goods:'))) { element.remove(); labels.delete(id); props.get(id)?.dispose(); props.delete(id) }
    }
    const selected = snapshot.targetId ? points.get(snapshot.targetId) : null
    target.setEnabled(Boolean(selected)); if (selected) setPosition(target, selected, .045)
    const end = snapshot.route.at(-1); destination.setEnabled(Boolean(end)); if (end) setPosition(destination, end, .05)
    for (let i = floating.length - 1; i >= 0; i--) {
      const item = floating[i]!, left = item.until - snapshot.time
      if (left <= 0) { item.element.remove(); floating.splice(i, 1); continue }
      const pos = Vector3.Project(new Vector3(item.point.x, heightAt(item.point.x, item.point.z) + 1.7 + (1.05 - left), item.point.z), Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(width, height))
      item.element.style.transform = `translate(${pos.x}px,${pos.y}px)`; item.element.style.opacity = String(Math.min(1, left * 2))
    }
  }
  return { player: player.model.root, actors, shadowCasters, occluders, update, events }
}
