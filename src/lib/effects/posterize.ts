import type { Effect } from '../core/types';
import { numberParam } from '../core/params';

export const posterize: Effect = {
  id: 'pixel.posterize',
  label: 'Posterizar',
  help: 'Reduce los niveles por canal. Aplana el color y hace visible la paleta.',
  phase: 'pixel',
  surface: 'bitmap',
  params: [
    { kind: 'range', key: 'levels', label: 'niveles', min: 2, max: 32, step: 1, default: 6 },
  ],
  apply(bitmap, params) {
    const levels = Math.max(2, Math.round(numberParam(params, 'levels')));
    const step = 255 / (levels - 1);
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.round(Math.round(i / step) * step);

    const data = bitmap.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
  },
};
