import type { Effect } from '../../core/types';
import { numberParam } from '../../core/params';

export const paletteDesaturate: Effect = {
  id: 'gif.palette-desaturate',
  label: 'Desaturar paleta',
  help: 'La tabla escrita pierde color aunque la cuantización se hizo con la original. El gesto de saturación de glifch.',
  phase: 'encode',
  surface: 'gif',
  params: [
    { kind: 'range', key: 'amount', label: 'cantidad', min: 0, max: 1, step: 0.05, default: 0.6 },
  ],
  configure(settings, params) {
    settings.paletteDesaturate = numberParam(params, 'amount');
  },
};
