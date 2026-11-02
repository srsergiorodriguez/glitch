import type { Effect } from '../../core/types';
import { numberParam, stringParam } from '../../core/params';
import type { OrderMode } from '../../core/order';

export const moshing: Effect = {
  id: 'moshing.avi',
  label: 'Moshing (tomato)',
  help: 'Corta el JPEG de cada frame y le pega la cola del JPEG de otro: el decodificador saca bandas y medias imágenes. Es el desgarro del AVI, traído a los frames para que se pueda ver en el navegador.',
  phase: 'encode',
  surface: 'frame',
  params: [
    {
      kind: 'enum',
      key: 'mode',
      label: 'modo',
      options: [
        { value: 'reverse', label: 'invertir' },
        { value: 'shuffle', label: 'al azar' },
        { value: 'invert', label: 'pares' },
        { value: 'jiggle', label: 'jiggle' },
      ],
      default: 'reverse',
    },
    { kind: 'range', key: 'amount', label: 'alcance', min: 1, max: 16, step: 1, default: 2 },
  ],
  apply(settings, params) {
    const mode = stringParam(params, 'mode', 'reverse');
    settings.mode =
      mode === 'shuffle' || mode === 'reverse' || mode === 'invert' || mode === 'jiggle'
        ? (mode as OrderMode)
        : 'reverse';
    settings.amount = Math.round(numberParam(params, 'amount'));
  },
};
