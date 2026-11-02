import type { Effect } from '../core/types';
import { numberParam } from '../core/params';

export const scanlines: Effect = {
  id: 'pixel.scanlines',
  label: 'Líneas de barrido',
  help: 'Oscurece filas periódicas. Sube la fuerza para ensuciar la señal.',
  phase: 'pixel',
  surface: 'bitmap',
  params: [
    { kind: 'range', key: 'period', label: 'período', min: 2, max: 10, step: 1, default: 3 },
    { kind: 'range', key: 'strength', label: 'fuerza', min: 0, max: 0.9, step: 0.05, default: 0.3 },
    { kind: 'range', key: 'offset', label: 'desfase', min: 0, max: 10, step: 1, default: 0 },
  ],
  apply(bitmap, params) {
    const period = Math.max(2, Math.round(numberParam(params, 'period')));
    const strength = Math.min(0.9, Math.max(0, numberParam(params, 'strength')));
    const offset = Math.round(numberParam(params, 'offset'));
    const factor = 1 - strength;

    const { width, height, data } = bitmap;
    for (let y = 0; y < height; y++) {
      if ((y + offset) % period !== 0) continue;
      const start = y * width * 4;
      for (let i = start; i < start + width * 4; i += 4) {
        data[i] *= factor;
        data[i + 1] *= factor;
        data[i + 2] *= factor;
      }
    }
  },
};
