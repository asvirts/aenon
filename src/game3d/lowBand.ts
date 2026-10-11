/** Original Aenon content moves as a unit so its authored river bank stays intact. */
export const AENON_OFFSET = { x: 0, z: 204 }
export const LOW_BAND_LAYOUT_VERSION = 2

/** The low-band expansion leaves the established northern region in place. */
export const LOW_BAND_PLACES = {
  aenon: { x: -8, z: 208, radius: 34 },
  salim: { x: -206, z: 172, radius: 34 },
  scythopolis: { x: -5, z: -80, radius: 38 },
  pella: { x: 210, z: -65, radius: 36 },
  jordan: { x: 0, z: 64, radius: 100 },
} as const

type Street = { placeId: string; points: { x: number; z: number }[] }
/** Town streets reserve broad approaches between homes, trades, and the regional road. */
export const LOW_BAND_STREETS: Street[] = [
  ...(['salim', 'scythopolis', 'pella'] as const).flatMap(placeId => {
    const place = LOW_BAND_PLACES[placeId]
    return [
      { placeId, points: [{ x: place.x, z: place.z - place.radius }, { x: place.x, z: place.z + place.radius }] },
      { placeId, points: [{ x: place.x - place.radius, z: place.z + 3 }, { x: place.x + place.radius, z: place.z + 3 }] },
    ]
  }),
  { placeId: 'aenon', points: [{ x: -1, z: 175 }, { x: 1.5, z: 190 }, { x: 1.5, z: 204 }, { x: -.8, z: 209 }, { x: -1, z: 235 }] },
  { placeId: 'aenon', points: [{ x: -23, z: 222 }, { x: 1, z: 222 }] },
  { placeId: 'aenon', points: [{ x: -23, z: 227 }, { x: 3, z: 227 }] },
]
