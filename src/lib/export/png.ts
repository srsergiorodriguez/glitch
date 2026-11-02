import type { Bitmap } from '../core/types';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PNG sin pérdida. Por ahora lo codifica el navegador; el encoder propio llega con GIF. */
export async function bitmapToPng(bitmap: Bitmap): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No hay contexto 2D disponible');
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height),
    0,
    0,
  );
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('El navegador no pudo codificar el PNG');
  return blob;
}

export function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') || 'glitch';
}
