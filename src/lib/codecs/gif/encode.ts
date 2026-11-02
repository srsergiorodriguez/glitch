import type { Bitmap } from '../../core/types';
import { hash32, mulberry32 } from '../../core/prng';
import { NO_GLITCH, type GifGlitch } from '../../core/gif-settings';

const MAX_COLORS = 256;
const SAMPLES = 4096;

class Writer {
  private buffer = new Uint8Array(1 << 16);
  private length = 0;

  private ensure(extra: number): void {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }

  u8(value: number): void {
    this.ensure(1);
    this.buffer[this.length++] = value & 0xff;
  }

  u16(value: number): void {
    this.u8(value & 0xff);
    this.u8((value >> 8) & 0xff);
  }

  raw(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buffer.set(bytes, this.length);
    this.length += bytes.length;
  }

  ascii(text: string): void {
    for (let i = 0; i < text.length; i++) this.u8(text.charCodeAt(i));
  }

  subBlocks(data: Uint8Array): void {
    for (let offset = 0; offset < data.length; offset += 255) {
      const size = Math.min(255, data.length - offset);
      this.u8(size);
      this.raw(data.subarray(offset, offset + size));
    }
    this.u8(0);
  }

  finish(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}

type Color = [number, number, number];

function collectSamples(frames: Bitmap[]): Color[] {
  let pixels = 0;
  for (const frame of frames) pixels += frame.width * frame.height;
  const stride = Math.max(1, Math.floor(pixels / SAMPLES));

  const samples: Color[] = [];
  let counter = 0;
  for (const frame of frames) {
    const { data } = frame;
    for (let i = 0; i < data.length; i += 4) {
      if (counter++ % stride !== 0) continue;
      if (data[i + 3] < 8) continue;
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  return samples;
}

function widestChannel(box: Color[]): { channel: number; range: number } {
  let minR = 255;
  let maxR = 0;
  let minG = 255;
  let maxG = 0;
  let minB = 255;
  let maxB = 0;
  for (const [r, g, b] of box) {
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }
  const ranges = [maxR - minR, maxG - minG, maxB - minB];
  let channel = 0;
  if (ranges[1] > ranges[channel]) channel = 1;
  if (ranges[2] > ranges[channel]) channel = 2;
  return { channel, range: ranges[channel] };
}

function average(box: Color[]): Color {
  if (box.length === 0) return [0, 0, 0];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const color of box) {
    r += color[0];
    g += color[1];
    b += color[2];
  }
  return [Math.round(r / box.length), Math.round(g / box.length), Math.round(b / box.length)];
}

/** Median cut determinista: sin aleatoriedad, así el mismo frame da la misma paleta. */
function buildPalette(samples: Color[]): Uint8Array {
  const palette = new Uint8Array(MAX_COLORS * 3);
  if (samples.length === 0) return palette;

  let boxes: Color[][] = [samples];
  while (boxes.length < MAX_COLORS) {
    let target = -1;
    let targetRange = 0;
    let targetChannel = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const widest = widestChannel(boxes[i]);
      if (widest.range > targetRange) {
        target = i;
        targetRange = widest.range;
        targetChannel = widest.channel;
      }
    }
    if (target < 0 || targetRange === 0) break;

    const box = boxes[target];
    box.sort((a, b) => a[targetChannel] - b[targetChannel]);
    const half = box.length >> 1;
    boxes.splice(target, 1, box.slice(0, half), box.slice(half));
  }

  boxes.forEach((box, index) => {
    const [r, g, b] = average(box);
    palette[index * 3] = r;
    palette[index * 3 + 1] = g;
    palette[index * 3 + 2] = b;
  });
  return palette;
}

/** La tabla que se escribe no es la que se usó para cuantizar: el gesto de glifch. */
function alterPalette(palette: Uint8Array, glitch: GifGlitch): Uint8Array {
  const out = palette.slice();
  if (glitch.paletteDesaturate > 0) {
    const amount = Math.min(1, glitch.paletteDesaturate);
    for (let i = 0; i < out.length; i += 3) {
      const gray = 0.2989 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2];
      for (let c = 0; c < 3; c++) {
        out[i + c] = Math.max(0, Math.min(255, Math.round(out[i + c] * (1 - amount) + gray * amount)));
      }
    }
  }
  if (glitch.paletteRotate !== 0) {
    const shift = ((glitch.paletteRotate % MAX_COLORS) + MAX_COLORS) % MAX_COLORS;
    const rotated = new Uint8Array(out.length);
    for (let i = 0; i < MAX_COLORS; i++) {
      const source = ((i + shift) % MAX_COLORS) * 3;
      rotated[i * 3] = out[source];
      rotated[i * 3 + 1] = out[source + 1];
      rotated[i * 3 + 2] = out[source + 2];
    }
    return rotated;
  }
  return out;
}

