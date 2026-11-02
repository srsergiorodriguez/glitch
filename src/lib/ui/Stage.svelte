<script lang="ts">
  import type { Bitmap } from '../core/types';
  import Button from './Button.svelte';

  interface Props {
    bitmap: Bitmap | null;
    videoUrl: string | null;
    name: string;
    hasSource: boolean;
    onfiles: (files: File[]) => void;
    onopen: () => void;
    onexample: () => void;
  }

  let { bitmap, videoUrl, name, hasSource, onfiles, onopen, onexample }: Props = $props();

  let canvas: HTMLCanvasElement | null = $state(null);
  let dragging = $state(false);

  $effect(() => {
    const target = canvas;
    const frame = bitmap;
    if (!target || !frame) return;
    if (frame.data.length !== frame.width * frame.height * 4) return;
    // reasignar width/height reasigna el buffer y borra el canvas: solo si cambió
    if (target.width !== frame.width || target.height !== frame.height) {
      target.width = frame.width;
      target.height = frame.height;
    }
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height),
      0,
      0,
    );
  });

  function over(event: DragEvent): void {
    event.preventDefault();
    dragging = true;
  }

  function leave(): void {
    dragging = false;
  }

  function drop(event: DragEvent): void {
    event.preventDefault();
    dragging = false;
    const files = Array.from(event.dataTransfer?.files ?? []).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    );
    if (files.length > 0) onfiles(files);
  }
</script>

<section
  class="stage"
  class:is-dragging={dragging}
  aria-label="Visor"
  ondragover={over}
  ondragleave={leave}
  ondrop={drop}
>
  {#if videoUrl}
    <video
      class="stage__video"
      src={videoUrl}
      controls
      autoplay
      loop
      muted
      playsinline
      aria-label={`Video procesado de ${name}`}
    ></video>
  {:else if hasSource}
    <div class="stage__figure" role="img" aria-label={`Vista previa de ${name}`}>
      <canvas class="stage__canvas" bind:this={canvas}></canvas>
    </div>
  {:else}
    <div class="stage__empty">
      <p class="stage__title">Arrastra una imagen o un video</p>
      <p class="stage__hint">
        PNG, JPEG, GIF, MP4 o WebM · el video se captura en frames · nada sale de tu equipo
      </p>
      <div class="stage__actions">
        <Button variant="primary" onclick={() => onopen()}>Abrir archivo</Button>
        <Button variant="ghost" onclick={onexample}>Cargar ejemplo</Button>
      </div>
    </div>
  {/if}

  <span class="reg reg--tl" aria-hidden="true"></span>
  <span class="reg reg--tr" aria-hidden="true"></span>
  <span class="reg reg--bl" aria-hidden="true"></span>
  <span class="reg reg--br" aria-hidden="true"></span>
</section>

<style>
  .stage {
    position: relative;
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    padding: var(--sp-5) var(--sp-4);
    background: var(--bg-0);
  }

  .stage.is-dragging {
    outline: 1px dashed var(--accent);
    outline-offset: calc(-1 * var(--sp-2));
  }

  .stage__figure {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .stage__canvas {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .stage__video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: var(--bg-0);
  }

  .stage__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    text-align: center;
  }

  .stage__title {
    margin: 0;
    font-size: var(--fs-lg);
    color: var(--fg-1);
  }

  .stage__hint {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--fg-3);
  }

  .stage__actions {
    display: flex;
    gap: var(--sp-2);
    padding-top: var(--sp-2);
  }

  /* marcas de registro: una, descentrada a propósito */
  .reg {
    position: absolute;
    width: calc(9px * var(--u));
    height: calc(9px * var(--u));
    opacity: 0.35;
    pointer-events: none;
  }

  .reg::before,
  .reg::after {
    content: '';
    position: absolute;
    background: var(--fg-2);
  }

  .reg::before {
    left: 50%;
    top: 0;
    width: 1px;
    height: 100%;
  }

  .reg::after {
    top: 50%;
    left: 0;
    height: 1px;
    width: 100%;
  }

  .reg--tl {
    top: var(--sp-2);
    left: var(--sp-2);
  }

  .reg--tr {
    top: var(--sp-2);
    right: var(--sp-2);
  }

  .reg--bl {
    bottom: var(--sp-2);
    left: var(--sp-2);
  }

  .reg--br {
    bottom: var(--sp-2);
    right: calc(var(--sp-2) + 1px);
    opacity: 0.18;
  }
</style>
