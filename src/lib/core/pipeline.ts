import type { Bitmap, EffectInstance, Params } from './types';
import { NO_GLITCH, hasGlitch, type GifGlitch } from './gif-settings';
import type { Moshing } from './moshing';
import { NO_AVI_REORDER, type AviReorder } from './video-settings';
import type { Ghost } from './ghost';
import { PHASE_ORDER, getEffect } from './registry';
import { clampParams } from './params';
import { rngFor } from './prng';

type Entry = { instance: EffectInstance; effect: NonNullable<ReturnType<typeof getEffect>> };

/** Efectos activos ordenados por fase; dentro de cada fase, en el orden del usuario. */
function active(stack: EffectInstance[]): Entry[] {
  return stack
    .filter((instance) => instance.enabled)
    .map((instance) => ({ instance, effect: getEffect(instance.effectId) }))
    .filter((entry): entry is Entry => Boolean(entry.effect))
    .sort((a, b) => PHASE_ORDER[a.effect.phase] - PHASE_ORDER[b.effect.phase]);
}

export function countBySurface(stack: EffectInstance[], surface: 'bytes' | 'bitmap'): number {
  return stack.filter((instance) => {
    if (!instance.enabled) return false;
    const effect = getEffect(instance.effectId);
    return effect ? effect.surface === surface : false;
  }).length;
}

/** Corrompe el archivo antes de decodificarlo. */
export async function runIngest(
  bytes: Uint8Array,
  stack: EffectInstance[],
  seed: number,
): Promise<Uint8Array> {
  let output = bytes;
  for (const { instance, effect } of active(stack)) {
    if (effect.surface !== 'bytes') continue;
    const params: Params = clampParams(effect.params, instance.params);
    output = await effect.applyBytes(output, params, {
      rng: rngFor(seed, effect.id, 0),
      width: 0,
      height: 0,
      frame: 0,
    });
  }
  return output;
}

/** Recolecta los ajustes de corrupción que usa el codificador GIF. */
export function collectGifSettings(stack: EffectInstance[], seed: number): GifGlitch {
  const settings: GifGlitch = { ...NO_GLITCH };
  for (const { instance, effect } of active(stack)) {
    if (effect.surface !== 'gif') continue;
    effect.configure(settings, clampParams(effect.params, instance.params), {
      rng: rngFor(seed, effect.id, 0),
      width: 0,
      height: 0,
      frame: 0,
    });
  }
  return settings;
}

export { hasGlitch };



/** Ajustes del reordenamiento del AVI, o null si no hay efecto activo. */
export function collectAviSettings(stack: EffectInstance[]): AviReorder | null {
  const settings: AviReorder = { ...NO_AVI_REORDER };
  let found = false;
  for (const { instance, effect } of active(stack)) {
    if (effect.surface !== 'video') continue;
    effect.configure(settings, clampParams(effect.params, instance.params), {
      rng: () => 0,
      width: 0,
      height: 0,
      frame: 0,
    });
    found = true;
  }
  return found ? settings : null;
}

/** Ajustes del reuso de P-frames, o null si no hay efecto activo. */
export function collectGhost(stack: EffectInstance[]): Ghost | null {
  const settings: Ghost = { hold: 24, gain: 1 };
  let found = false;
  for (const { instance, effect } of active(stack)) {
    if (effect.surface !== 'sequence') continue;
    effect.configure(settings, clampParams(effect.params, instance.params));
    found = true;
  }
  return found ? settings : null;
}

/** Ajustes del moshing, o null si no hay efecto activo. */
export function collectMoshing(stack: EffectInstance[]): Moshing | null {
  const settings: Moshing = { mode: "reverse", amount: 2 };
  let found = false;
  for (const { instance, effect } of active(stack)) {
    if (effect.surface !== 'frame') continue;
    effect.apply(settings, clampParams(effect.params, instance.params));
    found = true;
  }
  return found ? settings : null;
}

/** Aplica la pila de píxeles a cada frame. Nunca muta los frames de entrada. */
export function runStack(frames: Bitmap[], stack: EffectInstance[], seed: number): Bitmap[] {
  const effects = active(stack);

  return frames.map((frame, index) => {
    let bitmap: Bitmap = {
      data: new Uint8ClampedArray(frame.data),
      width: frame.width,
      height: frame.height,
    };

    for (const { instance, effect } of effects) {
      if (effect.surface !== 'bitmap') continue;
      const params = clampParams(effect.params, instance.params);
      const result = effect.apply(bitmap, params, {
        rng: rngFor(seed, effect.id, index),
        width: bitmap.width,
        height: bitmap.height,
        frame: index,
      });
      if (result) bitmap = result;
    }

    return bitmap;
  });
}