/** Tabla de 32×32×32 colores → índice de paleta. Cuantiza en una pasada. */
function buildLut(palette: Uint8Array, used: number): Uint8Array {
  const lut = new Uint8Array(32768);
  for (let index = 0; index < 32768; index++) {
    const r = ((index >> 10) & 31) * 8 + 4;
    const g = ((index >> 5) & 31) * 8 + 4;
    const b = (index & 31) * 8 + 4;
    let best = 0;
    let bestDistance = Infinity;
    for (let color = 0; color < used; color++) {
      const dr = r - palette[color * 3];
      const dg = g - palette[color * 3 + 1];
      const db = b - palette[color * 3 + 2];
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = color;
        if (distance === 0) break;
      }
    }
    lut[index] = best;
  }
  return lut;
}

function quantize(frame: Bitmap, lut: Uint8Array): Uint8Array {
  const { data } = frame;
  const indices = new Uint8Array(frame.width * frame.height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    indices[p] = lut[((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)];
  }
  return indices;
}

/** ReSlice: reordena tramos del stream de índices antes de comprimir. */
function resliceStream(
  indices: Uint8Array,
  slices: number,
  probability: number,
  rng: () => number,
): Uint8Array {
  const length = indices.length;
  const sections = Math.max(2, Math.round(slices));
  const chunk = Math.max(1, Math.floor(length / sections));
  const decisions = new Uint8Array(Math.min(length, 8192));
  for (let i = 0; i < decisions.length; i++) decisions[i] = rng() < probability ? 1 : 0;

  const out = new Uint8Array(length);
  let section = Math.floor(rng() * sections) * chunk;
  let count = 0;

  for (let i = 0; i < length; i++) {
    if (count >= chunk) {
      count = 0;
      section = Math.floor(rng() * sections) * chunk;
    }
    out[i] = decisions[i % decisions.length]
      ? indices[Math.min(length - 1, section + count)]
      : indices[i];
    count++;
  }
  return out;
}

type Substitute = { probability: number; mode: 'same-length' | 'random'; rng: () => number };

function lzwEncode(
  indices: Uint8Array,
  minCodeSize: number,
  substitute?: Substitute,
): Uint8Array {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out = new Writer();
  const dictionary = new Map<number, number>();

  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let accumulator = 0;
  let bitCount = 0;

  const lengths = new Uint16Array(4096).fill(1);
  const buckets: number[][] = Array.from({ length: 4097 }, () => []);

  const emit = (rawCode: number): void => {
    let code = rawCode;
    // solo se sustituyen códigos de datos: clear y EOI deben llegar intactos
    if (substitute && rawCode > end && next > end + 1 && substitute.rng() < substitute.probability) {
      if (substitute.mode === 'same-length') {
        const bucket = buckets[lengths[rawCode]];
        if (bucket && bucket.length > 1) {
          code = bucket[Math.floor(substitute.rng() * bucket.length)];
        }
      } else {
        const limit = next - 1;
        if (limit > end) code = end + 1 + Math.floor(substitute.rng() * (limit - end));
      }
    }

    accumulator |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.u8(accumulator & 0xff);
      accumulator >>>= 8;
      bitCount -= 8;
    }
  };

  const assign = (code: number, prefix: number): void => {
    lengths[code] = lengths[prefix] + 1;
    buckets[lengths[code]].push(code);
  };

  emit(clear);
  if (indices.length === 0) {
    emit(end);
    if (bitCount > 0) out.u8(accumulator & 0xff);
    return out.finish();
  }

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const value = indices[i];
    const key = (prefix << 8) | value;
    const found = dictionary.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }

    emit(prefix);
    if (next < 4096) {
      dictionary.set(key, next);
      assign(next, prefix);
      next++;
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dictionary.clear();
      codeSize = minCodeSize + 1;
      next = end + 1;
      // los índices por longitud también se reinician: si no, se emiten códigos muertos
      for (let bucket = 0; bucket < buckets.length; bucket++) buckets[bucket].length = 0;
    }
    prefix = value;
  }

  emit(prefix);
  emit(end);
  if (bitCount > 0) out.u8(accumulator & 0xff);
  return out.finish();
}

