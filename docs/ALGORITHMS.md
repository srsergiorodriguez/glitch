# Algoritmos

Tres familias, ordenadas por lo que cuestan. La de píxel ya está implementada; las otras dos definen
las etapas siguientes.

## Familia de píxel (hecha)

Operan sobre RGBA y sirven para cualquier salida. Son baratas y componen bien.

| Efecto | Gesto | Nota |
| --- | --- | --- |
| `pixel.posterize` | reduce niveles por canal | LUT de 256 entradas |
| `pixel.dither-bayer` | cuantiza con matriz ordenada 2/4/8 | matriz fija: no cambia entre frames |
| `pixel.channel-shift` | mueve un canal respecto a los otros | el desregistro de la imprenta |
| `pixel.slice-displace` | corta franjas y las corre | usa el PRNG: mismo seed, mismo corte |
| `pixel.scanlines` | oscurece filas periódicas | suciedad de señal |

El resto de la familia, cuando llegue: paletas fijas (1 bit, CGA, Game Boy, duotono), median cut,
dither Floyd–Steinberg y Atkinson, ruido azul, niveles, gamma, duotono y divergencia de saturación.

## Databending (hecho)

La idea: corromper el archivo **antes** de decodificarlo, y quedarse con lo que sobreviva. El archivo
corrupto también se exporta: en databending el archivo *es* la obra.

Implementados: `bytes.truncate` (corta la cola), `bytes.flip` (niega bytes en regiones al azar desde
un punto dado) y `bytes.splice` (copia un tramo y lo pega en otro sitio). Todos usan la semilla.

Es cirugía ciega: no sabe dónde está el stream comprimido, así que a veces lo rompe. Medido sobre 40
empalmes de un GIF de prueba: 26 decodifican completos, 12 se rescatan a medias y 2 no dejan nada.
Eso **no es un fallo**, es la distribución esperada. El decodificador tiene topes de iteración y de
prefijos, así que un archivo roto no cuelga la pestaña.

De ahí salen las dos salidas. El archivo **crudo**, tal cual, que un reproductor puede rechazar. Y
el **horneado**: decodificar lo que sobreviva y recomprimir en PNG o GIF válido. Si el archivo se
rompe a mitad, se hornea igual con los frames rescatados (8 de 14 en una prueba) y el GIF de salida
lo abre cualquier reproductor.

- **JPEG**: la zona entrópica no tiene CRC, así que el navegador dibuja lo que alcanza a decodificar.
  Truncar al 20 % deja las últimas filas en negro: eso es el glitch, no un error.
- **PNG**: el navegador valida CRC y zlib, así que corromper a lo bruto solo rompe el archivo. El
  camino bueno, y el que está implementado, es inflar los IDAT con `DecompressionStream`, corromper
  las scanlines, recomprimir con `CompressionStream` y recalcular el CRC. Resultado: un PNG válido
  con artefactos controlados. Dos efectos:
  - `png.filters` reescribe el byte de filtro de cada fila. El decodificador desfiltra con otro
    criterio y la imagen se corre: es el más destructivo (diferencia media 73/255 a 35 % de filas).
  - `png.idat` tritura bytes ya descomprimidos: quirúrgico, deja la imagen legible con bandas.
- Si `createImageBitmap` rechaza el archivo, se cae a `<img>`, que es más tolerante.

## GIF: codificador propio y glifch v2 (hecho)

Codificador completo: paleta global por median cut, LUT de 32×32×32 colores para cuantizar en una
pasada y LZW con clave numérica. El decodificador es bit-exacto contra PIL y el codificador produce
archivos que PIL abre con 1.58/255 de error medio. Pesa más que el original (911 KB contra 660 KB)
porque escribe cada frame completo, sin deltas.

Encima, cuatro intervenciones que se aplican **dentro** del codificador:

| Efecto | Mecanismo | Dónde |
| --- | --- | --- |
| `gif.reslice` | reordena tramos del stream de índices | antes de LZW |
| `gif.substitute-codes` | emite otro código en lugar del correcto | dentro de LZW |
| `gif.palette-rotate` | rota la tabla escrita; la cuantización usa la original | al escribir la paleta |
| `gif.palette-desaturate` | lleva la tabla escrita hacia el gris | al escribir la paleta |

