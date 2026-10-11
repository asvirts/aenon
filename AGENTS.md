## Host

The Season is a TypeScript browser game. Phaser draws the top-down world. A React page uses the YouVersion React SDK for the passage panel. A small Node server holds the App Key. The save lives in that browser.

The rules module is specified in [Season rules on the logic surface](https://github.com/asvirts/aenon/issues/15). The decision map is [Aenon region spec](https://github.com/asvirts/aenon/issues/1). The rules module lives in `src/season/`; verify with `npm test` and `npm run typecheck`.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
