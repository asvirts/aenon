import type { LevelBand } from '../season/lib/types.ts'
import { LOW_BAND_PLACES } from './lowBand.ts'

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
/**
 * A settlement townsperson and the copy for their Quests. Each tuple follows the
 * Quest order: common work, open roads, neighborly care. Step lines tell the
 * Adventurer what to do; finished lines are spoken by the townsperson.
 */
export type RegionGiver = {
  name: string
  trade: string
  supplies: [RegionSupply, RegionSupply]
  /** First step of each once-only Quest. `{target}` in the second is replaced by the hostile's name. */
  lines: [string, string, string]
  /** Return step of each once-only Quest. */
  returns: [string, string, string]
  finished: [string, string, string]
  /** The repeatable Quest: request, return, finished. */
  daily: [string, string, string]
  /** Later scenes in the settlement, by scene id: attend, return, finished. */
  visits?: Record<string, [string, string, string]>
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
  giver?: RegionGiver
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
    'John counts this as the first of the signs Jesus did. The disciples who saw it come to trust him.',
  ], standing: ['Mary the mother of Jesus', 'Wedding steward', 'Bridegroom', 'Wedding servants'],
}
const canaSecondSign: RegionScene = {
  id: 'cana-second-sign', title: 'The official’s son', reference: 'John 4:46-54', usfm: 'JHN.4.46-54',
  summary: [
    'Original narration of John 4:46–54. An official comes from Capernaum to Cana because his son is gravely ill. He asks Jesus for help.',
    'Jesus sends him home with assurance that his son lives. The official trusts him and starts back; his servants meet him with news of the child’s recovery.',
    'The boy got better at the same hour Jesus spoke to his father. The official and his whole household come to believe.',
  ], standing: ['Royal official'],
}
const nazarethScene: RegionScene = {
  id: 'nazareth-synagogue', title: 'In the synagogue at Nazareth', reference: 'Luke 4:16-30', usfm: 'LUK.4.16-30',
  summary: [
    'Original narration of Luke 4:16–30. On the Sabbath, Jesus stands in the synagogue of his home town and reads from the scroll of Isaiah. Then he tells the room that the passage is about what is happening now, in front of them.',
    'The listeners are impressed at first, but they know him as Joseph’s son. When he reminds them that Elijah and Elisha were sent to help foreigners, the mood turns to anger.',
    'The crowd drives him out to a steep drop outside the town. Jesus gets past them and leaves Nazareth.',
  ], standing: ['Synagogue attendant', 'Nazareth listeners'],
}
const nainScene: RegionScene = {
  id: 'nain-gate', title: 'At the gate of Nain', reference: 'Luke 7:11-17', usfm: 'LUK.7.11-17',
  summary: [
    'Original narration of Luke 7:11–17. A funeral procession reaches the gate of Nain. The dead man is the only son of a widow, and the town accompanies her.',
    'Jesus is moved when he sees the widow. He touches the bier and the bearers stop. The young man sits up alive, and Jesus brings him to his mother.',
    'The people who saw it are shaken, and they praise God. The story of what happened at the gate spreads far beyond Nain.',
  ], standing: ['Widow of Nain', 'Widow’s son', 'Funeral bearers'],
}
const gadaraScene: RegionScene = {
  id: 'eastern-shore-deliverance', title: 'The man from the tombs', reference: 'Mark 5:1-20', usfm: 'MRK.5.1-20',
  summary: [
    'Original narration of Mark 5:1–20. On the far side of the lake, Jesus meets a man who lives among the tombs, tormented by spirits. No one has been able to keep him chained. Jesus drives the spirits out, and they go into a herd of pigs that rushes down into the lake.',
    'People from the town come out and find the man dressed and calm. They are frightened and ask Jesus to leave. The man asks to go with him, but Jesus sends him home to tell his own people what has happened.',
    'The man tells his story through the towns of the Decapolis, and people are amazed.',
  ], standing: ['Restored man', 'Eastern shore neighbors'],
}
const capernaumStay: RegionScene = {
  id: 'capernaum-stay', title: 'A few days in Capernaum', reference: 'John 2:12', usfm: 'JHN.2.12',
  summary: [
    'Original narration of John 2:12. After the wedding at Cana, Jesus goes down to Capernaum. His mother and brothers come with him, and so do his disciples.',
    'John records only that they stay in the lakeside town for a few days. Soon afterward Jesus goes up to Jerusalem for the Passover.',
  ], standing: ['Mary the mother of Jesus', 'Jesus’ brothers'],
}
const capernaumRoof: RegionScene = {
  id: 'capernaum-roof', title: 'Lowered through the roof', reference: 'Mark 2:1-12', usfm: 'MRK.2.1-12',
  summary: [
    'Original narration of Mark 2:1–12. The house where Jesus is teaching is so full that four men cannot carry their paralyzed friend inside. They dig through the roof above Jesus and lower the man down on his mat.',
    'Jesus tells the man his sins are forgiven. Some teachers of the law think only God can forgive sins, so Jesus heals the man as well. The man stands up, takes his mat and leaves through the crowd.',
    'The people in the house are astonished, and they praise God.',
  ], standing: ['Man with a mat', 'Four friends', 'Teachers in the house'],
}
const bethsaidaScene: RegionScene = {
  id: 'bethsaida-bread', title: 'Bread near Bethsaida', reference: 'Luke 9:10-17', usfm: 'LUK.9.10-17',
  summary: [
    'Original narration of Luke 9:10–17. Jesus takes his disciples to Bethsaida to be alone, but crowds follow them. He welcomes the people, teaches them about the kingdom of God and heals the sick.',
    'Late in the day the disciples want to send everyone away to find food. They have five loaves and two fish, and there are about five thousand men. Jesus has the people sit in groups, gives thanks, breaks the bread and hands it to the disciples to share out.',
    'Everyone eats as much as they want. Afterward the disciples pick up twelve baskets of leftover pieces.',
  ], standing: ['Crowd near Bethsaida'],
}
const gennesaretScene: RegionScene = {
  id: 'gennesaret-nets', title: 'The nets at Gennesaret', reference: 'Luke 5:1-11', usfm: 'LUK.5.1-11',
  summary: [
    'Original narration of Luke 5:1–11. A crowd presses around Jesus on the shore, so he teaches from Simon’s boat a little way out. Afterward he tells Simon to take the boat out deeper and fish again. Simon has worked all night and caught nothing, but he does it.',
    'The nets fill with so many fish that they begin to tear, and the partners in a second boat come to help. Both boats are so full they start to sink. Simon kneels in front of Jesus, frightened by what he has seen.',
    'Back on shore, Simon and his partners James and John leave the boats and the catch behind and go with Jesus.',
  ], standing: [],
}
const lakeScene: RegionScene = {
  id: 'lake-stillness', title: 'The storm on the lake', reference: 'Mark 4:35-41', usfm: 'MRK.4.35-41',
  summary: [
    'Original narration of Mark 4:35–41. In the evening Jesus and his disciples set out to cross the lake. A violent wind rises, and water comes into the boat faster than they can bail it out, while Jesus sleeps in the stern.',
    'The disciples wake him, afraid they are going to drown. Jesus speaks to the wind and the water, and the lake goes completely still. Then he asks them why they were afraid.',
    'Now they are frightened in a different way. They ask one another who he is, if even the wind and the water do what he says.',
  ], standing: [],
}

