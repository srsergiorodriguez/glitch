import type { Effect } from '../../core/types';
import { numberParam } from '../../core/params';

export const truncate: Effect = {
  id: 'bytes.truncate',
  label: 'Cortar el final',
  help: 'Borra la cola del archivo. En JPEG el navegador dibuja lo que alcanzó a decodificar; en un GIF suele romper el LZW.',
  phase: 'ingest',
  surface: 'bytes',
  params: [
    { kind: 'range', key: 'percent', label: 'recorte', min: 1, max: 80, step: 1, default: 20, unit: '%' },
  ],
  applyBytes(bytes, params) {
    const percent = Math.min(80, Math.max(1, numberParam(params, 'percent')));
    const keep = Math.floor(bytes.length * (1 - percent / 100));
    return bytes.slice(0, Math.max(64, keep));
  },
};
