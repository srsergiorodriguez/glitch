/**
 * Presupuesto de documentación: 150 líneas por documento, 600 en total.
 * La documentación se pudre cuando nadie la mide.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const LIMIT_DOC = 200;
const LIMIT_TOTAL = 800;

const files = ['README.md'];
try {
  const docs = await readdir('docs');
  for (const name of docs.filter((entry) => entry.endsWith('.md')).sort()) {
    files.push(join('docs', name));
  }
} catch {
  // sin carpeta docs todavía
}

let total = 0;
const rows = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  // un archivo que acaba en salto de línea no tiene una línea vacía de más
  const lines = text.replace(/\n+$/, '').split('\n').length;
  total += lines;
  rows.push({ file, lines, over: lines > LIMIT_DOC });
}

for (const row of rows) {
  console.log(`${String(row.lines).padStart(4)} líneas  ${row.file}${row.over ? '  ← excede' : ''}`);
}
console.log(`${String(total).padStart(4)} líneas  total`);

const over = rows.filter((row) => row.over);
if (over.length > 0 || total > LIMIT_TOTAL) {
  console.error(
    `\ncheck:docs falló: límite ${LIMIT_DOC} por documento y ${LIMIT_TOTAL} en total.`,
  );
  process.exit(1);
}

console.log('check:docs ok');
