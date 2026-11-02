/** Utilidades de bajo nivel para PNG: chunks, CRC32 y flujo zlib. */

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

export const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export type PngChunk = {
  type: string;
  /** inicio del chunk, incluyendo longitud y tipo */
  start: number;
  dataStart: number;
  dataEnd: number;
  end: number;
};

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

export function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = -1;
  for (let i = start; i < end; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

export function readChunks(bytes: Uint8Array): PngChunk[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: PngChunk[] = [];
  let pos = 8;
  while (pos + 12 <= bytes.length) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7],
    );
    const dataStart = pos + 8;
    const dataEnd = dataStart + length;
    const end = dataEnd + 4;
    if (end > bytes.length) break;
    chunks.push({ type, start: pos, dataStart, dataEnd, end });
    pos = end;
    if (type === 'IEND') break;
  }
  return chunks;
}

export type PngInfo = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlaced: boolean;
  /** bytes por fila sin contar el byte de filtro */
  rowBytes: number;
  /** bytes por píxel (mínimo 1) */
  bytesPerPixel: number;
};

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function readInfo(bytes: Uint8Array, chunks: PngChunk[]): PngInfo | null {
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR');
  if (!ihdr) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(ihdr.dataStart);
  const height = view.getUint32(ihdr.dataStart + 4);
  const bitDepth = bytes[ihdr.dataStart + 8];
  const colorType = bytes[ihdr.dataStart + 9];
  const interlaced = bytes[ihdr.dataStart + 12] === 1;
  const channels = CHANNELS[colorType] ?? 4;
  const bitsPerPixel = channels * bitDepth;
  return {
    width,
    height,
    bitDepth,
    colorType,
    interlaced,
    rowBytes: Math.ceil((width * bitsPerPixel) / 8),
    bytesPerPixel: Math.max(1, Math.ceil(bitsPerPixel / 8)),
  };
}

/** Reconstruye el PNG con un único IDAT nuevo. Los demás chunks se copian tal cual. */
export function rebuildPng(
  bytes: Uint8Array,
  chunks: PngChunk[],
  idat: Uint8Array,
): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array(PNG_SIGNATURE)];
  let wroteIdat = false;

  const pushChunk = (type: string, data: Uint8Array): void => {
    const header = new Uint8Array(8);
    new DataView(header.buffer).setUint32(0, data.length);
    for (let i = 0; i < 4; i++) header[4 + i] = type.charCodeAt(i);
    const crcSource = new Uint8Array(4 + data.length);
    crcSource.set(header.subarray(4), 0);
    crcSource.set(data, 4);
    const crc = new Uint8Array(4);
    new DataView(crc.buffer).setUint32(0, crc32(crcSource, 0, crcSource.length));
    parts.push(header, data, crc);
  };

  for (const chunk of chunks) {
    if (chunk.type === 'IDAT') {
      if (!wroteIdat) {
        // varios IDAT de 64 KB: algunos decodificadores antiguos no aceptan uno gigante
        for (let offset = 0; offset < idat.length; offset += 65536) {
          pushChunk('IDAT', idat.subarray(offset, Math.min(idat.length, offset + 65536)));
        }
        wroteIdat = true;
      }
      continue;
    }
    parts.push(bytes.subarray(chunk.start, chunk.end));
  }

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Junta todos los IDAT, los infla, deja tocar las scanlines y vuelve a comprimir. */
export async function editScanlines(
  bytes: Uint8Array,
  edit: (raw: Uint8Array, info: PngInfo) => void,
): Promise<Uint8Array> {
  const chunks = readChunks(bytes);
  const info = readInfo(bytes, chunks);
  if (!info) throw new Error('PNG sin IHDR');

  const idats = chunks.filter((chunk) => chunk.type === 'IDAT');
  if (idats.length === 0) throw new Error('PNG sin IDAT');
  const compressed = new Uint8Array(idats.reduce((sum, chunk) => sum + (chunk.dataEnd - chunk.dataStart), 0));
  let offset = 0;
  for (const chunk of idats) {
    compressed.set(bytes.subarray(chunk.dataStart, chunk.dataEnd), offset);
    offset += chunk.dataEnd - chunk.dataStart;
  }

  const raw = await inflate(compressed);
  edit(raw, info);
  return rebuildPng(bytes, chunks, await deflate(raw));
}
