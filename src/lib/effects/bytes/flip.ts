import type { Effect } from '../../core/types';
import { numberParam } from '../../core/params';

export const flip: Effect = {
  id: 'bytes.flip',
  label: 'Invertir tramos',
  help: 'Niega bytes en regiones al azar. Rompe la entropía sin tocar la cabecera; el stream comprimido puede no sobrevivir.',
  phase: 'ingest',
  surface: 'bytes',
  params: [
    { kind: 'range', key: 'regions', label: 'regiones', min: 1, max: 40, step: 1, default: 6 },
    { kind: 'range', key: 'size', label: 'tamaño', min: 1, max: 512, step: 1, default: 24, unit: 'KB' },
    { kind: 'range', key: 'start', label: 'desde', min: 5, max: 90, step: 1, default: 25, unit: '%' },
  ],
  applyBytes(bytes, params, ctx) {
    const out = bytes.slice();
    const regions = Math.max(1, Math.round(numberParam(params, 'regions')));
    const size = Math.max(1, numberParam(params, 'size')) * 1024;
    const from = Math.floor(out.length * (numberParam(params, 'start') / 100));
    const span = Math.max(1, out.length - from);

    for (let i = 0; i < regions; i++) {
      const offset = from + Math.floor(ctx.rng() * span);
      const end = Math.min(out.length, offset + size);
      for (let p = offset; p < end; p++) out[p] = out[p] ^ 0xff;
    }

    return out;
  },
};
