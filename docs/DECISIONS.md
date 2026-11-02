# Decisiones

Una fila por decisión cerrada. El número es estable y no se reutiliza. Cuando algo deja de ser
cierto se marca ~~tachado~~ y se añade una fila que lo reemplaza. Al cerrar cada etapa se borran las
que el código ya vuelve obvias.

| # | Decisión | Por qué |
| - | -------- | ------- |
| D1 | Vite + Svelte 5 como SPA, sin SvelteKit | sitio estático: sin SSR ni rutas; menos piezas |
| D2 | Un solo tema, oscuro | la obra aporta el color |
| D3 | Cero estilos en línea, incluido `style:prop` | valores dinámicos por atributos nativos, clases y canvas; el slider usa `accent-color` |
| D4 | Efectos declarativos con schema de parámetros | la UI se genera; añadir un algoritmo no toca componentes |
| D5 | PRNG derivado de (seed, efecto, frame) | reproducibilidad; mover un efecto no altera a los demás |
| D6 | Un modelo: secuencia de frames; tres entradas; sin modos | un GIF es una secuencia, una imagen es una secuencia de uno |
| D7 | Cuatro fases con superficie de códec | evita el producto cartesiano de efectos incompatibles |
| D8 | Exportación explícita PNG/GIF/MP4; MP4 sin audio en v1 | el formato cambia el resultado; el audio es secundario |
| D9 | Databending en la etapa A, como fase de ingesta | es barato y es el puente entre archivo y píxel |
| D10 | GIF propio sobre el núcleo de MiniGif; glifch como `legacy` | 4× o más rápido conservando los gestos |
| D11 | AVI fuera del camino crítico | el preview no se puede reproducir; queda como técnica de archivo en D |
| D12 | Sin FFmpeg.wasm | GitHub Pages no envía COOP/COEP; y pesa decenas de MB |
| D13 | mediabunny (MPL-2.0) solo para MP4/WebM, etapa B | no reinventar muxers; MPL no obliga a relicenciar el resto |
| D14 | tomato se reimplementa desde su comportamiento | el repositorio original no declara licencia |
| D15 | Pila lineal, sin grafo ni plugins en ejecución | extensibilidad suficiente, sin superficie de ataque |
| D16 | Integridad y escala como parámetros de interfaz | la corrupción decorativa nunca toca datos ni cifras |
| D17 | Límites: 720p/10 s video, 600 frames GIF, 2048 px imagen | la memoria es el límite real del navegador |
| D18 | Presupuesto de 200 líneas por documento y 800 en total, en CI | la documentación se pudre cuando nadie la mide |
| D19 | Sin backend ni telemetría | privacidad para clases y obras de estudiantes |
| D21 | Códec GIF propio, verificado contra PIL | el decodificador es bit-exacto; el codificador da 1.58/255 de error |
| D22 | Cada frame se escribe completo, sin deltas ni transparencia | pesa más (911 KB contra 660 KB) pero es simple y tolerable |
| D23 | Los efectos de bytes se ocultan con fuentes de varias imágenes | sin archivo único no hay nada que corromper |
| D24 | El orden de frames vive en el proyecto, no en la pila | reordenar no es un efecto sobre píxeles; debe sobrevivir a cambios de parámetros |
| D25 | Las corridas se agrupan por frame y el visor nunca se vacía | 30 eventos de slider cuestan 4 ms en vez de ~540 ms; un fallo no borra la imagen |
| D26 | La secuencia (`{index, delay}`) vive en el proyecto y los frames añadidos también | reordenar o alargar no es un efecto sobre píxeles y debe sobrevivir a recodificar |
| D27 | El GIF respeta el delay de cada frame | un GIF de entrada conserva su ritmo; un hold dura lo que dice |
| D28 | Los efectos de códec configuran el codificador en vez de tocar los píxeles | la sustitución de códigos solo existe dentro de LZW |
| D29 | Con glitches de códec, el visor codifica y decodifica el frame actual | el resultado es el GIF, no el frame; cuesta ~70 ms por frame |
| D30 | Los glitches de PNG se hacen inflando y recomprimiendo el IDAT | corromper el archivo a lo bruto solo lo rompe; así el PNG sigue siendo válido |
| D31 | Un efecto de bytes puede ser asíncrono y declarar los tipos que acepta | `CompressionStream` es async, y los efectos de PNG no tienen sentido con un JPEG |
| D32 | Reemplazar un efecto conserva su hueco y su uid | cambiar de técnica no debe reordenar la pila; los parámetros vuelven a los por defecto |
| D33 | El selector de efectos se expande en línea, agrupado por fase | un menú flotante quedaría recortado por el scroll del panel |
| D34 | El reemplazo abre la lista a ancho completo bajo la cabecera | dentro de la fila del título quedaba estrecho y empujaba los botones: parecía un fallo |
| D35 | Atajos globales, desactivados mientras se escribe | espacio, flechas, exportar y ayuda cubren el ciclo de trabajo sin sacar el foco del campo |
| D36 | Si el databending rompe el archivo, se avisa en vez de mostrar un error | romper el stream es un resultado artístico; el último frame bueno se queda y el archivo se descarga |
| D37 | Hornear es la salida por defecto cuando hay efectos de datos | decodificar y recomprimir da un archivo que cualquier reproductor abre; el crudo queda como segunda opción |
| D38 | El video se convierte en secuencia por búsqueda exacta y sin WebCodecs | funciona en cualquier navegador; 12 fps y 120 frames bastan para glitchear |
| D39 | El reordenamiento es una operación de la secuencia, no un efecto | el orden y la duración ya son del proyecto; un efecto que los cambie rompería la tira |
| D40 | El GIF exporta como máximo 200 frames y lo avisa | un GIF de cientos de frames pesa decenas de MB y no aporta nada |
| D41 | MP4 con mediabunny y WebM como respaldo | H.264 no está en todos los navegadores; el respaldo evita un callejón sin salida |
| D42 | AVI propio con MJPEG y el índice obsoleto a propósito | así tomato funciona sin depender de un AVI de entrada |
| D44 | El moshing mezcla JPEG en vez de leer el índice roto del AVI | Chrome pinta en negro los JPEG truncados; el híbrido sí se ve y se hornea en MP4 |
| D45 | El datamosh real se exporta como MP4 y se avisa que Chrome lo pinta negro | el archivo es auténtico y se abre en VLC; fingir una previsualización sería mentir |
| D46 | La captura de video recorta por defecto y deja elegir la ventana | un video largo con recorte es más útil que un time-lapse sin avisar |
| D47 | 240 frames de techo, con 540 px por encima de 120 | más resolución temporal a cambio de menos espacial; la memoria no crece |
| D48 | Se quitaron los efectos de NAL y de tabla del MP4 | Chrome descarta el frame roto: no hay efecto que enseñar |
| D49 | «Ordenar el AVI» avisa en un chip cuando la salida no es AVI | es un efecto que solo existe en el archivo exportado; callarlo sería mentir |
