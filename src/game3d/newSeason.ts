// The one way to start a new Season over a saved one: ask first, and back up the saved Season before replacing it.
// Settings and the start screen both draw this control. Its confirm button calls main.ts's single restart path,
// which takes a verified backup through `restartGameSave` before it writes anything.
import { button, description, node } from './panelFrame.ts'

/**
 * A button that asks before starting again. Pressing it replaces it with the confirmation, and focus moves to
 * "Keep this Season", so Enter or A on the next press keeps the save. `keep` redraws whatever drew the button.
 */
export function newSeasonControl(label: string, className: string, confirm: () => void, keep: () => void): HTMLButtonElement {
  const trigger = button(label, () => {
    const confirmation = node('div', 'restart-confirmation')
    const keepSeason = button('Keep this Season', keep, 'text-button')
    confirmation.append(description('Start again at Aenon? Your current saved Season will be backed up first.'), button('Back up & start again', confirm, 'game-button danger'), keepSeason)
    trigger.replaceWith(confirmation)
    keepSeason.focus()
  }, className)
  return trigger
}
