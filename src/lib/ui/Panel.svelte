<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    index?: string;
    title: string;
    scroll?: boolean;
    children?: Snippet;
  }

  let { index = '', title, scroll = true, children }: Props = $props();
</script>

<aside class="pnl">
  <header class="pnl__head">
    <span class="pnl__no">{index}</span>
    <span class="pnl__title">{title}</span>
  </header>
  <div class="pnl__body" class:pnl__body--scroll={scroll}>
    {@render children?.()}
  </div>
</aside>

<style>
  .pnl {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--bg-1);
    overflow: hidden;
  }

  .pnl__head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: none;
    height: var(--h-head);
    padding: 0 var(--sp-2);
    border-bottom: 1px solid var(--line);
    font-size: var(--fs-xs);
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--fg-2);
  }

  .pnl__no {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--fg-3);
    letter-spacing: 0.04em;
  }

  .pnl__body {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: var(--sp-2);
    gap: var(--sp-4);
  }

  .pnl__body--scroll {
    overflow-y: auto;
  }
</style>
