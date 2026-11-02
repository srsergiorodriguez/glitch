<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  }

  let { label, disabled = false, onclick, children }: Props = $props();
</script>

<button class="ibtn" aria-label={label} title={label} {disabled} {onclick}>
  {@render children?.()}
</button>

<style>
  .ibtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: calc(26px * var(--u));
    height: var(--h-ctl);
    border: 1px solid transparent;
    border-radius: var(--r-1);
    background: transparent;
    color: var(--fg-2);
    font-size: var(--fs-sm);
  }

  .ibtn:hover:not(:disabled) {
    background: var(--bg-2);
    color: var(--fg-1);
  }

  .ibtn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>
