import { useMemo, useState } from 'react'
import { AlertTriangle, Check, FileText, X } from 'lucide-react'
import type { Song } from '../types'
import { decodeChordPro, parseChordPro, type ParsedChordPro } from '../domain/chordpro'

export interface ImportItem { id: string; fileName: string; parsed?: ParsedChordPro; error?: string; duplicateId?: string; duplicateFileName?: string; choice: 'new' | 'skip' | 'replace' }

export async function readChordProFiles(files: File[], currentSongs: Song[]): Promise<ImportItem[]> {
  const rows: ImportItem[] = []
  for (const file of files) {
    try {
      const decoded = decodeChordPro(await file.arrayBuffer())
      const parsed = parseChordPro(decoded.text, file.name.replace(/\.[^.]+$/, ''))
      if (decoded.warning) parsed.warnings.unshift(decoded.warning)
      const incomingLyrics = lyrics(parsed.document)
      const matchesSong = (song: Song) => {
        const sameName = normalize(song.title) === normalize(parsed.title) && normalize(song.artist) === normalize(parsed.artist)
        return sameName || (!!incomingLyrics.trim() && normalize(lyrics(song.document)) === normalize(incomingLyrics))
      }
      const duplicate = currentSongs.find(matchesSong)
      const batchDuplicate = duplicate ? undefined : rows.find(row => row.parsed &&
        ((normalize(row.parsed.title) === normalize(parsed.title) && normalize(row.parsed.artist) === normalize(parsed.artist)) ||
          (!!incomingLyrics.trim() && normalize(lyrics(row.parsed.document)) === normalize(incomingLyrics))))
      rows.push({ id: crypto.randomUUID(), fileName: file.name, parsed, duplicateId: duplicate?.id, duplicateFileName: batchDuplicate?.fileName, choice: duplicate || batchDuplicate ? 'skip' : 'new' })
    } catch (error) {
      rows.push({ id: crypto.randomUUID(), fileName: file.name, error: error instanceof Error ? error.message : 'Non se puido ler o ficheiro.', choice: 'skip' })
    }
  }
  return rows
}

export default function ImportReview({ items, songs, onClose, onImport }: { items: ImportItem[]; songs: Song[]; onClose: () => void; onImport: (items: ImportItem[], confirmReplace: boolean) => Promise<void> }) {
  const [rows, setRows] = useState(items)
  const [confirm, setConfirm] = useState(false)
  const replaceCount = useMemo(() => rows.filter(row => row.parsed && row.choice === 'replace' && row.duplicateId).length, [rows])

  const run = async (confirmed: boolean) => {
    await onImport(rows, confirmed)
    onClose()
  }

  return <div className="modal-backdrop"><section className="review-sheet" role="dialog" aria-modal="true"><header className="sheet-header"><button className="icon-button" onClick={onClose}><X/></button><div><span className="eyebrow">IMPORTACIÓN POR LOTES</span><h2>Revisar cancións</h2></div><button className="primary-button" onClick={() => replaceCount ? setConfirm(true) : void run(false)} disabled={rows.every(row => !row.parsed || row.choice === 'skip')}>Importar</button></header>
    <p className="review-intro">Comprobei o contido de cada ficheiro. Escolle que facer cos posibles duplicados.</p>
    <div className="review-list">{rows.map(row => <article className="review-card" key={row.id}><div className="review-file"><FileText size={17}/><span>{row.fileName}</span></div>{row.error ? <p className="import-error"><AlertTriangle size={16}/>{row.error}</p> : row.parsed && <><div className="review-song-title">{row.parsed.title || 'Sen título'}{row.parsed.subtitle && <small>{row.parsed.subtitle}</small>}<small>{row.parsed.artist || 'Artista descoñecido'}</small></div><div className="review-stats"><span>{row.parsed.key || 'Tonalidade ?'}</span><span>{row.parsed.verseCount} estrofas</span><span>{row.parsed.chords.length} acordes</span></div>{row.parsed.chords.length > 0 && <div className="review-chords">{row.parsed.chords.join(' · ')}</div>}{row.parsed.warnings.map((warning, index) => <p className="import-warning" key={index}><AlertTriangle size={14}/>{warning}</p>)}{row.duplicateId && <p className="duplicate-note">Posible duplicado de «{songs.find(song => song.id === row.duplicateId)?.title}»</p>}{row.duplicateFileName && <p className="duplicate-note">Tamén aparece no lote como «{row.duplicateFileName}»</p>}<select value={row.choice} onChange={e => setRows(rows.map(item => item.id === row.id ? { ...item, choice: e.target.value as ImportItem['choice'] } : item))}><option value="new">Importar como canción nova</option><option value="skip">Omitir</option>{row.duplicateId && <option value="replace">Substituír a existente</option>}</select></>}</article>)}</div>
    {confirm && <div className="confirm-overlay"><div className="confirm-card"><AlertTriangle size={25}/><h3>Confirmar substitución</h3><p>Actualizaranse {replaceCount} canción(s) existente(s). As notas e etiquetas persoais conservaranse.</p><div><button className="secondary-button" onClick={() => setConfirm(false)}>Volver</button><button className="danger-button" onClick={() => void run(true)}><Check size={16}/> Substituír</button></div></div></div>}
  </section></div>
}

function normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ') }
function lyrics(document: Song['document']): string { return document.sections.flatMap(section => section.lines).map(line => line.events.map(event => event.kind === 'text' ? event.value : event.kind === 'chord' ? `[${event.symbol}]` : event.value).join('')).join('\n') }
