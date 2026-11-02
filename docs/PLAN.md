# Plan

## Objetivo

Una app estática donde alguien suelta imágenes, un GIF o un video, apila operaciones que corrompen
sus datos y descarga el resultado. Sirve para producir y para enseñar: se ve *qué* se corrompe y
*por qué*.

## Modelo

**Una secuencia de frames, tres entradas, salidas explícitas.** No hay modos:

| Entrada | Se detecta | Metadatos |
| --- | --- | --- |
| Imagen | un archivo de imagen | duración al exportar |
| Secuencia | un GIF o varias imágenes | fps |
| Video | un video de cualquier formato | fps, duración |

Un GIF es una secuencia; una imagen es una secuencia de un frame. Los efectos que necesitan más de
un frame no aparecen con N=1. El editor, el pipeline y los efectos son uno solo.

Cada efecto declara su **fase** y el runner ordena la pila: los de píxel antes, los de códec
después. El orden dentro de una fase es del usuario.

## Etapas

| # | Contenido | Estado |
| - | --------- | ------ |
| A | Imagen, efectos de píxel, PNG, databending JPEG | **hecha** |
| A2 | Secuencia (GIF + varias imágenes), tira editable, codificador GIF propio | **hecha** (falta probar Safari y Firefox) |
| B | Video: captura de frames, reordenamiento tipo tomato, exportación MP4/WebM | **hecha** |
| C | Glitches de compresión: LZW de GIF (glifch v2), IDAT de PNG | **hecha** |
| D | Corrupción de NAL en H.264, AVI byte-exacto, audio | **NAL y AVI hechos**; audio pendiente |

Primero lo que no depende de códecs del sistema; al final, lo que sí.

## Límites

- Video: 720p y 10 s por trabajo. GIF: 600 frames y 800 px de lado. Imagen: 2048 px de lado.
- Por encima del límite se reduce, nunca se rechaza el archivo.
- Un trabajo a la vez; lo pesado va a un worker.

## Presupuesto de rendimiento

Referencia: portátil M1. Medido: 560×560 con dos efectos de píxel, 3–5 ms; con dither 8×8,
13 ms; GIF de 14 frames a 500×275, 260 ms para codificar.

| Operación | Objetivo | Límite |
| --- | --- | --- |
| Previsualizar un cambio de parámetro | 16 ms | 40 ms |
| Codificar GIF 480×480 × 48 | 2.2 s (medido: 0.7 s) | 4 s |
| Capturar 150 frames 720p | 6 s | 12 s |
| Exportar MP4 de 10 s | 15 s | 60 s |
| JS comprimido (gz) | 180 KB | 250 KB |

Hoy: 24 KB gz de JS y 3 KB de CSS. Ningún frame de UI puede pasar de 16 ms.

## ¿Es viable en un sitio estático?

Sí. Los límites reales son la memoria y los códecs del navegador, no la falta de servidor.

| Necesidad | Veredicto |
| --- | --- |
| Leer y escribir GIF | propio, sin dependencias |
| Leer y escribir PNG | `CompressionStream` nativo + CRC32 propio |
| Databending JPEG | el navegador decodifica JPEG truncados; sirve tal cual |
| Databending PNG | requiere inflar y recomprimir: válido y controlable |
| Reproducir AVI | **imposible**: ningún navegador lo hace |
| Exportar MP4/WebM | WebCodecs + mediabunny; `avc1.42001f` codifica en ~99 % de sesiones |
| FFmpeg.wasm | descartado: GitHub Pages no envía COOP/COEP, no hay `SharedArrayBuffer` |

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Memoria con muchos frames | ventana de 4 frames en vuelo, límites duros, reducción automática |
| WebCodecs desigual | detección de capacidades; GIF y PNG nunca dependen de él; MP4 cae a WebM |
| Previsualización de video lenta | proxy a 480 px y 12 fps mientras se edita |
| El AVI no se puede previsualizar | preview simulado sobre canvas; el archivo final se abre en VLC |
| La reescritura de glifch cambia el aspecto | modo `legacy` y fixtures visuales |
| La corrupción de la interfaz se vuelve ruido | regla: lo decorativo miente 1 px, los datos nunca |

## Preguntas abiertas

1. ¿La tira de frames editable (arrastrar, duración por frame) entra en A2 o después?
2. ¿Cuánto pesa el databending en la clase? Define si merece una vista de bytes.
3. ¿Hace falta audio antes de la etapa D?

## Regla de documentación

Cinco documentos, ≤ 200 líneas cada uno y 800 en total. Un hecho se escribe una sola vez. Al cerrar
una etapa se borra lo que dejó de ser cierto; si un documento empieza a explicar código, se
reemplaza por un enlace al código.
