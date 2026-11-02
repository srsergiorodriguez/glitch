import type { Effect } from '../../core/types';
import { numberParam } from '../../core/params';

export const ghostFrames: Effect = {
  id: 'ghost.pframes',
  label: 'Reusar P-frames',
  help: 'Congela una imagen y le suma el movimiento de los frames que vienen. El gesto se mueve sobre el dibujo viejo: el datamosh de manual.',
  phase: 'pixel',
  surface: 'sequence',
  params: [
    { kind: 'range', key: 'hold', label: 'congela', min: 2, max: 60, step: 1, default: 24 },
    { kind: 'range', key: 'gain', label: 'empuje', min: 0.2, max: 3, step: 0.1, default: 1 },
  ],
  configure(settings, params) {
    settings.hold = Math.round(numberParam(params, 'hold'));
    settings.gain = numberParam(params, 'gain');
  },
};
