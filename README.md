# glitch

Laboratorio web para corromper imágenes, gifs y videos. Corre **100 % en el navegador**: los
archivos no se suben a ningún servidor. Pensado para proyectos creativos y para clases de
programación creativa y humanidades digitales.

- App: <https://srsergiorodriguez.github.io/glitch/> · demo: `?ejemplo`
- Estado: **etapas A y A2 cerradas**. Imagen, GIF y secuencias funcionan de punta a punta.
- Stack: Svelte 5 + Vite 8 (SPA estática, sin SSR), TypeScript.

## Qué hay hoy

| Parte | Estado |
| --- | --- |
| Sistema de diseño (tokens, 12 componentes, integridad, escala) | hecho |
| Ingesta: imagen, GIF y varias imágenes sueltas | hecho |
| Códec GIF propio (decodificador y codificador) | hecho |
| Efectos de píxel (5) y de datos (3) | hecho |
| Secuencia con tira de frames, reproducción y fps | hecho |
| Editar la secuencia: mover, duplicar, quitar y añadir frames | hecho |
| Duración por frame, respetada al reproducir y al exportar | hecho |
| Glitches de compresión GIF: índices, códigos LZW y paleta | hecho |
| Glitches de PNG: filtros de fila e IDAT recompreso | hecho |
| Hornear el archivo dañado, con rescate parcial de frames | hecho |
| Video: captura con ventana elegible, reorden tipo tomato y MP4/WebM | hecho |
| AVI propio con MJPEG y reordenamiento de chunks con índice obsoleto | hecho |
| Moshing: desgarro del JPEG frame a frame, visible y horneable en MP4 | hecho |
| Reusar P-frames: movimiento nuevo sobre imagen congelada | hecho |
| Exportar MP4 con el audio original, recolocado según la secuencia | hecho |
| Datamosh real: I-frames sustituidos por P-frames, exportado para VLC | hecho |
| Exportar PNG y GIF; descargar el archivo corrupto | hecho |

El decodificador GIF es bit-exacto contra PIL sobre el GIF de prueba, y el codificador
produce archivos que PIL abre con un error medio de 1.58/255.

## Cómo correrlo

```bash
npm install
npm run dev      # http://localhost:5173/glitch/
npm run build    # dist/
npm run check    # estilos + presupuesto de docs + tipos
```

El sitio se publica solo: cada push a `main` compila, verifica y despliega a GitHub Pages
(`.github/workflows/deploy.yml`).

## Estructura

```
src/lib/core/      tipos, prng, params, registro, pipeline
src/lib/effects/   un archivo por efecto, con su schema de parámetros
src/lib/ingest/    archivo → bytes → frames
src/lib/codecs/gif/  decodificador y codificador GIF propios
src/lib/export/    bitmap → archivo
src/lib/state/     estado del proyecto y presets
src/lib/ui/        tokens.css y componentes
design/            exploración de interfaz y capturas (no entra al build)
ref/               material de referencia (no entra al build)
```

## Documentación

Presupuesto: **≤ 200 líneas por documento y 800 en total**, verificado por `npm run check:docs`.

| Doc | Responde |
| --- | --- |
| [PLAN](docs/PLAN.md) | alcance, etapas, límites, riesgos |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | fases, representaciones, registro, estado |
| [ALGORITHMS](docs/ALGORITHMS.md) | las técnicas y cómo añadir una |
| [DESIGN](docs/DESIGN.md) | tokens, componentes, integridad, reglas |
| [DECISIONS](docs/DECISIONS.md) | decisiones cerradas |

## Créditos y licencias

- `tomato.py`: Kaspar Ravel ([itsKaspar/tomato](https://github.com/itsKaspar/tomato)); el
  repositorio original no declara licencia, así que aquí se reimplementa el algoritmo con atribución.
- `MiniGif` y `glifch`: Sergio Rodríguez Gómez (MIT).
- [Mediabunny](https://mediabunny.dev): MPL-2.0, dependencia opcional de la etapa B.
- Código de esta app: MIT (ver `LICENSE`).
