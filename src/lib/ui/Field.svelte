<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    forId?: string;
    value?: string;
    help?: string;
    error?: string;
    children?: Snippet;
  }

  let { label, forId, value = '', help, error, children }: Props = $props();
</script>

<div class="fld" class:fld--error={Boolean(error)}>
  <label class="fld__label" for={forId}>{label}</label>
  <div class="fld__ctl">{@render children?.()}</div>
  <span class="fld__val">{value}</span>
  {#if error || help}
    <span class="fld__help">{error ?? help}</span>
  {/if}
</div>

<style>
  .fld {
    display: grid;
    grid-template-columns: var(--w-label) minmax(0, 1fr) var(--w-val);
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-1) 0;
  }

  .fld__label {
    font-size: var(--fs-sm);
    color: var(--fg-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fld__ctl {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .fld__val {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--fg-1);
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .fld__help {
    grid-column: 2 / -1;
    font-size: var(--fs-xs);
    color: var(--fg-3);
    line-height: 1.3;
  }

  .fld--error .fld__help {
    color: var(--danger);
  }
</style>
