import type { Effect } from '../core/types';
import { numberParam, stringParam } from '../core/params';

export const channelShift: Effect = {
  id: 'pixel.channel-shift',
  label: 'Desplazar canales',
  help: 'Mueve un canal respecto a los otros. Es el desregistro de color de la imprenta.',
  phase: 'pixel',
  surface: 'bitmap',
  params: [
    { kind: 'range', key: 'dx', label: 'desplaz. x', min: -40, max: 40, step: 1, default: 6, unit: 'px' },
    { kind: 'range', key: 'dy', label: 'desplaz. y', min: -40, max: 40, step: 1, default: 0, unit: 'px' },
    {
      kind: 'enum',
      key: 'channel',
      label: 'canal',
      options: [
        { value: 'rojo', label: 'rojo' },
        { value: 'verde', label: 'verde' },
        { value: 'azul', label: 'azul' },
        { value: 'todos', label: 'los tres' },
      ],
      default: 'rojo',
    },
  ],
  apply(bitmap, params) {
    const dx = Math.round(numberParam(params, 'dx'));
    const dy = Math.round(numberParam(params, 'dy'));
    const channel = stringParam(params, 'channel', 'rojo');
    if (dx === 0 && dy === 0) return;

    const { width, height, data } = bitmap;
    const source = new Uint8ClampedArray(data);
    const offsets: number[] =
      channel === 'todos' ? [0, 1, 2] : [channel === 'rojo' ? 0 : channel === 'verde' ? 1 : 2];

    for (let y = 0; y < height; y++) {
      const sy = y - dy;
      if (sy < 0 || sy >= height) continue;
      for (let x = 0; x < width; x++) {
        const sx = x - dx;
        if (sx < 0 || sx >= width) continue;
        const destination = (y * width + x) * 4;
        const origin = (sy * width + sx) * 4;
        for (const c of offsets) data[destination + c] = source[origin + c];
      }
    }
  },
};
