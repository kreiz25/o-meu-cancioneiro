import { useMemo, useState } from 'react'
import { ArrowDownAZ, Download, Heart, Import, Music2, Plus, Search, SlidersHorizontal } from 'lucide-react'
import type { Song } from '../types'
import { songMatchesQuery } from '../domain/search'

export default function Library({ songs, onEdit, onView, onNew, onImport, onDelete, onExportSong, onExportMany }: {
  songs: Song[]; onEdit: (song: Song) => void; onView: (song: Song) => void; onNew: () => void; onImport: () => void; onDelete: (song: Song) => void
  onExportSong: (song: Song) => void; onExportMany: (songs: Song[]) => void
}) {
  const [query, setQuery] = useState('')
  const [key, setKey] = useState('')
  const [favorites, setFavorites] = useState(false)
  const [sort, setSort] = useState<'title' | 'recent'>('title')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const keys = useMemo(() => [...new Set(songs.map(song => song.originalKey).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [songs])
  const filtered = useMemo(() => songs.filter(song =>
    songMatchesQuery(song, query) && (!key || song.originalKey === key) && (!favorites || song.favorite)
  ).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'gl') : b.updatedAt.localeCompare(a.updatedAt)), [songs, query, key, favorites, sort])

  return <section className="library-page">
    <div className="page-heading"><div><span className="eyebrow">A COLECCIÓN</span><h1>Cancioneiro</h1><p>{songs.length} {songs.length === 1 ? 'canción gardada' : 'cancións gardadas'} neste dispositivo.</p></div><div className="heading-actions">{selectedIds.length > 0 && <button className="secondary-button" onClick={() => onExportMany(songs.filter(song => selectedIds.includes(song.id)))}><Download size={16}/> Exportar {selectedIds.length}</button>}<button className="secondary-button" onClick={onImport}><Import size={17}/> Importar</button><button className="primary-button" onClick={onNew}><Plus size={17}/> Nova canción</button></div></div>
    <div className="library-filters"><label className="search-field"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar título, artista, acorde ou letra" aria-label="Buscar cancións por título, artista, acorde ou letra"/></label><label className="select-field"><SlidersHorizontal size={15}/><select value={key} onChange={e => setKey(e.target.value)}><option value="">Todas as tonalidades</option>{keys.map(item => <option key={item}>{item}</option>)}</select></label><button className={favorites ? 'filter-pill active' : 'filter-pill'} onClick={() => setFavorites(value => !value)}><Heart size={15} fill={favorites ? 'currentColor' : 'none'}/> Favoritas</button><button className="filter-pill" onClick={() => setSort(value => value === 'title' ? 'recent' : 'title')}><ArrowDownAZ size={15}/>{sort === 'title' ? 'Alfabética' : 'Recentes'}</button></div>
    {filtered.length ? <div className="song-grid">{filtered.map(song => <article className="song-card" key={song.id}>
      <button className="song-open" onClick={() => onView(song)} aria-label={`Abrir ${song.title}`}><span className="song-card-icon"><Music2 size={18}/></span><span className="song-card-title">{song.title || 'Sen título'}</span>{song.subtitle && <span className="song-card-subtitle">{song.subtitle}</span>}<span className="song-card-artist">{song.artist || 'Artista descoñecido'}</span><span className="song-card-meta">{song.originalKey && <span className="key-badge">{song.originalKey}</span>}{song.capo > 0 && <span>Capo {song.capo}</span>}{song.tempo && <span>{song.tempo} BPM</span>}</span></button>
      <div className="song-card-actions"><label className="song-select"><input type="checkbox" checked={selectedIds.includes(song.id)} onChange={() => setSelectedIds(value => value.includes(song.id) ? value.filter(id => id !== song.id) : [...value, song.id])}/> Seleccionar</label><button onClick={() => onEdit(song)}>Editar</button><button onClick={() => onExportSong(song)} aria-label={`Exportar ${song.title} en ChordPro`}>.pro</button><button onClick={() => onDelete(song)} aria-label={`Eliminar ${song.title}`}>Eliminar</button>{song.favorite && <Heart size={15} fill="currentColor"/>}</div>
    </article>)}</div> : <div className="empty-state"><Music2 size={30}/><h2>{songs.length ? 'Non hai resultados' : 'O primeiro acorde está por chegar'}</h2><p>{songs.length ? 'Proba outro termo ou quita algún filtro.' : 'Crea unha canción ou importa a túa colección ChordPro.'}</p><button className="primary-button" onClick={songs.length ? () => { setQuery(''); setKey(''); setFavorites(false) } : onNew}>{songs.length ? 'Limpar filtros' : 'Crear primeira canción'}</button></div>}
  </section>
}
