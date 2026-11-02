import type { Bitmap } from './types';
import { permute, type OrderMode } from './order';
import { hash32, mulberry32 } from './prng';

export type Moshing = {
  mode: OrderMode;
  amount: number;
};

async function toJpeg(bitmap: Bitmap, quality = 0.8): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No hay contexto 2D disponible');
  context.putImageData(
    new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height),
    0,
    0,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) throw new Error('el navegador no pudo codificar el JPEG');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Decodifica lo que se pueda: el JPEG mezclado da bandas y medias imágenes. */
async function decodeLoose(bytes: Uint8Array): Promise<Bitmap | null> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('no decodifica'));
    });
    if (image.naturalWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return { data: pixels.data, width: canvas.width, height: canvas.height };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Desgarro del JPEG: el frame se corta a media codificación y se le pega la cola del JPEG de
 * otro frame. El navegador decodifica lo que alcanza y salen bandas y medias imágenes.
 *
 * No se usa el índice roto del AVI porque Chrome no renderiza JPEG truncados: los pinta en
 * negro. El archivo con el `idx1` viejo sí se puede exportar (efecto «Ordenar el AVI»), y ese
 * se ve en VLC.
 */
export async function moshSequence(
  frames: Bitmap[],
  settings: Moshing,
  seed: number,
): Promise<Bitmap[]> {
  if (frames.length < 2) return frames;

  const rng = mulberry32(hash32(`mosh|${seed}`));
  const order = permute(
    frames.map((_, index) => index),
    settings.mode,
    settings.amount,
    rng,
  );

  const jpegs = [];
  for (const frame of frames) jpegs.push(await toJpeg(frame));

  const out: Bitmap[] = [];
  for (let index = 0; index < frames.length; index++) {
    const head = jpegs[index];
    const tail = jpegs[order[index] ?? index] ?? head;
    const cut = Math.max(32, Math.floor(head.length * 0.55));
    const merged = new Uint8Array(cut + Math.max(2, tail.length - cut));
    merged.set(head.subarray(0, cut), 0);
    merged.set(tail.subarray(cut), cut);
    const decoded = await decodeLoose(merged);
    out.push(decoded ?? frames[index]);
  }
  return out;
}
