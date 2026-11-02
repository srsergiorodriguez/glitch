import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';
import type { Bitmap } from '../core/types';

export type CaptureOptions = {
  fps: number;
  maxFrames: number;
  maxEdge?: number;
  /** segundo del video donde empieza el tramo */
  from?: number;
  /** segundo donde termina; por defecto, el final del video */
  to?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};

export type CaptureResult = {
  frames: Bitmap[];
  width: number;
  height: number;
  /** fps real de la captura: baja si el video es largo, para cubrirlo entero */
  fps: number;
  /** segundos cubiertos */
  duration: number;
  /** segundo del video donde empieza la ventana */
  start: number;
  /** true si hubo que bajar los fps por el techo de frames */
  thinned: boolean;
};

function fitSize(width: number, height: number, edge: number): { width: number; height: number } {
  if (width <= edge && height <= edge) return { width, height };
  const scale = edge / Math.max(width, height);
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
  };
}

/**
 * Video → secuencia de frames decodificando con WebCodecs (mediabunny), sin rebobinar el
 * elemento: cada paquete se decodifica una sola vez y de ahí salen todos los frames.
 */
export async function captureVideo(file: File, options: CaptureOptions): Promise<CaptureResult> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('el archivo no tiene pista de video');
  if (!(await track.canDecode())) throw new Error('el navegador no puede decodificar este video');

  const duration = Math.max(0.05, await input.computeDuration());
  const from = Math.max(0, Math.min(duration - 0.05, options.from ?? 0));
  const to = Math.max(from + 0.05, Math.min(duration, options.to ?? duration));
  const span = to - from;
  const desired = Math.max(1, Math.round(span * options.fps));
  const total = Math.max(1, Math.min(options.maxFrames, desired));
  const step = span / total;
  const fps = Math.max(1, Math.round(1 / step));

  const displayWidth = await track.getDisplayWidth();
  const displayHeight = await track.getDisplayHeight();
  // más frames, menos resolución: el presupuesto de memoria es el mismo
  const edge = total > 120 ? 540 : (options.maxEdge ?? 720);
  const size = fitSize(displayWidth, displayHeight, edge);

  const sink = new CanvasSink(track, {
    width: size.width,
    height: size.height,
    fit: 'fill',
  });

  const timestamps: number[] = [];
  for (let i = 0; i < total; i++) {
    timestamps.push(Math.min(duration - 0.001, from + (i + 0.5) * step));
  }

  const frames: Bitmap[] = [];
  let done = 0;
  for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
    if (options.signal?.aborted) throw new Error('captura cancelada');
    done += 1;
    if (wrapped) {
      const context = wrapped.canvas.getContext('2d');
      if (context) {
        const pixels = context.getImageData(0, 0, wrapped.canvas.width, wrapped.canvas.height);
        frames.push({ data: pixels.data, width: pixels.width, height: pixels.height });
      }
    }
    options.onProgress?.(done, total);
  }

  if (frames.length === 0) throw new Error('no se pudo extraer ningún frame');

  return {
    frames,
    width: frames[0].width,
    height: frames[0].height,
    fps,
    duration,
    start: from,
    thinned: desired > options.maxFrames,
  };
}

/** Miniaturas repartidas por todo el video, para el selector de ventana. */
export async function grabThumbnails(
  file: File,
  count: number,
  width: number,
): Promise<string[]> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const track = await input.getPrimaryVideoTrack();
  if (!track) return [];
  const duration = Math.max(0.05, await input.computeDuration());
  const sink = new CanvasSink(track, { width, fit: 'contain' });

  const timestamps: number[] = [];
  for (let i = 0; i < count; i++) timestamps.push(((i + 0.5) / count) * duration);

  const thumbs: string[] = [];
  for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
    if (!wrapped) {
      thumbs.push('');
      continue;
    }
    // el canvas del sink puede ser OffscreenCanvas: se copia a uno normal para exportar
    const canvas = document.createElement('canvas');
    canvas.width = wrapped.canvas.width;
    canvas.height = wrapped.canvas.height;
    canvas.getContext('2d')?.drawImage(wrapped.canvas as CanvasImageSource, 0, 0);
    thumbs.push(canvas.toDataURL('image/jpeg', 0.6));
  }
  return thumbs;
}

/** Duración del video sin decodificarlo: solo lee el índice. */
export async function videoDuration(file: File): Promise<number> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  return Math.max(0.05, await input.computeDuration());
}
