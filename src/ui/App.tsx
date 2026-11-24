import { useCallback, useEffect, useState } from 'react'
import { BookHeart, BookOpen, Download, Guitar, House, ListMusic, Music2, Plus, Settings as SettingsIcon, ShieldCheck } from 'lucide-react'
import { db, requestPersistentStorage } from '../db'
import { DEFAULT_SETTINGS, type AppSettings, type Repertoire, type RepertoireEntry, type Song } from '../types'
import { editorTextToDocument, exportChordPro } from '../domain/chordpro'
import { createStoredZip } from '../services/archive'
import Editor from './Editor'
import Library from './Library'
import ImportReview, { readChordProFiles, type ImportItem } from './ImportReview'
import Metronome from './Metronome'
import Performance from './Performance'
import Repertoires from './Repertoires'
import SettingsPage from './Settings'

type Tab = 'home' | 'songs' | 'repertoires' | 'metronome' | 'settings'
type Performing = { song: Song; key: string; queue?: { song: Song; key: string }[] }

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [songs, setSongs] = useState<Song[]>([])
  const [repertoires, setRepertoires] = useState<Repertoire[]>([])
  const [entries, setEntries] = useState<RepertoireEntry[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [editor, setEditor] = useState<Song | null>(null)
  const [performance, setPerformance] = useState<Performing | null>(null)
  const [importItems, setImportItems] = useState<ImportItem[] | null>(null)
  const [toast, setToast] = useState('')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [loadError, setLoadError] = useState('')

  const refresh = useCallback(async () => {
    try {
      await db.open()
      const [songRows, repertoireRows, entryRows, preference] = await Promise.all([
        db.songs.toArray(), db.repertoires.toArray(), db.entries.toArray(), db.settings.get('preferences')
      ])
      setSongs(songRows.sort((a, b) => a.title.localeCompare(b.title, 'gl')))
      setRepertoires(repertoireRows.sort((a, b) => a.name.localeCompare(b.name, 'gl')))
      setEntries(entryRows.sort((a, b) => a.position - b.position))
      if (preference) setSettings(preference)
      setLoadError('')
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Non se puideron ler os datos locais.') }
  }, [])

  useEffect(() => {
    void refresh()
    void requestPersistentStorage().then(setPersisted)
    const install = (event: Event) => { event.preventDefault(); setInstallPrompt(event) }
    window.addEventListener('beforeinstallprompt', install)
    return () => window.removeEventListener('beforeinstallprompt', install)
  }, [refresh])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer) }, [toast])

  const updateSettings = async (value: AppSettings) => { setSettings(value); await db.settings.put(value) }
  const saveSong = async (song: Song) => { await db.songs.put(song); await refresh(); setEditor(null); setToast('Canción gardada neste dispositivo.') }
  const createSong = () => {
    const now = new Date().toISOString()
    setEditor({ id: crypto.randomUUID(), title: '', subtitle: '', artist: '', originalKey: '', capo: 0, tempo: null, notes: '', rhythm: '', tags: [], favorite: false, createdAt: now, updatedAt: now, document: editorTextToDocument('') })
  }
  const editSong = (song: Song) => setEditor(song)
  const deleteSong = async (song: Song) => {
    if (!window.confirm(`Eliminar «${song.title}» deste dispositivo? Tamén se quitará dos repertorios.`)) return
    await db.transaction('rw', db.songs, db.entries, async () => {
      await db.songs.delete(song.id)
      await db.entries.where('songId').equals(song.id).delete()
    })
    await refresh(); setToast('Canción eliminada.')
  }
  const clearSongs = async () => {
    await db.transaction('rw', db.songs, db.entries, async () => {
      await db.songs.clear()
      await db.entries.clear()
    })
    await refresh()
  }
  const saveRepertoire = async (item: Repertoire) => { await db.repertoires.put(item); await refresh(); setToast('Repertorio gardado.') }
  const deleteRepertoire = async (item: Repertoire) => { await db.transaction('rw', db.repertoires, db.entries, async () => { await db.repertoires.delete(item.id); await db.entries.where('repertoireId').equals(item.id).delete() }); await refresh() }
  const saveEntries = async (items: RepertoireEntry[], repertoireId: string) => {
    await db.transaction('rw', db.entries, async () => {
      await db.entries.where('repertoireId').equals(repertoireId).delete()
      await db.entries.bulkPut(items)
    })
    await refresh()
  }
  const openImporter = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.multiple = true; input.accept = '.pro,.chopro,.cho,.crd,text/plain'
    input.onchange = async () => {
      const files = [...(input.files ?? [])]
      if (!files.length) return
      setImportItems(await readChordProFiles(files, songs))
    }
    input.click()
  }
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
  const exportSong = (song: Song) => {
    downloadBlob(new Blob([exportChordPro(song)], { type: 'text/plain;charset=utf-8' }), `${fileSlug(song.title)}.pro`)
    setToast('Ficheiro ChordPro preparado.')
  }
  const exportMany = (selected: Song[], title = 'Cancioneiro') => {
    const files = selected.map(song => ({ name: `${fileSlug(song.title)}.pro`, text: exportChordPro(song) }))
    downloadBlob(createStoredZip(files), `${fileSlug(title)}.zip`)
    setToast(`${selected.length} canción(s) preparadas para exportar.`)
  }
  const finishImport = async (items: ImportItem[], confirmReplace: boolean) => {
    await db.transaction('rw', db.songs, async () => {
      for (const item of items) {
        const parsed = item.parsed
        if (!parsed || item.choice === 'skip') continue
        const now = new Date().toISOString()
        if (item.choice === 'replace' && confirmReplace && item.duplicateId) {
          const old = await db.songs.get(item.duplicateId)
          if (old) await db.songs.put({ ...old, title: parsed.title, subtitle: parsed.subtitle, artist: parsed.artist, originalKey: parsed.key, capo: parsed.capo, tempo: parsed.tempo, document: parsed.document, updatedAt: now })
        } else if (item.choice === 'new') {
          await db.songs.add({ id: crypto.randomUUID(), title: parsed.title, subtitle: parsed.subtitle, artist: parsed.artist, originalKey: parsed.key, capo: parsed.capo, tempo: parsed.tempo, notes: '', rhythm: '', tags: [], favorite: false, createdAt: now, updatedAt: now, document: parsed.document })
        }
      }
    })
    await refresh(); setToast('Importación completada.'); setImportItems(null)
  }

  const showPerformance = (song: Song, key: string, queue?: Performing['queue']) => setPerformance({ song, key, queue })
  const currentTab = (id: Tab) => { setTab(id); setEditor(null); setPerformance(null) }

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => currentTab('home')}><span className="brand-mark"><Guitar size={18}/></span><span>O Meu Cancioneiro</span></button><div className="top-right"><span className="local-pill"><i/>Local e privado</span><button className="quiet-button" onClick={() => { if (installPrompt) { void installPrompt.prompt(); setInstallPrompt(null) } else setToast('iPhone: Safari → Compartir → Engadir á pantalla de inicio. Mac: no menú de Safari, Engadir á Dock.') }}><Download size={15}/> Instalar</button></div></header>
    <div className="app-layout"><aside className="side-nav">{navItems.map(([id, Icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => currentTab(id as Tab)}><Icon size={18}/>{label}</button>)}<div className="offline-badge"><ShieldCheck size={16}/><span>Sen conta<br/>Sen nube</span></div></aside>
      <main className="main-content">
        {loadError && <div className="error-banner">Non se abriu a base local: {loadError}</div>}
        {tab === 'home' && <Home songs={songs} repertoires={repertoires} onNew={createSong} onSongs={() => setTab('songs')} onView={song => showPerformance(song, '')}/>}
        {tab === 'songs' && <Library songs={songs} onEdit={editSong} onView={song => showPerformance(song, '')} onNew={createSong} onImport={openImporter} onDelete={song => void deleteSong(song)} onExportSong={exportSong} onExportMany={items => exportMany(items)}/>}
        {tab === 'repertoires' && <Repertoires repertoires={repertoires} songs={songs} entries={entries} onSave={saveRepertoire} onDelete={deleteRepertoire} onEntries={saveEntries} onPerform={showPerformance} onExport={exportMany}/>}
        {tab === 'metronome' && <Metronome settings={settings} onSettings={updateSettings}/>}
        {tab === 'settings' && <SettingsPage songs={songs} repertoires={repertoires} entries={entries} settings={settings} persisted={persisted} onRefresh={refresh} onSettings={updateSettings} onClearSongs={clearSongs}/>}
      </main>
    </div>
    <nav className="bottom-nav">{navItems.map(([id, Icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => currentTab(id as Tab)}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {editor && <Editor key={editor.id} song={editor} settings={settings} onClose={() => setEditor(null)} onSave={saveSong} onSettings={updateSettings}/>}
    {importItems && <ImportReview items={importItems} songs={songs} onClose={() => setImportItems(null)} onImport={finishImport}/>}
    {performance && <Performance key={performance.song.id} song={performance.song} keyOverride={performance.key} queue={performance.queue} settings={settings} onSettings={updateSettings} onClose={() => setPerformance(null)} onQueueIndex={(song, key) => setPerformance(current => current ? { ...current, song, key } : null)}/>}
    {toast && <div className="toast"><ShieldCheck size={16}/>{toast}</div>}
  </div>
}

function Home({ songs, repertoires, onNew, onSongs, onView }: { songs: Song[]; repertoires: Repertoire[]; onNew: () => void; onSongs: () => void; onView: (song: Song) => void }) {
  const favorites = songs.filter(song => song.favorite).slice(0, 3)
  const recent = [...songs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  return <section className="home-page"><div className="home-intro"><span className="eyebrow">O TEU CANCIONEIRO PERSOAL</span><h1>A música,<br/><em>sempre a man.</em></h1><p>As túas cancións e acordes, gardados neste dispositivo.</p><div className="home-actions"><button className="primary-button" onClick={onNew}><Plus size={17}/> Nova canción</button><button className="secondary-button" onClick={onSongs}><BookOpen size={17}/> Abrir cancioneiro</button></div></div>
    <div className="home-stats"><article><b>{songs.length}</b><span>cancións</span></article><article><b>{repertoires.length}</b><span>repertorios</span></article><article><b>{songs.reduce((sum, song) => sum + new Set(song.document.sections.flatMap(s => s.lines.flatMap(line => line.events.flatMap(event => event.kind === 'chord' ? [event.symbol] : [])))).size, 0)}</b><span>acordes</span></article></div>
    {favorites.length > 0 && <section className="home-section"><div className="section-header"><div><span className="eyebrow">AS TÚAS FAVORITAS</span><h2>Para volver tocar</h2></div><BookHeart size={20}/></div><div className="home-song-list">{favorites.map(song => <button key={song.id} onClick={() => onView(song)}><span><b>{song.title}</b><small>{song.artist}</small></span><span className="key-badge">{song.originalKey || '—'}</span></button>)}</div></section>}
    <section className="home-section"><div className="section-header"><div><span className="eyebrow">RECENTES</span><h2>Últimas cancións</h2></div><button className="text-button" onClick={onSongs}>Ver todo</button></div>{recent.length ? <div className="home-song-list">{recent.map(song => <button key={song.id} onClick={() => onView(song)}><span><b>{song.title}</b><small>{song.artist || 'Artista descoñecido'}</small></span><span className="key-badge">{song.originalKey || '—'}</span></button>)}</div> : <div className="home-empty"><Music2 size={24}/><p>Importa a túa colección ChordPro ou crea a primeira canción.</p><button className="text-button" onClick={onSongs}>Ir ao cancioneiro</button></div>}</section>
    <footer className="privacy-footer"><ShieldCheck size={17}/> A base está neste navegador. Usa Axustes para exportar unha copia e pasala ao Mac ou ao iPhone.</footer>
  </section>
}

const navItems = [
  ['home', House, 'Inicio'], ['songs', BookOpen, 'Cancioneiro'], ['repertoires', ListMusic, 'Repertorios'], ['metronome', Music2, 'Metrónomo'], ['settings', SettingsIcon, 'Axustes']
] as const

function fileSlug(value: string): string {
  const slug = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || 'cancion'
}
