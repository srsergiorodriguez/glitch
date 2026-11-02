import type { Effect } from '../core/types';
import { truncate } from './bytes/truncate';
import { flip } from './bytes/flip';
import { splice } from './bytes/splice';
import { posterize } from './posterize';
import { ditherBayer } from './dither-bayer';
import { channelShift } from './channel-shift';
import { sliceDisplace } from './slice-displace';
import { scanlines } from './scanlines';
import { paletteRotate } from './gif/palette-rotate';
import { paletteDesaturate } from './gif/palette-desaturate';
import { reslice } from './gif/reslice';
import { substituteCodes } from './gif/substitute-codes';
import { pngFilters } from './png/filters';
import { pngIdat } from './png/idat';
import { aviReorder } from './video/avi-reorder';
import { moshing } from './frame/moshing';
import { ghostFrames } from './sequence/ghost';

/** Orden del menú «añadir efecto». Añadir uno aquí no toca la interfaz. */
export const bytesEffects: Effect[] = [truncate, flip, splice, pngFilters, pngIdat];

export const pixelEffects: Effect[] = [
  posterize,
  ditherBayer,
  channelShift,
  sliceDisplace,
  scanlines,
];

export const gifEffects: Effect[] = [
  reslice,
  substituteCodes,
  paletteRotate,
  paletteDesaturate,
];

export const videoEffects: Effect[] = [aviReorder];

export const frameEffects: Effect[] = [moshing];
export const sequenceEffects: Effect[] = [ghostFrames];

export const allEffects: Effect[] = [
  ...bytesEffects,
  ...pixelEffects,
  ...gifEffects,
  ...videoEffects,
  ...frameEffects,
  ...sequenceEffects,
];
