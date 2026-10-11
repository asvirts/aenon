import * as Phaser from "phaser"

/** The world owns movement and rules; the interface only reads this surface. */
type GameSurface = Phaser.Scene & {
  player: { x: number; y: number }
  wolf?: { x: number; y: number }
  characterLines(): string[]
  messageLine: string
}

const INK = 0x202b28
const GOLD = 0xb6a579
const PAPER = "#eee8d6"
const MUTED = "#b6bbaa"
const SANS = "Arial, Helvetica, sans-serif"
const SERIF = "Georgia, Times New Roman, serif"

/** A quiet, screen-fixed field journal around the playable world. */
export class UIScene extends Phaser.Scene {
  private characterPanel!: Phaser.GameObjects.Container
  private characterPlate!: Phaser.GameObjects.Graphics
  private characterBody!: Phaser.GameObjects.Container
  private characterFooter!: Phaser.GameObjects.Text
  private characterHeight = 480
  private characterOpen = false
  private journalPanel!: Phaser.GameObjects.Container
  private journalPlate!: Phaser.GameObjects.Graphics
  private journalBody!: Phaser.GameObjects.Container
  private journalFooter!: Phaser.GameObjects.Text
  private journalHeight = 480
  private journalOpen = false
  private message!: Phaser.GameObjects.Text
  private bannerTitle!: Phaser.GameObjects.Text
  private bannerSub!: Phaser.GameObjects.Text
  private minimapPlayer!: Phaser.GameObjects.Arc
  private minimapWolf!: Phaser.GameObjects.Arc
  private pendingCharacter: { lines: string[]; open: boolean } | null = null
  private pendingJournal: { lines: string[]; open: boolean } | null = null
  private pendingMessage: string | null = null
  private pendingBanner: { title: string; sub: string } | null = null

  private static readonly panelX = 22
  private static readonly panelY = 18
  private static readonly panelW = 370
  private static readonly journalX = 568
  private static readonly maxPanelH = 494
  private static readonly mapX = 792
  private static readonly mapY = 47
  private static readonly mapScale = 0.043

  constructor() { super("ui") }

  private gameScene(): GameSurface | null {
    try {
      const scene = this.scene.get("aenon") as GameSurface | null
      return scene?.player ? scene : null
    } catch { return null }
  }

  private minimapXY(x: number, y: number): { x: number; y: number } {
    return { x: UIScene.mapX + x * UIScene.mapScale, y: UIScene.mapY + y * UIScene.mapScale }
  }

