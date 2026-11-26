import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Heart, Plus, Search, Star, X } from 'lucide-react'
import type { AppSettings, Song } from '../types'
import { chordSymbols, documentToEditorText, editorTextToDocument } from '../domain/chordpro'
import { insertChordAtCursor } from '../domain/music'
import { normalizeTag, STANDARD_TAGS, STANDARD_TAG_GROUPS } from '../domain/tags'

export default function Editor({ song, settings, existingTags = [], onClose, onSave, onSettings }: {
  song: Song
  settings: AppSettings
  existingTags?: string[]
  onClose: () => void
  onSave: (song: Song) => Promise<void>
  onSettings: (settings: AppSettings) => Promise<void>
}) {
  const [draft, setDraft] = useState<Song>({ ...song, tags: [...(song.tags ?? [])] })
  const [text, setText] = useState(() => documentToEditorText(song.document))
  const [activeGroup, setActiveGroup] = useState<'song' | 'favorites' | 'recent' | 'search'>('song')
  const [query, setQuery] = useState('')
  const [newChord, setNewChord] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [cursor, setCursor] = useState(0)
  const area = useRef<HTMLTextAreaElement>(null)
  const nextCursor = useRef<number | null>(null)

  const songChords = useMemo(() => chordSymbols(text), [text])
  const candidateChords = useMemo(() => [...new Set([...songChords, ...settings.favoriteChords, ...settings.recentChords, 'A', 'Am', 'B', 'Bm', 'C', 'C7', 'Cadd9', 'D', 'D7', 'Dm', 'E', 'Em', 'F', 'F#m', 'G'])].sort((a, b) => a.localeCompare(b)), [songChords, settings])
  const visibleChords = activeGroup === 'song' ? songChords : activeGroup === 'favorites' ? settings.favoriteChords : activeGroup === 'recent' ? settings.recentChords : candidateChords.filter(chord => chord.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const tagOptions = useMemo(() => [...new Map([...STANDARD_TAGS, ...existingTags, ...(draft.tags ?? [])].map(tag => [normalizeTag(tag), tag.trim()])).values()].filter(Boolean), [existingTags, draft.tags])
  const customTags = tagOptions.filter(tag => !STANDARD_TAGS.some(standard => normalizeTag(standard) === normalizeTag(tag)))
  const addTag = (value = tagInput) => {
    const normalized = normalizeTag(value)
    if (!normalized) return
    const canonical = tagOptions.find(tag => normalizeTag(tag) === normalized) ?? value.trim().replace(/\s+/g, ' ')
    if (!draft.tags.some(tag => normalizeTag(tag) === normalized)) setDraft(current => ({ ...current, tags: [...current.tags, canonical] }))
    setTagInput('')
  }
  const toggleTag = (tag: string) => {
    const normalized = normalizeTag(tag)
    setDraft(current => ({ ...current, tags: current.tags.some(item => normalizeTag(item) === normalized)
      ? current.tags.filter(item => normalizeTag(item) !== normalized)
      : [...current.tags, tag] }))
  }

  useLayoutEffect(() => {
    if (nextCursor.current === null || !area.current) return
    const point = nextCursor.current
    area.current.focus()
    area.current.setSelectionRange(point, point)
    setCursor(point)
    nextCursor.current = null
  }, [text])

  const insert = (symbol: string) => {
    const position = area.current?.selectionStart ?? cursor
    const result = insertChordAtCursor(text, position, symbol)
    nextCursor.current = result.cursor
    setText(result.text)
    void onSettings({ ...settings, recentChords: [symbol, ...settings.recentChords.filter(item => item !== symbol)].slice(0, 12) })
  }

  const toggleFavorite = (symbol: string) => {
    const favorites = settings.favoriteChords.includes(symbol)
      ? settings.favoriteChords.filter(item => item !== symbol)
      : [...settings.favoriteChords, symbol]
    void onSettings({ ...settings, favoriteChords: favorites })
  }

  const addChord = () => {
    const symbol = newChord.trim()
    if (!symbol) return
    insert(symbol)
    setNewChord('')
  }

  const save = async () => {
    const cleanTitle = draft.title.trim()
    if (!cleanTitle) { setError('Escribe un título para a canción.'); return }
    setSaving(true); setError('')
    try { await onSave({ ...draft, title: cleanTitle, document: editorTextToDocument(text), updatedAt: new Date().toISOString() }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Non se puido gardar a canción.') }
    finally { setSaving(false) }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="editor-sheet" role="dialog" aria-modal="true" aria-label={song.title ? 'Editar canción' : 'Nova canción'}>
      <header className="sheet-header"><button className="icon-button" onClick={onClose} aria-label="Pechar"><X/></button><div><span className="eyebrow">CANCIONEIRO</span><h2>{song.title ? 'Editar canción' : 'Nova canción'}</h2></div><button className="primary-button" onClick={save} disabled={saving}><Check size={17}/>{saving ? 'Gardando…' : 'Gardar'}</button></header>
      <div className="editor-content">
        <div className="metadata-grid">
          <label>Título<input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Título da canción" autoFocus/></label>
          <label>Artista<input value={draft.artist} onChange={e => setDraft({ ...draft, artist: e.target.value })} placeholder="Artista ou grupo"/></label>
          <label>Subtítulo<input value={draft.subtitle} onChange={e => setDraft({ ...draft, subtitle: e.target.value })} placeholder="Subtítulo"/></label>
          <label>Tonalidade<input value={draft.originalKey} onChange={e => setDraft({ ...draft, originalKey: e.target.value })} placeholder="G, Am…"/></label>
          <label>Capo<input type="number" min="0" max="12" value={draft.capo} onChange={e => setDraft({ ...draft, capo: Math.min(12, Math.max(0, Number(e.target.value))) })}/></label>
          <label>Tempo · BPM<input type="number" min="20" max="300" value={draft.tempo ?? ''} onChange={e => setDraft({ ...draft, tempo: e.target.value ? Number(e.target.value) : null })}/></label>
        </div>
        <label className="favorite-toggle"><input type="checkbox" checked={draft.favorite} onChange={e => setDraft({ ...draft, favorite: e.target.checked })}/><Heart size={16}/> Favorita</label>
        <section className="song-tags-editor" aria-label="Etiquetas da canción">
          <div className="tag-section-heading"><div><span className="eyebrow">CLASIFICACIÓN</span><h3>Etiquetas</h3></div><span>{draft.tags.length} seleccionadas</span></div>
          {draft.tags.length > 0 && <div className="selected-tags">{draft.tags.map(tag => <button type="button" className="tag-chip selected" key={normalizeTag(tag)} onClick={() => toggleTag(tag)} aria-label={`Quitar etiqueta ${tag}`}>{tag}<X size={13}/></button>)}</div>}
          <label className="tag-entry">Engadir ou crear unha etiqueta<input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }} placeholder="Escribe para buscar ou crear" list="song-tag-options"/><datalist id="song-tag-options">{tagOptions.map(tag => <option key={normalizeTag(tag)} value={tag}/>)}</datalist><button type="button" className="secondary-button" onClick={() => addTag()} disabled={!tagInput.trim()}><Plus size={15}/> Engadir</button></label>
          {STANDARD_TAG_GROUPS.map(group => <div className="tag-group" key={group.title}><span>{group.title}</span><div className="tag-options">{group.tags.map(tag => <button type="button" key={tag} className={draft.tags.some(item => normalizeTag(item) === normalizeTag(tag)) ? 'tag-chip selected' : 'tag-chip'} onClick={() => toggleTag(tag)}>{tag}</button>)}</div></div>)}
          {customTags.length > 0 && <div className="tag-group"><span>Etiquetas creadas</span><div className="tag-options">{customTags.map(tag => <button type="button" key={normalizeTag(tag)} className={draft.tags.some(item => normalizeTag(item) === normalizeTag(tag)) ? 'tag-chip selected' : 'tag-chip'} onClick={() => toggleTag(tag)}>{tag}</button>)}</div></div>}
        </section>
        <section className="lyrics-panel"><div className="panel-title"><div><span className="eyebrow">EDITOR CHORDPRO</span><h3>Letra e acordes</h3></div><span className="editor-hint">Toca un acorde abaixo para inserilo xunto ao cursor.</span></div>
          <textarea ref={area} className="lyrics-input" value={text} onChange={e => setText(e.target.value)} onSelect={e => setCursor(e.currentTarget.selectionStart)} spellCheck={false} placeholder={'{start_of_verse}\n[G]Escribe aquí a letra\n{end_of_verse}'} aria-label="Letra con acordes en sintaxe ChordPro"/>
        </section>
        <section className="chord-bar" aria-label="Barra de acordes">
          <div className="chord-tabs">{([['song', 'Canción'], ['favorites', 'Favoritos'], ['recent', 'Recentes'], ['search', 'Buscar']] as const).map(([key, label]) => <button key={key} className={activeGroup === key ? 'selected' : ''} onClick={() => setActiveGroup(key)}>{label}</button>)}</div>
          {activeGroup === 'search' && <label className="chord-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar acordes"/></label>}
          <div className="chord-strip">{visibleChords.length ? visibleChords.map(chord => <span className="chord-chip" key={chord}><button onClick={() => insert(chord)}>{chord}</button><button className={settings.favoriteChords.includes(chord) ? 'star on' : 'star'} onClick={() => toggleFavorite(chord)} aria-label={settings.favoriteChords.includes(chord) ? 'Quitar dos favoritos' : 'Engadir aos favoritos'}><Star size={13} fill={settings.favoriteChords.includes(chord) ? 'currentColor' : 'none'}/></button></span>) : <span className="empty-chords">{activeGroup === 'song' ? 'Os acordes da letra aparecerán aquí.' : activeGroup === 'favorites' ? 'Marca a estrela dun acorde para gardalo.' : 'Aínda non hai acordes recentes.'}</span>}</div>
          <form className="add-chord-form" onSubmit={e => { e.preventDefault(); addChord() }}><input value={newChord} onChange={e => setNewChord(e.target.value)} placeholder="Engadir acorde novo"/><button disabled={!newChord.trim()}><Plus size={16}/> Engadir e inserir</button></form>
        </section>
        <label className="notes-field">Notas persoais<textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={3}/></label>
        {error && <p className="form-error">{error}</p>}
      </div>
    </section>
  </div>
}
