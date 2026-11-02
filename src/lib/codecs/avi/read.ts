/** Lee la tabla de frames de un AVI y la usa para reordenar chunks sin tocar el índice. */

export type AviFrameEntry = { offset: number; size: number; chunkStart: number; chunkEnd: number };

export type AviLayout = {
  /** primer byte del contenido de movi (después del fourcc 'movi') */
  moviDataStart: number;
  /** byte donde termina el contenido de movi */
  moviDataEnd: number;
  frames: AviFrameEntry[];
};

function readFourcc(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

function readU32(bytes: Uint8Array, at: number): number {
  return (
    (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0
  );
}

/** Lee la tabla idx1 (offsets y tamaños tal como quedaron escritos). */
export function readIdx1(bytes: Uint8Array): { offset: number; size: number }[] | null {
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const type = readFourcc(bytes, pos);
    const size = readU32(bytes, pos + 4);
    if (type === 'idx1') {
      const entries: { offset: number; size: number }[] = [];
      const count = Math.floor(size / 16);
      for (let i = 0; i < count; i++) {
        const at = pos + 8 + i * 16;
        if (at + 16 > bytes.length) break;
        entries.push({ offset: readU32(bytes, at + 8), size: readU32(bytes, at + 12) });
      }
      return entries;
    }
    if (size === 0 || pos + 8 + size > bytes.length) break;
    pos += 8 + size + (size % 2);
  }
  return null;
}

/** Recorre los chunks de movi buscando '00dc' (video MJPEG). */
export function readAviLayout(bytes: Uint8Array): AviLayout | null {
  if (bytes.length < 12 || readFourcc(bytes, 0) !== 'RIFF' || readFourcc(bytes, 8) !== 'AVI ') {
    return null;
  }

  let moviDataStart = -1;
  let moviDataEnd = -1;

  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const type = readFourcc(bytes, pos);
    const size = readU32(bytes, pos + 4);
    if (pos + 8 + size > bytes.length) break;

    if (type === 'LIST' && readFourcc(bytes, pos + 8) === 'movi') {
      moviDataStart = pos + 12;
      moviDataEnd = pos + 8 + size;
      break;
    }
    pos += 8 + size + (size % 2);
  }
  if (moviDataStart < 0) return null;

  const frames: AviFrameEntry[] = [];
  let cursor = moviDataStart;
  while (cursor + 8 <= moviDataEnd) {
    const id = readFourcc(bytes, cursor);
    const size = readU32(bytes, cursor + 4);
    const chunkEnd = cursor + 8 + size + (size % 2);
    if (cursor + 8 + size > moviDataEnd) break;
    if (id === '00dc' || id === '00db') {
      frames.push({
        offset: cursor - moviDataStart,
        size,
        chunkStart: cursor,
        chunkEnd,
      });
    }
    cursor = chunkEnd;
  }

  if (frames.length === 0) return null;
  return { moviDataStart, moviDataEnd, frames };
}

/**
 * Reordena los chunks de movi y deja el idx1 **intacto**: así el índice queda obsoleto,
 * que es justo lo que hace tomato.
 */
export function reorderAvi(bytes: Uint8Array, order: number[]): Uint8Array {
  const layout = readAviLayout(bytes);
  if (!layout) return bytes;

  const pieces: Uint8Array[] = [];
  let total = 0;
  for (const index of order) {
    const frame = layout.frames[index];
    if (!frame) continue;
    const piece = bytes.subarray(frame.chunkStart, frame.chunkEnd);
    pieces.push(piece);
    total += piece.length;
  }
  if (pieces.length === 0) return bytes;

  const before = bytes.subarray(0, layout.moviDataStart);
  const after = bytes.subarray(layout.moviDataEnd);
  const out = new Uint8Array(before.length + total + after.length);
  out.set(before, 0);
  let offset = before.length;
  for (const piece of pieces) {
    out.set(piece, offset);
    offset += piece.length;
  }
  out.set(after, offset);
  return out;
}