/** Approximate playable geography, not an archaeological reconstruction or a claim of exact event sites. */
export const regionPlaces: RegionPlace[] = [
  {
    id: 'aenon', name: 'Aenon', kind: 'settlement', band: 'low', ...LOW_BAND_PLACES.aenon,
    character: 'A village of limestone houses by shallow springs near the Jordan, where John is baptizing. The potter’s hearth burns under the olive trees.',
    passage: { reference: 'John 1:29', usfm: 'JHN.1.29', context: 'John’s witness to Jesus, remembered beside the place where he continues to baptize.' },
    giver: {
      name: 'Miriam', trade: 'Potter', supplies: ['wood', 'herbs'],
      lines: ['More families are arriving at the springs, and each one needs water jars. Bring four bundles of wood for the kiln.', 'A wolf has been following people who carry jars along the river path. Drive off the {target}.', 'Go back down to the water where John is baptizing, and listen with the families who came to hear him.'],
      returns: ['Carry the four bundles of wood to the potter’s kiln.', 'Bring the potter a bundle of wood for a watch fire at the head of the river path.', 'Bring three bunches of herbs to the potter for the families camped by the spring.'],
      finished: ['The kiln is hot again. The first jars will be ready for the new families by evening.', 'With the wolf gone and a fire at the top of the path, people will carry their jars down again.', 'These will go into the cooking pots at the spring tonight. Those families have walked a long way.'],
      daily: ['The kiln burns through wood quickly. Bring three bundles of wood whenever you can.', 'Take the three bundles of wood to the potter.', 'That is enough for another firing.'],
    },
    scene: johnWitness, scenes: [johnWitness],
  },
  {
    id: 'salim', name: 'Salim', kind: 'settlement', band: 'low', ...LOW_BAND_PLACES.salim,
    character: 'A spring village ringed by garden walls. Flax dries on frames beside the channels, and travelers on the way to Aenon stop here for water.',
    passage: { reference: 'John 3:23', usfm: 'JHN.3.23', context: 'The Gospel names Salim when it locates John’s baptizing at nearby Aenon.' },
    giver: {
      name: 'Tamar', trade: 'Spring keeper', supplies: ['flax', 'herbs'],
      lines: ['The cords that tie off the water skins at the spring have worn through. Gather four bundles of flax for new cords.', 'A wolf has been waiting near the track where people fetch water before dusk. Chase off the {target}.', 'A widow beside the spring has opened her courtyard to tired travelers. Gather three bunches of herbs for the meal she cooks for them.'],
      returns: ['Take the four bundles of flax to Tamar at the spring.', 'Bring Tamar a bundle of wood to keep a fire lit by the spring after dark.', 'Bring the three bunches of herbs to Tamar, who will carry them to the widow’s courtyard.'],
      finished: ['I can twist new cords from these tonight. The skins will stop leaking on the walk home.', 'With the wolf gone and a fire by the water, people can come for water after dark again.', 'She will cook with these tonight. Her courtyard is full most evenings, and she turns no one away.'],
      daily: ['The cords at the spring need mending every few weeks. Gather three bundles of flax for the next batch.', 'Give the three bundles of flax to Tamar at the spring.', 'That is enough for the next mending.'],
    },
  },
  {
    id: 'scythopolis', name: 'Scythopolis', kind: 'settlement', band: 'low', ...LOW_BAND_PLACES.scythopolis,
    character: 'A city on the valley crossing with a wide trading road. Caravans unload under the colonnades, and goods are weighed on stones in the market.',
    passage: { reference: '1 Samuel 31:10-13', usfm: '1SA.31.10-13', context: 'A memory of Beth Shan, the older biblical name associated with this place; these events do not replay in the Season.' },
    giver: {
      name: 'Damaris', trade: 'Market steward', supplies: ['wood', 'flax'],
      lines: ['A market stall split under a load of jars, and a caravan arrives soon. Bring four bundles of wood to rebuild it.', 'A bandit from the Gilboa ridges has been stopping traders at the valley crossing. Drive off the {target}.', 'The cloth over the common market shelter has torn in the wind. Gather three bundles of flax for a new covering.'],
      returns: ['Take the four bundles of wood to Damaris in the market.', 'Bring Damaris a bundle of wood for the guard post at the crossing.', 'Deliver the three bundles of flax to Damaris for the market shelter.'],
      finished: ['The carpenters can have the stall standing before the caravan comes in. The jar seller will be pleased.', 'The traders will hear by tomorrow that the crossing is open. Word moves fast in this market.', 'Sellers who cannot afford their own awning use that shelter. They will have shade again tomorrow.'],
      daily: ['Something in this market breaks every week. Three bundles of wood would cover the next repair.', 'Deliver the three bundles of wood to Damaris at the market.', 'That covers this week’s repairs. There will be more next week.'],
    },
  },
  {
    id: 'pella', name: 'Pella', kind: 'settlement', band: 'low', ...LOW_BAND_PLACES.pella,
    character: 'A town on the eastern terraces above the Jordan valley. Water is carried up the slopes in clay jars to gardens around a small colonnaded square.',
    passage: { reference: 'Proverbs 11:25', usfm: 'PRO.11.25', context: 'Wisdom about generosity, recalled by a water carrier. This is a thematic reading, not a claim that a Gospel episode occurred at Pella.' },
    giver: {
      name: 'Eliab', trade: 'Water carrier', supplies: ['wood', 'herbs'],
      lines: ['The yoke for carrying water to the highest terrace has cracked. Bring four bundles of wood for a new yoke and spare poles.', 'A bandit has been robbing the workers on the lower garden track. Stop the {target}.', 'Some people in Pella are too old or sick to climb to the market. Gather three bunches of herbs for the meal that is carried down to them.'],
      returns: ['Take the four bundles of wood to Eliab at the foot of the terraces.', 'Bring Eliab a bundle of wood to mend the gate on the garden track.', 'Take the three bunches of herbs to Eliab, who carries the meal down.'],
      finished: ['With a sound yoke I can reach the top terrace twice a day. The gardens up there have been dry for a week.', 'The workers can tend the lower gardens without looking over their shoulders now.', 'I will take these down with the water this evening. They will have a proper meal tonight.'],
      daily: ['Yokes and poles wear out on the climb. Bring three bundles of wood for spares.', 'Carry the three bundles of wood up to Eliab.', 'Those will do for spare poles. The climb breaks one every few days.'],
    },
  },
  {
    id: 'gadara', name: 'Gadara', kind: 'settlement', band: 'middle', x: 82, z: -157, radius: 18,
    character: 'A ridge town of dark stone with arcaded workshops along the road. Steep pasture paths run down toward the lake.',
    passage: { reference: 'Mark 5:18-20', usfm: 'MRK.5.18-20', context: 'The restored man tells his people in the Decapolis. The game represents the broader eastern lake country without choosing a disputed exact shore.' },
    giver: {
      name: 'Leontios', trade: 'Sandalmaker', supplies: ['hide', 'flax'],
      lines: ['The steep paths around Gadara wear out sandals quickly. Bring four hides to cut new soles.', 'A wolf has been taking lambs from the pasture paths above town. Drive off the {target}.', 'Jesus has crossed the lake, and a man who lives among the tombs has gone down to meet him. Go and witness what happens.'],
      returns: ['Take the four hides to Leontios at his workshop under the arches.', 'Bring Leontios a bundle of wood to repair the pasture gate.', 'Bring Leontios three bundles of flax for sandal laces.'],
      finished: ['This is good hide. The shepherds will have new sandals before they go back up to the pastures.', 'The shepherds can bring their flocks down the ridge path again. I will tell them who cleared it.', 'Thank you for the flax. In the workshops they still argue about what happened to that man by the tombs.'],
      daily: ['Every shepherd here needs new sandals before winter. Three more hides would make three more pairs.', 'Bring the three hides to Leontios’s workshop.', 'Three more pairs of sandals for the shepherds.'],
    },
    scene: gadaraScene, scenes: [gadaraScene],
  },
  {
    id: 'nazareth', name: 'Nazareth', kind: 'settlement', band: 'middle', x: -128, z: -174, radius: 18,
    character: 'A small hill village of white stone houses on narrow lanes. A carpenter’s yard sits among the olive terraces, below a modest synagogue court.',
    passage: { reference: 'Luke 4:16-21', usfm: 'LUK.4.16-21', context: 'Jesus reads from Isaiah in Nazareth. The later rejection episode is included under the Season’s deliberate compression.' },
    giver: {
      name: 'Yosef', trade: 'Carpenter', supplies: ['wood', 'flax'],
      lines: ['A neighbor’s doorway split in the last storm, and the door will not close. Bring four bundles of wood for a new frame.', 'A wolf has been seen on the hillside road where laborers walk with their tools. Chase off the {target}.', 'It is the Sabbath, and the village is gathering in the synagogue. Put the work aside and go in to listen.'],
      returns: ['Take the four bundles of wood to Yosef in the carpenter’s yard.', 'Bring Yosef a bundle of wood to mend the rail along the hillside road.', 'Bring Yosef three bundles of flax for the cord he uses to measure timber.'],
      finished: ['Good straight timber. The door will hang true by tomorrow, and the family can sleep with it shut.', 'The laborers will walk that road again in the morning. I will have the rail fixed before then.', 'The village is uneasy after what happened in the synagogue. Thank you for the flax all the same.'],
      daily: ['There is always a doorway or a plow to mend in Nazareth. Bring three bundles of wood for the yard.', 'Take the three bundles of wood to Yosef’s yard.', 'That is enough for this week’s repairs in the village.'],
    },
    scene: nazarethScene, scenes: [nazarethScene],
  },
  {
    id: 'cana', name: 'Cana', kind: 'settlement', band: 'middle', x: -110, z: -237, radius: 18,
    character: 'A village of courtyard homes among vineyards. Large stone water jars stand by the doors, and one courtyard is being made ready for a wedding feast.',
    passage: { reference: 'John 2:1-11', usfm: 'JHN.2.1-11', context: 'The wedding sign at Cana. A separate encounter follows the official’s appeal in John 4.' },
    giver: {
      name: 'Hadassah', trade: 'Courtyard keeper', supplies: ['flax', 'herbs'],
      lines: ['The wedding courtyard needs linen shade before the guests arrive. Gather four bundles of flax for the awnings.', 'A bandit on the approach road has frightened off families coming to the wedding. Drive off the {target}.', 'The wedding feast has begun in the courtyard. Join the guests and witness what happens there.'],
      returns: ['Take the four bundles of flax to Hadassah in the wedding courtyard.', 'Bring Hadassah a bundle of wood for a fire to light the road for late guests.', 'The feast lasts for days. Bring Hadassah three bunches of herbs for the kitchen.'],
      finished: ['The weavers will have the awnings up by tomorrow. The guests will sit in the shade.', 'More guests can come now. The bridegroom’s family will be glad of a full courtyard.', 'The steward is still talking about the wine. I have never seen this courtyard so full.'],
      daily: ['Cana always has another wedding coming. Three bundles of flax would make shade for the next one.', 'Give the three bundles of flax to Hadassah.', 'That is enough linen for the next feast.'],
      visits: {
        'cana-second-sign': ['An official has come from Capernaum to find Jesus, because his son is dying. Go and witness what happens.', 'Bring Hadassah a bundle of flax to mend the awning before the next guests come.', 'The official left for home as soon as he had spoken with Jesus. We are waiting for news of his son.'],
      },
    },
    scene: canaWedding, scenes: [canaWedding, canaSecondSign],
  },
  {
    id: 'sepphoris', name: 'Sepphoris', kind: 'settlement', band: 'middle', x: -177, z: -218, radius: 18,
    character: 'A busy city of stone workshops along a paved market lane. Masons and painters work on the roof terraces, and the town shares one large cistern.',
    passage: { reference: 'Proverbs 22:29', usfm: 'PRO.22.29', context: 'Wisdom about skilled work, remembered at a workshop. No visit or teaching of Jesus in Sepphoris is asserted.' },
    giver: {
      name: 'Rufus', trade: 'Mason', supplies: ['wood', 'flax'],
      lines: ['The common cistern has a cracked wall, and the masons need timber frames to hold the new stone. Bring four bundles of wood.', 'A wolf has been prowling the quarry approach, and the apprentices will not go out to cut stone. Drive off the {target}.', 'The workers on the cistern have no shade at midday. Gather three bundles of flax for a shade cloth.'],
      returns: ['Take the four bundles of wood to Rufus at the cistern.', 'Bring Rufus a bundle of wood to repair the sledge that drags stone from the quarry.', 'Deliver the three bundles of flax to Rufus for the shade cloth.'],
      finished: ['We can set the frames today and start laying stone tomorrow. The cistern will hold water before the rains.', 'The apprentices went back to the quarry this morning. We will have stone again by the end of the week.', 'The men can keep working through the hottest hours now. That cloth will last us the season.'],
      daily: ['The scaffolds in Sepphoris always need timber. Bring three bundles of wood for the next wall.', 'Deliver the three bundles of wood to Rufus.', 'That will do for the scaffolds this week. Someone in Sepphoris is always building.'],
    },
  },
  {
    id: 'gath-hepher', name: 'Gath-hepher', kind: 'settlement', band: 'middle', x: -73, z: -214, radius: 16,
    character: 'A village on a rise above small vineyard plots and grape presses. Dry stone walls mark the fields, and people meet in the shade at the top of the village.',
    passage: { reference: '2 Kings 14:25', usfm: '2KI.14.25', context: 'A memory naming Jonah of Gath Hepher. Jonah is not placed here as a living character in this Season.' },
    giver: {
      name: 'Hannah', trade: 'Vine dresser', supplies: ['flax', 'wood'],
      lines: ['The ties that hold the young vines to their stakes have rotted. Gather four bundles of flax to tie them up again.', 'A bandit from the Cana road has been robbing people carrying grape baskets home. Stop the {target}.', 'The roof over the grape press is falling in. Gather three bundles of wood to rebuild the press shelter.'],
      returns: ['Take the four bundles of flax to Hannah in the vineyard.', 'Bring Hannah a bundle of wood to mend the vineyard gate.', 'Take the three bundles of wood to Hannah at the press.'],
      finished: ['The young vines are tied and standing straight. They will bear in a year or two.', 'The pickers can carry their baskets home before dark without trouble now.', 'We will tread the grapes under a sound roof this year. The old people will tell the story of Jonah at the press again. They say he came from this village.'],
      daily: ['The vines need new ties every season. Gather three bundles of flax for the next row.', 'Give the three bundles of flax to Hannah among the vines.', 'That will tie a whole row of vines.'],
    },
  },
  {
    id: 'nain', name: 'Nain', kind: 'settlement', band: 'middle', x: -93, z: -119, radius: 16,
    character: 'A quiet town on the slope of the Hill of Moreh. Low-roofed houses with kitchen gardens line a shaded lane that runs to the town gate.',
    passage: { reference: 'Luke 7:11-17', usfm: 'LUK.7.11-17', context: 'Jesus meets a widow’s funeral procession. This later episode is present in the compressed Season.' },
    giver: {
      name: 'Esther', trade: 'Weaver', supplies: ['flax', 'herbs'],
      lines: ['Blankets have been promised to households that cannot afford them. Gather four bundles of flax for the loom.', 'A bandit from the Hill of Moreh has been stopping people on the road to the town gate. Drive off the {target}.', 'A funeral procession is going out through the town gate, and most of Nain is walking with it. Go with them.'],
      returns: ['Take the four bundles of flax to Esther at her loom.', 'Bring Esther a bundle of wood to mend the bench by the town gate.', 'The neighbors are cooking for the widow and her son. Bring Esther three bunches of herbs for the meal.'],
      finished: ['I can start weaving tonight. The first blanket goes to a family on the lower lane.', 'People from the farms will come in to the gate again. Market day will be busier for it.', 'The whole lane is at the widow’s house tonight. I have never seen Nain like this.'],
      daily: ['Someone in Nain always needs a blanket. Three bundles of flax would make another.', 'Take the three bundles of flax to Esther’s loom.', 'That is one more blanket for someone who needs it.'],
    },
    scene: nainScene, scenes: [nainScene],
  },
  {
    id: 'legio', name: 'Legio', kind: 'settlement', band: 'middle', x: -202, z: -65, radius: 18,
    character: 'A road station near Megiddo on the edge of the Jezreel plain. Pack animals wait by the repair sheds, and the stores face south across the fields.',
    passage: { reference: '2 Kings 23:29-30', usfm: '2KI.23.29-30', context: 'A memory of Josiah at Megiddo. “Legio” follows the supplied game map and is not presented as a first-century naming claim.' },
    giver: {
      name: 'Azariah', trade: 'Cartwright', supplies: ['wood', 'flax'],
      lines: ['The cart that hauls the village’s grain has a broken axle. Bring four bundles of wood for a new one.', 'A wolf has been chasing the pack animals on the southern road, and the carriers will not use it. Drive off the {target}.', 'Travelers wait at the station through the midday heat with no cover. Gather three bundles of flax for an awning.'],
      returns: ['Take the four bundles of wood to Azariah at the repair sheds.', 'Bring Azariah a bundle of wood to fix the hitching rail at the station.', 'Take the three bundles of flax to Azariah for the awning.'],
      finished: ['A new axle and a spare. The grain will go out on time this week.', 'The carriers are back on the southern road. The station is busy again.', 'The awning is up. Travelers can sit out the heat while their carts are mended.'],
      daily: ['Every cart through Legio needs a spoke or a new wheel. Bring three bundles of wood for the sheds.', 'Leave the three bundles of wood with Azariah at the sheds.', 'That will keep the sheds working for a few more days.'],
    },
  },
  {
    id: 'jotapata', name: 'Jotapata', kind: 'settlement', band: 'middle', x: -166, z: -284, radius: 17,
    character: 'A hilltop town reached by a steep approach. Stone retaining walls hold terraced gardens, and rain is caught in cisterns on the roofs.',
    passage: { reference: 'Psalm 121:1-2', usfm: 'PSA.121.1-2', context: 'A psalm recalled on a hill road. It does not locate the psalm’s composition or a Gospel event at Jotapata.' },
    giver: {
      name: 'Shimon', trade: 'Cistern tender', supplies: ['flax', 'wood'],
      lines: ['The ropes used to haul water up to the high gardens are fraying. Gather four bundles of flax to twist new ones.', 'A wolf has been lying in wait on the steep approach where people carry supplies uphill. Chase off the {target}.', 'The steps down into the oldest cistern are slippery and have no rail. Gather three bundles of wood for handrails.'],
      returns: ['Take the four bundles of flax to Shimon at the upper cistern.', 'Bring Shimon a bundle of wood for a bench halfway up the approach.', 'Take the three bundles of wood to Shimon at the old cistern.'],
      finished: ['Good fiber. With new ropes we can water the top terraces before the sun gets high.', 'People can climb with their loads again, and rest halfway if they need to.', 'The rails are in. Children fetch water from that cistern, so I will sleep better tonight.'],
      daily: ['The cistern ropes never last long on these slopes. Gather three bundles of flax for another rope.', 'Carry the three bundles of flax up to Shimon.', 'That is enough for another rope.'],
    },
  },
  {
    id: 'tiberias', name: 'Tiberias', kind: 'settlement', band: 'high', x: 3, z: -237, radius: 18,
    character: 'A lakeside city with a busy harbor. Steam rises from the hot springs south of town, and small boats tie up along stone quays below pale colonnades.',
    passage: { reference: 'John 6:23-24', usfm: 'JHN.6.23-24', context: 'Boats from Tiberias join the movement around the lake. This later passage is remembered within the compressed Season.' },
    giver: {
      name: 'Joatham', trade: 'Harbor steward', supplies: ['wood', 'flax'],
      lines: ['The jetty where small fishing boats tie up has rotten planks. Bring four bundles of wood to repair it.', 'A bandit has been robbing harbor workers on the shoreline track at night. Stop the {target}.', 'The fishermen in the harbor say a storm is building over the lake, and a boat has set out to cross it. Go and witness what happens on the lake.'],
      returns: ['Take the four bundles of wood to Joatham on the quay.', 'Bring Joatham a bundle of wood for the lantern post on the shoreline track.', 'Bring Joatham three bundles of flax for new mooring ropes.'],
      finished: ['The fishermen can land at the small jetty again. The big boats were taking all the room at the main quay.', 'The harbor workers can walk home along the shore again. I will have the lantern lit tonight.', 'After that storm every boat owner in the harbor wants new ropes. These will go to the small boats first.'],
      daily: ['The harbor goes through timber faster than it can be bought. Bring three bundles of wood for the quay.', 'Deliver the three bundles of wood to Joatham at the harbor.', 'That will patch the quay for now.'],
    },
  },
  {
    id: 'magdala', name: 'Magdala', kind: 'settlement', band: 'high', x: -17, z: -301, radius: 17,
    character: 'A fishing town of drying sheds and low stone quays. Fish are salted and packed in baskets here, and farmland opens out toward Gennesaret.',
    passage: { reference: 'Luke 8:1-3', usfm: 'LUK.8.1-3', context: 'The women who support Jesus’ traveling company, including Mary Magdalene. She is with the company, not permanently stationed in this town.' },
    giver: {
      name: 'Dinah', trade: 'Net maker', supplies: ['flax', 'wood'],
      lines: ['Some families here fish without a boat and share one net between them. Gather four bundles of flax to make them another.', 'A bandit has been robbing people on the shore road between the fishing sheds and the Gennesaret fields. Drive off the {target}.', 'A crowd is gathering on the shore at Gennesaret to hear Jesus. Walk along the shore and witness what happens.'],
      returns: ['Take the four bundles of flax to Dinah at the drying sheds.', 'Bring Dinah a bundle of wood to repair the footbridge on the shore road.', 'Bring Dinah three bundles of wood for new frames to dry the nets.'],
      finished: ['This is enough for a full net. The families on the shore can each cast their own now.', 'The carts can take salted fish out to the farms again and bring grain back.', 'The fishermen came back with their nets torn from that catch. These frames will be busy for days.'],
      daily: ['Nets tear every day on this lake. Three bundles of flax would mend a good stretch.', 'Give the three bundles of flax to Dinah.', 'That mends a good stretch of net.'],
    },
  },
  {
    id: 'capernaum', name: 'Capernaum', kind: 'settlement', band: 'high', x: 19, z: -377, radius: 19,
    character: 'A town of dark basalt houses on the northern shore. Courtyards open onto narrow lanes, and fishing boats are pulled up near the gathering place.',
    passage: { reference: 'John 2:12', usfm: 'JHN.2.12', context: 'The brief stay after Cana belongs to the early setting. Other Capernaum scenes are deliberately compressed into the same Season.' },
    giver: {
      name: 'Mattathias', trade: 'Householder', supplies: ['wood', 'flax'],
      lines: ['A neighbor’s roof is sagging, and visitors are expected in the lane. Bring four bundles of wood for new roof beams.', 'A wolf has been coming down to the northern shore road, where households carry food into town. Drive off the {target}.', 'Jesus has come to stay in Capernaum for a few days with his family and his disciples. Go and witness their arrival.'],
      returns: ['Take the four bundles of wood to Mattathias in his courtyard.', 'Bring Mattathias a bundle of wood for the fence along the shore road.', 'Bring Mattathias three bundles of flax to make bedding for the guests in town.'],
      finished: ['The beams will go up tomorrow. That roof will hold for a few more winters now.', 'People are bringing their baskets in by the shore road again. The market will be fuller tomorrow.', 'Every house on this lane has guests this week. The bedding will be used tonight.'],
      daily: ['With so many visitors, there is always a roof or a door to mend. Bring three bundles of wood for repairs.', 'Take the three bundles of wood to Mattathias.', 'That will see us through the next few days of visitors.'],
      visits: {
        'capernaum-roof': ['A house in town is so crowded that no one else can reach the door. Go and witness what happens there.', 'Bring Mattathias a bundle of flax for binding when the opened roof is patched.', 'The roof will be patched by tomorrow. People in the lane are still talking about the man who walked out carrying his mat.'],
      },
    },
    scene: capernaumStay, scenes: [capernaumStay, capernaumRoof],
  },
  {
    id: 'bethsaida', name: 'Bethsaida', kind: 'settlement', band: 'high', x: 83, z: -391, radius: 18,
    character: 'A fishing town of basalt walls near where the Jordan enters the lake. Reed beds line the shore, and baskets are made and mended in the fishing yards.',
    passage: { reference: 'Luke 9:10-17', usfm: 'LUK.9.10-17', context: 'The gathering and feeding near Bethsaida, a later episode present in this Season’s compressed geography.' },
    giver: {
      name: 'Yael', trade: 'Basket maker', supplies: ['flax', 'wood'],
      lines: ['The families gathering outside town have borrowed every basket in Bethsaida. Gather four bundles of flax to weave more.', 'A bandit has been robbing late arrivals on the road from the landing. Drive off the {target}.', 'A large crowd has followed Jesus to the open country near Bethsaida. Go and stand among them as a witness.'],
      returns: ['Take the four bundles of flax to Yael in the fishing yard.', 'Bring Yael a bundle of wood for a fire at the landing to guide late boats.', 'Bring Yael three bundles of wood for frames to stiffen the large baskets.'],
      finished: ['I can have new baskets woven by tomorrow. The fishermen were starting to complain.', 'The landing road is safe again. People coming in after dark can find their way by the fire.', 'Everyone who came back from the hillside is talking about the meal. The big baskets will be needed again soon.'],
      daily: ['Bethsaida’s fishermen wear out baskets quickly. Gather three bundles of flax for new ones.', 'Give the three bundles of flax to Yael.', 'That is enough for two more baskets.'],
    },
    scene: bethsaidaScene, scenes: [bethsaidaScene],
  },
  {
    id: 'gamla', name: 'Gamla', kind: 'settlement', band: 'high', x: 142, z: -332, radius: 18,
    character: 'A town of dark stone houses on a steep ridge, joined by narrow stairways. Olive presses and garden terraces cover the slopes below, looking out over the lake.',
    passage: { reference: 'Psalm 125:1-2', usfm: 'PSA.125.1-2', context: 'Mountain imagery recalled by a traveler. The psalm speaks of Zion; it is not a claim that its events or composition belong to Gamla.' },
    giver: {
      name: 'Reuben', trade: 'Terrace keeper', supplies: ['wood', 'flax'],
      lines: ['A terrace wall that feeds several households is starting to slide. Bring four bundles of wood for braces.', 'A wolf has been seen on the exposed ridge path that workers use on their way home. Chase off the {target}.', 'Baskets are lowered on ropes between the steep garden levels, and the ropes are wearing out. Gather three bundles of flax for new ones.'],
      returns: ['Take the four bundles of wood to Reuben on the terraces.', 'Bring Reuben a bundle of wood for a rail along the ridge path.', 'Take the three bundles of flax to Reuben for the terrace ropes.'],
      finished: ['The braces will hold the wall until we can rebuild it in stone. Those households will keep their garden.', 'The workers can come home along the ridge before dark without fear now.', 'The ropes are strong again. We can send the harvest down without losing any of it over the edge.'],
      daily: ['There is always another terrace wall to brace in Gamla. Bring three bundles of wood for braces.', 'Carry the three bundles of wood out to Reuben on the terraces.', 'That will brace another stretch of wall.'],
    },
  },
  {
    id: 'hippus', name: 'Hippus', kind: 'settlement', band: 'high', x: 124, z: -256, radius: 18,
    character: 'A city of columns and dark stone on an eastern ridge. A long road winds down from the gates to a sheltered landing on the lake.',
    passage: { reference: 'Mark 5:20', usfm: 'MRK.5.20', context: 'The restored man’s account spreads through the Decapolis. This regional connection does not place a new invented Gospel episode in Hippus.' },
    giver: {
      name: 'Petros', trade: 'Landing keeper', supplies: ['wood', 'flax'],
      lines: ['Carriers resting at the foot of the landing road have no shelter from the sun. Bring four bundles of wood to build one.', 'A wolf has been following people down the eastern descent with their market goods. Drive off the {target}.', 'The town carriers and the boat crews share the same ropes, and there are never enough. Gather three bundles of flax for more.'],
      returns: ['Take the four bundles of wood to Petros at the landing.', 'Bring Petros a bundle of wood for a hitching post at the landing.', 'Take the three bundles of flax to Petros for the shared ropes.'],
      finished: ['The shelter will be up by the end of the week. The carriers have waited a long time for it.', 'The carriers will be glad of it. The descent was hard enough without a wolf on it.', 'Now the boat crews and the carriers can stop arguing over the ropes.'],
      daily: ['The landing goes through timber all season. Bring three bundles of wood for repairs.', 'Take the three bundles of wood down to Petros at the landing.', 'That will keep the landing in repair a little longer.'],
    },
  },
  {
    id: 'jordan', name: 'Jordan', kind: 'wilderness', band: 'low', ...LOW_BAND_PLACES.jordan,
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

export const regionBounds = { minX: -270, maxX: 280, minZ: -426, maxZ: 260 }
