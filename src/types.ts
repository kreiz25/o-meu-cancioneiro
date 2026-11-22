export type ChordEvent = { kind: 'chord'; symbol: string }
export type TextEvent = { kind: 'text'; value: string }
export type DirectiveEvent = { kind: 'directive'; value: string }
export type SongEvent = ChordEvent | TextEvent | DirectiveEvent
export type SectionKind = 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'other'

export interface SongLine { id: string; events: SongEvent[] }
export interface SongSection { id: string; kind: SectionKind; lines: SongLine[] }
export interface SongDocument {
  formatVersion: 1
  sections: SongSection[]
  originalChordPro?: string
  preservedDirectives: string[]
}

export interface Song {
  id: string
  title: string
  subtitle: string
  artist: string
  originalKey: string
  capo: number
  tempo: number | null
  notes: string
  rhythm: string
  tags: string[]
  favorite: boolean
  createdAt: string
  updatedAt: string
  document: SongDocument
}

export interface Repertoire {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface RepertoireEntry {
  id: string
  repertoireId: string
  songId: string
  position: number
  performanceKey: string
}

export interface AppSettings {
  key: 'preferences'
  favoriteChords: string[]
  recentChords: string[]
  fontSize: number
  bpm: number
  meter: 2 | 3 | 4 | 6
  sound: 'wood' | 'click' | 'soft'
  keepAwake: boolean
}

export interface BackupFile {
  app: 'OMeuCancioneiro'
  formatVersion: 1
  createdAt: string
  songs: Song[]
  repertoires: Repertoire[]
  entries: RepertoireEntry[]
  settings: AppSettings[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  key: 'preferences', favoriteChords: ['G', 'C', 'D', 'Em', 'Am', 'A', 'E'],
  recentChords: [], fontSize: 22, bpm: 90, meter: 4, sound: 'wood', keepAwake: true
}
