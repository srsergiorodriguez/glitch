import type { Effect } from '../../core/types';
import { numberParam, stringParam } from '../../core/params';
import type { OrderMode } from '../../core/order';

export const aviReorder: Effect = {
  id: 'avi.reorder',
  label: 'Ordenar el AVI',
  help: 'Reordena los chunks dentro de movi y deja el índice viejo apuntando a los frames de antes. No se puede previsualizar: solo existe en el archivo, así que hay que exportar en AVI y abrirlo en un reproductor tolerante como VLC.',
  phase: 'encode',
  surface: 'video',
  params: [
    {
      kind: 'enum',
      key: 'mode',
      label: 'modo',
      options: [
        { value: 'shuffle', label: 'al azar' },
        { value: 'reverse', label: 'invertir' },
        { value: 'invert', label: 'pares' },
        { value: 'jiggle', label: 'jiggle' },
      ],
      default: 'reverse',
    },
    { kind: 'range', key: 'amount', label: 'alcance', min: 1, max: 16, step: 1, default: 2 },
  ],
  configure(settings, params) {
    const mode = stringParam(params, 'mode', 'reverse');
    settings.mode =
      mode === 'shuffle' || mode === 'reverse' || mode === 'invert' || mode === 'jiggle'
        ? (mode as OrderMode)
        : 'reverse';
    settings.amount = Math.round(numberParam(params, 'amount'));
  },
};
