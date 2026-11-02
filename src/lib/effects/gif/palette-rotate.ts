import type { Effect } from '../../core/types';
import { numberParam } from '../../core/params';

export const paletteRotate: Effect = {
  id: 'gif.palette-rotate',
  label: 'Rotar paleta',
  help: 'Gira la tabla que se escribe: cada índice pasa a mostrar otro color. La imagen se cuantiza igual, pero se pinta con otra paleta.',
  phase: 'encode',
  surface: 'gif',
  params: [
    { kind: 'range', key: 'shift', label: 'giro', min: 1, max: 255, step: 1, default: 64, unit: 'idx' },
  ],
  configure(settings, params) {
    settings.paletteRotate = Math.round(numberParam(params, 'shift'));
  },
};
