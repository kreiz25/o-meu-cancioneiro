import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, Printer, ScrollText, X } from 'lucide-react'
import type { AppSettings, Song, SongLine } from '../types'
import { intervalBetweenKeys, prefersFlats, transposeChord, transposeKey } from '../domain/music'

export default function Performance({ song, keyOverride, queue, settings, onSettings, onClose, onQueueIndex }: {
  song: Song; keyOverride: string; queue?: { song: Song; key: string }[]; settings: AppSettings
  onSettings: (settings: AppSettings) => Promise<void>; onClose: () => void; onQueueIndex?: (song: Song, key: string) => void
}) {
  const [offset, setOffset] = useState(0)
  const [scrolling, setScrolling] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const wake = useRef<WakeLockSentinel | null>(null)
  const index = queue?.findIndex(item => item.song.id === song.id) ?? -1
  const baseOffset = keyOverride && song.originalKey ? intervalBetweenKeys(song.originalKey, keyOverride) ?? 0 : 0
  const totalOffset = baseOffset + offset
  const shownKey = keyOverride ? transposeKey(keyOverride, offset) : song.originalKey ? transposeKey(song.originalKey, totalOffset) : ''

  useEffect(() => {
    if (!scrolling) return
    let frame = 0
    const tick = () => {
      if (!scroll.current) return
      scroll.current.scrollTop += 0.55
      if (scroll.current.scrollTop + scroll.current.clientHeight < scroll.current.scrollHeight) frame = requestAnimationFrame(tick)
      else setScrolling(false)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [scrolling, song.id])

  useEffect(() => {
    if (!settings.keepAwake || !('wakeLock' in navigator)) return
    let active = true
    void navigator.wakeLock.request('screen').then(value => { if (active) wake.current = value; else void value.release() }).catch(() => {})
    return () => { active = false; void wake.current?.release().catch(() => {}); wake.current = null }
  }, [settings.keepAwake, song.id])

  const chordStyle = shownKey ? prefersFlats(shownKey) : undefined
  const changeIndex = (next: number) => { const item = queue?.[next]; if (item) onQueueIndex?.(item.song, item.key) }

  return <div className="performance-screen"><header className="performance-toolbar"><button className="icon-button" onClick={onClose} aria-label="Pechar"><X/></button><div className="performance-actions"><button className="secondary-button toolbar-icon" onClick={() => setOffset(value => value - 1)} aria-label="Baixar un semitón" title="Baixar un semitón"><Minus size={17}/></button><span className="performance-key" title={`Tonalidade ${shownKey || 'descoñecida'}`}>{shownKey || '?'}</span><button className="secondary-button toolbar-icon" onClick={() => setOffset(value => value + 1)} aria-label="Subir un semitón" title="Subir un semitón"><Plus size={17}/></button><button className={scrolling ? 'secondary-button toolbar-icon active' : 'secondary-button toolbar-icon'} onClick={() => setScrolling(value => !value)} aria-label={scrolling ? 'Parar desprazamento automático' : 'Iniciar desprazamento automático'} title={scrolling ? 'Parar desprazamento' : 'Desprazamento automático'}><ScrollText size={17}/></button><button className="secondary-button toolbar-icon print-button" onClick={() => window.print()} aria-label="Exportar PDF ou imprimir" title="PDF / Imprimir"><Printer size={17}/></button><button className="secondary-button font-size-button" onClick={() => void onSettings({ ...settings, fontSize: Math.max(16, settings.fontSize - 1) })} aria-label="Diminuír tamaño do texto">A−</button><button className="secondary-button font-size-button" onClick={() => void onSettings({ ...settings, fontSize: Math.min(36, settings.fontSize + 1) })} aria-label="Aumentar tamaño do texto">A+</button></div></header>
    <div className="performance-scroll" ref={scroll}><article className="performance-sheet"><div className="performance-song-heading"><span className="eyebrow">{song.originalKey ? `TONALIDADE ORIXINAL ${song.originalKey}` : 'CANCIÓN'}</span><h1>{song.title}</h1>{song.subtitle && <h2>{song.subtitle}</h2>}{song.artist && <p>{song.artist}</p>}<div className="performance-meta">{shownKey && <span>Key <b>{shownKey}</b></span>}{song.capo > 0 && <span>Capo <b>{song.capo}</b></span>}{song.tempo && <span>Tempo <b>{song.tempo} BPM</b></span>}</div></div>
      {song.document.sections.map(section => <section className="performance-section" key={section.id}>{section.kind !== 'verse' && <h3>{({ chorus: 'Retrouso', bridge: 'Ponte', intro: 'Introdución', outro: 'Final', other: 'Sección', verse: 'Estrofa' })[section.kind]}</h3>}{section.lines.map(line => <ChordLine key={line.id} line={line} size={settings.fontSize} offset={totalOffset} flatStyle={chordStyle}/>)}</section>)}
      {song.notes && <details className="performance-notes"><summary>Notas persoais</summary><p>{song.notes}</p></details>}
    </article></div>
    {queue && queue.length > 1 && <footer className="performance-queue"><button className="secondary-button" disabled={index <= 0} onClick={() => changeIndex(index - 1)}><ChevronLeft size={16}/> Anterior</button><span>{Math.max(0, index + 1)} / {queue.length}</span><button className="secondary-button" disabled={index >= queue.length - 1} onClick={() => changeIndex(index + 1)}>Seguinte <ChevronRight size={16}/></button></footer>}
  </div>
}

function ChordLine({ line, size, offset, flatStyle }: { line: SongLine; size: number; offset: number; flatStyle?: boolean }) {
  const model = useMemo(() => {
    let lyric = ''
    const chords: { at: number; value: string }[] = []
    const directives: string[] = []
    for (const event of line.events) {
      if (event.kind === 'text') lyric += event.value
      else if (event.kind === 'chord') chords.push({ at: Array.from(lyric).length, value: transposeChord(event.symbol, offset, flatStyle) })
      else directives.push(event.value)
    }
    return { lyric, chords, directives }
  }, [line, offset, flatStyle])
  const width = Math.max(Array.from(model.lyric).length, ...model.chords.map(chord => chord.at + chord.value.length), 1)
  return <div className="chord-line" style={{ '--line-size': `${size}px`, '--line-width': `${width}ch` } as React.CSSProperties}>
    <div className="chord-track" style={{ width: `${width}ch` }}>{model.chords.map((chord, i) => <span className="aligned-chord" key={`${chord.at}-${i}`} style={{ left: `${chord.at}ch` }}>{chord.value}</span>)}</div>
    <div className="performance-lyric">{model.lyric || '\u00a0'}</div>
    {model.directives.map((directive, i) => <span className="performance-directive" key={i}>{directive}</span>)}
  </div>
}