  create(): void {
    const location = this.add.graphics().setDepth(20)
    location.fillStyle(INK, 0.94)
    location.fillRoundedRect(22, 18, 264, 90, 4)
    location.lineStyle(1, GOLD, 0.46)
    location.strokeRoundedRect(22, 18, 264, 90, 4)
    location.lineStyle(2, GOLD, 0.9)
    location.lineBetween(38, 33, 60, 33)
    this.add.text(68, 27, "THE SEASON", {
      fontFamily: SANS, fontSize: "9px", color: "#c1b78f", letterSpacing: 2,
    }).setDepth(21)
    this.bannerTitle = this.add.text(38, 43, "Aenon", {
      fontFamily: SERIF, fontSize: "27px", color: PAPER,
    }).setDepth(21)
    this.bannerSub = this.add.text(39, 80, "Where John is baptizing", {
      fontFamily: SANS, fontSize: "10px", color: MUTED, wordWrap: { width: 230 },
    }).setDepth(21)

    const status = this.add.graphics().setDepth(20)
    status.fillStyle(INK, 0.96)
    status.fillRoundedRect(22, 522, 916, 59, 4)
    status.lineStyle(1, GOLD, 0.46)
    status.strokeRoundedRect(22, 522, 916, 59, 4)
    status.lineStyle(1, GOLD, 0.2)
    status.lineBetween(38, 553, 922, 553)
    this.message = this.add.text(39, 531, "", {
      fontFamily: SANS, fontSize: "11px", color: PAPER,
      wordWrap: { width: 881 }, lineSpacing: 1,
    }).setDepth(21)
    const hints: Array<[string, string, number]> = [
      ["W A S D", "Move", 39], ["C", "Character", 144], ["J", "Journal", 244],
      ["G", "Gather", 334], ["R", "Read", 424], ["T", "Talk", 503],
      ["B", "Trade", 583], ["F", "Face", 663], ["SPACE", "Swing", 743], ["H", "Hunt", 861],
    ]
    for (const [key, action, x] of hints) {
      const width = key.length > 1 ? key.length * 5.5 + 12 : 18
      status.fillStyle(0x3f4940, 0.8)
      status.fillRoundedRect(x, 560, width, 14, 2)
      this.add.text(x + width / 2, 567, key, {
        fontFamily: SANS, fontSize: "8px", color: "#ded6bc",
      }).setOrigin(0.5).setDepth(21)
      this.add.text(x + width + 6, 561, action, {
        fontFamily: SANS, fontSize: "10px", color: MUTED,
      }).setDepth(21)
    }
    this.createMinimap()
    this.createCharacterPanel()
    this.createJournalPanel()

    const game = this.gameScene()
    const pendingCharacter = this.pendingCharacter
    const pendingJournal = this.pendingJournal
    const pendingMessage = this.pendingMessage
    const pendingBanner = this.pendingBanner
    if (pendingCharacter) {
      this.characterOpen = pendingCharacter.open
      this.setCharacterLines(pendingCharacter.lines)
    } else if (game) { this.setCharacterLines(game.characterLines()) }
    if (pendingJournal) {
      this.journalOpen = pendingJournal.open
      this.setJournalLines(pendingJournal.lines)
    }
    this.say(pendingMessage ?? game?.messageLine ?? "")
    if (pendingBanner) this.showBanner(pendingBanner.title, pendingBanner.sub)

    const sharpenText = (object: Phaser.GameObjects.GameObject): void => {
      if (object instanceof Phaser.GameObjects.Text) object.setResolution(2)
      if (object instanceof Phaser.GameObjects.Container) {
        for (const child of object.list) sharpenText(child)
      }
    }
    for (const object of this.children.list) sharpenText(object)
  }

  private createMinimap(): void {
    const map = this.add.graphics().setDepth(20)
    map.fillStyle(INK, 0.95)
    map.fillRoundedRect(780, 18, 158, 125, 4)
    map.lineStyle(1, GOLD, 0.46)
    map.strokeRoundedRect(780, 18, 158, 125, 4)
    this.add.text(792, 28, "THE JORDAN VALLEY", {
      fontFamily: SANS, fontSize: "8px", color: "#c1b78f", letterSpacing: 0.8,
    }).setDepth(21)
    map.fillStyle(0x59634b, 0.7)
    map.fillRect(792, 47, 69, 86)
    map.fillStyle(0x454f40, 0.8)
    map.fillRect(861, 47, 69, 86)
    map.lineStyle(4, 0x679591, 0.75)
    map.lineBetween(862, 47, 862, 133)
    map.lineStyle(1, 0xc2b28a, 0.45)
    map.lineBetween(808, 119, 838, 80)
    map.lineBetween(838, 80, 903, 84)
    const landmarks: Array<[number, number]> = [[1050, 700], [420, 1270], [1470, 950], [852, 1460], [2500, 700]]
    for (const [x, y] of landmarks) {
      const at = this.minimapXY(x, y)
      this.add.rectangle(at.x, at.y, 3, 3, 0xc3b991).setAngle(45).setDepth(21)
    }
    this.minimapPlayer = this.add.circle(0, 0, 2.8, 0xfff4d1).setStrokeStyle(1.3, 0x29392f).setDepth(23)
    this.minimapWolf = this.add.circle(0, 0, 1.8, 0xb47964).setDepth(22)
  }

