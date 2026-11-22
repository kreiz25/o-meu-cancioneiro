import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, Music2, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import type { Repertoire, RepertoireEntry, Song } from '../types'

export default function Repertoires({ repertoires, songs, entries, onSave, onDelete, onEntries, onPerform, onExport }: {
  repertoires: Repertoire[]; songs: Song[]; entries: RepertoireEntry[]
  onSave: (item: Repertoire) => Promise<void>; onDelete: (item: Repertoire) => Promise<void>
  onEntries: (items: RepertoireEntry[], repertoireId: string) => Promise<void>; onPerform: (song: Song, key: string, queue?: { song: Song; key: string }[]) => void
  onExport: (songs: Song[], name: string) => void
}) {
  const [editing, setEditing] = useState<Repertoire | 'new' | null>(null)
  const [selected, setSelected] = useState<Repertoire | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Repertoire | null>(null)
  const sorted = [...repertoires].sort((a, b) => a.name.localeCompare(b.name, 'gl'))

  return <section className="repertoire-page"><div className="page-heading"><div><span className="eyebrow">LISTAS PARA TOCAR</span><h1>Repertorios</h1><p>{repertoires.length} repertorios · canvia a orde segundo a actuación.</p></div><button className="primary-button" onClick={() => setEditing('new')}><Plus size={17}/> Novo repertorio</button></div>
    {sorted.length ? <div className="repertoire-grid">{sorted.map(item => <article className="repertoire-card" key={item.id}><button className="repertoire-open" onClick={() => setSelected(item)}><span className="repertoire-icon"><Music2/></span><b>{item.name}</b><small>{item.description || `${entries.filter(entry => entry.repertoireId === item.id).length} cancións`}</small><span className="repertoire-count">{entries.filter(entry => entry.repertoireId === item.id).length} temas</span></button><div><button onClick={() => setEditing(item)} aria-label="Editar"><Pencil size={15}/></button><button onClick={() => setRemoveTarget(item)} aria-label="Eliminar"><Trash2 size={15}/></button></div></article>)}</div> : <div className="empty-state"><Music2 size={30}/><h2>Prepara a seguinte actuación</h2><p>Crea repertorios, ordénaos e garda unha tonalidade distinta para cada concerto.</p><button className="primary-button" onClick={() => setEditing('new')}><Plus size={17}/> Crear repertorio</button></div>}
    {editing && <RepertoireEditor item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={async item => { await onSave(item); if (selected?.id === item.id) setSelected(item); setEditing(null) }}/ >}
    {selected && <RepertoireDetail item={selected} songs={songs} entries={entries.filter(entry => entry.repertoireId === selected.id)} onClose={() => setSelected(null)} onEntries={onEntries} onEdit={() => setEditing(selected)} onPerform={onPerform} onExport={onExport}/>}
    {removeTarget && <div className="confirm-overlay"><div className="confirm-card"><Trash2 size={24}/><h3>Eliminar repertorio?</h3><p>Eliminarase «{removeTarget.name}», pero as cancións conservaranse no cancioneiro.</p><div><button className="secondary-button" onClick={() => setRemoveTarget(null)}>Cancelar</button><button className="danger-button" onClick={() => { void onDelete(removeTarget); setRemoveTarget(null) }}>Eliminar</button></div></div></div>}
  </section>
}

function RepertoireEditor({ item, onClose, onSave }: { item: Repertoire | null; onClose: () => void; onSave: (item: Repertoire) => Promise<void> }) {
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  return <div className="modal-backdrop"><form className="small-sheet" onSubmit={e => { e.preventDefault(); const now = new Date().toISOString(); void onSave({ id: item?.id ?? crypto.randomUUID(), name: name.trim(), description: description.trim(), createdAt: item?.createdAt ?? now, updatedAt: now }) }}><header className="sheet-header"><button className="icon-button" type="button" onClick={onClose}><X/></button><div><span className="eyebrow">REPERTORIO</span><h2>{item ? 'Editar lista' : 'Novo repertorio'}</h2></div><button className="primary-button" disabled={!name.trim()}>Gardar</button></header><label>Nome<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Noite de sábado"/></label><label>Descrición<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Concerto, ensaio, viaxe…"/></label></form></div>
}

