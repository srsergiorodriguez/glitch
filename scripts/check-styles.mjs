/**
 * Verifica la regla dura del sistema de diseño:
 *  1. cero estilos en línea (ni `style="..."` ni `style:prop={...}`),
 *  2. cero colores literales fuera de tokens.css.
 * Falla el build si aparece algo.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname;
const INLINE_STYLE = /\bstyle\s*[:=]/;
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;

const problems = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
    } else if (entry.name.endsWith('.svelte')) {
      const text = await readFile(full, 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        const where = `${relative(process.cwd(), full)}:${index + 1}`;
        if (INLINE_STYLE.test(line)) {
          problems.push(`${where}  estilo en línea: ${line.trim()}`);
        }
        if (HEX_COLOR.test(line)) {
          problems.push(`${where}  color literal (usa un token): ${line.trim()}`);
        }
      });
    }
  }
}

await walk(ROOT);

if (problems.length > 0) {
  console.error('check:styles falló:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}

console.log('check:styles ok');