export type GifPrepared = { palette: Uint8Array; lut: Uint8Array };

export type GifOptions = {
  /** duración por defecto, en milisegundos */
  delayMs?: number;
  /** duración de cada frame; si falta, se usa delayMs */
  delays?: number[];
  glitch?: GifGlitch;
  seed?: number;
};

/** Paleta y LUT una sola vez por secuencia: se reutilizan para exportar y para el visor. */
export function prepareGif(frames: Bitmap[], glitch: GifGlitch = NO_GLITCH): GifPrepared {
  const base = buildPalette(collectSamples(frames));
  return { palette: alterPalette(base, glitch), lut: buildLut(base, MAX_COLORS) };
}

function writeGif(frames: Bitmap[], prepared: GifPrepared, options: GifOptions): Uint8Array {
  if (frames.length === 0) throw new Error('Nada que codificar');
  const width = frames[0].width;
  const height = frames[0].height;
  const glitch = options.glitch ?? NO_GLITCH;
  const seed = options.seed ?? 0;
  const fallback = Math.max(2, Math.round((options.delayMs ?? 100) / 10));

  const out = new Writer();
  out.ascii('GIF89a');
  out.u16(width);
  out.u16(height);
  out.u8(0xf7); // tabla global, 8 bits de color, 256 entradas
  out.u8(0);
  out.u8(0);
  out.raw(prepared.palette);

  // loop infinito
  out.u8(0x21);
  out.u8(0xff);
  out.u8(0x0b);
  out.ascii('NETSCAPE2.0');
  out.u8(0x03);
  out.u8(0x01);
  out.u16(0);
  out.u8(0x00);

  frames.forEach((frame, index) => {
    if (frame.width !== width || frame.height !== height) {
      throw new Error('Todos los frames deben medir lo mismo');
    }

    const delay = Math.max(2, Math.round((options.delays?.[index] ?? fallback * 10) / 10));
    const rng = mulberry32(hash32(`gif|${seed}|${index}`));

    let indices = quantize(frame, prepared.lut);
    if (glitch.resliceSlices > 1 && glitch.resliceProbability > 0) {
      indices = resliceStream(indices, glitch.resliceSlices, glitch.resliceProbability, rng);
    }

    const substitute: Substitute | undefined =
      glitch.substituteProbability > 0
        ? { probability: glitch.substituteProbability, mode: glitch.substituteMode, rng }
        : undefined;

    out.u8(0x21);
    out.u8(0xf9);
    out.u8(0x04);
    out.u8(0x04); // disposal 1, sin transparencia
    out.u16(delay);
    out.u8(0x00);
    out.u8(0x00);

    out.u8(0x2c);
    out.u16(0);
    out.u16(0);
    out.u16(width);
    out.u16(height);
    out.u8(0x00);

    out.u8(0x08);
    out.subBlocks(lzwEncode(indices, 8, substitute));
  });

  out.u8(0x3b);
  return out.finish();
}

export function encodeGif(frames: Bitmap[], options: GifOptions = {}): Uint8Array {
  return writeGif(frames, prepareGif(frames, options.glitch), options);
}

/** Un solo frame con una paleta ya preparada: el visor ve el mismo resultado que el GIF final. */
export function encodeGifFrame(
  frame: Bitmap,
  prepared: GifPrepared,
  options: GifOptions = {},
): Uint8Array {
  return writeGif([frame], prepared, options);
}
