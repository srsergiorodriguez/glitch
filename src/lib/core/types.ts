/** Tipos base del núcleo. No importan nada de la interfaz. */

import type { GifGlitch } from './gif-settings';
import type { AviReorder } from './video-settings';
import type { Moshing } from './moshing';
import type { Ghost } from './ghost';

export type Bitmap = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/** Fase del recorrido en la que vive un efecto. */
export type Phase = 'ingest' | 'pixel' | 'encode' | 'package';

export type ParamValue = number | boolean | string;

export type ParamSchema =
  | {
      kind: 'range';
      key: string;
      label: string;
      min: number;
      max: number;
      step: number;
      default: number;
      unit?: string;
      help?: string;
    }
  | {
      kind: 'int';
      key: string;
      label: string;
      min: number;
      max: number;
      default: number;
      unit?: string;
      help?: string;
    }
  | { kind: 'bool'; key: string; label: string; default: boolean; help?: string }
  | {
      kind: 'enum';
      key: string;
      label: string;
      options: { value: string; label: string }[];
      default: string;
      help?: string;
    };

export type Params = Record<string, ParamValue>;

export type EffectCtx = {
  /** PRNG derivado de (seed, efecto, frame). Nunca Math.random. */
  rng: () => number;
  width: number;
  height: number;
  frame: number;
};

type EffectBase = {
  id: string;
  label: string;
  help: string;
  params: ParamSchema[];
  /** Fase concreta donde corre el efecto. */
  phase: Phase;
  /** Tipos MIME con los que tiene sentido; si falta, vale para todo. */
  requires?: string[];
};

/** Corrompe el archivo antes de decodificarlo. */
export type BytesEffect = EffectBase & {
  phase: 'ingest';
  surface: 'bytes';
  applyBytes: (
    bytes: Uint8Array,
    params: Params,
    ctx: EffectCtx,
  ) => Uint8Array | Promise<Uint8Array>;
};

/** Trabaja sobre píxeles. */
export type PixelEffect = EffectBase & {
  phase: 'pixel';
  surface: 'bitmap';
  apply: (bitmap: Bitmap, params: Params, ctx: EffectCtx) => Bitmap | void;
};

/** Ajusta la corrupción que el codificador GIF aplica mientras comprime. */
export type GifEffect = EffectBase & {
  phase: 'encode';
  surface: 'gif';
  configure: (settings: GifGlitch, params: Params, ctx: EffectCtx) => void;
};

/** Ajusta la corrupción que se aplica al MP4 ya codificado. */
export type VideoEffect = EffectBase & {
  phase: 'encode';
  surface: 'video';
  configure: (settings: AviReorder, params: Params, ctx: EffectCtx) => void;
};

/** Se aplica sobre los frames ya procesados, con el códec de imagen de por medio. */
export type FrameEffect = EffectBase & {
  phase: 'encode';
  surface: 'frame';
  apply: (settings: Moshing, params: Params) => void;
};

/** Opera sobre toda la secuencia de frames, no sobre uno suelto. */
export type SequenceEffect = EffectBase & {
  phase: 'pixel';
  surface: 'sequence';
  configure: (settings: Ghost, params: Params) => void;
};

export type Effect = BytesEffect | PixelEffect | GifEffect | VideoEffect | FrameEffect | SequenceEffect;

export type EffectInstance = {
  uid: string;
  effectId: string;
  enabled: boolean;
  params: Params;
};
