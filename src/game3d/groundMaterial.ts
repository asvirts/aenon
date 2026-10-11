import { Color3, MaterialPluginBase, PBRMaterial, ShaderLanguage, Texture } from '@babylonjs/core'
import type { BaseTexture, MaterialDefines, Scene, UniformBuffer } from '@babylonjs/core'
import type { Quality } from './quality.ts'

const layers = ['grass', 'dirt', 'stones', 'sand', 'mud', 'rock'] as const
type Layer = typeof layers[number]

/** Extend the PBR surface, preserving Babylon's sun, environment, fog and shadow passes. */
class PaintedGround extends MaterialPluginBase {
  private normals = true
  private readonly colors: Record<Layer, Texture> = {} as Record<Layer, Texture>
  private readonly details: Record<Layer, Texture> = {} as Record<Layer, Texture>

  constructor(material: PBRMaterial, scene: Scene) {
    super(material, 'PaintedGround', 200, { GROUND_NORMALS: true, GROUND_GAMMA: true }, true, true)
    const load = (layer: Layer, kind: string) => {
      const texture = new Texture(`/game-assets/terrain/${layer}-${kind}.ktx2`, scene, {
        noMipmap: false, invertY: false, samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
        useSRGBBuffer: kind === 'color',
        onLoad: () => this.markAllDefinesAsDirty(),
      })
      texture.wrapU = Texture.WRAP_ADDRESSMODE; texture.wrapV = Texture.WRAP_ADDRESSMODE
      texture.anisotropicFilteringLevel = 4; texture.gammaSpace = kind === 'color'
      return texture
    }
    this.colors = Object.fromEntries(layers.map(layer => [layer, load(layer, 'color')])) as Record<Layer, Texture>
    this.details = Object.fromEntries(layers.map(layer => [layer, load(layer, 'normal')])) as Record<Layer, Texture>
  }

