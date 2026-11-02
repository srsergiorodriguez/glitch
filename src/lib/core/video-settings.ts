/** Ajustes del reordenamiento byte-exacto del AVI. */

import type { OrderMode } from './order';

export type AviReorder = {
  /** modo de permutación; lo desactiva cuando vale '' */
  mode: OrderMode | '';
  amount: number;
};

export const NO_AVI_REORDER: AviReorder = { mode: '', amount: 2 };

export function hasAviReorder(settings: AviReorder): boolean {
  return settings.mode !== '';
}
