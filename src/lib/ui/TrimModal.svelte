<script lang="ts">
  import Button from './Button.svelte';
  import { LIMITS } from '../core/limits';

  interface Props {
    thumbs: string[];
    duration: number;
    from: number;
    to: number;
    onapply?: (from: number, to: number) => void;
    onclose?: () => void;
  }

  let { thumbs, duration, from, to, onapply, onclose }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let start = $state(0);
  let end = $state(0);
  let anchor = $state<number | null>(null);

  // la ventana máxima la fija el techo de frames: 240 a 12 fps son 20 s
  const maxSpan = LIMITS.videoFrames / 12;
  const step = $derived(thumbs.length > 0 ? duration / thumbs.length : 1);
  const maxCells = $derived(Math.max(1, Math.floor(maxSpan / step)));

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });

  // el modal se monta con el tramo actual ya fijado
  $effect(() => {
    start = from;
    end = to;
  });

  const timeOf = (index: number): number => (index + 0.5) * step;
  const low = $derived(Math.min(start, end));
  const high = $derived(Math.max(start, end));
  const frames = $derived(
    Math.max(1, Math.min(LIMITS.videoFrames, Math.round((high - low) * 12))),
  );
  const fps = $derived(Math.max(1, Math.round(frames / Math.max(0.1, high - low))));
  const atLimit = $derived(high - low >= maxSpan - 0.01);
  const inRange = (index: number): boolean => {
    const time = timeOf(index);
    return time >= low && time < high;
  };

  /** un toque coloca la ventana completa desde ese frame; arrastrar la ajusta */
  function press(index: number): void {
    anchor = index;
    start = timeOf(index);
    end = Math.min(duration, start + maxSpan);
  }

  function enter(index: number): void {
    if (anchor === null) return;
    const delta = Math.min(Math.abs(index - anchor), maxCells - 1);
    const sign = index >= anchor ? 1 : -1;
    const target = anchor + sign * delta;
    start = timeOf(Math.min(anchor, target));
    end = Math.min(duration, timeOf(Math.max(anchor, target)) + step);
  }

  function release(): void {
    anchor = null;
  }

  function apply(): void {
    onapply?.(low, high);
    dialog?.close();
  }
</script>

<svelte:window onpointerup={release} />

<dialog
  class="trim"
  bind:this={dialog}
  aria-label="Elegir el tramo del video"
  oncancel={(event) => {
    event.preventDefault();
    dialog?.close();
  }}
  onclose={() => onclose?.()}
>
  <header class="trim__head">
    <h2 class="trim__title">Elegir el tramo</h2>
    <p class="trim__hint">
      Arrastra sobre los frames para marcar el tramo, o toca uno para colocar la ventana completa.
      El tope son {LIMITS.videoFrames} frames: {maxSpan} segundos a 12 fps.
    </p>
  </header>

  <div class="trim__grid" role="group" aria-label="Frames del video" onpointerleave={release}>
    {#each thumbs as thumb, index (index)}
      {@const time = timeOf(index)}
      <button
        type="button"
        class="frame"
        class:is-in={inRange(index)}
        class:is-edge={inRange(index) && (Math.abs(time - low) < step || Math.abs(time + step - high) < step)}
        aria-pressed={inRange(index)}
        aria-label={`Frame en el segundo ${time.toFixed(1)}`}
        onpointerdown={() => press(index)}
        onpointerenter={() => enter(index)}
      >
        <img src={thumb} alt="" draggable="false" />
        <span class="frame__time">{Math.round(time)}s</span>
      </button>
    {/each}
  </div>

  <footer class="trim__foot">
    <p class="trim__summary">
      del <strong>{low.toFixed(1)} s</strong> al <strong>{high.toFixed(1)} s</strong>
      · {frames} frames a {fps} fps
      {#if atLimit}<span class="trim__limit">· tope alcanzado</span>{/if}
    </p>
    <div class="trim__actions">
      <Button variant="ghost" onclick={() => dialog?.close()}>Cancelar</Button>
      <Button variant="primary" onclick={apply}>Usar este tramo</Button>
    </div>
  </footer>
</dialog>

<style>
  .trim {
    width: min(1100px, 92vw);
    max-height: 88vh;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--bg-1);
    color: var(--fg-1);
    overflow: hidden;
  }

  .trim::backdrop {
    background: rgb(0 0 0 / 0.72);
  }

  .trim__head {
    padding: var(--sp-3);
    border-bottom: 1px solid var(--line);
  }

  .trim__title {
    margin: 0;
    font-size: var(--fs-md);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .trim__hint {
    margin: var(--sp-1) 0 0;
    color: var(--fg-3);
    font-size: var(--fs-sm);
  }

  .trim__grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: var(--sp-1);
    padding: var(--sp-3);
    max-height: 52vh;
    overflow-y: auto;
  }

  .frame {
    position: relative;
    padding: 0;
    border: 2px solid transparent;
    border-radius: var(--r-sm);
    background: var(--bg-0);
    cursor: pointer;
    overflow: hidden;
  }

  .frame img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    opacity: 0.4;
    pointer-events: none;
  }

  .frame.is-in {
    border-color: var(--line-strong);
  }

  .frame.is-in img {
    opacity: 1;
  }

  .frame.is-edge {
    border-color: var(--accent);
  }

  .trim__limit {
    color: var(--accent);
  }

  .frame:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .frame__time {
    position: absolute;
    inset-inline-end: 4px;
    inset-block-end: 4px;
    padding: 0 4px;
    border-radius: var(--r-sm);
    background: rgb(0 0 0 / 0.6);
    color: var(--fg-2);
    font-size: var(--fs-xs);
    pointer-events: none;
  }

  .trim__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-top: 1px solid var(--line);
  }

  .trim__summary {
    margin: 0;
    color: var(--fg-2);
    font-size: var(--fs-sm);
  }

  .trim__actions {
    display: flex;
    gap: var(--sp-2);
  }
</style>
