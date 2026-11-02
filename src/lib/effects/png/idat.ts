import type { Effect } from '../../core/types';
import { numberParam } from '../../core/params';
import { editScanlines, isPng } from '../../codecs/png/chunks';

export const pngIdat: Effect = {
  id: 'png.idat',
  label: 'Triturar IDAT',
  help: 'Corrompe las scanlines descomprimidas y vuelve a comprimir con el CRC recalculado. El PNG sigue siendo válido.',
  phase: 'ingest',
  surface: 'bytes',
  requires: ['image/png'],
  params: [
    { kind: 'range', key: 'regions', label: 'regiones', min: 1, max: 80, step: 1, default: 20 },
    { kind: 'range', key: 'size', label: 'tamaño', min: 1, max: 256, step: 1, default: 40, unit: 'B' },
  ],
  async applyBytes(bytes, params, ctx) {
    if (!isPng(bytes)) return bytes;
    const regions = Math.max(1, Math.round(numberParam(params, 'regions')));
    const size = Math.max(1, Math.round(numberParam(params, 'size')));

    return editScanlines(bytes, (raw) => {
      for (let i = 0; i < regions; i++) {
        const start = Math.floor(ctx.rng() * raw.length);
        for (let k = 0; k < size; k++) {
          raw[(start + k) % raw.length] = Math.floor(ctx.rng() * 256);
        }
      }
    });
  },
};
