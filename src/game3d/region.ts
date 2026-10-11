import type { LevelBand } from '../season/lib/types.ts'

export type RegionPassage = { reference: string; usfm: string; context: string }
export type RegionSupply = 'wood' | 'ore' | 'herbs' | 'flax' | 'hide' | 'bone' | 'meat'
export type RegionScene = {
  id: string
  title: string
  reference: string
  usfm: string
  /** Original narration, never stored Bible text or invented quotations from Jesus. */
  summary: string[]
  standing: string[]
}
export type RegionPlace = {
  id: string
  name: string
  kind: 'settlement' | 'wilderness'
  band: LevelBand
  x: number
  z: number
  radius: number
  character: string
  passage: RegionPassage
  giver?: { name: string; trade: string; supplies: [RegionSupply, RegionSupply]; lines: [string, string, string] }
  scene?: RegionScene
  /** More than one episode can belong to a place; each still plays once. */
  scenes?: RegionScene[]
}

const johnWitness: RegionScene = {
  id: 'john-witness', title: 'A witness beside the water', reference: 'John 3:22-30', usfm: 'JHN.3.22-30',
  summary: [
    'Original narration of John 3:22–30. People continue to come to the water at Aenon. John’s followers bring him a question about the growing crowds around Jesus.',
    'John answers without rivalry. He understands his task as preparation, and welcomes the place that belongs to Jesus. The work at the water continues.',
    'You stand among those listening as John directs their attention beyond himself.',
  ], standing: ['john'],
}
const canaWedding: RegionScene = {
  id: 'cana-wedding', title: 'The wedding at Cana', reference: 'John 2:1-11', usfm: 'JHN.2.1-11',
  summary: [
    'Original narration of John 2:1–11. At a wedding in Cana, the wine has run out. Jesus’ mother brings the need to his attention; the servants wait for his direction.',
    'The servants fill the stone jars with water and bring a sample to the banquet steward. The water has become wine, and the steward is surprised by its quality.',
    'The sign reveals Jesus’ glory, and his disciples believe in him.',
  ], standing: ['Mary the mother of Jesus', 'Wedding steward', 'Bridegroom', 'Wedding servants'],
}
const canaSecondSign: RegionScene = {
  id: 'cana-second-sign', title: 'The official’s journey', reference: 'John 4:46-54', usfm: 'JHN.4.46-54',
  summary: [
    'Original narration of John 4:46–54. An official comes from Capernaum to Cana because his son is gravely ill. He asks Jesus for help.',
    'Jesus sends him home with assurance that his son lives. The official trusts him and starts back; his servants meet him with news of the child’s recovery.',
    'The time of the recovery matches Jesus’ word. The official and his household believe.',
  ], standing: ['Royal official'],
}
const nazarethScene: RegionScene = {
  id: 'nazareth-synagogue', title: 'In the synagogue at Nazareth', reference: 'Luke 4:16-30', usfm: 'LUK.4.16-30',
  summary: [
    'Original narration of Luke 4:16–30. Jesus reads from Isaiah in the synagogue of his home town. He connects the passage with what the people are hearing that day.',
    'Their first response gives way to resistance as he recalls God’s mercy beyond familiar boundaries. The crowd drives him toward the edge of the town, but he passes through and leaves.',
    'The encounter ends with Jesus leaving Nazareth.',
  ], standing: ['Synagogue attendant', 'Nazareth listeners'],
}
const nainScene: RegionScene = {
  id: 'nain-gate', title: 'At the gate of Nain', reference: 'Luke 7:11-17', usfm: 'LUK.7.11-17',
  summary: [
    'Original narration of Luke 7:11–17. A funeral procession reaches the gate of Nain. The dead man is the only son of a widow, and the town accompanies her.',
    'Jesus meets the procession with compassion. He stops the bearers and restores the young man to life, returning him to his mother.',
    'The crowd responds with awe and praise. News of what happened at the gate spreads beyond Nain into the surrounding country.',
  ], standing: ['Widow of Nain', 'Widow’s son', 'Funeral bearers'],
}
const gadaraScene: RegionScene = {
  id: 'eastern-shore-deliverance', title: 'A restored neighbor', reference: 'Mark 5:1-20', usfm: 'MRK.5.1-20',
  summary: [
    'Original narration of Mark 5:1–20. Across the lake, Jesus encounters a man who has been living in anguish among the tombs. Jesus frees him, and those who return find him restored.',
    'The people are afraid and ask Jesus to leave. The restored man wants to accompany him, but is sent to tell his own people what God has done for him.',
    'The man carries his account through the Decapolis, and the people who hear him are amazed.',
  ], standing: ['Restored man', 'Eastern shore neighbors'],
}
const capernaumStay: RegionScene = {
  id: 'capernaum-stay', title: 'A few days in Capernaum', reference: 'John 2:12', usfm: 'JHN.2.12',
  summary: [
    'Original narration of John 2:12. After Cana, Jesus comes to Capernaum with his mother, his brothers, and his disciples.',
    'They remain together in the lakeside town for a few days.',
  ], standing: ['Mary the mother of Jesus', 'Jesus’ brothers'],
}
const capernaumRoof: RegionScene = {
  id: 'capernaum-roof', title: 'Room for a neighbor', reference: 'Mark 2:1-12', usfm: 'MRK.2.1-12',
  summary: [
    'Original narration of Mark 2:1–12. A crowded house keeps four people from bringing their paralyzed friend to Jesus. They make an opening above him and lower the man through the roof.',
    'Jesus addresses both the man’s sins and the question raised by the teachers present. The man rises, takes his mat, and leaves in front of the crowd.',
    'Those watching respond with amazement and praise God for what they have seen.',
  ], standing: ['Man with a mat', 'Four friends', 'Teachers in the house'],
}
const bethsaidaScene: RegionScene = {
  id: 'bethsaida-bread', title: 'Bread near Bethsaida', reference: 'Luke 9:10-17', usfm: 'LUK.9.10-17',
  summary: [
    'Original narration of Luke 9:10–17. Near Bethsaida, a crowd follows Jesus. He welcomes them, teaches, and attends to those needing healing.',
    'As evening approaches, the disciples see how little food is available. Jesus gives thanks, breaks the bread, and has the disciples distribute it. Everyone eats, with food remaining.',
    'The disciples gather twelve baskets of the pieces left over after the meal.',
  ], standing: ['Crowd near Bethsaida'],
}
const gennesaretScene: RegionScene = {
  id: 'gennesaret-nets', title: 'The nets at Gennesaret', reference: 'Luke 5:1-11', usfm: 'LUK.5.1-11',
  summary: [
    'Original narration of Luke 5:1–11. Jesus teaches from Simon’s boat on the lake. After a fruitless night of fishing, Simon follows his instruction to put out again.',
    'The catch fills the nets so heavily that another boat is needed. Simon responds with awe. The fishermen bring their boats ashore and follow Jesus.',
    'Simon, James, and John leave their former work behind and begin a different journey.',
  ], standing: [],
}
const lakeScene: RegionScene = {
  id: 'lake-stillness', title: 'Stillness on the lake', reference: 'Mark 4:35-41', usfm: 'MRK.4.35-41',
  summary: [
    'Original narration of Mark 4:35–41. During a crossing, a storm overtakes the boat while Jesus sleeps. His companions wake him in fear.',
    'Jesus stills the storm and questions their fear. His companions are left considering who he is, and the authority they have just witnessed.',
  ], standing: [],
}

