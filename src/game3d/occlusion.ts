import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh.js'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js'
import type { Ray } from '@babylonjs/core/Culling/ray.js'

export type OcclusionGroup = readonly AbstractMesh[]

/** Call after assembling the complete building/tree, including attached details. */
export function occlusionGroup(root: TransformNode): OcclusionGroup {
  const meshes = root.getChildMeshes().filter(mesh => mesh.getTotalVertices() > 0)
  for (const mesh of meshes) if (mesh.material) mesh.material.transparencyMode = null
  return meshes
}

/** A building's material primitives form one obstruction, not separate walls. */
export function updateOcclusionGroups(groups: readonly OcclusionGroup[], rays: readonly Ray[]): void {
  for (const meshes of groups) {
    const blocked = meshes.some(mesh => mesh.isEnabled() && mesh.isVisible && rays.some(ray => ray.intersectsMesh(mesh, true).hit))
    for (const mesh of meshes) mesh.visibility = blocked ? .23 : 1
  }
}