  private createCharacterPanel(): void {
    this.characterPlate = this.add.graphics()
    this.characterBody = this.add.container(20, 60)
    const title = this.add.text(20, 16, "The Adventurer", {
      fontFamily: SERIF, fontSize: "25px", color: PAPER,
    })
    this.characterFooter = this.add.text(20, 460, "C  Close character", {
      fontFamily: SANS, fontSize: "10px", color: MUTED,
    })
    this.characterPanel = this.add.container(UIScene.panelX, UIScene.panelY, [
      this.characterPlate, title, this.characterBody, this.characterFooter,
    ]).setDepth(70).setVisible(false)
  }

  private createJournalPanel(): void {
    this.journalPlate = this.add.graphics()
    this.journalBody = this.add.container(20, 60)
    const title = this.add.text(20, 16, "Field Journal", {
      fontFamily: SERIF, fontSize: "25px", color: PAPER,
    })
    this.journalFooter = this.add.text(20, 460, "J  Close journal", {
      fontFamily: SANS, fontSize: "10px", color: MUTED,
    })
    this.journalPanel = this.add.container(UIScene.journalX, UIScene.panelY, [
      this.journalPlate, title, this.journalBody, this.journalFooter,
    ]).setDepth(70).setVisible(false)
  }

  setCharacterLines(lines: string[]): void {
    if (!this.characterBody) {
      this.pendingCharacter = { lines: [...lines], open: this.characterOpen }
      return
    }
    this.pendingCharacter = null
    const bodyLines = lines.flatMap((line) => line.split("\n"))
    if (bodyLines[0] === "Character") bodyLines.shift()
    if (bodyLines[bodyLines.length - 1] === "C closes") bodyLines.pop()
    while (bodyLines[0] === "") bodyLines.shift()
    while (bodyLines[bodyLines.length - 1] === "") bodyLines.pop()
    this.characterHeight = this.fitPanel(bodyLines, this.characterBody, this.characterPlate, this.characterFooter)
    this.characterPanel.setVisible(this.characterOpen)
  }

  setJournalLines(lines: string[]): void {
    if (!this.journalBody) {
      this.pendingJournal = { lines: [...lines], open: this.journalOpen }
      return
    }
    this.pendingJournal = null
    const bodyLines = lines.flatMap((line) => line.split("\n"))
    if (bodyLines[0] === "Journal") bodyLines.shift()
    if (bodyLines[bodyLines.length - 1] === "J closes") bodyLines.pop()
    while (bodyLines[0] === "") bodyLines.shift()
    while (bodyLines[bodyLines.length - 1] === "") bodyLines.pop()
    this.journalHeight = this.fitPanel(bodyLines, this.journalBody, this.journalPlate, this.journalFooter)
    this.journalPanel.setVisible(this.journalOpen)
  }

  toggleJournal(lines: string[]): void {
    this.journalOpen = !this.journalOpen
    this.setJournalLines(lines)
  }

  journalCovers(x: number, y: number): boolean {
    if (!this.journalOpen) return false
    const { journalX, panelY, panelW } = UIScene
    return x >= journalX && y >= panelY && x <= journalX + panelW && y <= panelY + this.journalHeight
  }

  private fitPanel(
    lines: string[], body: Phaser.GameObjects.Container,
    plate: Phaser.GameObjects.Graphics, footer: Phaser.GameObjects.Text,
  ): number {
    // Measure wrapped content so the journal and footer remain on screen.
    let fontSize = 12
    let height = this.layoutPanelLines(lines, fontSize, body)
    const availableHeight = UIScene.maxPanelH - 104
    while (height > availableHeight && fontSize > 5) {
      fontSize -= 0.5
      height = this.layoutPanelLines(lines, fontSize, body)
    }
    if (height > availableHeight) {
      body.setScale(availableHeight / height)
      height = availableHeight
    }
    const panelHeight = Math.max(220, height + 104)
    footer.setY(panelHeight - 25)
    plate.clear()
    plate.fillStyle(INK, 0.98)
    plate.fillRoundedRect(0, 0, UIScene.panelW, panelHeight, 4)
    plate.lineStyle(1, GOLD, 0.7)
    plate.strokeRoundedRect(0, 0, UIScene.panelW, panelHeight, 4)
    plate.lineStyle(1, GOLD, 0.3)
    plate.lineBetween(20, 50, UIScene.panelW - 20, 50)
    plate.lineBetween(20, panelHeight - 34, UIScene.panelW - 20, panelHeight - 34)
    return panelHeight
  }

