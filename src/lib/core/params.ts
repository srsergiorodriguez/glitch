import type { ParamSchema, ParamValue, Params } from './types';

export function defaults(schemas: ParamSchema[]): Params {
  const out: Params = {};
  for (const schema of schemas) out[schema.key] = schema.default;
  return out;
}

export function clampValue(schema: ParamSchema, value: ParamValue): ParamValue {
  switch (schema.kind) {
    case 'range':
      return clampNumber(value, schema.min, schema.max, schema.default);
    case 'int':
      return Math.round(clampNumber(value, schema.min, schema.max, schema.default));
    case 'bool':
      return typeof value === 'boolean' ? value : schema.default;
    case 'enum':
      return schema.options.some((option) => option.value === value)
        ? value
        : schema.default;
  }
}

/** Valida un preset venido de la URL o del disco. */
export function clampParams(schemas: ParamSchema[], raw: Params): Params {
  const out: Params = {};
  for (const schema of schemas) {
    const value = raw[schema.key];
    out[schema.key] = value === undefined ? schema.default : clampValue(schema, value);
  }
  return out;
}

export function numberParam(params: Params, key: string): number {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function stringParam(params: Params, key: string, fallback = ''): string {
  const value = params[key];
  return typeof value === 'string' ? value : fallback;
}

function clampNumber(value: ParamValue, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
