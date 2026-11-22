import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Download, HardDrive, Shield, Upload } from 'lucide-react'
import type { AppSettings, BackupFile, Repertoire, RepertoireEntry, Song } from '../types'
import { createBackup, mergeBackup, restoreBackup, validateBackup } from '../services/backup'

export default function SettingsPage({ songs, repertoires, entries, settings, persisted, onRefresh, onSettings }: {
  songs: Song[]; repertoires: Repertoire[]; entries: RepertoireEntry[]; settings: AppSettings; persisted: boolean | null
  onRefresh: () => Promise<void>; onSettings: (settings: AppSettings) => Promise<void>
}) {
  const [backup, setBackup] = useState<BackupFile | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [conflict, setConflict] = useState<'keep' | 'replace'>('keep')
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const counts = useMemo(() => ({ songs: songs.length, repertoires: repertoires.length, entries: entries.length }), [songs, repertoires, entries])
  const conflicts = backup ? backup.songs.filter(incoming => songs.some(current => current.id === incoming.id && JSON.stringify(current) !== JSON.stringify(incoming))).length : 0
  const newSongs = backup ? backup.songs.filter(incoming => !songs.some(current => current.id === incoming.id)).length : 0

  const download = (file: BackupFile, name: string) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
  const exportNow = async () => {
    try {
      const file = await createBackup()
      download(file, `OMeuCancioneiro_${new Date().toISOString().slice(0, 10)}.json`)
      setMessage('Copia preparada para gardar ou pasar ao outro dispositivo.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Non se puido crear a copia.') }
  }
  const readFile = async (file?: File) => {
    if (!file) return
    setMessage('')
    try { setBackup(validateBackup(JSON.parse(await file.text()))); setMode('merge'); setConfirmRestore(false) }
    catch (error) { setBackup(null); setMessage(error instanceof Error ? error.message : 'Non se puido validar o ficheiro.') }
  }
  const apply = async () => {
    if (!backup) return
    setBusy(true); setMessage('')
    try {
      if (mode === 'replace') await restoreBackup(backup)
      else await mergeBackup(backup, conflict)
      await onRefresh(); setBackup(null); setConfirmRestore(false)
      setMessage(mode === 'replace' ? 'Copia restaurada. Creouse tamén unha salvagarda local previa.' : 'Copia fusionada cos datos deste dispositivo.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Non se puido aplicar a copia.') }
    finally { setBusy(false) }
  }
  const armRestore = async () => {
    const current = await createBackup()
    download(current, `OMeuCancioneiro_PREVIO_${new Date().toISOString().slice(0, 10)}.json`)
    setConfirmRestore(true)
    setMessage('Descarguei unha copia previa. Garda o ficheiro antes de confirmar a substitución.')
  }

  return <section className="settings-page"><div className="page-heading"><div><span className="eyebrow">DATOS BAIXO O TEU CONTROL</span><h1>Axustes e copias</h1><p>A base queda neste navegador. Usa JSON para pasar cancións entre o iPhone e o Mac.</p></div></div>
    <div className="storage-card"><HardDrive size={20}/><div><b>{persisted === true ? 'Almacenamento local persistente solicitado' : persisted === false ? 'O navegador non garante conservar os datos' : 'Comprobando almacenamento local…'}</b><p>{counts.songs} cancións · {counts.repertoires} repertorios · {counts.entries} relacións</p></div><Shield size={19}/></div>
    <div className="settings-grid"><article className="settings-card"><span className="settings-icon"><Download/></span><h2>Exportar a base de datos</h2><p>Garda cancións, acordes, repertorios, tonalidades, favoritos e axustes nun ficheiro JSON versionado.</p><button className="primary-button" onClick={() => void exportNow()}><Download size={17}/> Descargar copia completa</button></article><article className="settings-card"><span className="settings-icon"><Upload/></span><h2>Importar / transferir</h2><p>Escolle unha copia JSON deste cancioneiro. Podes fusionala cos datos locais ou restaurala.</p><label className="file-picker"><Upload size={17}/> Escoller copia JSON<input type="file" accept="application/json,.json" onChange={e => void readFile(e.target.files?.[0])}/></label></article></div>
    {backup && <section className="backup-preview"><div className="backup-preview-head"><span className="eyebrow">VISTA PREVIA</span><h2>Revisa antes de importar</h2><p>Creada o {new Date(backup.createdAt).toLocaleString('gl-ES')} · formato v{backup.formatVersion}</p></div><div className="backup-counts"><span><b>{backup.songs.length}</b> cancións</span><span><b>{backup.repertoires.length}</b> repertorios</span><span><b>{newSongs}</b> cancións novas</span><span><b>{conflicts}</b> cambios no mesmo ID</span></div><div className="backup-options"><label><input type="radio" checked={mode === 'merge'} onChange={() => { setMode('merge'); setConfirmRestore(false) }}/> Fusionar co cancioneiro actual</label><label><input type="radio" checked={mode === 'replace'} onChange={() => { setMode('replace'); setConfirmRestore(false) }}/> Substituír a base actual</label></div>{mode === 'merge' && conflicts > 0 && <div className="conflict-choice"><b>{conflicts} canción(s) modificadas tamén neste dispositivo.</b><label><input type="radio" checked={conflict === 'keep'} onChange={() => setConflict('keep')}/> Manter a versión local</label><label><input type="radio" checked={conflict === 'replace'} onChange={() => setConflict('replace')}/> Usar a versión da copia</label></div>}{mode === 'replace' && !confirmRestore ? <button className="danger-button" onClick={() => void armRestore()}><Download size={16}/> Descargar copia previa antes de restaurar</button> : <button className={mode === 'replace' ? 'danger-button' : 'primary-button'} onClick={() => void apply()} disabled={busy}>{busy ? 'Aplicando…' : mode === 'replace' ? 'Confirmar restauración' : 'Fusionar copia'}</button>}</section>}
    {message && <p className="status-message"><Check size={16}/>{message}</p>}
    <section className="settings-note"><AlertTriangle size={17}/><p>Se limpas os datos do sitio no navegador, podes perder a base local. Garda copias JSON fóra da aplicación con regularidade. O ficheiro contén as túas letras e notas en texto lexible.</p></section>
    <label className="wake-option"><input type="checkbox" checked={settings.keepAwake} onChange={e => void onSettings({ ...settings, keepAwake: e.target.checked })}/> Tentar manter a pantalla activa durante a interpretación e o metrónomo</label>
  </section>
}