  private layoutPanelLines(lines: string[], fontSize: number, body: Phaser.GameObjects.Container): number {
    body.removeAll(true)
    body.setScale(1)
    let y = 0
    for (const line of lines) {
      if (!line) { y += fontSize * 0.48; continue }
      const field = /^(.*?) {2,}(.*)$/.exec(line)
      const isHeading = ["Journal", "Next", "Quests", "Passages"].includes(line)
      const label = this.add.text(0, y, field?.[1] ?? line, {
        fontFamily: SANS, fontSize: `${isHeading ? fontSize - 1 : fontSize}px`,
        fontStyle: isHeading ? "bold" : "normal",
        color: isHeading ? "#c1b78f" : field ? MUTED : PAPER,
        wordWrap: { width: field ? 168 : UIScene.panelW - 40 }, lineSpacing: 1,
      }).setResolution(2)
      body.add(label)
      let rowHeight = label.height
      if (field) {
        const value = this.add.text(184, y, field[2], {
          fontFamily: SANS, fontSize: `${fontSize}px`, color: PAPER,
          wordWrap: { width: UIScene.panelW - 224 }, lineSpacing: 1,
        }).setResolution(2)
        body.add(value)
        rowHeight = Math.max(rowHeight, value.height)
      }
      y += rowHeight + 2
    }
    return y
  }

  toggleCharacter(lines: string[]): void {
    this.characterOpen = !this.characterOpen
    this.setCharacterLines(lines)
  }

  characterCovers(x: number, y: number): boolean {
    if (!this.characterOpen) return false
    const { panelX, panelY, panelW } = UIScene
    return x >= panelX && y >= panelY && x <= panelX + panelW && y <= panelY + this.characterHeight
  }

  interfaceCovers(x: number, y: number): boolean {
    if (this.characterCovers(x, y) || this.journalCovers(x, y)) return true
    return (
      (x >= 22 && x <= 286 && y >= 18 && y <= 108) ||
      (x >= 780 && x <= 938 && y >= 18 && y <= 143) ||
      (x >= 22 && x <= 938 && y >= 522 && y <= 581)
    )
  }

  say(line: string): void {
    if (!this.message) { this.pendingMessage = line; return }
    this.pendingMessage = null
    this.message.setFontSize(11).setText(line)
    if (this.message.height > 19) this.message.setFontSize(9)
  }

  showBanner(title: string, sub: string): void {
    if (!this.bannerTitle) { this.pendingBanner = { title, sub }; return }
    this.pendingBanner = null
    this.bannerTitle.setText(title)
    this.bannerSub.setText(sub.charAt(0).toUpperCase() + sub.slice(1))
    for (const text of [this.bannerTitle, this.bannerSub]) {
      this.tweens.killTweensOf(text)
      text.setAlpha(0)
    }
    this.tweens.add({ targets: [this.bannerTitle, this.bannerSub], alpha: 1, duration: 420, ease: "quad.out" })
  }

  override update(): void {
    const game = this.gameScene()
    if (!game || !this.minimapPlayer) return
    const player = this.minimapXY(game.player.x, game.player.y)
    this.minimapPlayer.setPosition(player.x, player.y)
    this.minimapWolf.setVisible(Boolean(game.wolf))
    if (game.wolf) {
      const wolf = this.minimapXY(game.wolf.x, game.wolf.y)
      this.minimapWolf.setPosition(wolf.x, wolf.y)
    }
  }
}
