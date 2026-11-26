import type { Song, SongDocument, SongEvent, SongLine, SongSection, SectionKind } from '../types'
import { cleanTags, normalizeTag } from './tags.ts'

export interface ParsedChordPro {
  title: string
  subtitle: string
  artist: string
  key: string
  capo: number
  tempo: number | null
  tags: string[]
  document: SongDocument
  warnings: string[]
  chords: string[]
  verseCount: number
}

export function decodeChordPro(data: ArrayBuffer): { text: string; warning?: string } {
  const bytes = new Uint8Array(data)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)) }
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), warning: 'Ficheiro UTF-16 convertido a Unicode.' }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), warning: 'Ficheiro UTF-16 convertido a Unicode.' }
  }
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) } }
  catch { return { text: new TextDecoder('windows-1252').decode(bytes), warning: 'Non era UTF-8; interpretouse como Windows-1252.' } }
}

export function parseChordPro(source: string, fallbackTitle = ''): ParsedChordPro {
  if (!source.trim()) throw new Error('O ficheiro está baleiro.')
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  let title = '', subtitle = '', artist = '', key = '', capo = 0, tempo: number | null = null
  const tags: string[] = []
  let kind: SectionKind = 'verse'
  let current: SongLine[] = []
  const sections: SongSection[] = []
  const warnings: string[] = []
  const known = new Set(['comment', 'comment_italic', 'comment_box', 'new_song', 'new_page', 'columns', 'column_break', 'define', 'image', 'start_of_tab', 'end_of_tab', 'transpose'])
  let recognized = false
  const closeSection = () => {
    if (current.length) sections.push({ id: id(), kind, lines: current })
    current = []
  }

  lines.forEach((line, index) => {
    const directive = directiveParts(line)
    if (!directive) { current.push(parseLine(line)); return }
    const name = directive.name.toLowerCase()
    const value = directive.value.trim()
    const section = parseSectionStart(name)
    if (section) { recognized = true; closeSection(); kind = section; return }
    if (isSectionEnd(name)) { recognized = true; closeSection(); kind = 'verse'; return }
    switch (name) {
      case 'title': case 't': title = value; recognized = true; break
      case 'subtitle': case 'st': subtitle = value; recognized = true; break
      case 'artist': artist = value; recognized = true; break
      case 'key': key = value; recognized = true; break
      case 'capo':
        recognized = true
        if (/^\d+$/.test(value) && Number(value) <= 12) capo = Number(value)
        else warnings.push(`Capo non válido na liña ${index + 1}: ${value}`)
        break
      case 'tempo':
        recognized = true
        if (/^\d+$/.test(value) && Number(value) >= 20 && Number(value) <= 300) tempo = Number(value)
        else warnings.push(`Tempo non válido na liña ${index + 1}: ${value}`)
        break
      case 'tag': case 'tags':
        recognized = true
        tags.push(...value.split(/\s*[,;|]\s*/).filter(Boolean))
        break
      default:
        current.push({ id: id(), events: [{ kind: 'directive', value: line }] })
        if (!known.has(name)) warnings.push(`Directiva conservada sen interpretar: {${directive.name}} (liña ${index + 1})`)
    }
  })
  closeSection()
  const normalizedSections = sections.length ? sections : [{ id: id(), kind: 'verse' as const, lines: [] }]
  const chords = unique(normalizedSections.flatMap(s => s.lines.flatMap(l => l.events.flatMap(e => e.kind === 'chord' ? [e.symbol] : []))))
  const validChord = chords.some(isChordSymbol)
  if (!recognized && !validChord) throw new Error('O contido non parece unha canción ChordPro válida.')
  const document: SongDocument = { formatVersion: 1, sections: normalizedSections, originalChordPro: source, preservedDirectives: [] }
  return { title: title || fallbackTitle || subtitle, subtitle, artist, key, capo, tempo, tags: canonicalizeTags(tags), document, warnings, chords, verseCount: normalizedSections.filter(s => s.kind === 'verse').length }
}

export function parseLine(value: string): SongLine {
  const events: SongEvent[] = []
  const pattern = /(\[[^\]\r\n]+\]|\{[^}\r\n]+\})/g
  let cursor = 0
  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > cursor) events.push({ kind: 'text', value: value.slice(cursor, start) })
    const token = match[0]
    if (token.startsWith('[')) events.push({ kind: 'chord', symbol: token.slice(1, -1).trim() })
    else events.push({ kind: 'directive', value: token })
    cursor = start + token.length
  }
  if (cursor < value.length) events.push({ kind: 'text', value: value.slice(cursor) })
  return { id: id(), events }
}

export function chordSymbols(text: string): string[] {
  return unique([...text.matchAll(/\[([^\]\r\n]+)\]/g)].map(m => m[1].trim()).filter(isChordSymbol))
}

