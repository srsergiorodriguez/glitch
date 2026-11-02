/** Escritor AVI mínimo con MJPEG: un frame = un JPEG en un chunk '00dc'. */

export type AviFrame = { jpeg: Uint8Array };

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

  u32(value: number): void {
    this.u8(value & 0xff);
    this.u8((value >> 8) & 0xff);
    this.u8((value >> 16) & 0xff);
    this.u8((value >>> 24) & 0xff);
  }

  ascii(text: string): void {
    for (let i = 0; i < text.length; i++) this.u8(text.charCodeAt(i));
  }

  raw(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buffer.set(bytes, this.length);
    this.length += bytes.length;
  }

  get size(): number {
    return this.length;
  }

  /** parchea un u32 ya escrito (tamaños que solo se conocen al final) */
  patch32(offset: number, value: number): void {
    this.buffer[offset] = value & 0xff;
    this.buffer[offset + 1] = (value >> 8) & 0xff;
    this.buffer[offset + 2] = (value >> 16) & 0xff;
    this.buffer[offset + 3] = (value >>> 24) & 0xff;
  }

  finish(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}

export type AviOptions = { width: number; height: number; fps: number };

/**
 * Estructura: RIFF AVI → LIST hdrl (avih + LIST strl con strh y strf) → LIST movi → idx1.
 * Los offsets de idx1 se miden desde el byte siguiente al fourcc 'movi'.
 */
export function writeAvi(frames: AviFrame[], options: AviOptions): Uint8Array {
  if (frames.length === 0) throw new Error('no hay frames para el AVI');
  const width = options.width & ~1;
  const height = options.height & ~1;
  const fps = Math.max(1, Math.round(options.fps));
  const microsPerFrame = Math.round(1_000_000 / fps);

  const out = new Writer();
  out.ascii('RIFF');
  const riffSizeAt = out.size;
  out.u32(0); // se parchea al final
  out.ascii('AVI ');

  // ── hdrl ────────────────────────────────────────────────
  out.ascii('LIST');
  const hdrlSizeAt = out.size;
  out.u32(0);
  out.ascii('hdrl');

  out.ascii('avih');
  out.u32(56);
  out.u32(microsPerFrame);
  out.u32(0); // dwMaxBytesPerSec
  out.u32(0); // dwPaddingGranularity
  out.u32(0x10); // AVIF_HASINDEX
  out.u32(frames.length); // dwTotalFrames
  out.u32(0); // dwInitialFrames
  out.u32(1); // dwStreams
  const suggested = Math.max(...frames.map((frame) => frame.jpeg.length));
  out.u32(suggested);
  out.u32(width);
  out.u32(height);
  out.u32(0);
  out.u32(0);
  out.u32(0);
  out.u32(0);

  out.ascii('LIST');
  const strlSizeAt = out.size;
  out.u32(0);
  out.ascii('strl');

  out.ascii('strh');
  out.u32(56);
  out.ascii('vids');
  out.ascii('MJPG');
  out.u32(0); // dwFlags
  out.u16(0); // wPriority
  out.u16(0); // wLanguage
  out.u32(0); // dwInitialFrames
  out.u32(1); // dwScale
  out.u32(fps); // dwRate
  out.u32(0); // dwStart
  out.u32(frames.length); // dwLength
  out.u32(suggested); // dwSuggestedBufferSize
  out.u32(0xffffffff); // dwQuality: por defecto
  out.u32(0); // dwSampleSize
  out.u16(0);
  out.u16(0);
  out.u16(width);
  out.u16(height);

  out.ascii('strf');
  out.u32(40);
  out.u32(40); // biSize
  out.u32(width);
  out.u32(height);
  out.u16(1); // biPlanes
  out.u16(24); // biBitCount
  out.ascii('MJPG'); // biCompression
  out.u32(width * height * 3); // biSizeImage
  out.u32(0);
  out.u32(0);
  out.u32(0);
  out.u32(0);

  out.patch32(strlSizeAt, out.size - strlSizeAt - 4);
  out.patch32(hdrlSizeAt, out.size - hdrlSizeAt - 4);

  // ── movi ────────────────────────────────────────────────
  out.ascii('LIST');
  const moviSizeAt = out.size;
  out.u32(0);
  out.ascii('movi');
  const moviDataStart = out.size;

  const table: { offset: number; size: number }[] = [];
  for (const frame of frames) {
    table.push({ offset: out.size - moviDataStart, size: frame.jpeg.length });
    out.ascii('00dc');
    out.u32(frame.jpeg.length);
    out.raw(frame.jpeg);
    if (frame.jpeg.length % 2 === 1) out.u8(0); // los chunks se alinean a 2 bytes
  }

  out.patch32(moviSizeAt, out.size - moviSizeAt - 4);

  // ── idx1 (con el orden real) ────────────────────────────
  out.ascii('idx1');
  out.u32(table.length * 16);
  for (const entry of table) {
    out.ascii('00dc');
    out.u32(0x10); // AVIIF_KEYFRAME
    out.u32(entry.offset);
    out.u32(entry.size);
  }

  out.patch32(riffSizeAt, out.size - 8);
  return out.finish();
}
