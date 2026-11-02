import type { Params } from '../core/types';

export type Preset = {
  id: string;
  name: string;
  summary: string;
  stack: { effectId: string; params?: Params }[];
};

export const presets: Preset[] = [
  {
    id: 'paleta',
    name: 'Paleta quebrada',
    summary: '6 niveles + Bayer 4×4',
    stack: [
      { effectId: 'pixel.posterize', params: { levels: 6 } },
      { effectId: 'pixel.dither-bayer', params: { levels: 4, matrix: '4', strength: 0.9 } },
    ],
  },
  {
    id: 'cortes',
    name: 'Cortes y canales',
    summary: 'desregistro + franjas desplazadas',
    stack: [
      { effectId: 'pixel.channel-shift', params: { dx: 8, dy: 0, channel: 'rojo' } },
      { effectId: 'pixel.slice-displace', params: { count: 14, shift: 56, height: 9 } },
    ],
  },
  {
    id: 'senal',
    name: 'Señal sucia',
    summary: 'barrido + posterizado',
    stack: [
      { effectId: 'pixel.scanlines', params: { period: 3, strength: 0.35, offset: 0 } },
      { effectId: 'pixel.posterize', params: { levels: 5 } },
    ],
  },
  {
    id: 'fotocopia',
    name: 'Fotocopia',
    summary: '2 niveles + Bayer 2×2',
    stack: [
      { effectId: 'pixel.posterize', params: { levels: 2 } },
      { effectId: 'pixel.dither-bayer', params: { levels: 2, matrix: '2', strength: 1 } },
    ],
  },
  {
    id: 'vhs',
    name: 'VHS',
    summary: 'barrido fino + azul corrido',
    stack: [
      { effectId: 'pixel.scanlines', params: { period: 2, strength: 0.45, offset: 0 } },
      { effectId: 'pixel.channel-shift', params: { dx: 3, dy: 1, channel: 'azul' } },
      { effectId: 'pixel.posterize', params: { levels: 14 } },
    ],
  },
  {
    id: 'deriva',
    name: 'Deriva',
    summary: 'movimiento sobre imagen congelada',
    stack: [{ effectId: 'ghost.pframes', params: { hold: 30, gain: 1.3 } }],
  },
  {
    id: 'desgarro',
    name: 'Desgarro',
    summary: 'AVI con el índice roto',
    stack: [{ effectId: 'moshing.avi', params: { mode: 'reverse', amount: 2 } }],
  },
];
