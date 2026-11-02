/** Ajustes de corrupción que se aplican dentro del codificador GIF. */

export type GifGlitch = {
  /** rota la tabla escrita; la cuantización usa la tabla original */
  paletteRotate: number;
  /** lleva la tabla escrita hacia el gris */
  paletteDesaturate: number;
  /** menos de 2 desactiva el reordenamiento del stream de índices */
  resliceSlices: number;
  resliceProbability: number;
  /** probabilidad de emitir otro código en lugar del correcto */
  substituteProbability: number;
  substituteMode: 'same-length' | 'random';
};

export const NO_GLITCH: GifGlitch = {
  paletteRotate: 0,
  paletteDesaturate: 0,
  resliceSlices: 0,
  resliceProbability: 0,
  substituteProbability: 0,
  substituteMode: 'same-length',
};

export function hasGlitch(glitch: GifGlitch): boolean {
  return (
    glitch.paletteRotate !== 0 ||
    glitch.paletteDesaturate > 0 ||
    (glitch.resliceSlices > 1 && glitch.resliceProbability > 0) ||
    glitch.substituteProbability > 0
  );
}
