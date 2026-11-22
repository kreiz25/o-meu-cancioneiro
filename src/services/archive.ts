export interface TextArchiveFile { name: string; text: string }

export function createStoredZip(files: TextArchiveFile[]): Blob {
  const encoder = new TextEncoder()
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.name.replace(/\\/g, '/'))
    const data = encoder.encode(file.text)
    const crc = crc32(data)
    const header = new Uint8Array(30 + name.length)
    const view = new DataView(header.buffer)
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true)
    view.setUint16(8, 0, true); view.setUint16(10, 0, true); view.setUint16(12, 0x21, true)
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true)
    view.setUint16(26, name.length, true); view.setUint16(28, 0, true); header.set(name, 30)
    local.push(header, data)

    const record = new Uint8Array(46 + name.length)
    const directory = new DataView(record.buffer)
    directory.setUint32(0, 0x02014b50, true); directory.setUint16(4, 20, true); directory.setUint16(6, 20, true)
    directory.setUint16(8, 0x0800, true); directory.setUint16(10, 0, true); directory.setUint16(12, 0, true); directory.setUint16(14, 0x21, true); directory.setUint32(16, crc, true)
    directory.setUint32(20, data.length, true); directory.setUint32(24, data.length, true)
    directory.setUint16(28, name.length, true); directory.setUint16(30, 0, true); directory.setUint16(32, 0, true)
    directory.setUint16(34, 0, true); directory.setUint16(36, 0, true); directory.setUint32(38, 0, true)
    directory.setUint32(42, offset, true); record.set(name, 46); central.push(record)
    offset += header.length + data.length
  }
  const centralBytes = concat(central)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralBytes.length, true); endView.setUint32(16, offset, true)
  return new Blob([...local, centralBytes, end].map(chunk => chunk as unknown as BlobPart), { type: 'application/zip' })
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let cursor = 0
  for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.length }
  return result
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
