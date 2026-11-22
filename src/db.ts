import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings, Repertoire, RepertoireEntry, Song } from './types'
import { DEFAULT_SETTINGS } from './types'

class CancioneiroDB extends Dexie {
  songs!: EntityTable<Song, 'id'>
  repertoires!: EntityTable<Repertoire, 'id'>
  entries!: EntityTable<RepertoireEntry, 'id'>
  settings!: EntityTable<AppSettings, 'key'>
  backups!: EntityTable<{ id?: number; createdAt: string; reason: string; songs: Song[]; repertoires: Repertoire[]; entries: RepertoireEntry[] }, 'id'>

  constructor() {
    super('OMeuCancioneiro')
    this.version(1).stores({
      songs: 'id, title, artist, originalKey, favorite, updatedAt',
      repertoires: 'id, name, updatedAt',
      entries: 'id, repertoireId, songId, [repertoireId+position]',
      settings: 'key',
      backups: '++id, createdAt'
    }).upgrade(async tx => {
      if (!(await tx.table('settings').get('preferences'))) await tx.table('settings').put(DEFAULT_SETTINGS)
    })
    this.on('populate', async () => { await this.settings.put(DEFAULT_SETTINGS) })
  }
}

export const db = new CancioneiroDB()

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch { return false }
}
