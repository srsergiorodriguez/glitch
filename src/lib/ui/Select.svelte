<script lang="ts">
  interface Props {
    id: string;
    label: string;
    value: string;
    options: { value: string; label: string; disabled?: boolean }[];
    disabled?: boolean;
    small?: boolean;
    onchange?: (value: string) => void;
  }

  let { id, label, value, options, disabled = false, small = false, onchange }: Props = $props();

  function change(event: Event): void {
    onchange?.((event.currentTarget as HTMLSelectElement).value);
  }
</script>

<select
  {id}
  class="sel"
  class:sel--sm={small}
  {disabled}
  {value}
  aria-label={label}
  onchange={change}
>
  {#each options as option (option.value)}
    <option value={option.value} disabled={option.disabled}>{option.label}</option>
  {/each}
</select>

<style>
  .sel {
    width: 100%;
    height: var(--h-ctl);
    padding: 0 var(--sp-1);
    border: 1px solid var(--line-2);
    border-radius: var(--r-1);
    background: var(--bg-2);
    color: var(--fg-1);
    font-size: var(--fs-sm);
  }

  .sel:hover:not(:disabled) {
    border-color: var(--line-3);
  }

  .sel:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .sel--sm {
    width: auto;
    height: var(--h-ctl-sm);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
