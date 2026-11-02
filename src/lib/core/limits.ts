/** Techos de la app, en un solo sitio. */
export const LIMITS = {
  /** frames que entran en un GIF exportado: más que esto pesa demasiado */
  gifFrames: 200,
  /** frames que se capturan de un video */
  videoFrames: 240,
  /** lado máximo al capturar video */
  videoEdge: 720,
  /** lado máximo de una imagen de entrada */
  imageEdge: 2048,
  /** frames que puede llegar a tener la secuencia */
  sequenceFrames: 600,
} as const;
