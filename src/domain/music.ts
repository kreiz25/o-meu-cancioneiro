import type { SongDocument } from '../types'

const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const flatNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const flatKeys = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'])

function note(value: string): { pitch: number; suffix: string; flat: boolean } | null {
  const match = /^([A-Ga-g])([#b♯♭]?)(.*)$/.exec(value)
  if (!match) return null
  const pitch: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  const letter = match[1].toUpperCase()
  const accidental = match[2]
  return { pitch: (pitch[letter] + (accidental === '#' || accidental === '♯' ? 1 : accidental === 'b' || accidental === '♭' ? -1 : 0) + 12) % 12, suffix: match[3], flat: accidental === 'b' || accidental === '♭' }
}
function spell(pitch: number, flats: boolean): string { return (flats ? flatNames : sharpNames)[(pitch % 12 + 12) % 12] }

export function prefersFlats(key: string): boolean { return flatKeys.has(key) || key.includes('b') || key.includes('♭') }

export function transposeChord(chord: string, semitones: number, preferFlatStyle?: boolean): string {
  if (!semitones) return chord
  const parts = chord.split('/')
  if (parts.length > 2) return chord
  const root = note(parts[0])
  if (!root) return chord
  const flats = preferFlatStyle ?? root.flat
  const movedRoot = spell(root.pitch + semitones, flats) + root.suffix
  if (parts.length === 1) return movedRoot
  const bass = note(parts[1])
  return bass ? `${movedRoot}/${spell(bass.pitch + semitones, flats)}${bass.suffix}` : chord
}

export function transposeKey(key: string, semitones: number): string {
  const parsed = note(key)
  return parsed ? spell(parsed.pitch + semitones, prefersFlats(key)) + parsed.suffix : key
}

export function intervalBetweenKeys(from: string, to: string): number | null {
  const a = note(from), b = note(to)
  return a && b ? (b.pitch - a.pitch + 12) % 12 : null
}

export function transposeDocument(document: SongDocument, semitones: number, preferFlatStyle?: boolean): SongDocument {
  return {
    ...document,
    sections: document.sections.map(section => ({
      ...section,
      lines: section.lines.map(line => ({
        ...line,
        events: line.events.map(event => event.kind === 'chord'
          ? { ...event, symbol: transposeChord(event.symbol, semitones, preferFlatStyle) }
          : event)
      }))
    }))
  }
}

export function insertChordAtCursor(text: string, selectionStart: number, symbol: string): { text: string; cursor: number } {
  const location = Math.min(Math.max(0, selectionStart), text.length)
  const tag = `[${symbol}]`
  return { text: text.slice(0, location) + tag + text.slice(location), cursor: location + tag.length }
}
