import type { Effect } from '../../core/types';
import { numberParam } from '../../core/params';

export const splice: Effect = {
  id: 'bytes.splice',
  label: 'Empalmar',
  help: 'Copia un tramo del archivo y lo pega en otro sitio. A veces rompe el stream comprimido: eso también es el efecto.',
  phase: 'ingest',
  surface: 'bytes',
  params: [
    { kind: 'range', key: 'copies', label: 'copias', min: 1, max: 20, step: 1, default: 3 },
    { kind: 'range', key: 'size', label: 'tamaño', min: 1, max: 512, step: 1, default: 40, unit: 'KB' },
  ],
  applyBytes(bytes, params, ctx) {
    const copies = Math.max(1, Math.round(numberParam(params, 'copies')));
    const size = Math.max(1, numberParam(params, 'size')) * 1024;
    let out = bytes;

    for (let i = 0; i < copies; i++) {
      const source = Math.floor(ctx.rng() * Math.max(1, out.length - size));
      const target = Math.floor(ctx.rng() * Math.max(1, out.length - size));
      const piece = out.subarray(source, Math.min(out.length, source + size));
      const next = new Uint8Array(out.length);
      next.set(out.subarray(0, target), 0);
      next.set(piece.subarray(0, out.length - target), target);
      next.set(out.subarray(target + piece.length), target + piece.length);
      out = next;
    }

    return out;
  },
};