  setQuality(quality: Quality) {
    const normals = quality !== 'low'
    if (this.normals === normals) return
    this.normals = normals; this.markAllDefinesAsDirty()
  }
  override isCompatible(language: ShaderLanguage) { return language === ShaderLanguage.GLSL }
  override prepareDefines(defines: MaterialDefines) {
    const flags = defines as MaterialDefines & { GROUND_NORMALS: boolean; GROUND_GAMMA: boolean }
    flags.GROUND_NORMALS = this.normals; flags.GROUND_GAMMA = this.colors.grass.gammaSpace
  }
  override isReadyForSubMesh() {
    return layers.every(layer => this.colors[layer].isReady() && (!this.normals || this.details[layer].isReady()))
  }
  override getAttributes(attributes: string[]) { attributes.push('groundSurface') }
  override getSamplers(samplers: string[]) { for (const layer of layers) samplers.push(`ground_${layer}Color`, `ground_${layer}Normal`) }
  override bindForSubMesh(buffer: UniformBuffer) {
    for (const layer of layers) {
      buffer.setTexture(`ground_${layer}Color`, this.colors[layer])
      if (this.normals) buffer.setTexture(`ground_${layer}Normal`, this.details[layer])
    }
  }
  override getActiveTextures(textures: BaseTexture[]) { textures.push(...Object.values(this.colors), ...(this.normals ? Object.values(this.details) : [])) }
  override hasTexture(texture: BaseTexture) { return [...Object.values(this.colors), ...Object.values(this.details)].includes(texture as Texture) }
  override dispose() { for (const texture of [...Object.values(this.colors), ...Object.values(this.details)]) texture.dispose() }
  override getCustomCode(type: string): Record<string, string> | null {
    if (type === 'vertex') return {
      CUSTOM_VERTEX_DEFINITIONS: 'attribute vec4 groundSurface; varying vec4 vGroundSurface;',
      CUSTOM_VERTEX_MAIN_BEGIN: 'vGroundSurface = groundSurface;',
    }
    if (type !== 'fragment') return null
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
varying vec4 vGroundSurface;
${layers.map(layer => `uniform sampler2D ground_${layer}Color;\n#ifdef GROUND_NORMALS\nuniform sampler2D ground_${layer}Normal;\n#endif`).join('\n')}
float groundHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float groundNoise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(groundHash(i),groundHash(i+vec2(1.0,0.0)),f.x),mix(groundHash(i+vec2(0.0,1.0)),groundHash(i+vec2(1.0)),f.x),f.y);
}
// Two offset samples blend on a non-periodic mask; unmodified UV derivatives keep mip levels stable.
vec3 groundSample(sampler2D tex, vec2 uv, float variation) {
  return mix(texture2D(tex,uv).rgb,texture2D(tex,uv+vec2(.373,.617)).rgb,smoothstep(.22,.78,variation));
}
vec3 groundColor(sampler2D tex, vec2 uv, float variation) {
  vec3 color=groundSample(tex,uv,variation);
  #ifdef GROUND_GAMMA
  color=toLinearSpace(color);
  #endif
  return color;
}
`,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
vec2 groundXZ=vPositionW.xz;
float macro=groundNoise(groundXZ*.047);
float patches=groundNoise(groundXZ*.23+vec2(12.0,7.0));
float detailNoise=groundNoise(groundXZ*2.2);
float wetDistance=vGroundSurface.x;
float roadDistance=max(0.0,vGroundSurface.y);
float village=clamp(vGroundSurface.z,0.0,1.0);
float slope=1.0-abs(normalW.y);
float road=1.0-smoothstep(1.22,1.72,roadDistance+(detailNoise-.5)*.18);
float bank=1.0-smoothstep(.35,1.6,wetDistance);
float moisture=(1.0-smoothstep(1.4,18.0,wetDistance+(macro-.5)*3.0))*(1.0-smoothstep(5.0,16.0,vGroundSurface.w)*.5);
float cliff=smoothstep(.10,.32,slope)*.92;
float bare=smoothstep(.52,.78,patches)*.48+village*.40;
float grassWeight=(1.0-road)*(1.0-bank)*(1.0-cliff)*(1.0-bare);
float lushWeight=grassWeight*clamp(moisture*.88+macro*.22,0.0,1.0);
float dryWeight=grassWeight-lushWeight;
float dirtWeight=(1.0-road)*(1.0-bank)*(1.0-cliff)*bare+road*(1.0-village);
float stoneWeight=road*village;
float sandWeight=bank*(1.0-cliff)*(1.0-smoothstep(.12,.68,moisture*.35+patches*.5));
float mudWeight=bank*(1.0-cliff)-sandWeight;
float rockWeight=cliff*(1.0-road);
float weightSum=max(.001,lushWeight+dryWeight+dirtWeight+stoneWeight+sandWeight+mudWeight+rockWeight);
vec2 grassUV=groundXZ/3.8, dirtUV=groundXZ/3.4, stoneUV=groundXZ/2.6, bankUV=groundXZ/3.1;
// Project cliff strata onto the dominant vertical plane to avoid stretched texture on steep land.
vec2 rockUV=mix(groundXZ/4.0,(abs(normalW.x)>abs(normalW.z)?vPositionW.zy:vPositionW.xy)/4.0,smoothstep(.12,.38,slope));
vec3 grassPigment=mix(vec3(.20,.27,.06),groundColor(ground_grassColor,grassUV,macro),.60);
float grassLight=dot(grassPigment,vec3(.2126,.7152,.0722));
vec3 lush=grassPigment*vec3(.62,1.10,.69);
vec3 dry=mix(grassPigment,grassLight*vec3(1.40,1.01,.40),.90);
vec3 dirt=groundColor(ground_dirtColor,dirtUV,patches)*vec3(1.36,1.15,.89);
vec3 stones=groundColor(ground_stonesColor,stoneUV,macro)*vec3(1.04,1.02,.94);
vec3 sand=groundColor(ground_sandColor,bankUV,patches)*vec3(.99,1.03,.93);
vec3 mud=groundColor(ground_mudColor,bankUV,macro)*vec3(.76,.85,.76);
vec3 rock=groundColor(ground_rockColor,rockUV,patches);
rock=mix(rock,dot(rock,vec3(.2126,.7152,.0722))*vec3(1.18,1.15,1.01),.78);
surfaceAlbedo=(lush*lushWeight+dry*dryWeight+dirt*dirtWeight+stones*stoneWeight+sand*sandWeight+mud*mudWeight+rock*rockWeight)/weightSum;
surfaceAlbedo*=.88+macro*.22;
// Two worn wheel/foot tracks are restrained enough to leave the whole walkable road readable.
float rut=(1.0-smoothstep(.09,.23,abs(roadDistance-.62)))*road*(1.0-village)*.13;
surfaceAlbedo*=1.0-rut;
#ifdef GROUND_NORMALS
vec3 gN=groundSample(ground_grassNormal,grassUV,macro)*2.0-1.0;
vec3 dN=groundSample(ground_dirtNormal,dirtUV,patches)*2.0-1.0;
vec3 sN=groundSample(ground_stonesNormal,stoneUV,macro)*2.0-1.0;
vec3 aN=groundSample(ground_sandNormal,bankUV,patches)*2.0-1.0;
vec3 mN=groundSample(ground_mudNormal,bankUV,macro)*2.0-1.0;
vec3 rN=groundSample(ground_rockNormal,rockUV,patches)*2.0-1.0;
vec2 relief=(gN.xy*(lushWeight+dryWeight)*.22+dN.xy*dirtWeight*.30+sN.xy*stoneWeight*.55+aN.xy*sandWeight*.25+mN.xy*mudWeight*.32+rN.xy*rockWeight*.45)/weightSum;
vec3 tangentX=normalize(vec3(normalW.y,-normalW.x,0.0));
vec3 tangentZ=normalize(cross(tangentX,normalW));
normalW=normalize(normalW+tangentX*relief.x+tangentZ*relief.y);
#endif
`,
    }
  }
}

export function createGroundMaterial(scene: Scene) {
  const material = new PBRMaterial('painted-regional-earth', scene)
  material.albedoColor = Color3.White(); material.metallic = 0; material.roughness = .94
  const painting = new PaintedGround(material, scene)
  return { material, setQuality: (quality: Quality) => painting.setQuality(quality) }
}
