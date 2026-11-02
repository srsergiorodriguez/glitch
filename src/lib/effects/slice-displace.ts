import type { Effect } from '../core/types';
import { numberParam } from '../core/params';

export const sliceDisplace: Effect = {
  id: 'pixel.slice-displace',
  label: 'Desplazar cortes',
  help: 'Corta franjas horizontales y las corre de sitio. Usa la semilla: mismo seed, mismo corte.',
  phase: 'pixel',
  surface: 'bitmap',
  params: [
    { kind: 'range', key: 'count', label: 'cortes', min: 1, max: 64, step: 1, default: 12 },
    { kind: 'range', key: 'shift', label: 'desplaz.', min: 1, max: 240, step: 1, default: 48, unit: 'px' },
    { kind: 'range', key: 'height', label: 'alto', min: 1, max: 40, step: 1, default: 8, unit: 'px' },
  ],
  apply(bitmap, params, ctx) {
    const count = Math.max(1, Math.round(numberParam(params, 'count')));
    const shift = Math.max(1, numberParam(params, 'shift'));
    const maxHeight = Math.max(1, Math.round(numberParam(params, 'height')));

    const { width, height, data } = bitmap;
    const rowBytes = width * 4;
    const row = new Uint8ClampedArray(rowBytes);

    for (let k = 0; k < count; k++) {
      const y0 = Math.floor(ctx.rng() * height);
      const bandHeight = Math.max(
        1,
        Math.min(height - y0, 1 + Math.floor(ctx.rng() * maxHeight)),
      );
      const dx = Math.round((ctx.rng() * 2 - 1) * shift);

      for (let y = y0; y < y0 + bandHeight; y++) {
        const start = y * rowBytes;
        row.set(data.subarray(start, start + rowBytes));
        for (let x = 0; x < width; x++) {
          const sx = (((x - dx) % width) + width) % width;
          const d = start + x * 4;
          const s = sx * 4;
          data[d] = row[s];
          data[d + 1] = row[s + 1];
          data[d + 2] = row[s + 2];
          data[d + 3] = row[s + 3];
        }
      }
    }
  },
};
