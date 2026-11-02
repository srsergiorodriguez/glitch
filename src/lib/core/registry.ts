import type { Effect, Phase } from './types';
import { allEffects } from '../effects';

/**
 * Tres registros, un runner:
 *  - efectos (aquí),
 *  - códecs (bytes ↔ representación, en lib/codecs),
 *  - presets (en lib/state/presets.ts).
 */
export const effects: Effect[] = [...allEffects];

export const PHASE_ORDER: Record<Phase, number> = {
  ingest: 0,
  pixel: 1,
  encode: 2,
  package: 3,
};

export const PHASE_LABEL: Record<Phase, string> = {
  ingest: 'DATOS',
  pixel: 'PÍXEL',
  encode: 'CÓDIGO',
  package: 'CONTENEDOR',
};

export function getEffect(id: string): Effect | undefined {
  return effects.find((effect) => effect.id === id);
}