Los dos primeros desalinean el diccionario que reconstruye el decodificador: la firma visual de
glifch. Los otros son su truco de saturación: se cuantiza con una tabla y se escribe otra.

Dos reglas que costaron encontrar y que no se pueden romper:

- al reiniciar el diccionario hay que vaciar también los índices por longitud, o se emiten códigos
  muertos y el GIF deja de decodificar;
- nunca se sustituyen `clear` ni `EOI`: sin ellos el stream no cierra.

Con eso, las siete combinaciones probadas (incluida la fuerte: 30 tramos, 70 % de probabilidad, 5 %
de sustitución y rotación de 90) las lee PIL con sus 14 frames.

El visor muestra el frame ya comprimido y decodificado, porque con estos efectos el resultado no es
el frame de píxeles: es el GIF. La tira sigue mostrando la secuencia sin comprimir.

## Video: frames, AVI y datamosh

El video entra decodificando con **WebCodecs** (mediabunny), no rebobinando el elemento: cada
paquete se decodifica una vez y de ahí salen todos los frames. Techo de **240 frames**, con 720 px de
lado hasta 120 frames y 540 px por encima (la memoria manda: ≈140 MB), y progreso en la barra. El
tramo se elige en un **modal con la rejilla de frames**: se arrastra y la ventana no crece más de lo
que caben 240 frames (20 s a 12 fps), con el tope a la vista; un toque la coloca entera. La captura
reparte los frames dentro del tramo, así que un tramo más corto da más fps.

Después la secuencia es una secuencia más: los mismos efectos, la misma tira. El reordenamiento es
una **operación de la secuencia**, no un efecto de la pila, porque el orden y la duración ya viven
en el proyecto. Los modos, heredados de `tomato.py`:

| Modo | Efecto | `-c` | `-n` |
| --- | --- | --- | --- |
| `void` | nada: solo la limpieza | — | — |
| `random` | permutación aleatoria | — | — |
| `reverse` | invierte el orden | — | — |
| `invert` | intercambia pares | — | — |
| `bloom` | repite el frame `n` | repeticiones | frame |
| `pulse` | repite bloques de `c` | longitud | — |
| `jiggle` | frame vecino según una normal | — | σ |
| `overlap` | copia bloques de `c` cada `n` | longitud | paso |

Se conservan dos rarezas que definen el resultado: `invert` descarta el último frame cuando el
conteo es impar, y en `pulse` el contador solo avanza en la rama negativa.

**Aviso importante.** Reordenar frames y *recodificar* no es datamosh: sale un video limpio en orden
raro. Para eso están las secciones de abajo. La exportación usa **mediabunny** (MPL-2.0) sobre
WebCodecs: H.264 en MP4 y VP9 en WebM si no hay codificador.

### Escribir y romper un AVI (hecho)

No teníamos ningún AVI, así que el camino empieza por fabricarlo: cada frame se codifica como JPEG
(`canvas.toBlob`) y se muxa a mano en un AVI (`RIFF` → `LIST hdrl` con `avih`, `strh` y `strf` →
`LIST movi` con chunks `00dc` → `idx1`). Los offsets del índice se miden desde el byte siguiente a
`movi`, que es la convención de tomato.

Encima, `avi.reorder` reordena los chunks dentro de `movi` y **deja el `idx1` intacto**, igual que
el original. Verificado: el orden de los chunks sale invertido, el tamaño no cambia, el `idx1` es
idéntico byte a byte, y los JPEG extraídos abren en PIL. Un reproductor que respeta el índice ve un
video; uno que lo ignora, el otro.

### Lo que se quitó: corromper NAL y tabla (descartado)

`video.samples` invertía bytes en los NAL y `video.table` ensuciaba la tabla de tamaños. Medido:
Chrome no reparte el error, **descarta el frame** y mantiene el anterior, así que el efecto visible
era un video congelado o en negro. Se quitaron los dos; quedan el AVI (MJPEG sí tolera) y el
datamosh real, que se exporta.

### Audio: seguir a los frames (hecho)

