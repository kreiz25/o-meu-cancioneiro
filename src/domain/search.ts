import type { Song } from '../types'

export function songMatchesQuery(song: Song, query: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return true

  const lyricsAndChords = song.document.sections.flatMap(section =>
    section.lines.flatMap(line => line.events.map(event => {
      if (event.kind === 'text') return event.value
      if (event.kind === 'chord') return event.symbol
      return event.value
    }))
  ).join(' ')

  const searchable = normalize([
    song.title,
    song.subtitle,
    song.artist,
    ...(song.tags ?? []),
    lyricsAndChords,
  ].join(' '))

  return terms.every(term => searchable.includes(term))
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('gl')
}
