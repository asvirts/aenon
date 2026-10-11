/** Perspective radius in metres: inspect a person, read the Adventurer, see streets. */
export const cameraZoom = { min: 12, default: 22, max: 44 }
export const cameraView = { alpha: Math.PI / 4, beta: .83, verticalFov: 32 * Math.PI / 180, targetHeight: .85 }

export function clampCameraRadius(radius: number): number {
  return Math.max(cameraZoom.min, Math.min(cameraZoom.max, Number.isFinite(radius) ? radius : cameraZoom.default))
}

/** Bounding radius of the four perspective corners on a horizontal ground plane. */
export function groundViewRadius(radius: number, aspect: number, groundBelowTarget: number): number {
  const sin = Math.sin(cameraView.beta), cos = Math.cos(cameraView.beta), tangent = Math.tan(cameraView.verticalFov / 2)
  const height = radius * cos + groundBelowTarget
  return Math.max(...[-1, 1].map(edge => {
    const vertical = edge * tangent, distance = height / (cos - vertical * sin)
    const forward = radius * sin - distance * (sin + vertical * cos)
    const sideways = distance * tangent * aspect
    return Math.hypot(forward, sideways)
  }))
}

/** Existing distance floors remain; widen only for a larger visible footprint. */
export function viewCoverage(radius: number, aspect: number, playerHeight: number) {
  // Terrain's lowest analytic river/lake bed is above -2m. Using that plane
  // conservatively includes valleys when the Adventurer stands on a hill.
  const groundRadius = groundViewRadius(radius, aspect, playerHeight + cameraView.targetHeight + 2)
  return {
    terrain: Math.max(87, groundRadius + 32 * Math.SQRT1_2 + 8),
    scenery: Math.max(78, groundRadius + 12), props: Math.max(70, groundRadius + 8), actors: Math.max(60, groundRadius + 8),
    shadowCasters: Math.max(42, groundRadius + 12), shadowFrustum: Math.max(64, (groundRadius + 8) * 2),
  }
}
export type ViewCoverage = ReturnType<typeof viewCoverage>
