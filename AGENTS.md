## Host

The Season is a TypeScript browser game. Babylon.js draws the original 3D world at the root route through `src/game3d/main.ts`. The camera follows the Adventurer at a constant isometric-style angle. `src/season/realtime.ts` owns the browser-independent simulation; DOM panels provide Gear, journals, trade, crafting, settings, and live NIV passages. A small Node server holds the YouVersion App Key. Versioned saves live in the browser, with earlier saves retained for recovery. The previous Phaser host remains in `src/host/` as source, and `/art-sample.html` retains the separate art study.

The rules module is specified in [Season rules on the logic surface](https://github.com/asvirts/aenon/issues/15). The decision map is [Aenon region spec](https://github.com/asvirts/aenon/issues/1). The rules module lives in `src/season/`. Accepted 3D and real-time changes are recorded in `docs/design/3d-redesign.md` and ADRs 0015–0023. Verify with `npm test`, `npm run typecheck`, and `npm run build`, then check the actual game in the Codex in-app browser.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Asking the user

Always ask the user questions one at a time with the AskUserQuestion tool. Send one question per tool call, never several in one call or in plain text, and wait for the answer before asking the next. Each answer can change the questions that follow.
