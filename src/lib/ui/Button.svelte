<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'primary' | 'ghost';
    size?: 'md' | 'sm';
    type?: 'button' | 'submit';
    disabled?: boolean;
    wide?: boolean;
    title?: string;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    variant = 'default',
    size = 'md',
    type = 'button',
    disabled = false,
    wide = false,
    title,
    onclick,
    children,
  }: Props = $props();
</script>

<button
  class="btn btn--{variant} btn--{size}"
  class:btn--wide={wide}
  {type}
  {disabled}
  {title}
  {onclick}
>
  {@render children?.()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-1);
    height: var(--h-ctl);
    padding: 0 var(--sp-2);
    border: 1px solid var(--line-2);
    border-radius: var(--r-1);
    background: var(--bg-2);
    color: var(--fg-1);
    font-size: var(--fs-sm);
    letter-spacing: 0.02em;
    white-space: nowrap;
    transition:
      background var(--dur-1) var(--ease),
      border-color var(--dur-1) var(--ease);
  }

  .btn:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--line-3);
  }

  .btn:active:not(:disabled) {
    background: var(--bg-2);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn--primary {
    position: relative;
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-fg);
    font-weight: 600;
  }

  .btn--primary:hover:not(:disabled) {
    background: var(--accent-2);
    border-color: var(--accent-2);
  }

  .btn--ghost {
    background: transparent;
    border-color: transparent;
    color: var(--fg-2);
  }

  .btn--ghost:hover:not(:disabled) {
    background: var(--bg-2);
    color: var(--fg-1);
  }

  .btn--sm {
    height: var(--h-ctl-sm);
    padding: 0 var(--sp-1);
    font-size: var(--fs-xs);
  }

  .btn--wide {
    width: 100%;
  }

  /* desregistro: 1px de cian y magenta, solo en la acción primaria */
  .btn--primary::before,
  .btn--primary::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--r-1);
    pointer-events: none;
  }

  .btn--primary::before {
    border-left: 1px solid var(--mis-c);
    transform: translateX(-1px);
  }

  .btn--primary::after {
    border-right: 1px solid var(--mis-m);
    transform: translateX(1px);
  }
</style>