/** Approximate playable geography, not an archaeological reconstruction or a claim of exact event sites. */
export const regionPlaces: RegionPlace[] = [
  {
    id: 'aenon', name: 'Aenon', kind: 'settlement', band: 'low', x: -8, z: 4, radius: 22,
    character: 'Limestone homes, olive shade, shallow springs, and a busy pottery hearth beside the Jordan.',
    passage: { reference: 'John 1:29', usfm: 'JHN.1.29', context: 'John’s witness to Jesus, remembered beside the place where he continues to baptize.' },
    giver: { name: 'Miriam', supplies: ['wood', 'herbs'], trade: 'Potter', lines: ['Keep the kiln burning for water jars needed by the arriving families.', 'Make the river path safe enough for neighbors carrying jars.', 'Leave the kiln for a moment and attend to John beside the water.'] },
    scene: johnWitness, scenes: [johnWitness],
  },
  {
    id: 'salim', name: 'Salim', kind: 'settlement', band: 'low', x: -45, z: -8, radius: 16,
    character: 'Garden walls, spring channels, flax drying on frames, and a shaded place for travelers to rest.',
    passage: { reference: 'John 3:23', usfm: 'JHN.3.23', context: 'The Gospel names Salim when it locates John’s baptizing at nearby Aenon.' },
    giver: { name: 'Tamar', supplies: ['flax', 'herbs'], trade: 'Spring keeper', lines: ['Bind fresh fiber around the leaking baskets used at the spring.', 'Clear the track used by people fetching water before dusk.', 'Prepare herbs for a neighbor who has given her courtyard to weary travelers.'] },
  },
  {
    id: 'scythopolis', name: 'Scythopolis', kind: 'settlement', band: 'low', x: -5, z: -80, radius: 18,
    character: 'A broad trading road, stone columns, awnings, weighing stones, and wagons approaching the valley crossing.',
    passage: { reference: '1 Samuel 31:10-13', usfm: '1SA.31.10-13', context: 'A memory of Beth Shan, the older biblical name associated with this place; these events do not replay in the Season.' },
    giver: { name: 'Damaris', supplies: ['wood', 'flax'], trade: 'Market steward', lines: ['Supply sound wood for a broken market stall before the next caravan.', 'Drive bandits away from the crossing used by the valley traders.', 'Bring flax for clean coverings while we repair the common market shelter.'] },
  },
  {
    id: 'pella', name: 'Pella', kind: 'settlement', band: 'low', x: 70, z: -75, radius: 17,
    character: 'Eastern terraces, terracotta jars, hillside gardens, and a small colonnaded square overlooking the valley.',
    passage: { reference: 'Proverbs 11:25', usfm: 'PRO.11.25', context: 'Wisdom about generosity, recalled by a water carrier. This is a thematic reading, not a claim that a Gospel episode occurred at Pella.' },
    giver: { name: 'Eliab', supplies: ['wood', 'herbs'], trade: 'Water carrier', lines: ['Bring wood to mend the carrier’s yoke so water can reach the highest terrace.', 'Protect the lower garden track from animals troubling the workers.', 'Gather herbs for the shared meal offered to people who cannot climb to the market.'] },
  },
  {
    id: 'gadara', name: 'Gadara', kind: 'settlement', band: 'middle', x: 82, z: -157, radius: 18,
    character: 'A ridge road, dark building stone, arcaded workshops, and steep pasture paths toward the eastern lake country.',
    passage: { reference: 'Mark 5:18-20', usfm: 'MRK.5.18-20', context: 'The restored man tells his people in the Decapolis. The game represents the broader eastern lake country without choosing a disputed exact shore.' },
    giver: { name: 'Leontios', supplies: ['hide', 'flax'], trade: 'Sandalmaker', lines: ['Bring supple hide for the sandals worn on these steep paths.', 'Help keep the pasture route open to families returning from the ridge.', 'Come hear the account of a neighbor restored in the eastern lake country.'] },
    scene: gadaraScene, scenes: [gadaraScene],
  },
  {
    id: 'nazareth', name: 'Nazareth', kind: 'settlement', band: 'middle', x: -128, z: -174, radius: 18,
    character: 'White stone houses along narrow lanes, a carpenter’s yard, olive terraces, and a modest synagogue court.',
    passage: { reference: 'Luke 4:16-21', usfm: 'LUK.4.16-21', context: 'Jesus reads from Isaiah in Nazareth. The later rejection episode is included under the Season’s deliberate compression.' },
    giver: { name: 'Yosef', supplies: ['wood', 'flax'], trade: 'Carpenter', lines: ['Bring straight timber to repair a neighbor’s damaged doorway.', 'Recover the use of the hillside road where laborers carry their tools.', 'Set the work aside and come to the synagogue as a listener.'] },
    scene: nazarethScene, scenes: [nazarethScene],
  },
  {
    id: 'cana', name: 'Cana', kind: 'settlement', band: 'middle', x: -110, z: -237, radius: 18,
    character: 'Courtyard homes, great stone jars, linen shade, vineyards, and a courtyard prepared for a wedding feast.',
    passage: { reference: 'John 2:1-11', usfm: 'JHN.2.1-11', context: 'The wedding sign at Cana. A separate encounter follows the official’s appeal in John 4.' },
    giver: { name: 'Hadassah', supplies: ['flax', 'herbs'], trade: 'Courtyard keeper', lines: ['Bring flax for the ordinary work of preparing the wedding courtyard.', 'Help guests reach the village by clearing danger from the approach.', 'Attend the wedding, then listen when an anxious official arrives from Capernaum.'] },
    scene: canaWedding, scenes: [canaWedding, canaSecondSign],
  },
  {
    id: 'sepphoris', name: 'Sepphoris', kind: 'settlement', band: 'middle', x: -177, z: -218, radius: 18,
    character: 'Busy stone workshops, a paved market lane, roof terraces, pigment bowls, and a communal cistern.',
    passage: { reference: 'Proverbs 22:29', usfm: 'PRO.22.29', context: 'Wisdom about skilled work, remembered at a workshop. No visit or teaching of Jesus in Sepphoris is asserted.' },
    giver: { name: 'Rufus', supplies: ['wood', 'flax'], trade: 'Mason', lines: ['Supply wood for the frames used to mend the common cistern.', 'Open the quarry approach so apprentices can return with their tools.', 'Bring fiber for the shade cloth that shelters the workers at midday.'] },
  },
  {
    id: 'gath-hepher', name: 'Gath-hepher', kind: 'settlement', band: 'middle', x: -73, z: -214, radius: 16,
    character: 'Small vineyard plots, grape presses, dry stone boundaries, and a shaded gathering place on the village rise.',
    passage: { reference: '2 Kings 14:25', usfm: '2KI.14.25', context: 'A memory naming Jonah of Gath Hepher. Jonah is not placed here as a living character in this Season.' },
    giver: { name: 'Hannah', supplies: ['flax', 'wood'], trade: 'Vine dresser', lines: ['Bring fiber to replace the worn bindings that hold the young vines upright.', 'Make the vineyard path safe for the people carrying baskets home.', 'Gather wood for the press shelter before we share the village’s older memory of Jonah.'] },
  },
  {
    id: 'nain', name: 'Nain', kind: 'settlement', band: 'middle', x: -93, z: -119, radius: 16,
    character: 'A quiet gate on the slope of Moreh, kitchen gardens, low roofs, and a shaded lane where neighbors gather.',
    passage: { reference: 'Luke 7:11-17', usfm: 'LUK.7.11-17', context: 'Jesus meets a widow’s funeral procession. This later episode is present in the compressed Season.' },
    giver: { name: 'Esther', supplies: ['flax', 'herbs'], trade: 'Weaver', lines: ['Bring flax for coverings promised to households with little to spare.', 'Remove danger from the road used by neighbors coming to the town gate.', 'Walk with the gathered neighbors and attend to the meeting at the gate.'] },
    scene: nainScene, scenes: [nainScene],
  },
  {
    id: 'legio', name: 'Legio', kind: 'settlement', band: 'middle', x: -202, z: -65, radius: 18,
    character: 'A southern road station near Megiddo, with pack animals, repair sheds, and stores facing the Jezreel plain.',
    passage: { reference: '2 Kings 23:29-30', usfm: '2KI.23.29-30', context: 'A memory of Josiah at Megiddo. “Legio” follows the supplied game map and is not presented as a first-century naming claim.' },
    giver: { name: 'Azariah', supplies: ['wood', 'flax'], trade: 'Cartwright', lines: ['Find timber to repair the cart used for village grain deliveries.', 'Make the southern road usable after bandits frightened the carriers away.', 'Bring strong fiber for the awning where travelers wait out the heat.'] },
  },
  {
    id: 'jotapata', name: 'Jotapata', kind: 'settlement', band: 'middle', x: -166, z: -284, radius: 17,
    character: 'A steep approach, stone retaining walls, rooftop cisterns, and terraced gardens high above the road.',
    passage: { reference: 'Psalm 121:1-2', usfm: 'PSA.121.1-2', context: 'A psalm recalled on a hill road. It does not locate the psalm’s composition or a Gospel event at Jotapata.' },
    giver: { name: 'Shimon', supplies: ['flax', 'wood'], trade: 'Cistern tender', lines: ['Gather fiber for ropes used to raise water to the upper gardens.', 'Protect the steep approach while people carry the season’s supplies uphill.', 'Bring wood for safe handrails beside the oldest cistern steps.'] },
  },
  {
    id: 'tiberias', name: 'Tiberias', kind: 'settlement', band: 'high', x: 3, z: -237, radius: 18,
    character: 'A busy lake harbor, pale colonnades, hot spring steam, tiled courtyards, and boats pulled beside the quays.',
    passage: { reference: 'John 6:23-24', usfm: 'JHN.6.23-24', context: 'Boats from Tiberias join the movement around the lake. This later passage is remembered within the compressed Season.' },
    giver: { name: 'Joatham', supplies: ['wood', 'flax'], trade: 'Harbor steward', lines: ['Bring sound wood for a landing used by small fishing boats.', 'Clear danger from the shoreline track used by harbor workers.', 'Supply fiber for mooring ropes before the next lake crossing.'] },
  },
  {
    id: 'magdala', name: 'Magdala', kind: 'settlement', band: 'high', x: -17, z: -301, radius: 17,
    character: 'Fishing sheds, baskets of salt, low stone quays, drying nets, and fertile land opening toward Gennesaret.',
    passage: { reference: 'Luke 8:1-3', usfm: 'LUK.8.1-3', context: 'The women who support Jesus’ traveling company, including Mary Magdalene. She is with the company, not permanently stationed in this town.' },
    giver: { name: 'Dinah', supplies: ['flax', 'wood'], trade: 'Net maker', lines: ['Bring fiber for nets shared by families who have no spare boat.', 'Make the shore road safe between the fishing sheds and the fields.', 'Prepare wood for drying frames before joining the neighbors at the lakeside.'] },
  },
  {
    id: 'capernaum', name: 'Capernaum', kind: 'settlement', band: 'high', x: 19, z: -377, radius: 19,
    character: 'Dark stone houses, courtyards joined by narrow lanes, fishing boats, and a gathering place near the northern shore.',
    passage: { reference: 'John 2:12', usfm: 'JHN.2.12', context: 'The brief stay after Cana belongs to the early setting. Other Capernaum scenes are deliberately compressed into the same Season.' },
    giver: { name: 'Mattathias', supplies: ['wood', 'flax'], trade: 'Householder', lines: ['Bring wood to repair a neighbor’s roof before visitors fill the lane.', 'Keep the northern shore road open for households bringing food to town.', 'Welcome the travelers for their short stay and attend to the gathering in the house.'] },
    scene: capernaumStay, scenes: [capernaumStay, capernaumRoof],
  },
  {
    id: 'bethsaida', name: 'Bethsaida', kind: 'settlement', band: 'high', x: 83, z: -391, radius: 18,
    character: 'Reed beds, fishing yards, basalt walls, broad baskets, and a landing near the water entering the lake.',
    passage: { reference: 'Luke 9:10-17', usfm: 'LUK.9.10-17', context: 'The gathering and feeding near Bethsaida, a later episode present in this Season’s compressed geography.' },
    giver: { name: 'Yael', supplies: ['flax', 'wood'], trade: 'Basket maker', lines: ['Bring fiber for baskets borrowed by the families gathering outside town.', 'Make the road from the landing safe for late arrivals.', 'Join the gathering near Bethsaida as a witness, with no part in causing the sign.'] },
    scene: bethsaidaScene, scenes: [bethsaidaScene],
  },
  {
    id: 'gamla', name: 'Gamla', kind: 'settlement', band: 'high', x: 142, z: -332, radius: 18,
    character: 'A high ridge, dark stone dwellings, narrow stairways, hillside presses, and deep views toward the lake.',
    passage: { reference: 'Psalm 125:1-2', usfm: 'PSA.125.1-2', context: 'Mountain imagery recalled by a traveler. The psalm speaks of Zion; it is not a claim that its events or composition belong to Gamla.' },
    giver: { name: 'Reuben', supplies: ['wood', 'flax'], trade: 'Terrace keeper', lines: ['Carry wood for braces along a terrace that feeds several households.', 'Protect the exposed ridge path used by workers returning before dark.', 'Bring fiber to strengthen the baskets lowered between the steep garden levels.'] },
  },
  {
    id: 'hippus', name: 'Hippus', kind: 'settlement', band: 'high', x: 124, z: -256, radius: 18,
    character: 'An eastern ridge town of columns and dark stone, with a long descent to a sheltered lake landing.',
    passage: { reference: 'Mark 5:20', usfm: 'MRK.5.20', context: 'The restored man’s account spreads through the Decapolis. This regional connection does not place a new invented Gospel episode in Hippus.' },
    giver: { name: 'Petros', supplies: ['wood', 'flax'], trade: 'Landing keeper', lines: ['Bring timber for the shelter beside the steep landing road.', 'Make the eastern descent safer for people carrying market goods.', 'Supply fiber for ropes shared between the town carriers and the boat crews.'] },
  },
  {
    id: 'jordan', name: 'Jordan', kind: 'wilderness', band: 'low', x: 0, z: -35, radius: 28,
    character: 'Reeds, tamarisk shade, shallow fords, river clay, and trails winding between the springs and the valley.',
    passage: { reference: 'Joshua 4:1-7', usfm: 'JOS.4.1-7', context: 'River stones recall Israel’s crossing. This is a memory, not the claim that Aenon is the exact crossing site.' },
  },
  {
    id: 'jezreel', name: 'Jezreel', kind: 'wilderness', band: 'middle', x: -139, z: -77, radius: 30,
    character: 'Open grain fields, vineyard boundaries, wagon ruts, orchard edges, and long views across the valley.',
    passage: { reference: '1 Kings 21:1-3', usfm: '1KI.21.1-3', context: 'Naboth’s vineyard is remembered in Jezreel. These earlier events remain Scripture memories, not living encounters.' },
  },
  {
    id: 'kishon', name: 'Kishon', kind: 'wilderness', band: 'middle', x: -216, z: -144, radius: 28,
    character: 'A winding stream, damp reed margins, willow shade, muddy banks, and a stone crossing on the western road.',
    passage: { reference: 'Judges 5:20-21', usfm: 'JDG.5.20-21', context: 'The song of Deborah remembers the Kishon. The ancient battle does not become a combat encounter for the Adventurer.' },
  },
  {
    id: 'tabor', name: 'Mount Tabor', kind: 'wilderness', band: 'middle', x: -65, z: -164, radius: 27,
    character: 'A rounded mountain, oak shade, chalky paths, upland herbs, and stone outcrops above the plain.',
    passage: { reference: 'Judges 4:6-7', usfm: 'JDG.4.6-7', context: 'Deborah’s instruction to Barak names Tabor and the Kishon. The game does not identify Tabor as the site of the Transfiguration.' },
  },
  {
    id: 'gilboa', name: 'Mount Gilboa', kind: 'wilderness', band: 'middle', x: -62, z: -58, radius: 23,
    character: 'Dry ridges, pale exposed rock, scattered thorn scrub, and steep tracks above the southern valley.',
    passage: { reference: '1 Samuel 31:1-6', usfm: '1SA.31.1-6', context: 'A memory of Saul and his sons on Gilboa. The Adventurer cannot enter or change this earlier battle.' },
  },
  {
    id: 'moreh', name: 'Hill of Moreh', kind: 'wilderness', band: 'middle', x: -124, z: -124, radius: 21,
    character: 'A low hill of grazing slopes, olive terraces, small caves, and footpaths overlooking Nain and Jezreel.',
    passage: { reference: 'Judges 7:1', usfm: 'JDG.7.1', context: 'The hill of Moreh appears in the account of Gideon. This passage is an earlier memory of the landscape.' },
  },
  {
    id: 'gennesaret', name: 'Gennesaret', kind: 'wilderness', band: 'high', x: -49, z: -342, radius: 27,
    character: 'Fertile lakeside fields, orchards, woven nets, quiet coves, and fishing boats drawn onto the shore.',
    passage: { reference: 'Luke 5:1-11', usfm: 'LUK.5.1-11', context: 'The catch and call beside the Lake of Gennesaret, also called the Sea of Galilee.' },
    scene: gennesaretScene, scenes: [gennesaretScene],
  },
  {
    id: 'sea-of-galilee', name: 'Sea of Galilee', kind: 'wilderness', band: 'high', x: 56, z: -301, radius: 46,
    character: 'Open blue water, reed-fringed coves, landing stages, and boat routes between the western and eastern shores.',
    passage: { reference: 'Mark 4:35-41', usfm: 'MRK.4.35-41', context: 'The storm stilled during a lake crossing. This later scene belongs to the deliberately compressed Season.' },
    scene: lakeScene, scenes: [lakeScene],
  },
]

