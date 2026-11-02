# Arquitectura

## Principio

Todo el trabajo ocurre sobre datos que el navegador puede manipular sin códecs externos. Cada
recorrido tiene cuatro fases:

```
bytes → [ingesta] → decodificar → frames → [píxel] → [codificación] → [empaquetado] → bytes
```

Cada etapa existe ya para el caso más simple: `bytes/*` corrompe el archivo, `decodeBytes` lo
convierte en uno o más frames, `pixel/*` los transforma y `codecs/gif` los vuelve a comprimir.

El registro de efectos es el único punto de extensión. Las fases no se eligen: las fija el recorrido.

## Fases

| Fase | Toca | Efectos previstos | Depende de |
| --- | --- | --- | --- |
| `ingest` | bytes del archivo | databending, truncar, empalmar | formato de entrada |
| `pixel` | RGBA | cuantizar, dither, color, cortes, barrido | nada: sirve para toda salida |
| `encode` | stream comprimido | LZW de GIF, NAL de H.264, IDAT de PNG | formato de salida |
| `package` | contenedor | tablas de samples, chunks, `idx1` | formato de salida |

Hoy existen dos superficies, `bytes` y `bitmap`, y dos representaciones:

```ts
type Bitmap = { data: Uint8ClampedArray; width: number; height: number };
// bytes: Uint8Array del archivo, sin decodificar
```

Las demás llegan con sus códecs: `indices` (paleta + índices), `codes` (bitstream LZW), `samples`
(paquetes de video), `frametable` (chunks de AVI).

## Contrato de un efecto

```ts
type Effect =
  | { phase: 'ingest'; surface: 'bytes';  applyBytes(bytes: Uint8Array, …): Uint8Array }
  | { phase: 'pixel';  surface: 'bitmap'; apply(bitmap: Bitmap, …): Bitmap | void };
// además, en ambos: id, label, help y params (que generan los controles)

type EffectCtx = {
  rng: () => number;          // derivado de (seed, efecto, frame)
  width: number;
  height: number;
  frame: number;
};
```

El runner filtra los efectos desactivados, los ordena por fase (orden estable, así que respeta el
orden del usuario dentro de cada fase) y aplica cada uno sobre una copia del frame. Un efecto puede
mutar el bitmap o devolver uno nuevo. Los de `bytes` corren antes de decodificar y su resultado se
queda para poder descargar el archivo corrupto.

## Registro

`src/lib/effects/index.ts` exporta el arreglo. El orden del arreglo es el orden del menú «añadir
efecto». Añadir un algoritmo no toca ningún componente: el schema de parámetros genera la interfaz.

## Determinismo

Cada efecto recibe su propio PRNG, derivado de `hash(effectId | seed | frame)`.

- Mismo seed y misma pila → mismos bytes.
- Mover un efecto en la pila no cambia los números aleatorios que ve otro efecto.
- El seed es visible y editable; el botón de dado solo cambia el seed.

Nota útil para clase: los efectos de punto (posterizar, dither) conmutan con los que permutan píxeles
(cortes). No es un error del pipeline: es álgebra.

## Estado

- `src/lib/state/project.svelte.ts` con runes: `project` (nombre, tamaño, pila, seed, estado),
  `ui` (integridad, escala) y `view` (referencia al bitmap de salida).
- Los buffers grandes no se copian al estado: la fuente vive en una variable de módulo y el estado
  guarda referencias.
- La **secuencia** es del proyecto (no de la pila): una lista de `{index, delay}` que se aplica
  después de decodificar. Sobrevive a cualquier cambio de efecto y guarda el orden y la duración de
  cada frame. Si la fuente cambia de tamaño, vuelve al orden natural con los delays originales.
- Los **frames añadidos** viven aparte de la fuente (`extraFrames`) para que no se pierdan cuando
  hay que volver a decodificar el archivo.
- `requestRun()` agrupa los cambios de un arrastre en una corrida por frame; el visor conserva el
  último frame bueno si una corrida falla.
- Ejecutar es implícito: cada cambio de pila, parámetro o seed llama a `run()`. Los frames ya
  decodificados se cachean y solo se vuelven a decodificar si cambia la parte de bytes.
- Con 560×560 y dos efectos son 3–5 ms; un GIF de 14 frames se codifica en ~260 ms. El worker con
  progreso y cancelación sigue pendiente: hoy todo corre en el hilo principal.
- Sin persistencia todavía. El siguiente paso es codificar `{seed, pila}` en el hash de la URL para
  compartir presets.

## Concurrencia y memoria (pendiente)

- Main: UI, ingesta, preview. Worker: códecs y efectos sobre buffers.
- Transferencia cero copia con `ArrayBuffer` e `ImageBitmap`.
- Ventana de 4 frames en vuelo; `bitmap.close()` y pool de buffers por tamaño.
- Sin `SharedArrayBuffer`: GitHub Pages no envía COOP/COEP.

## Carpetas

```
src/
  main.ts            monta la app
  App.svelte         layout, barra, paneles
  app.css            base + escala de interfaz
  lib/
    core/            types, prng, params, registry, pipeline
    effects/         bytes/{truncate,flip,splice} + pixel/{posterize,dither,channel,slice,scanlines}
    codecs/gif/      decode.ts y encode.ts propios (LZW, paleta global)
    ingest/          image.ts (archivo → bytes), decode.ts (bytes → frames)
    export/          png.ts (Bitmap → PNG, descarga)
    state/           project.svelte.ts, presets.ts
    ui/              tokens.css + componentes
scripts/             check-styles.mjs, check-docs.mjs
design/              exploración visual (no entra al build)
ref/                 material de referencia (no entra al build)
```

## Reglas

1. `core`, `effects`, `ingest` y `export` no importan nada de `ui`.
2. Un códec nuevo entra con prueba de ida y vuelta y un fixture de menos de 100 KB.
3. Nada de `Math.random()` en `core`: siempre `ctx.rng`.
4. Cero estilos en línea y cero colores literales en componentes: lo verifica `check:styles`.
5. La documentación se mide: `check:docs`.
