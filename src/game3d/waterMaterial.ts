import { ShaderMaterial } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'
import '@babylonjs/core/Shaders/ShadersInclude/fogVertexDeclaration.js'
import '@babylonjs/core/Shaders/ShadersInclude/fogVertex.js'
import '@babylonjs/core/Shaders/ShadersInclude/fogFragmentDeclaration.js'
import '@babylonjs/core/Shaders/ShadersInclude/fogFragment.js'
import '@babylonjs/core/Shaders/ShadersInclude/helperFunctions.js'
import '@babylonjs/core/Shaders/ShadersInclude/imageProcessingDeclaration.js'
import '@babylonjs/core/Shaders/ShadersInclude/imageProcessingFunctions.js'

/** Existing water pattern with the same haze and linear/ACES output as the world. */
export function createWaterMaterial(scene: Scene) {
  const material = new ShaderMaterial('original-regional-water', scene, {
    vertexSource: `precision highp float;
      attribute vec3 position; attribute vec2 uv;
      uniform mat4 world; uniform mat4 view; uniform mat4 worldViewProjection;
      varying vec2 vUV; varying vec3 p;
      #include<fogVertexDeclaration>
      void main() {
        vUV=uv; p=position; vec4 worldPos=world*vec4(position,1.);
        gl_Position=worldViewProjection*vec4(position,1.);
        #include<fogVertex>
      }`,
    fragmentSource: `precision highp float;
      varying vec2 vUV; varying vec3 p; uniform float time; uniform float finishInMaterial;
      #define TONEMAPPING 2
      #define EXPOSURE
      #define CONTRAST
      #include<helperFunctions>
      #include<imageProcessingDeclaration>
      #include<imageProcessingFunctions>
      #include<fogFragmentDeclaration>
      void main() {
        float edge=min(vUV.x,1.-vUV.x);
        float flow=sin(p.z*2.6+p.x*1.8+time*.48)+sin(p.z*7.4-p.x*3.6-time*.65)*.28;
        vec3 col=mix(vec3(.34,.57,.51),vec3(.13,.36,.38),smoothstep(0.,.28,edge));
        col+=vec3(.033,.05,.045)*flow;
        float ripple=pow(max(0.,sin(p.z*8.+p.x*2.+sin(p.x*2.5+time*.22)*1.5+time*.8)),34.);
        col+=vec3(.23,.26,.20)*ripple*smoothstep(.15,.7,sin(p.x*4.3-p.z*.85))*.45;
        float foam=(1.-smoothstep(.008,.035,edge))*(.55+.3*sin(p.z*5.+time*.5));
        vec4 color=vec4(mix(col,vec3(.72,.76,.58),foam*.8),1.);
        #include<fogFragment>
        color.rgb=toLinearSpace(color.rgb);
        if (finishInMaterial>.5) color=applyImageProcessing(color);
        gl_FragColor=color;
      }`,
  }, { attributes: ['position', 'uv'], uniforms: ['world', 'view', 'worldViewProjection', 'time', 'finishInMaterial', 'exposureLinear', 'contrast'] })
  material.backFaceCulling = false; material.setFloat('time', 0)
  material.onBindObservable.add(() => {
    const effect = material.getEffect(), image = scene.imageProcessingConfiguration
    // Low has no postprocess. Other tiers tone-map once at the end of HDR rendering.
    effect.setFloat('finishInMaterial', image.applyByPostProcess ? 0 : 1)
    effect.setFloat('exposureLinear', image.exposure); effect.setFloat('contrast', image.contrast)
  })
  return material
}
