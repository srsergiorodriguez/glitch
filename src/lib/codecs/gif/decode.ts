import type { Bitmap } from '../../core/types';

export type GifDocument = {
  width: number;
  height: number;
  frames: Bitmap[];
  /** milisegundos por frame */
  delays: number[];
  /** true si el archivo se rompió a mitad y solo se rescató una parte */
  truncated: boolean;
};

class Reader {
  pos = 0;

  constructor(private readonly data: Uint8Array) {}

  u8(): number {
    if (this.pos >= this.data.length) throw new Error('GIF truncado');
    return this.data[this.pos++];
  }

  u16(): number {
    const value = this.data[this.pos] | (this.data[this.pos + 1] << 8);
    this.pos += 2;
    return value;
  }

  take(length: number): Uint8Array {
    if (this.pos + length > this.data.length) throw new Error('GIF truncado');
    const slice = this.data.subarray(this.pos, this.pos + length);
    this.pos += length;
    return slice;
  }

  ascii(length: number): string {
    return String.fromCharCode(...this.take(length));
  }

  skipSubBlocks(): void {
    for (;;) {
      const size = this.u8();
      if (size === 0) return;
      this.pos += size;
      if (this.pos > this.data.length) throw new Error('GIF truncado');
    }
  }

  readSubBlocks(): Uint8Array {
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const size = this.u8();
      if (size === 0) break;
      const chunk = this.take(size);
      chunks.push(chunk);
      total += size;
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

/** Descodificador LZW de GIF, con prefix/suffix y pila de salida. */
function lzwDecode(minCodeSize: number, data: Uint8Array, pixelCount: number): Uint8Array {
  if (minCodeSize < 1 || minCodeSize > 11) throw new Error('LZW inválido');

  const out = new Uint8Array(pixelCount);
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = end + 1;

  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  for (let i = 0; i < clear; i++) suffix[i] = i;
  const stack = new Uint8Array(4097);

  let buffer = 0;
  let bits = 0;
  let position = 0;

  let previous = -1;
  let written = 0;
  let guard = pixelCount + 4096;

  while (written < pixelCount && guard-- > 0) {
    while (bits < codeSize) {
      if (position >= data.length) return out;
      buffer |= data[position++] << bits;
      bits += 8;
    }
    const code = buffer & ((1 << codeSize) - 1);
    buffer >>= codeSize;
    bits -= codeSize;

    if (code === end) break;
    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = end + 1;
      previous = -1;
      continue;
    }

    let first = 0;
    let depth = 0;
    let cursor = code;

    if (previous === -1) {
      if (code >= clear) break;
      first = suffix[code];
      out[written++] = first;
      previous = code;
      continue;
    }

    if (code < next) {
      while (cursor >= clear && depth < 4096) {
        stack[depth++] = suffix[cursor];
        cursor = prefix[cursor];
      }
      first = suffix[cursor];
      stack[depth++] = first;
      for (let i = depth - 1; i >= 0 && written < pixelCount; i--) out[written++] = stack[i];
    } else {
      cursor = previous;
      while (cursor >= clear && depth < 4096) {
        stack[depth++] = suffix[cursor];
        cursor = prefix[cursor];
      }
      first = suffix[cursor];
      stack[depth++] = first;
      for (let i = depth - 1; i >= 0 && written < pixelCount; i--) out[written++] = stack[i];
      if (written < pixelCount) out[written++] = first;
    }

    if (next < 4096) {
      prefix[next] = previous;
      suffix[next] = first;
      next++;
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
    }
    previous = code;
  }

  return out;
}

const INTERLACE_START = [0, 4, 2, 1];
const INTERLACE_STEP = [8, 8, 4, 2];

export function decodeGif(bytes: Uint8Array): GifDocument {
  const reader = new Reader(bytes);
  const signature = reader.ascii(6);
  if (signature !== 'GIF89a' && signature !== 'GIF87a') throw new Error('No es un GIF');

  const width = reader.u16();
  const height = reader.u16();
  if (width === 0 || height === 0) throw new Error('GIF sin dimensiones');

  const packed = reader.u8();
  reader.u8();
  reader.u8();

  let globalPalette: Uint8Array | null = null;
  if (packed & 0x80) globalPalette = reader.take(3 * (1 << ((packed & 7) + 1)));

  const canvas = new Uint8ClampedArray(width * height * 4);
  const frames: Bitmap[] = [];
  const delays: number[] = [];

  let pending = { disposal: 0, delay: 0, transparent: -1 };
  let previousDisposal = 0;
  let previousRect = { x: 0, y: 0, width: 0, height: 0 };
  let saved: Uint8ClampedArray | null = null;

  const clearRect = (rect: { x: number; y: number; width: number; height: number }): void => {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      const start = (y * width + rect.x) * 4;
      canvas.fill(0, start, start + rect.width * 4);
    }
  };

