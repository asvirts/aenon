// The credits list, drawn the same way from Settings and from the start screen.
import { creditGroups } from './credits.ts'
import { description, heading, node } from './panelFrame.ts'

export const creditsIntro = 'The artists and open-source projects behind The Season.'

/** Each category's heading, then its entries with links to the source, the author and the licence. */
export function creditsList(): HTMLElement[] {
  const link = (label: string, href: string): HTMLAnchorElement => {
    const element = node('a', '', label)
    element.href = href; element.target = '_blank'; element.rel = 'noopener noreferrer'
    return element
  }
  const elements: HTMLElement[] = []
  for (const [category, entries] of creditGroups()) {
    elements.push(heading(category))
    for (const entry of entries) {
      const article = node('article', 'credit-entry')
      const title = node('h4'); title.append(link(entry.title, entry.source))
      const byline = node('p', 'small-note')
      byline.append('By ', entry.authorUrl ? link(entry.author, entry.authorUrl) : entry.author, ' · ', link(entry.license === 'original' ? 'Original work' : entry.license, entry.licenseUrl))
      article.append(title, byline)
      if (entry.attribution) article.append(description(entry.attribution, 'credit-attribution'))
      article.append(description(entry.changes, 'small-note'))
      if (entry.notes) article.append(description(entry.notes, 'small-note'))
      if (entry.ai) {
        const details = description(`Created with ${entry.ai.tool} (${entry.ai.plan}). `, 'small-note')
        details.append(link('Tool terms', entry.ai.termsUrl))
        article.append(details, description(`Prompt: ${entry.ai.prompt}`, 'small-note'))
      }
      elements.push(article)
    }
  }
  return elements
}
