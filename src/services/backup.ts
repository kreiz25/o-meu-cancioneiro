import type { AppSettings, BackupFile, Repertoire, RepertoireEntry, Song } from '../types'
import { db } from '../db'
export { validateBackup } from '../domain/backup-validation'

export async function createBackup(): Promise<BackupFile> {
  const [songs, repertoires, entries, setting] = await Promise.all([
    db.songs.toArray(), db.repertoires.toArray(), db.entries.toArray(), db.settings.get('preferences')
  ])
  return { app: 'OMeuCancioneiro', formatVersion: 1, createdAt: new Date().toISOString(), songs, repertoires, entries, settings: setting ? [setting] : [] }
}

export async function mergeBackup(file: BackupFile, conflict: 'keep' | 'replace'): Promise<{ added: number; updated: number; conflicts: number }> {
  const [songs, repertoires, entries] = await Promise.all([db.songs.toArray(), db.repertoires.toArray(), db.entries.toArray()])
  const songMap = new Map(songs.map(song => [song.id, song]))
  const repertoireMap = new Map(repertoires.map(item => [item.id, item]))
  const entryMap = new Map(entries.map(item => [item.id, item]))
  let added = 0, updated = 0, conflicts = 0
  await db.transaction('rw', db.songs, db.repertoires, db.entries, db.settings, db.backups, async () => {
    for (const incoming of file.songs) {
      const current = songMap.get(incoming.id)
      if (!current) { await db.songs.put(incoming); added++ }
      else if (JSON.stringify(current) !== JSON.stringify(incoming)) {
        conflicts++
        if (conflict === 'replace') { await db.songs.put(incoming); updated++ }
      }
    }
    for (const incoming of file.repertoires) {
      const current = repertoireMap.get(incoming.id)
      if (!current || (conflict === 'replace' && JSON.stringify(current) !== JSON.stringify(incoming))) await db.repertoires.put(incoming)
    }
    for (const incoming of file.entries) {
      const current = entryMap.get(incoming.id)
      if (!current || (conflict === 'replace' && JSON.stringify(current) !== JSON.stringify(incoming))) await db.entries.put(incoming)
    }
    const preferences = file.settings.find(setting => setting.key === 'preferences')
    if (preferences) await db.settings.put(preferences)
  })
  return { added, updated, conflicts }
}

export async function restoreBackup(file: BackupFile): Promise<void> {
  const [currentSongs, currentRepertoires, currentEntries] = await Promise.all([db.songs.toArray(), db.repertoires.toArray(), db.entries.toArray()])
  await db.transaction('rw', db.songs, db.repertoires, db.entries, db.settings, db.backups, async () => {
    await db.songs.clear(); await db.repertoires.clear(); await db.entries.clear()
    await db.songs.bulkPut(file.songs); await db.repertoires.bulkPut(file.repertoires); await db.entries.bulkPut(file.entries)
    if (file.settings[0]) await db.settings.put(file.settings[0])
    await db.backups.add({ createdAt: new Date().toISOString(), reason: 'before-restore', songs: currentSongs, repertoires: currentRepertoires, entries: currentEntries })
  })
}

export function isBackupSong(value: unknown): value is Song { return !!value && typeof value === 'object' && typeof (value as Song).id === 'string' }
export function isBackupRepertoire(value: unknown): value is Repertoire { return !!value && typeof value === 'object' && typeof (value as Repertoire).id === 'string' }
export function isBackupEntry(value: unknown): value is RepertoireEntry { return !!value && typeof value === 'object' && typeof (value as RepertoireEntry).id === 'string' }
export function isSettings(value: unknown): value is AppSettings { return !!value && typeof value === 'object' && (value as AppSettings).key === 'preferences' }

