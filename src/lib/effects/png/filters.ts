import type { Effect } from '../../core/types';
import { numberParam } from '../../core/params';
import { editScanlines, isPng } from '../../codecs/png/chunks';

export const pngFilters: Effect = {
  id: 'png.filters',
  label: 'Cambiar filtros',
  help: 'Reescribe el byte de filtro de cada fila. El decodificador desfiltra con otro criterio y la imagen se corre.',
  phase: 'ingest',
  surface: 'bytes',
  requires: ['image/png'],
  params: [
    { kind: 'range', key: 'probability', label: 'probab.', min: 0, max: 1, step: 0.05, default: 0.2 },
  ],
  async applyBytes(bytes, params, ctx) {
    if (!isPng(bytes)) return bytes;
    const probability = numberParam(params, 'probability');
    return editScanlines(bytes, (raw, info) => {
      const stride = info.rowBytes + 1;
      for (let y = 0; y < info.height; y++) {
        const offset = y * stride;
        if (offset >= raw.length) break;
        if (ctx.rng() < probability) raw[offset] = Math.floor(ctx.rng() * 5);
      }
    });
  },
};
