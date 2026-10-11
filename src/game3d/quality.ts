export const qualities = ['low', 'medium', 'high', 'ultra'] as const
export type Quality = typeof qualities[number]

export const qualityDescriptions: Record<Quality, string> = {
  low: 'Clear, simple lighting, sparse decoration and reduced resolution for smoother play.',
  medium: 'Warm sunlight, crisp shadows and full decoration with smooth edges.',
  high: 'Richer contact shadows, softer sunlight and a subtle glow.',
  ultra: 'The finest shadows and surface depth at the highest resolution.',
}

/** A conservative first visit suggestion; a valid manual choice always wins. */
export function selectGraphicsQuality(saved: unknown, hardwareConcurrency: number, renderer: string): Quality {
  if (qualities.includes(saved as Quality)) return saved as Quality
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic render|warp/i.test(renderer)) return 'low'
  if (!Number.isFinite(hardwareConcurrency) || hardwareConcurrency <= 4) return 'low'
  // Renderer strings are hints, not a benchmark. Unified/integrated and mobile
  // GPUs start at Medium; the player can choose a higher tier in Settings.
  if (/intel|apple|adreno|mali|powervr|radeon.*(?:vega|\bgraphics\b|\b\d{3}m\b)/i.test(renderer)) return 'medium'
  if (/geforce|quadro|rtx|radeon.*(?:rx|pro)/i.test(renderer) && hardwareConcurrency >= 8) return 'high'
  return 'medium'
}
