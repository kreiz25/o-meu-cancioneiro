import { useEffect, useRef, useState } from 'react'
import { Minus, Pause, Play, Plus, Volume2 } from 'lucide-react'
import type { AppSettings } from '../types'

export default function Metronome({ settings, onSettings }: { settings: AppSettings; onSettings: (value: AppSettings) => Promise<void> }) {
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(-1)
  const audio = useRef<AudioContext | null>(null)
  const timer = useRef<number | null>(null)
  const nextTime = useRef(0)
  const beatIndex = useRef(0)
  const bpm = useRef(settings.bpm)
  const meter = useRef(settings.meter)
  const sound = useRef(settings.sound)
  const wake = useRef<WakeLockSentinel | null>(null)

  useEffect(() => { bpm.current = settings.bpm; meter.current = settings.meter; sound.current = settings.sound }, [settings])
  useEffect(() => () => stop(), [])

  const clickAt = (time: number, index: number) => {
    const ctx = audio.current
    if (!ctx) return
    const accent = index === 0
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const tone = sound.current === 'wood' ? (accent ? 1200 : 850) : sound.current === 'soft' ? 600 : accent ? 1500 : 1000
    oscillator.type = sound.current === 'wood' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(tone, time)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(accent ? 0.65 : 0.38, time + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (sound.current === 'soft' ? 0.075 : 0.045))
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(time); oscillator.stop(time + 0.09)
    const delay = Math.max(0, (time - ctx.currentTime) * 1000)
    window.setTimeout(() => setBeat(index), delay)
  }

  const schedule = () => {
    const ctx = audio.current
    if (!ctx) return
    while (nextTime.current < ctx.currentTime + 0.12) {
      const index = beatIndex.current % meter.current
      clickAt(nextTime.current, index)
      nextTime.current += 60 / bpm.current
      beatIndex.current += 1
    }
  }

  const start = async () => {
    if (!audio.current) audio.current = new AudioContext()
    await audio.current.resume()
    nextTime.current = audio.current.currentTime + 0.06
    beatIndex.current = 0
    setRunning(true)
    timer.current = window.setInterval(schedule, 25)
    if (settings.keepAwake && 'wakeLock' in navigator) {
      try { wake.current = await navigator.wakeLock.request('screen') } catch { /* Safari pode rexeitalo; o metrónomo segue en primeiro plano. */ }
    }
  }

  function stop() {
    setRunning(false); setBeat(-1)
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
    void wake.current?.release().catch(() => {})
    wake.current = null
  }

  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'visible' && running && audio.current?.state === 'suspended') {
        nextTime.current = audio.current.currentTime + 0.06
        void audio.current.resume()
      }
    }
    document.addEventListener('visibilitychange', resume)
    return () => document.removeEventListener('visibilitychange', resume)
  }, [running])

  const setBpm = (value: number) => { const next = Math.min(240, Math.max(40, value)); bpm.current = next; void onSettings({ ...settings, bpm: next }) }
  const beats = Array.from({ length: settings.meter }, (_, i) => i)

  return <div className="metronome-page">
    <div className="metronome-heading"><span className="eyebrow">TEMPO PARA TOCAR</span><h1>Metrónomo</h1><p>Un pulso preciso para manter o ritmo.</p></div>
    <section className="metronome-card">
      <div className="meter-dots">{beats.map(index => <span key={index} className={`${beat === index ? 'active' : ''} ${index === 0 ? 'accent' : ''}`}/>)}</div>
      <div className="bpm-display"><strong>{settings.bpm}</strong><span>BPM</span></div>
      <div className="tempo-control"><button onClick={() => setBpm(settings.bpm - 5)} aria-label="Baixar cinco BPM"><Minus/></button><input aria-label="Tempo BPM" type="range" min="40" max="240" value={settings.bpm} onChange={e => setBpm(Number(e.target.value))}/><button onClick={() => setBpm(settings.bpm + 5)} aria-label="Subir cinco BPM"><Plus/></button></div>
      <div className="metro-options"><label>Compás<select value={settings.meter} onChange={e => { const selectedMeter = Number(e.target.value) as AppSettings['meter']; meter.current = selectedMeter; void onSettings({ ...settings, meter: selectedMeter }) }}><option value="2">2/4</option><option value="3">3/4</option><option value="4">4/4</option><option value="6">6/8</option></select></label><label><Volume2 size={16}/> Son<select value={settings.sound} onChange={e => void onSettings({ ...settings, sound: e.target.value as AppSettings['sound'] })}><option value="wood">Madeira</option><option value="click">Click</option><option value="soft">Suave</option></select></label></div>
      <button className="metro-start" onClick={() => running ? stop() : void start()}>{running ? <><Pause fill="currentColor"/> Parar</> : <><Play fill="currentColor"/> Comezar</>}</button>
    </section>
    <label className="wake-option"><input type="checkbox" checked={settings.keepAwake} onChange={e => void onSettings({ ...settings, keepAwake: e.target.checked })}/> Manter a pantalla activa mentres está aberta <span>(cando o navegador o permite)</span></label>
    <p className="offline-note">O metrónomo funciona localmente. Mantén a app aberta e en primeiro plano para maior fiabilidade.</p>
  </div>
}