export const regionRoads: { from: string; to: string }[] = [
  { from: 'aenon', to: 'salim' }, { from: 'aenon', to: 'jordan' },
  { from: 'salim', to: 'gilboa' }, { from: 'jordan', to: 'scythopolis' },
  { from: 'scythopolis', to: 'pella' }, { from: 'scythopolis', to: 'gilboa' },
  { from: 'gilboa', to: 'jezreel' }, { from: 'jezreel', to: 'legio' },
  { from: 'legio', to: 'kishon' }, { from: 'kishon', to: 'sepphoris' },
  { from: 'jezreel', to: 'moreh' }, { from: 'moreh', to: 'nain' },
  { from: 'nain', to: 'tabor' }, { from: 'moreh', to: 'nazareth' },
  { from: 'nazareth', to: 'sepphoris' }, { from: 'nazareth', to: 'gath-hepher' },
  { from: 'gath-hepher', to: 'tabor' }, { from: 'gath-hepher', to: 'cana' },
  { from: 'sepphoris', to: 'cana' }, { from: 'sepphoris', to: 'jotapata' },
  { from: 'cana', to: 'tiberias' }, { from: 'jotapata', to: 'gennesaret' },
  { from: 'pella', to: 'gadara' }, { from: 'gadara', to: 'hippus' },
  { from: 'tiberias', to: 'magdala' }, { from: 'magdala', to: 'gennesaret' },
  { from: 'gennesaret', to: 'capernaum' }, { from: 'capernaum', to: 'bethsaida' },
  { from: 'bethsaida', to: 'gamla' }, { from: 'gamla', to: 'hippus' },
]

/** Dock positions are ashore. Crossings connect only these named landings. */
export const ports: { placeId: string; x: number; z: number; destinationIds: string[] }[] = [
  { placeId: 'tiberias', x: 17, z: -250, destinationIds: ['magdala', 'capernaum', 'bethsaida', 'hippus'] },
  { placeId: 'magdala', x: -9, z: -301, destinationIds: ['tiberias', 'capernaum', 'bethsaida', 'hippus'] },
  { placeId: 'capernaum', x: 31, z: -374, destinationIds: ['tiberias', 'magdala', 'bethsaida', 'hippus'] },
  { placeId: 'bethsaida', x: 77, z: -376, destinationIds: ['tiberias', 'magdala', 'capernaum', 'hippus'] },
  { placeId: 'hippus', x: 106, z: -269, destinationIds: ['tiberias', 'magdala', 'capernaum', 'bethsaida'] },
]

export const regionBounds = { minX: -254, maxX: 181, minZ: -426, maxZ: 35 }
