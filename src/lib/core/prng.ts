/** PRNG determinista. Todo efecto recibe su propio flujo derivado de la semilla. */

export function hash32(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Un flujo por efecto y por frame: mover o añadir un efecto no altera el
 * resultado de los demás, y cada frame puede previsualizarse por separado.
 */
export function rngFor(seed: number, effectId: string, frame: number): () => number {
  return mulberry32(hash32(`${effectId}|${seed}|${frame}`));
}
