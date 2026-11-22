import type { BackupFile } from '../types'

export function validateBackup(value: unknown): BackupFile {
  if (!value || typeof value !== 'object') throw new Error('O ficheiro non contén unha copia válida.')
  const file = value as Partial<BackupFile>
  if (file.app !== 'OMeuCancioneiro' || file.formatVersion !== 1 || !Array.isArray(file.songs) || !Array.isArray(file.repertoires) || !Array.isArray(file.entries) || !Array.isArray(file.settings)) {
    throw new Error('A aplicación, a versión ou a estrutura da copia non se recoñecen.')
  }
  const songIds = new Set<string>()
  for (const song of file.songs) {
    if (!song || typeof song.id !== 'string' || !song.id || typeof song.title !== 'string' || typeof song.artist !== 'string' || !validDocument(song.document)) throw new Error('A copia contén cancións incompletas ou non válidas.')
    if (songIds.has(song.id)) throw new Error('A copia contén identificadores de canción duplicados.')
    songIds.add(song.id)
  }
  const repertoireIds = new Set<string>()
  for (const repertoire of file.repertoires) {
    if (!repertoire || typeof repertoire.id !== 'string' || !repertoire.id || typeof repertoire.name !== 'string') throw new Error('A copia contén repertorios incompletos.')
    if (repertoireIds.has(repertoire.id)) throw new Error('A copia contén repertorios duplicados.')
    repertoireIds.add(repertoire.id)
  }
  const entryIds = new Set<string>()
  for (const entry of file.entries) {
    if (!entry || typeof entry.id !== 'string' || !repertoireIds.has(entry.repertoireId) || !songIds.has(entry.songId) || !Number.isInteger(entry.position)) throw new Error('A copia contén unha relación de repertorio non válida.')
    if (entryIds.has(entry.id)) throw new Error('A copia contén relacións duplicadas.')
    entryIds.add(entry.id)
  }
  if (typeof file.createdAt !== 'string' || Number.isNaN(Date.parse(file.createdAt))) throw new Error('A data da copia non é válida.')
  if (file.settings.length > 1 || file.settings.some(setting => setting.key !== 'preferences' || !Array.isArray(setting.favoriteChords) || !Array.isArray(setting.recentChords) || !Number.isFinite(setting.bpm) || !Number.isFinite(setting.fontSize))) throw new Error('Os axustes da copia non son válidos.')
  return file as BackupFile
}

function validDocument(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const doc = value as Record<string, unknown>
  const kinds = ['verse', 'chorus', 'bridge', 'intro', 'outro', 'other']
  return doc.formatVersion === 1 && Array.isArray(doc.sections) && doc.sections.every(section => {
    if (!section || typeof section !== 'object') return false
    const candidate = section as { id?: unknown; kind?: unknown; lines?: unknown }
    return typeof candidate.id === 'string' && kinds.includes(String(candidate.kind)) && Array.isArray(candidate.lines) && candidate.lines.every(line => {
      if (!line || typeof line !== 'object') return false
      const row = line as { id?: unknown; events?: unknown }
      return typeof row.id === 'string' && Array.isArray(row.events) && row.events.every(event => {
        if (!event || typeof event !== 'object') return false
        const item = event as { kind?: unknown; value?: unknown; symbol?: unknown }
        return item.kind === 'text' ? typeof item.value === 'string' : item.kind === 'directive' ? typeof item.value === 'string' : item.kind === 'chord' ? typeof item.symbol === 'string' : false
      })
    })
  })
}
