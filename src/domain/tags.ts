import type { Song } from '../types'

export const STANDARD_TAG_GROUPS = [
  { title: 'Tempos litúrxicos', tags: ['Advento', 'Coresma', 'Pascua', 'Nadal'] },
  { title: 'Partes da misa', tags: ['Entrada', 'Salmo interleccional', 'Aleluia', 'Gloria', 'Ofertorio', 'Santo', 'Pai Noso', 'Paz', 'Comuñón', 'Agnus Dei', 'Saída'] }
] as const

export const STANDARD_TAGS = STANDARD_TAG_GROUPS.flatMap(group => [...group.tags])

export function normalizeTag(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('gl')
}

export function cleanTags(values: string[] | undefined): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values ?? []) {
    const tag = value.trim().replace(/\s+/g, ' ')
    const key = normalizeTag(tag)
    if (key && !seen.has(key)) { seen.add(key); result.push(tag) }
  }
  return result
}

export function collectTags(songs: Song[]): string[] {
  const custom = cleanTags(songs.flatMap(song => song.tags ?? []))
  const known = new Map(custom.map(tag => [normalizeTag(tag), tag]))
  return [
    ...STANDARD_TAGS,
    ...custom.filter(tag => !STANDARD_TAGS.some(standard => normalizeTag(standard) === normalizeTag(tag)))
      .sort((a, b) => a.localeCompare(b, 'gl'))
  ].map(tag => known.get(normalizeTag(tag)) && !STANDARD_TAGS.some(standard => normalizeTag(standard) === normalizeTag(tag))
    ? known.get(normalizeTag(tag))!
    : tag)
}