export function isChordSymbol(value: string): boolean {
  return /^[A-G](?:#|b|♯|♭)?(?:maj|min|m|M|dim|aug|°|ø|\+)?\d*(?:sus[24]?|add\d+)?(?:b\d+|#\d+)?(?:\([^)]{1,8}\))?(?:\/[A-G](?:#|b|♯|♭)?)?$/i.test(value)
}

export function documentToEditorText(document: SongDocument): string {
  const withMarkers = document.sections.length > 1 || document.sections.some(s => s.kind !== 'verse')
  return document.sections.flatMap(section => {
    const content = section.lines.map(line => line.events.map(event => event.kind === 'text' ? event.value : event.kind === 'chord' ? `[${event.symbol}]` : event.value).join(''))
    if (!withMarkers) return content
    return [startDirective(section.kind), ...content, endDirective(section.kind)]
  }).join('\n')
}

export function editorTextToDocument(text: string): SongDocument {
  let kind: SectionKind = 'verse'
  let lines: SongLine[] = []
  const sections: SongSection[] = []
  const close = () => { if (lines.length) sections.push({ id: id(), kind, lines }); lines = [] }
  for (const line of text.split('\n')) {
    const directive = directiveParts(line)
    const name = directive?.name.toLowerCase()
    const start = name ? parseSectionStart(name) : undefined
    if (start) { close(); kind = start; continue }
    if (name && isSectionEnd(name)) { close(); kind = 'verse'; continue }
    lines.push(parseLine(line))
  }
  close()
  return { formatVersion: 1, sections: sections.length ? sections : [{ id: id(), kind: 'verse', lines: [] }], preservedDirectives: [] }
}

export function exportChordPro(song: Pick<Song, 'title' | 'subtitle' | 'artist' | 'originalKey' | 'capo' | 'tempo' | 'tags' | 'document'>): string {
  const output: string[] = []
  const meta = (name: string, value: string) => { if (value.trim()) output.push(`{${name}: ${value}}`) }
  meta('title', song.title); meta('subtitle', song.subtitle); meta('artist', song.artist); meta('key', song.originalKey)
  if (song.capo > 0) output.push(`{capo: ${song.capo}}`)
  if (song.tempo !== null) output.push(`{tempo: ${song.tempo}}`)
  for (const tag of cleanTags(song.tags)) meta('tag', tag)
  for (const section of song.document.sections) {
    output.push(startDirective(section.kind))
    for (const line of section.lines) output.push(line.events.map(event => event.kind === 'text' ? event.value : event.kind === 'chord' ? `[${event.symbol}]` : event.value).join(''))
    output.push(endDirective(section.kind))
  }
  return output.join('\n') + '\n'
}

function directiveParts(line: string): { name: string; value: string } | null {
  const match = /^\s*\{([^}:]+)(?::([\s\S]*?))?\}\s*$/.exec(line)
  return match ? { name: match[1].trim(), value: match[2] ?? '' } : null
}
function parseSectionStart(name: string): SectionKind | null {
  if (name === 'start_of_verse' || name === 'sov') return 'verse'
  if (name === 'start_of_chorus' || name === 'soc') return 'chorus'
  if (name === 'start_of_bridge') return 'bridge'
  if (name === 'start_of_intro') return 'intro'
  if (name === 'start_of_outro') return 'outro'
  return null
}
function isSectionEnd(name: string): boolean { return ['end_of_verse', 'eov', 'end_of_chorus', 'eoc', 'end_of_bridge', 'end_of_intro', 'end_of_outro'].includes(name) }
function startDirective(kind: SectionKind): string {
  return ({ verse: '{start_of_verse}', chorus: '{start_of_chorus}', bridge: '{start_of_bridge}', intro: '{start_of_intro}', outro: '{start_of_outro}', other: '{start_of_verse}' })[kind]
}
function endDirective(kind: SectionKind): string {
  return ({ verse: '{end_of_verse}', chorus: '{end_of_chorus}', bridge: '{end_of_bridge}', intro: '{end_of_intro}', outro: '{end_of_outro}', other: '{end_of_verse}' })[kind]
}
function canonicalizeTags(tags: string[]): string[] {
  const aliases: Record<string, string> = {
    'salmo': 'Salmo interleccional', 'interleccional': 'Salmo interleccional',
    'aleluya': 'Aleluia', 'alleluia': 'Aleluia',
    'comunion': 'Comuñón', 'comunhao': 'Comuñón', 'comuñon': 'Comuñón',
    'nosopai': 'Pai Noso', 'pai nosso': 'Pai Noso', 'padre nuestro': 'Pai Noso',
    'envio': 'Saída', 'salida': 'Saída', 'agnus dei': 'Agnus Dei'
  }
  return cleanTags(tags.map(tag => aliases[normalizeTag(tag)] ?? tag))
}
function unique<T>(items: T[]): T[] { return [...new Set(items)] }
function id(): string { return crypto.randomUUID() }
