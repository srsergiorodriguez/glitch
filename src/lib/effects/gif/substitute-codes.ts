import type { Effect } from '../../core/types';
import { numberParam, stringParam } from '../../core/params';

export const substituteCodes: Effect = {
  id: 'gif.substitute-codes',
  label: 'Sustituir códigos',
  help: 'Emite otro código en lugar del correcto. El decodificador arma otro diccionario: la firma visual de glifch.',
  phase: 'encode',
  surface: 'gif',
  params: [
    { kind: 'range', key: 'probability', label: 'probab.', min: 0, max: 0.2, step: 0.002, default: 0.02 },
    {
      kind: 'enum',
      key: 'mode',
      label: 'modo',
      options: [
        { value: 'same-length', label: 'igual longitud' },
        { value: 'random', label: 'al azar' },
      ],
      default: 'same-length',
    },
  ],
  configure(settings, params) {
    settings.substituteProbability = numberParam(params, 'probability');
    settings.substituteMode =
      stringParam(params, 'mode', 'same-length') === 'random' ? 'random' : 'same-length';
  },
};
