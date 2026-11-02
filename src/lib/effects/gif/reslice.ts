import type { Effect } from '../../core/types';
import { numberParam } from '../../core/params';

export const reslice: Effect = {
  id: 'gif.reslice',
  label: 'Reordenar índices',
  help: 'Mueve tramos del stream de índices antes de comprimir. Los colores se desalinean progresivamente.',
  phase: 'encode',
  surface: 'gif',
  params: [
    { kind: 'range', key: 'slices', label: 'tramos', min: 2, max: 40, step: 1, default: 10 },
    { kind: 'range', key: 'probability', label: 'probab.', min: 0, max: 1, step: 0.05, default: 0.35 },
  ],
  configure(settings, params) {
    settings.resliceSlices = Math.round(numberParam(params, 'slices'));
    settings.resliceProbability = numberParam(params, 'probability');
  },
};
