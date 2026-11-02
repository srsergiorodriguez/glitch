<script lang="ts">
  import type { Effect } from '../core/types';
  import EffectList from './EffectList.svelte';

  interface Props {
    label: string;
    effects: Effect[];
    onpick: (id: string) => void;
  }

  let { label, effects, onpick }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement | null = $state(null);

  function pick(id: string): void {
    open = false;
    onpick(id);
  }

  // cerrar con Escape o al tocar fuera
  $effect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') open = false;
    };
    const onDown = (event: PointerEvent): void => {
      if (root && !root.contains(event.target as Node)) open = false;
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  });
</script>

<div class="picker" bind:this={root}>
  <button class="picker__trigger" aria-expanded={open} onclick={() => (open = !open)}>
    <span class="picker__label">{label}</span>
    <span class="picker__caret" aria-hidden="true"></span>
  </button>

  {#if open}
    <EffectList {effects} onpick={pick} />
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }

  .picker__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    width: 100%;
    height: var(--h-ctl);
    padding: 0 var(--sp-2);
    border: 1px solid var(--line-2);
    border-radius: var(--r-1);
    background: var(--bg-2);
    color: var(--fg-2);
    font-size: var(--fs-sm);
    text-align: left;
  }

  .picker__trigger:hover {
    background: var(--bg-3);
    color: var(--fg-1);
  }

  .picker__caret {
    flex: none;
    width: 0;
    height: 0;
    border-top: 3px solid currentColor;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    opacity: 0.6;
  }
</style>
