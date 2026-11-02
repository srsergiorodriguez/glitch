import type { Effect } from '../core/types';
import { numberParam, stringParam } from '../core/params';

const CACHE = new Map<number, number[][]>();

/** Matriz de Bayer por recursión: 2, 4 u 8. */
function bayerMatrix(size: number): number[][] {
  const cached = CACHE.get(size);
  if (cached) return cached;

  let matrix: number[][] = [[0]];
  while (matrix.length < size) {
    const n = matrix.length;
    const next: number[][] = Array.from({ length: n * 2 }, () => new Array<number>(n * 2).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = matrix[y][x] * 4;
        next[y][x] = v;
        next[y][x + n] = v + 2;
        next[y + n][x] = v + 3;
        next[y + n][x + n] = v + 1;
      }
    }
    matrix = next;
  }

  CACHE.set(size, matrix);
  return matrix;
}

export const ditherBayer: Effect = {
  id: 'pixel.dither-bayer',
  label: 'Dither Bayer',
  help: 'Cuantiza con una matriz ordenada. El patrón es fijo, así que es idéntico entre frames.',
  phase: 'pixel',
  surface: 'bitmap',
  params: [
    { kind: 'range', key: 'levels', label: 'niveles', min: 2, max: 16, step: 1, default: 4 },
    {
      kind: 'enum',
      key: 'matrix',
      label: 'matriz',
      options: [
        { value: '2', label: '2×2' },
        { value: '4', label: '4×4' },
        { value: '8', label: '8×8' },
      ],
      default: '4',
    },
    { kind: 'range', key: 'strength', label: 'fuerza', min: 0, max: 1, step: 0.05, default: 1 },
  ],
  apply(bitmap, params) {
    const levels = Math.max(2, Math.round(numberParam(params, 'levels')));
    const size = Number(stringParam(params, 'matrix', '4')) || 4;
    const strength = Math.min(1, Math.max(0, numberParam(params, 'strength')));
    const matrix = bayerMatrix(size);
    const denominator = size * size;
    const step = 255 / (levels - 1);

    const { data, width, height } = bitmap;
    for (let y = 0; y < height; y++) {
      const row = matrix[y % size];
      for (let x = 0; x < width; x++) {
        const threshold = ((row[x % size] + 0.5) / denominator - 0.5) * step * strength;
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const v = data[i + c] + threshold;
          const clamped = v < 0 ? 0 : v > 255 ? 255 : v;
          data[i + c] = Math.round(Math.round(clamped / step) * step);
        }
      }
    }
  },
};
