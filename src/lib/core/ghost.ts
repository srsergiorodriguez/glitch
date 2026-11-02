import type { Bitmap } from './types';

export type Ghost = {
  /** cada cuántos frames se congela una imagen nueva */
  hold: number;
  /** cuánto movimiento se le suma a la imagen congelada */
  gain: number;
};

/**
 * Datamosh clásico, en píxeles: se congela una imagen y se le va sumando el movimiento de
 * los frames siguientes. El resultado es la textura vieja moviéndose con el gesto nuevo.
 */
export function applyGhost(frames: Bitmap[], settings: Ghost): Bitmap[] {
  const hold = Math.max(2, Math.round(settings.hold));
  const gain = settings.gain;
  const out: Bitmap[] = [];

  let ghost: Uint8ClampedArray | null = null;
  let previous: Uint8ClampedArray | null = null;

  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    const pixels = frame.data;

    if (!ghost || index % hold === 0) {
      ghost = new Uint8ClampedArray(pixels);
      previous = pixels;
      out.push({ data: new Uint8ClampedArray(ghost), width: frame.width, height: frame.height });
      continue;
    }

    if (!previous || previous.length !== pixels.length) {
      ghost = new Uint8ClampedArray(pixels);
      previous = pixels;
      out.push({ data: new Uint8ClampedArray(ghost), width: frame.width, height: frame.height });
      continue;
    }

    for (let offset = 0; offset < pixels.length; offset += 4) {
      const deltaR = (pixels[offset] - previous[offset]) * gain;
      const deltaG = (pixels[offset + 1] - previous[offset + 1]) * gain;
      const deltaB = (pixels[offset + 2] - previous[offset + 2]) * gain;
      // Uint8ClampedArray satura a 0 y 255: sin desbordes
      ghost[offset] = ghost[offset] + deltaR;
      ghost[offset + 1] = ghost[offset + 1] + deltaG;
      ghost[offset + 2] = ghost[offset + 2] + deltaB;
      ghost[offset + 3] = 255;
    }

    previous = pixels;
    out.push({ data: new Uint8ClampedArray(ghost), width: frame.width, height: frame.height });
  }

  return out;
}