function RepertoireDetail({ item, songs, entries, onClose, onEntries, onEdit, onPerform, onExport }: {
  item: Repertoire; songs: Song[]; entries: RepertoireEntry[]; onClose: () => void; onEntries: (items: RepertoireEntry[], repertoireId: string) => Promise<void>; onEdit: () => void
  onPerform: (song: Song, key: string, queue?: { song: Song; key: string }[]) => void
  onExport: (songs: Song[], name: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const ordered = [...entries].sort((a, b) => a.position - b.position)
  const byId = new Map(songs.map(song => [song.id, song]))
  const queue = ordered.flatMap(entry => { const song = byId.get(entry.songId); return song ? [{ song, key: entry.performanceKey }] : [] })
  const add = async (song: Song) => { await onEntries([...entries, { id: crypto.randomUUID(), repertoireId: item.id, songId: song.id, position: entries.length, performanceKey: '' }], item.id) }
  const remove = async (entry: RepertoireEntry) => onEntries(ordered.filter(row => row.id !== entry.id).map((row, index) => ({ ...row, position: index })), item.id)
  const move = async (entry: RepertoireEntry, by: number) => {
    const from = ordered.findIndex(row => row.id === entry.id), to = from + by
    if (to < 0 || to >= ordered.length) return
    const copy = [...ordered]; [copy[from], copy[to]] = [copy[to], copy[from]]
    await onEntries(copy.map((row, index) => ({ ...row, position: index })), item.id)
  }
  const updateKey = async (entry: RepertoireEntry, performanceKey: string) => onEntries(ordered.map(row => row.id === entry.id ? { ...row, performanceKey } : row), item.id)

  return <div className="modal-backdrop"><section className="repertoire-detail"><header className="sheet-header"><button className="icon-button" onClick={onClose}><X/></button><div><span className="eyebrow">MODO ACTUACIÓN</span><h2>{item.name}</h2></div><div className="detail-header-actions"><button className="secondary-button" disabled={!queue.length} onClick={() => onExport(queue.map(row => row.song), item.name)}><Download size={15}/> .zip</button><button className="secondary-button" onClick={onEdit}><Pencil size={15}/> Editar</button><button className="primary-button" disabled={!queue.length} onClick={() => onPerform(queue[0].song, queue[0].key, queue)}><Play fill="currentColor" size={15}/> Tocar</button></div></header>
    {item.description && <p className="repertoire-description">{item.description}</p>}<div className="performance-list">{ordered.map((entry, index) => { const song = byId.get(entry.songId); if (!song) return null; return <article key={entry.id}><span className="entry-number">{index + 1}</span><button className="entry-song" onClick={() => onPerform(song, entry.performanceKey)}><b>{song.title}</b><small>{song.artist}</small></button><input className="entry-key" value={entry.performanceKey} onChange={e => void updateKey(entry, e.target.value)} placeholder={song.originalKey || 'Key'} aria-label={`Tonalidade de ${song.title} neste repertorio`}/><button className="reorder" disabled={index === 0} onClick={() => void move(entry, -1)} aria-label="Mover arriba"><ArrowUp size={15}/></button><button className="reorder" disabled={index === ordered.length - 1} onClick={() => void move(entry, 1)} aria-label="Mover abaixo"><ArrowDown size={15}/></button><button className="reorder remove" onClick={() => void remove(entry)} aria-label="Quitar do repertorio"><X size={15}/></button></article> })}</div>
    <button className="add-song-button" onClick={() => setAdding(true)}><Plus size={17}/> Engadir canción</button>
    {adding && <div className="add-song-overlay"><div className="add-song-sheet"><header><h3>Engadir ao repertorio</h3><button className="icon-button" onClick={() => setAdding(false)}><X/></button></header>{songs.filter(song => !entries.some(entry => entry.songId === song.id)).map(song => <button className="add-song-row" key={song.id} onClick={() => { void add(song); setAdding(false) }}><span><b>{song.title}</b><small>{song.artist}</small></span><Plus size={17}/></button>)||null}{songs.every(song => entries.some(entry => entry.songId === song.id)) && <p className="empty-chords">Non hai cancións dispoñibles para engadir.</p>}</div></div>}
    </section></div>
}
