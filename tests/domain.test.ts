import test from 'node:test'
import assert from 'node:assert/strict'
import { chordSymbols, decodeChordPro, editorTextToDocument, exportChordPro, parseChordPro } from '../src/domain/chordpro.ts'
import { insertChordAtCursor, intervalBetweenKeys, prefersFlats, transposeChord, transposeKey } from '../src/domain/music.ts'
import { validateBackup } from '../src/domain/backup-validation.ts'
import { createStoredZip } from '../src/services/archive.ts'

test('ChordPro interpreta metadatos, seccións, acordes e directivas descoñecidas', () => {
  const parsed = parseChordPro([
    '{title: Luz do día}', '{subtitle: Estudo acústico}', '{artist: Grupo X}', '{key: G}', '{capo: 2}', '{tempo: 96}',
    '{sov}', '[G]Hoxe é un [D]bo día', '', '{comment_italic: suave}', '{vendor_directive: manter}', '{eov}',
    '{soc}', '[Em]Volverei [Cadd9]mañá', '{eoc}'
  ].join('\r\n'))
  assert.equal(parsed.title, 'Luz do día')
  assert.equal(parsed.subtitle, 'Estudo acústico')
  assert.equal(parsed.artist, 'Grupo X')
  assert.equal(parsed.key, 'G')
  assert.equal(parsed.capo, 2)
  assert.equal(parsed.tempo, 96)
  assert.deepEqual(parsed.chords, ['G', 'D', 'Em', 'Cadd9'])
  assert.equal(parsed.verseCount, 1)
  assert.ok(parsed.document.sections.some(section => section.kind === 'chorus'))
  assert.ok(parsed.warnings.some(warning => warning.includes('vendor_directive')))
  assert.equal(parsed.document.sections.flatMap(section => section.lines).flatMap(line => line.events).filter(event => event.kind === 'directive').length, 2)
})

test('UTF-8 BOM, UTF-16 e Windows-1252 lídense con aviso cando procede', () => {
  const utf8 = new TextEncoder().encode('\uFEFF{title: Canción}\n[G]ola')
  assert.equal(parseChordPro(decodeChordPro(utf8.buffer).text).title, 'Canción')
  const utf16 = new Uint8Array([0xff, 0xfe, 0x7b, 0x00, 0x74, 0x00, 0x3a, 0x00, 0x20, 0x00, 0x43, 0x00, 0x61, 0x00, 0x66, 0x00, 0xe9, 0x00, 0x7d, 0x00])
  const decoded16 = decodeChordPro(utf16.buffer)
  assert.equal(parseChordPro(decoded16.text, 'ficheiro').title, 'Café')
  assert.match(decoded16.warning ?? '', /UTF-16/)
  const cp1252 = new Uint8Array([0x7b, 0x74, 0x3a, 0x20, 0x43, 0x61, 0x66, 0xe9, 0x7d, 0x0a, 0x5b, 0x43, 0x5d])
  const decoded1252 = decodeChordPro(cp1252.buffer)
  assert.equal(parseChordPro(decoded1252.text).title, 'Café')
  assert.match(decoded1252.warning ?? '', /Windows-1252/)
})

test('exportar e volver importar conserva acordes, seccións e directivas', () => {
  const parsed = parseChordPro('{title: Test}\n{start_of_chorus}\n[G]Retrouso\n{vendor: keep}\n{end_of_chorus}')
  const song = { title: parsed.title, subtitle: parsed.subtitle, artist: parsed.artist, originalKey: parsed.key, capo: parsed.capo, tempo: parsed.tempo, document: parsed.document }
  const again = parseChordPro(exportChordPro(song))
  assert.deepEqual(again.chords, parsed.chords)
  assert.equal(again.document.sections[0].kind, 'chorus')
  assert.ok(again.warnings.some(warning => warning.includes('vendor')))
})

test('editor mantén seccións e inserta o acorde xunto ao cursor sen borrar selección', () => {
  const doc = editorTextToDocument('{start_of_verse}\n[G]Unha estrofa\n{end_of_verse}\n{start_of_chorus}\n[Em]Retrouso\n{end_of_chorus}')
  assert.deepEqual(doc.sections.map(section => section.kind), ['verse', 'chorus'])
  const text = '🙂 día libre'
  const result = insertChordAtCursor(text, text.indexOf('día'), 'G')
  assert.equal(result.text, '🙂 [G]día libre')
  assert.equal(result.cursor, text.indexOf('día') + 3)
  assert.deepEqual(chordSymbols('[Verse] letra [G] e [Em]'), ['G', 'Em'])
})

test('motor de transposición recoñece calidades e baixos alternativos', () => {
  assert.equal(transposeChord('Cadd9', 2), 'Dadd9')
  assert.equal(transposeChord('G/B', -2), 'F/A')
  assert.equal(transposeChord('F#m7b5', 1), 'Gm7b5')
  assert.equal(transposeChord('Bbmaj7/D', 2), 'Cmaj7/E')
  assert.equal(transposeChord('C', 3, true), 'Eb')
  assert.equal(intervalBetweenKeys('C', 'D'), 2)
  assert.equal(transposeKey('Am', 2), 'Bm')
  assert.equal(prefersFlats('Bb'), true)
})

test('copia JSON valida versión, modelos e relacións antes de restaurar', () => {
  const now = new Date().toISOString()
  const file = {
    app: 'OMeuCancioneiro', formatVersion: 1, createdAt: now,
    songs: [{ id: 's1', title: 'Test', artist: '', document: { formatVersion: 1, sections: [], preservedDirectives: [] } }],
    repertoires: [{ id: 'r1', name: 'Set', description: '', createdAt: now, updatedAt: now }],
    entries: [{ id: 'e1', repertoireId: 'r1', songId: 's1', position: 0, performanceKey: '' }],
    settings: []
  }
  assert.equal(validateBackup(file).songs.length, 1)
  assert.throws(() => validateBackup({ ...file, formatVersion: 7 }), /versión/)
  assert.throws(() => validateBackup({ ...file, entries: [{ ...file.entries[0], songId: 'missing' }] }), /relación/)
})

test('exportación de repertorio crea un ZIP con cancións ChordPro', async () => {
  const zip = await createStoredZip([{ name: 'unha.pro', text: '{title: Unha}\n[G]hola\n' }, { name: 'dúas.pro', text: '{title: Dúas}\n[D]ola\n' }]).arrayBuffer()
  const bytes = new Uint8Array(zip)
  assert.equal(new DataView(zip).getUint32(0, true), 0x04034b50)
  assert.ok(new TextDecoder().decode(bytes).includes('dúas.pro'))
  assert.equal(new DataView(zip).getUint32(bytes.length - 22, true), 0x06054b50)
})
