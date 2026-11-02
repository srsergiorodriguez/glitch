/** Los modos de reordenamiento de tomato, como permutaciones puras y deterministas. */

import { LIMITS } from './limits';

export type OrderMode =
  | 'shuffle'
  | 'reverse'
  | 'invert'
  | 'bloom'
  | 'pulse'
  | 'jiggle'
  | 'overlap';

export const ORDER_MODES: { value: OrderMode; label: string; help: string }[] = [
  { value: 'shuffle', label: 'al azar', help: 'permutación aleatoria de todos los frames' },
  { value: 'reverse', label: 'invertir', help: 'invierte el orden' },
  { value: 'invert', label: 'pares', help: 'intercambia cada par de frames' },
  { value: 'bloom', label: 'bloom', help: 'repite un frame al azar «veces» veces' },
  { value: 'pulse', label: 'pulse', help: 'repite un frame cada «veces» posiciones' },
  { value: 'jiggle', label: 'jiggle', help: 'toma un frame vecino; «veces» es la dispersión' },
  { value: 'overlap', label: 'overlap', help: 'copia bloques de «veces» frames con solape' },
];

/**
 * Devuelve una copia reordenada. `amount` es el `-c`/`-n` de tomato según el modo:
 * veces que se repite (bloom), periodo (pulse), dispersión (jiggle) o tamaño de bloque (overlap).
 */
export function permute<T>(items: T[], mode: OrderMode, amount: number, rng: () => number): T[] {
  const length = items.length;
  if (length < 2) return items.slice();

  const times = Math.max(1, Math.round(amount));
  const out = items.slice();

  switch (mode) {
    case 'shuffle': {
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      break;
    }

    case 'reverse': {
      out.reverse();
      break;
    }

    case 'invert': {
      for (let i = 0; i + 1 < out.length; i += 2) {
        [out[i], out[i + 1]] = [out[i + 1], out[i]];
      }
      break;
    }

    case 'bloom': {
      const at = Math.floor(rng() * out.length);
      const copies = Array.from({ length: times }, () => out[at]);
      out.splice(at + 1, 0, ...copies);
      break;
    }

    case 'pulse': {
      const expanded: T[] = [];
      for (let i = 0; i < out.length; i++) {
        expanded.push(out[i]);
        if (i % times === 0) expanded.push(out[i]);
      }
      out.splice(0, out.length, ...expanded);
      break;
    }

    case 'jiggle': {
      const source = out.slice();
      for (let i = 0; i < source.length; i++) {
        const offset = Math.round((rng() * 2 - 1) * times);
        const index = Math.max(0, Math.min(source.length - 1, i + offset));
        out[i] = source[index];
      }
      break;
    }

    case 'overlap': {
      const step = Math.max(1, Math.floor(times / 2));
      const expanded: T[] = [];
      for (let i = 0; i < out.length; i += step) {
        expanded.push(...out.slice(i, i + times));
      }
      out.splice(0, out.length, ...expanded);
      break;
    }
  }

  // más allá del límite de la app, el resultado deja de ser útil
  return out.length > LIMITS.sequenceFrames ? out.slice(0, LIMITS.sequenceFrames) : out;
}