  while (reader.pos < bytes.length) {
    const selector = reader.u8();

    try {

      if (selector === 0x3b) break;

      if (selector === 0x21) {
        const label = reader.u8();
        if (label === 0xf9) {
          const size = reader.u8();
          if (size !== 4) {
            reader.pos += size;
            reader.u8();
            continue;
          }
          const flags = reader.u8();
          const delay = reader.u16();
          const transparentIndex = reader.u8();
          reader.u8();
          pending = {
            disposal: (flags >> 2) & 7,
            delay,
            transparent: flags & 1 ? transparentIndex : -1,
          };
        } else {
          reader.skipSubBlocks();
        }
        continue;
      }

      if (selector === 0x2c) {
        // composición: primero se aplica el disposal del frame anterior
        if (previousDisposal === 2) clearRect(previousRect);
        else if (previousDisposal === 3 && saved) canvas.set(saved);

        const x = reader.u16();
        const y = reader.u16();
        const frameWidth = reader.u16();
        const frameHeight = reader.u16();
        const imageFlags = reader.u8();

        let palette = globalPalette;
        if (imageFlags & 0x80) palette = reader.take(3 * (1 << ((imageFlags & 7) + 1)));
        if (!palette) throw new Error('GIF sin tabla de color');

        const interlaced = (imageFlags & 0x40) !== 0;
        const minCodeSize = reader.u8();
        const data = reader.readSubBlocks();
        const indices = lzwDecode(minCodeSize, data, frameWidth * frameHeight);

        if (pending.disposal === 3) saved = new Uint8ClampedArray(canvas);

        const transparent = pending.transparent;
        let cursor = 0;

        const paintRow = (row: number): void => {
          const targetY = y + row;
          if (targetY < 0 || targetY >= height) return;
          for (let column = 0; column < frameWidth; column++) {
            const index = indices[cursor++];
            if (index === transparent) continue;
            const targetX = x + column;
            if (targetX < 0 || targetX >= width) continue;
            const source = index * 3;
            const target = (targetY * width + targetX) * 4;
            canvas[target] = palette[source];
            canvas[target + 1] = palette[source + 1];
            canvas[target + 2] = palette[source + 2];
            canvas[target + 3] = 255;
          }
        };

        if (interlaced) {
          for (let pass = 0; pass < 4; pass++) {
            for (let row = INTERLACE_START[pass]; row < frameHeight; row += INTERLACE_STEP[pass]) {
              paintRow(row);
            }
          }
        } else {
          for (let row = 0; row < frameHeight; row++) paintRow(row);
        }

        frames.push({ data: new Uint8ClampedArray(canvas), width, height });
        delays.push(pending.delay * 10);

        previousDisposal = pending.disposal;
        previousRect = { x, y, width: frameWidth, height: frameHeight };
        continue;
      }

      // bloque desconocido: se ignora un byte y se sigue
    } catch (error) {
      // un archivo roto no siempre es basura: si ya hay frames, se rescatan
      if (frames.length > 0) return { width, height, frames, delays, truncated: true };
      throw error;
    }
  }

  if (frames.length === 0) throw new Error('El GIF no tiene frames');
  return { width, height, frames, delays, truncated: false };
}
