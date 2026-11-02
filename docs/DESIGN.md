# Sistema de diseño

## Principios

1. **El color es de la obra.** Interfaz en neutros, un solo acento (ácido) y cian/magenta únicamente
   como desregistro de 1 px.
2. **Densidad de editor.** Tipografía pequeña, hairlines de 1 px, timecode mono. Se lee como
   herramienta, no como juguete.
3. **Tokens antes que valores.** Si un número no está en `tokens.css`, no existe.
4. **Cero estilos en línea. Sin excepciones** (ver reglas).

## Layout

```
┌ barra 38 ────────────────────────────────────────────────┐
│ glitch · abrir · ejemplo · readout   integridad · escala │
├ medios 288 ─┬ visor (flexible) ───────────┬ propiedades ─┤
│ fuente      │  canvas + marcas de registro│ pila         │
│ presets     │                             │ parámetros   │
│             │                             │ salida       │
└─────────────┴─────────────────────────────┴──────────────┘
```

- **Medios:** fuente y presets.
- **Visor:** canvas centrado, marcas de registro en las esquinas (una descentrada 1 px), estado
  vacío con arrastre. Con más de un frame aparece el transporte debajo y la tira abajo del todo.
- **Propiedades:** pila numerada, parámetros del seleccionado, seed, salida y exportar.

Breakpoints: `>1040` tres columnas · `900–1040` columnas reducidas · `<900` una columna, visor
primero. La tira de frames se sumará debajo del visor cuando existan secuencias.

## Tokens

`src/lib/ui/tokens.css`, un solo archivo. Todo se multiplica por `--u`, la escala de interfaz.

| Grupo | Valores |
| --- | --- |
| Superficies | `#0c0c0e` · `#131316` · `#1a1a1f` · `#222229` |
| Líneas | `#26262c` · `#34343c` · `#44444f` |
| Texto | `#e9e9ee` · `#9c9ca8` · `#6a6a76` |
| Acento | `#d8ff3e`, texto `#0b0b0d`, hover `#e6ff72` |
| Desregistro | cian `#22e0ff` y magenta `#ff2e88`, solo a 1 px |
| Estado | `#ff5d5d`, `#ffb74d` |
| Tipo | UI 12 px, etiquetas 10 px, mono para números |
| Medidas | barra 38 · cabecera 26 · control 24 · fila 27 · izquierda 288 · derecha 320 |
| Movimiento | 90 ms y 160 ms, `cubic-bezier(.2,.7,.3,1)` |

## Componentes

Quince, en `src/lib/ui/`. Cada uno: un `.svelte`, `<style>` scoped, props tipadas, todos los estados.

| Componente | Uso |
| --- | --- |
| `Button` | primario (con desregistro), fantasma, chico, ancho |
| `IconButton` | 26×24, `aria-label` obligatorio |
| `Panel` | cabecera numerada + cuerpo con scroll |
| `Field` | fila de parámetro: etiqueta, control, valor, ayuda |
| `Slider` | `<input type=range>` nativo con `accent-color` |
| `NumberInput` | entero, confirma en `change` |
| `Select` | nativo estilizado; variante chica para la barra |
| `Checkbox` | nativo con `accent-color` |
| `ParamControl` | schema → primitivo; no dibuja estilos propios |
| `Stage` | canvas, marcas de registro, estado vacío, arrastre |
| `EffectPicker` | botón + lista de efectos agrupada por fase |
| `EffectList` | la lista en sí; se usa para añadir y para reemplazar en el hueco |
| `Filmstrip` | tira de frames con el actual resaltado |
| `ShortcutHelp` | panel fijo con los atajos de teclado |
| `Thumb` | miniatura de un frame en un canvas |

Compuestos que viven en `App.svelte` hasta que haga falta reusarlos: fila de efecto, chip de estado,
barra superior y barra de transporte (reproducir, timecode, contador, fps, duración del frame y
mover/duplicar/quitar/añadir frame; aparece en cuanto hay fuente, aunque sea un solo frame). `Progress` y `Tabs`
llegan con los trabajos largos.

## Esquema de parámetros

| `kind` | Control | Extra |
| --- | --- | --- |
| `range` | `Slider` | min, max, step, unidad |
| `int` | `NumberInput` | min, max |
| `bool` | `Checkbox` | etiqueta propia |
| `enum` | `Select` | opciones con etiqueta |

Un efecto sin parámetros no dibuja nada. Los valores se validan al cargar un preset.

## Integridad y escala

- **Integridad** (100 / 97 / 92 %), en la barra. A 97 el desregistro se intensifica y una etiqueta
  activa baja 1 px; a 92 el desregistro sube. Es corrupción decorativa: nunca toca datos, tamaños de
  clic ni cifras.
- **Escala** (100 / 125 / 150 %), en la barra, para proyectar en clase. Se aplica con clases
  `u-100`, `u-125`, `u-150` sobre la raíz; todos los tokens usan `--u`.
- **TrimModal** elige el tramo del video con una rejilla de frames grandes y etiquetados. La ventana
  se arrastra y tiene tope (240 frames), así que el límite se ve antes de aceptar: el pie dice el
  rango, los frames y los fps que saldrán.

**Regla de honestidad:** lo decorativo puede mentir 1 px; los datos nunca. Si el contador de frames
o el tiempo de cálculo mienten, la herramienta deja de servir.

## Reglas

1. **Cero `style="…"` y cero `style:prop`.** `npm run check:styles` lo verifica y falla el build.
2. Valores dinámicos por tres vías: atributos de elementos nativos (`value`, `width`, `height`),
   clases discretas (`is-active`, `u-125`) y geometría dibujada en canvas. Por eso el slider nativo
   usa `accent-color` en vez de una pista rellena con porcentaje.
3. Sin colores literales fuera de `tokens.css`: también lo verifica `check:styles`.
4. Clases kebab-case con prefijo del componente; variantes por prop, nunca anidando componentes.
5. Estados obligatorios: default, hover, active, focus-visible, disabled. Foco visible siempre.
6. Textos en español, sentence case, verbo + objeto. Sin abreviaturas crípticas.
7. Iconos: glifos tipográficos mientras alcance; SVG propio cuando no.
8. Atajos: `espacio` reproduce, `← →` mueven frame, `ctrl/⌘ + s` exporta, `?` abre la ayuda y `esc`
   cierra. Nunca se disparan mientras se escribe en un campo.
9. Accesibilidad: contraste AA, blancos ≥ 24 px, todo operable con teclado, `aria-label` en iconos,
   `role="img"` en el visor.

## Mantenimiento

- Los tokens se ajustan en un solo archivo; `design/mockup.html` sigue siendo la referencia visual.
- Un componente no se copia: si dos vistas lo necesitan, sube a `lib/ui/` con variante.
- Cambiar la API de un componente obliga a actualizar la tabla de arriba y a anotar una decisión.
