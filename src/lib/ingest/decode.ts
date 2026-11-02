import type { Bitmap } from '../core/types';
import { decodeGif } from '../codecs/gif/decode';

export const MAX_EDGE = 2048;
export const MAX_FRAMES = 300;

export type Decoded = {
  frames: Bitmap[];
  delays: number[];
  width: number;
  height: number;
  /** true si el archivo venía roto y solo se pudo rescatar una parte */
  partial: boolean;
};

export function fitSize(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const factor = maxEdge / longest;
  return { width: Math.round(width * factor), height: Math.round(height * factor) };
}

function canvasContext(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No hay contexto 2D disponible');
  return context;
}

export function toBitmap(source: CanvasImageSource, width: number, height: number): Bitmap {
  const context = canvasContext(width, height);
  context.drawImage(source, 0, 0, width, height);
  return { data: context.getImageData(0, 0, width, height).data, width, height };
}

/** Escala con letterbox negro: conserva la proporción sin recortar. */
export function scaleToFrame(bitmap: Bitmap, width: number, height: number): Bitmap {
  const context = canvasContext(width, height);
  context.fillStyle = '#000';
  context.fillRect(0, 0, width, height);
  const factor = Math.min(width / bitmap.width, height / bitmap.height);
  const targetWidth = Math.max(1, Math.round(bitmap.width * factor));
  const targetHeight = Math.max(1, Math.round(bitmap.height * factor));
  const source = canvasContext(bitmap.width, bitmap.height);
  source.putImageData(new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height), 0, 0);
  context.drawImage(
    source.canvas,
    Math.round((width - targetWidth) / 2),
    Math.round((height - targetHeight) / 2),
    targetWidth,
    targetHeight,
  );
  return { data: context.getImageData(0, 0, width, height).data, width, height };
}

async function decodeImageElement(bytes: Uint8Array, type: string): Promise<Bitmap> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const size = fitSize(image.naturalWidth, image.naturalHeight);
    return toBitmap(image, size.width, size.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function decodeImageBytes(bytes: Uint8Array, type: string): Promise<Bitmap> {
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }));
    try {
      const size = fitSize(bitmap.width, bitmap.height);
      return toBitmap(bitmap, size.width, size.height);
    } finally {
      bitmap.close();
    }
  } catch {
    // los archivos truncados suelen fallar acá; <img> es más tolerante
    return decodeImageElement(bytes, type);
  }
}

export async function decodeBytes(bytes: Uint8Array, type: string): Promise<Decoded> {
  if (type === 'image/gif') {
    const gif = decodeGif(bytes);
    const size = fitSize(gif.width, gif.height);
    const frames = gif.frames.slice(0, MAX_FRAMES).map((frame) => {
      if (size.width === frame.width && size.height === frame.height) return frame;
      return scaleToFrame(frame, size.width, size.height);
    });
    return {
      frames,
      delays: gif.delays.slice(0, MAX_FRAMES),
      width: size.width,
      height: size.height,
      partial: gif.truncated,
    };
  }

  const frame = await decodeImageBytes(bytes, type);
  return { frames: [frame], delays: [0], width: frame.width, height: frame.height, partial: false };
}

/** Iguala el tamaño de una secuencia de imágenes sueltas. */
export function normalizeFrames(frames: Bitmap[]): Bitmap[] {
  if (frames.length === 0) return frames;
  const { width, height } = fitSize(frames[0].width, frames[0].height);
  return frames.map((frame) =>
    frame.width === width && frame.height === height ? frame : scaleToFrame(frame, width, height),
  );
}
