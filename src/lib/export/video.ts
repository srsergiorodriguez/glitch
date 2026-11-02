import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  type OutputFormat,
} from 'mediabunny';
import type { Bitmap } from '../core/types';

export type VideoFrameInput = { bitmap: Bitmap; delay: number };

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No hay contexto 2D disponible');
  return [canvas, context];
}

async function encode(
  frames: VideoFrameInput[],
  format: OutputFormat,
  codec: 'avc' | 'vp9',
  allKeyframes: boolean,
): Promise<Blob> {
  const first = frames[0].bitmap;
  // H.264 trabaja con dimensiones pares: se recorta un píxel si hace falta
  const width = Math.max(2, first.width & ~1);
  const height = Math.max(2, first.height & ~1);

  const [canvas, context] = makeCanvas(width, height);
  const [scratch, scratchContext] = makeCanvas(first.width, first.height);

  const output = new Output({ format, target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, quality: new Quality('high') });
  output.addVideoTrack(source);

  await output.start();

  let time = 0;
  for (const frame of frames) {
    const { bitmap, delay } = frame;
    const duration = Math.max(0.01, delay / 1000);
    scratchContext.putImageData(
      new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height),
      0,
      0,
    );
    context.drawImage(scratch, 0, 0, width, height);
    // con todos los frames clave, corromper uno no arrastra al resto de la cadena
    await source.add(time, duration, allKeyframes ? { keyFrame: true } : undefined);
    time += duration;
  }

  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('el codificador no devolvió datos');
  return new Blob([buffer], { type: format.mimeType });
}

/** Video con los frames ya procesados: MP4 si el navegador puede, WebM si no. */
export async function framesToVideo(
  frames: VideoFrameInput[],
  options: { allKeyframes?: boolean } = {},
): Promise<{ blob: Blob; extension: 'mp4' | 'webm' }> {
  if (frames.length === 0) throw new Error('no hay frames que exportar');
  const allKeyframes = options.allKeyframes ?? false;

  try {
    const blob = await encode(frames, new Mp4OutputFormat(), 'avc', allKeyframes);
    return { blob, extension: 'mp4' };
  } catch {
    const blob = await encode(frames, new WebMOutputFormat(), 'vp9', allKeyframes);
    return { blob, extension: 'webm' };
  }
}

/** ¿Este navegador puede codificar video? */
export function canEncodeVideo(): boolean {
  return typeof globalThis.VideoEncoder === 'function';
}
