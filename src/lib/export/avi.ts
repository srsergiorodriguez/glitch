import type { Bitmap } from '../core/types';
import { writeAvi, type AviFrame } from '../codecs/avi/write';

async function bitmapToJpeg(bitmap: Bitmap, quality: number): Promise<Uint8Array> {
  // MJPEG en AVI: un JPEG por frame, con dimensiones pares
  const width = Math.max(2, bitmap.width & ~1);
  const height = Math.max(2, bitmap.height & ~1);

  const scratch = document.createElement('canvas');
  scratch.width = bitmap.width;
  scratch.height = bitmap.height;
  const scratchContext = scratch.getContext('2d');
  if (!scratchContext) throw new Error('No hay contexto 2D disponible');
  scratchContext.putImageData(
    new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height),
    0,
    0,
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No hay contexto 2D disponible');
  context.drawImage(scratch, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) throw new Error('el navegador no pudo codificar el JPEG');
  return new Uint8Array(await blob.arrayBuffer());
}

export async function framesToAvi(
  frames: Bitmap[],
  fps: number,
  quality = 0.85,
): Promise<Uint8Array> {
  if (frames.length === 0) throw new Error('no hay frames que exportar');
  const encoded: AviFrame[] = [];
  for (const frame of frames) {
    encoded.push({ jpeg: await bitmapToJpeg(frame, quality) });
  }
  return writeAvi(encoded, {
    width: frames[0].width & ~1,
    height: frames[0].height & ~1,
    fps,
  });
}