El MP4 exportado puede llevar el sonido del archivo original. No se recodifica: se copian los
paquetes AAC y se recolocan según la secuencia, así que cada frame se lleva su trozo y los duplicados
lo repiten. El muxer exige orden de tiempo, así que se agrupan por frame de origen y se escriben en el
orden de la secuencia. Verificado con un export invertido: misma duración y energía, y su envolvente
correlaciona **0.98** con el original invertido y **-0.85** con el original.

### Datamosh real: romper los I-frames (hecho)

Se reescriben los paquetes del video original con mediabunny y cada I-frame se sustituye por el
P-frame anterior: el decodificador nunca reinicia la imagen y el movimiento nuevo se aplica sobre la
escena vieja. El audio se copia tal cual. Es datamosh de verdad, y VLC lo reproduce. Lo que **no**
hace es verse en Chrome: medido, avanza el tiempo pero pinta negro (`media: 0`), porque descarta los
P-frames cuyo I-frame no llegó. Por eso es una exportación, no una previsualización.

### Reusar P-frames (hecho)

El datamosh de manual —ver el gesto nuevo sobre el dibujo viejo— también se consigue sin tocar el
bitstream: se congela un frame y se le van sumando, píxel a píxel, las diferencias entre frames
consecutivos. `ghost = ghost + (frame[i] - frame[i-1]) * empuje`, con saturación a 0 y 255. Donde el
video se mueve, la imagen congelada se desplaza con ese movimiento; donde hay un cambio de escena,
el dibujo viejo se deforma con el gesto nuevo. `congela` decide cada cuántos frames se toma una
imagen nueva.

Es una aproximación honesta al datamosh real (que reutiliza vectores de movimiento de los P-frames):
no transporta vectores, transporta diferencias de color. Se calcula en el hilo principal en unos
pocos milisegundos por frame y se ve en el visor, la tira y cualquier exportación.

### Moshing: el desgarro del AVI, traído a los frames (hecho)

El AVI con el índice roto se ve muy bien en un reproductor: VLC decodifica frames desordenados y
**desgarrados**, con bandas donde el JPEG se corta. Se intentó reproducir dentro de la app leyendo el
archivo como lo lee VLC —chunk por chunk, con el tamaño del índice obsoleto— y **no funciona**:
Chrome no pinta los JPEG truncados, los pinta en negro. Medido: 240 de 240 «decodifican» y todos
salen negros.

Lo que sí funciona es mezclar los JPEG a mano: cortar el de cada frame y pegarle la cola del JPEG de
otro. El navegador decodifica el híbrido y aparecen bandas y medias imágenes — el mismo desgarro,
pero por una vía que el navegador puede enseñar. Eso es `moshing`, y entra en la secuencia como
cualquier otro frame: se ve en el visor y se hornea en MP4, GIF o PNG. Cuesta ~1.4 s por 240 frames.

El archivo con el `idx1` viejo sigue disponible al exportar **AVI** (efecto «Ordenar el AVI»), y ese
se abre en VLC.

## Añadir un algoritmo

1. Decide la fase: `ingest`, `pixel`, `encode` o `package`.
2. Si necesitas otra representación, escribe el códec con ida y vuelta y un fixture < 100 KB.
3. Declara el efecto con su `params`; el schema genera los controles.
4. Regístralo en `src/lib/effects/index.ts`. El orden del arreglo es el del menú.
5. Añade dos pruebas: mismo seed → mismos bytes, y el frame original no se muta.

```ts
export const posterize: Effect = {
  id: 'pixel.posterize',
  label: 'Posterizar',
  help: 'Reduce los niveles por canal.',
  phase: 'pixel',
  params: [{ kind: 'range', key: 'levels', label: 'niveles', min: 2, max: 32, step: 1, default: 6 }],
  apply(bitmap, params) { /* lee con numberParam, escribe en bitmap.data */ },
};
```

## Referencias

- <https://github.com/itsKaspar/tomato> · <https://www.kaspar.wtf/blog/tomato-v2-0-avi-breaker>
- <https://www.w3.org/Graphics/GIF/spec-gif89a.txt>
- <https://learn.microsoft.com/en-us/windows/win32/directshow/avi-riff-file-reference>
- <https://github.com/srsergiorodriguez/> (`MiniGif`, `glifch`)
