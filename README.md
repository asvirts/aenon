# Aenon

A single-player game set in the Galilee and Jordan during one season of Jesus' ministry, about 27–29 AD. The Adventurer starts in Aenon.

## Host

TypeScript in the browser.

- Phaser draws the isometric pixel world. Movement is click-to-walk or WASD.
- A React page around that canvas uses the YouVersion React SDK to show an NIV passage and that version's copyright beside it.
- A small Node server holds the YouVersion App Key and is the only caller of the Platform.
- The save is the rules module's exported state in that browser.

The Season's rules are specified in [Season rules on the logic surface](https://github.com/asvirts/aenon/issues/15). The map of decisions is [Aenon region spec](https://github.com/asvirts/aenon/issues/1). Domain language is in `GLOSSARY.md`.

## Rules module

- `src/season/` — pure Season logic, no engine deps. `loadSeason(definition, curve, state?)` returns the playable Season; `exportState()` is the save.
- `tests/season/` — one behavior-first test per Season moment.

### Verify

```sh
npm test          # behavior tests
npm run typecheck # tsc --noEmit
```

## Run the game (browser MVP)

Vite + Phaser canvas wired to the rules module, with a demo Aenon + Jordan
definition in `src/host/demoDefinition.ts`. The save is the exported Season
state in `localStorage`. The passage panel loads live text + copyright from
`src/server/passageServer.ts`, the only YouVersion caller; the App Key lives
in local `.env` (see `.env.example`), never in git or the client bundle.

```sh
npm run server  # passage API on http://localhost:5174 (needs YVP_APP_KEY)
npm run dev     # play at http://localhost:5173
npm run build   # production bundle in dist/
```

Walk with click-to-move or WASD across the midpoint to travel between Aenon
and the Jordan. Keys: `G` gather · `F` face wolf · `SPACE` swing · `H` hunt ·
`R` read · `J`/`T` look at / speak to John · `B` buy rope.
