import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createGame } from "../../src/season/realtime.ts"
import { canTraverseRegion, findRegionPath } from "../../src/game3d/regionNavigation.ts"
import { curves, definition, layout, navigation } from "../../src/game3d/content.ts"
import type { Game, GameOptions } from "../../src/game3d/types.ts"

const options: GameOptions = { definition, curves, layout,
  pathfind: (start, goal) => findRegionPath(start, goal, navigation),
  canTraverse: (start, goal) => canTraverseRegion(start, goal, navigation), random: () => 0,
}
function visit(game: Game, id: string) {
  game.interact(id)
  for (let seconds = 0; !game.snapshot().paused && seconds < 30; seconds += 0.1) game.advance(0.1)
  assert.ok(game.snapshot().paused, `Expected to reach ${id}`)
}

describe("a townsperson's quests in the real-time game", () => {
  it("shows each quest's standing and starts the quest the Adventurer chooses", () => {
    const game = createGame(options)
    visit(game, "potter")
    assert.deepEqual(game.quests("potter").map(quest => [quest.questId, quest.standing]), [
      ["wood-for-the-hearth", "available"],
      ["safe-river-path", "locked"],
      ["beside-the-water", "locked"],
      ["aenon-common-work", "locked"],
      ["aenon-open-roads", "locked"],
      ["aenon-neighborly-care", "locked"],
      ["aenon-daily-provisions", "locked"],
    ])

    assert.deepEqual(game.act({ type: "speak", id: "potter", questId: "safe-river-path" }), { ok: false, reason: "not-offered" })
    const started = game.act({ type: "speak", id: "potter", questId: "wood-for-the-hearth" })
    assert.equal(started.ok, true, JSON.stringify(started))
    assert.equal(started.questId, "wood-for-the-hearth")
    assert.equal(game.quests("potter")[0]?.standing, "active")
  })

  it("shows no quests for a townsperson in another place", () => {
    const game = createGame(options)
    assert.deepEqual(game.quests("salim-neighbor"), [])
  })
})
