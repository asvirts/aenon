import * as Phaser from "phaser"
import { loadSeason, type Season } from "../season/index.ts"
import { demoCurve, demoDefinition } from "./demoDefinition.ts"

const SAVE_KEY = "aenon-season-save-v1"
const WORLD_TOP = 150
const MID_X = 480
const SPEED = 240

/** Scripture object id -> USFM passage id for the passage server. */
const SCRIPTURE_USFM: Record<string, string> = { reeds: "JHN.1.29" }

function readSavedState(): unknown {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return undefined
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

function bootSeason(): Season | { error: string } {
  const saved = readSavedState()
  // The save is the rules module's exported state; anything else starts fresh.
  const loaded =
    saved !== undefined && typeof saved === "object" && saved !== null
      ? loadSeason(demoDefinition, demoCurve, saved as never)
      : loadSeason(demoDefinition, demoCurve)
  if (!loaded.ok) return { error: loaded.reason }
  return loaded.season
}

function passageNode(): HTMLElement | null {
  return window.document.getElementById("passage")
}

function showNotice(title: string, body: string): void {
  const node = passageNode()
  if (!node) return
  node.replaceChildren()
  const heading = window.document.createElement("h2")
  heading.textContent = title
  const text = window.document.createElement("p")
  text.textContent = body
  node.append(heading, text)
}

/**
 * Renders licensed passage HTML fetched from our own passage server
 * (the only YouVersion caller) with the version copyright beside it.
 * The HTML comes from the Platform API via our server, not from player
 * input, so it is rendered as markup rather than text.
 */
function showLivePassage(reference: string, html: string, copyright: string): void {
  const node = passageNode()
  if (!node) return
  node.replaceChildren()
  const heading = window.document.createElement("h2")
  heading.textContent = reference
  const passage = window.document.createElement("div")
  passage.innerHTML = html
  node.append(heading, passage)
  if (copyright) {
    const aside = window.document.createElement("p")
    aside.textContent = copyright
    node.append(aside)
  }
}

async function loadLivePassage(usfm: string): Promise<void> {
  try {
    const response = await fetch(`/api/passage?usfm=${encodeURIComponent(usfm)}`)
    const body = (await response.json()) as {
      reference?: string
      html?: string
      version?: { copyright?: string }
      error?: string
    }
    if (!response.ok || typeof body.html !== "string") {
      showNotice("Passage unavailable", body.error ?? "The passage server could not be reached.")
      return
    }
    showLivePassage(body.reference ?? usfm, body.html, body.version?.copyright ?? "")
  } catch {
    showNotice("Passage unavailable", "The passage server could not be reached.")
  }
}

class AenonScene extends Phaser.Scene {
  private season!: Season
  private player!: Phaser.GameObjects.Rectangle
  private target: { x: number; y: number } | null = null
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private hud!: Phaser.GameObjects.Text
  private message!: Phaser.GameObjects.Text
  private hereId = "aenon"

  constructor() {
    super("aenon")
  }

  create(): void {
    const booted = bootSeason()
    if ("error" in booted) {
      this.add.text(24, 24, `Season failed to load: ${booted.error}`, { color: "#ff8080" })
      return
    }
    this.season = booted
    this.hereId = this.season.adventurer().placeId

    // World: Aenon settlement (west) and the Jordan wilderness (east).
    this.add.rectangle(MID_X, 375, 960, 450, 0x1d3a24).setOrigin(0.5)
    this.add.rectangle(240, 375, 440, 410, 0x8a734f).setStrokeStyle(2, 0x5d4c33)
    this.add.rectangle(720, 375, 440, 410, 0x274156).setStrokeStyle(2, 0x18293a)
    this.add.text(40, 170, "Aenon — settlement", { color: "#f5eeda" })
    this.add.text(560, 170, "The Jordan — wilderness", { color: "#dceef5" })
    this.add.text(40, 196, "timber-stand · John · merchant", { color: "#cbbf9f", fontSize: "13px" })
    this.add.text(560, 196, "wolf · cache pool (none yet)", { color: "#a9c6d4", fontSize: "13px" })

    const start = this.hereId === "jordan" ? { x: 720, y: 400 } : { x: 240, y: 400 }
    this.player = this.add.rectangle(start.x, start.y, 22, 22, 0xf2c14e).setStrokeStyle(2, 0x7a5b17)

    this.hud = this.add.text(16, 12, "", { color: "#ffffff", fontSize: "14px", lineSpacing: 4 })
    this.message = this.add.text(16, 560, "Click to walk, or WASD. E is handled by walking across.", {
      color: "#ffe9a8",
      fontSize: "14px",
    })
    this.add.text(
      16,
      96,
      "G gather · F face wolf · SPACE swing · H hunt · R read reeds · J look John · T speak John · B buy rope",
      { color: "#9fb4c7", fontSize: "13px" },
    )

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > WORLD_TOP) this.target = { x: pointer.x, y: pointer.y }
    })

    const keyboard = this.input.keyboard
    if (keyboard) {
      this.keys = keyboard.addKeys(
        "W,A,S,D,UP,DOWN,LEFT,RIGHT,G,F,H,R,J,T,B,SPACE",
      ) as Record<string, Phaser.Input.Keyboard.Key>
      keyboard.on("keydown-G", () => this.doGather())
      keyboard.on("keydown-F", () => this.doFace())
      keyboard.on("keydown-SPACE", () => this.doSwing())
      keyboard.on("keydown-H", () => this.doHunt())
      keyboard.on("keydown-R", () => this.doRead())
      keyboard.on("keydown-J", () => this.doLookJohn())
      keyboard.on("keydown-T", () => this.doSpeakJohn())
      keyboard.on("keydown-B", () => this.doBuyRope())
    }

    showNotice(
      "Passage panel",
      "Read the reeds at Aenon (R) to file John 1:29. The text + copyright load live from the passage server.",
    )
    this.refreshHud()
    this.say(`You wake in ${this.hereId === "jordan" ? "the Jordan." : "Aenon, where John is baptizing."}`)
  }

  override update(_time: number, delta: number): void {
    if (!this.player || !this.keys) return
    const step = (SPEED * delta) / 1000
    let dx = 0
    let dy = 0
    if (this.keys["A"]?.isDown || this.keys["LEFT"]?.isDown) dx -= 1
    if (this.keys["D"]?.isDown || this.keys["RIGHT"]?.isDown) dx += 1
    if (this.keys["W"]?.isDown || this.keys["UP"]?.isDown) dy -= 1
    if (this.keys["S"]?.isDown || this.keys["DOWN"]?.isDown) dy += 1
    if (dx !== 0 || dy !== 0) {
      this.target = null
      const length = Math.hypot(dx, dy)
      this.player.x = Phaser.Math.Clamp(this.player.x + (dx / length) * step, 12, 948)
      this.player.y = Phaser.Math.Clamp(this.player.y + (dy / length) * step, WORLD_TOP + 12, 588)
      this.syncPlace()
      return
    }
    if (this.target) {
      const dxT = this.target.x - this.player.x
      const dyT = this.target.y - this.player.y
      const distance = Math.hypot(dxT, dyT)
      if (distance <= step) {
        this.player.x = this.target.x
        this.player.y = this.target.y
        this.target = null
      } else {
        this.player.x += (dxT / distance) * step
        this.player.y += (dyT / distance) * step
      }
      this.syncPlace()
    }
  }

  private placeAt(x: number): string {
    return x < MID_X ? "aenon" : "jordan"
  }

  private syncPlace(): void {
    const placeId = this.placeAt(this.player.x)
    if (placeId === this.hereId) return
    const entered = this.season.enter(placeId)
    if (entered.ok && "acquaintance" in entered && entered.acquaintance) {
      this.say("On the road you meet Jesus and the traveling company: one encouraging line.")
    } else if (entered.ok && "scene" in entered && entered.scene) {
      this.say("A set scene is waiting here.")
    } else if (entered.ok) {
      this.say(placeId === "aenon" ? "You enter Aenon." : "You wade into the Jordan wilderness.")
    } else {
      this.say(`The way is shut: ${entered.reason}.`)
      return
    }
    this.hereId = placeId
    this.persist()
    this.refreshHud()
  }

  private refreshHud(): void {
    const me = this.season.adventurer()
    const worn = me.worn.weapon ?? "bare hands"
    this.hud.setText(
      [
        `Aenon MVP — ${me.placeId} · Adventurer ${me.adventurerLevel} · Hitpoints ${me.currentHitpoints}/${me.combatLevels.Hitpoints} · coin ${me.coin}`,
        `pack ${me.pack.length} · wielding ${worn} · Woodcutting ${me.trainedSkills.Woodcutting.level} · Scripture ${me.trainedSkills.Scripture.level}`,
        `journal: ${me.questJournal.length === 0 ? "no quests yet" : me.questJournal.map((entry) => entry.line).join(" / ")}`,
      ].join("\n"),
    )
  }

  private say(line: string): void {
    this.message.setText(line)
  }

  private persist(): void {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.season.exportState()))
    } catch {
      // A full or blocked store must not break the Season.
    }
  }

  private afterAction(ok: boolean, reason: string, good: string): void {
    if (ok) {
      this.persist()
      this.refreshHud()
      this.say(good)
    } else {
      this.say(`Nothing happens (${reason}).`)
    }
  }

  private doGather(): void {
    const result = this.season.gather("timber-stand")
    this.afterAction(result.ok, result.ok ? "" : result.reason, "You cut wood at the timber-stand.")
  }

  private doFace(): void {
    const result = this.season.face("wolf")
    this.afterAction(result.ok, result.ok ? "" : result.reason, "A wolf of the Jordan faces you.")
  }

  private doSwing(): void {
    const result = this.season.swing(() => 2)
    if (!result.ok) {
      this.say(`Nothing happens (${result.reason}).`)
      return
    }
    this.persist()
    this.refreshHud()
    this.say(result.hostileFell ? "The wolf falls. Press H to hunt it." : "You swing at the wolf.")
  }

  private doHunt(): void {
    const result = this.season.hunt()
    this.afterAction(result.ok, result.ok ? "" : result.reason, "You hunt the fallen wolf for meat, hide, and bone.")
  }

  private doRead(): void {
    const result = this.season.read("reeds")
    if (!result.ok) {
      this.say(`Nothing happens (${result.reason}).`)
      return
    }
    this.persist()
    this.refreshHud()
    const usfm = SCRIPTURE_USFM["reeds"] ?? "JHN.1.29"
    void loadLivePassage(usfm)
    this.say("You read at the reeds; the passage is filed in the reference journal.")
  }

  private doLookJohn(): void {
    const result = this.season.look("john")
    if (!result.ok) {
      this.say(`Nothing happens (${result.reason}).`)
      return
    }
    this.say("John stands at Aenon, baptizing. (Look: presence confirmed.)")
  }

  private doSpeakJohn(): void {
    const result = this.season.speak("john")
    if (!result.ok) {
      this.say(`Nothing happens (${result.reason}).`)
      return
    }
    this.say("John answers with a short word and stays at Aenon.")
  }

  private doBuyRope(): void {
    const result = this.season.buy("merchant", { kind: "everyday", id: "rope" })
    this.afterAction(result.ok, result.ok ? "" : result.reason, "You buy rope from the merchant.")
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 600,
  backgroundColor: "#101820",
  scene: [AenonScene],
})
