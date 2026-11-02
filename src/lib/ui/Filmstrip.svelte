<script lang="ts">
  import type { Bitmap } from '../core/types';
  import Thumb from './Thumb.svelte';

  interface Props {
    frames: Bitmap[];
    current: number;
    onpick: (index: number) => void;
  }

  let { frames, current, onpick }: Props = $props();

  const MAX = 32;

  const shown = $derived.by(() => {
    if (frames.length <= MAX) {
      return frames.map((bitmap, index) => ({ bitmap, index }));
    }
    const step = Math.ceil(frames.length / MAX);
    const items: { bitmap: Bitmap; index: number }[] = [];
    for (let i = 0; i < frames.length; i += step) items.push({ bitmap: frames[i], index: i });
    return items;
  });
</script>

<div class="strip" role="group" aria-label="Frames de la secuencia">
  {#each shown as item (item.index)}
    <button
      class="strip__item"
      class:is-current={item.index === current}
      aria-label={`Frame ${item.index + 1}`}
      aria-current={item.index === current}
      onclick={() => onpick(item.index)}
    >
      <Thumb bitmap={item.bitmap} width={84} />
    </button>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    align-items: flex-start;
    gap: 2px;
    padding: var(--sp-1) var(--sp-2);
    overflow-x: auto;
    overflow-y: hidden;
    min-height: 0;
    background: var(--bg-1);
  }

  .strip__item {
    flex: none;
    align-self: flex-start;
    width: calc(88px * var(--u));
    height: calc(50px * var(--u));
    padding: 0;
    border: 1px solid var(--line-2);
    background: var(--bg-2);
    line-height: 0;
    opacity: 0.72;
  }

  .strip__item:hover {
    opacity: 1;
    border-color: var(--line-3);
  }

  .strip__item.is-current {
    opacity: 1;
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
</style>
