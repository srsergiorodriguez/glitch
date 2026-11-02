<script lang="ts">
  interface Props {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    onchange?: (value: number) => void;
  }

  let { id, label, value, min, max, onchange }: Props = $props();

  function commit(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const parsed = Math.round(input.valueAsNumber);
    if (Number.isFinite(parsed)) {
      onchange?.(Math.min(max, Math.max(min, parsed)));
    }
    input.value = String(value);
  }
</script>

<input
  {id}
  class="num"
  type="number"
  {min}
  {max}
  {value}
  aria-label={label}
  onchange={commit}
/>

<style>
  .num {
    width: 100%;
    height: var(--h-ctl);
    padding: 0 var(--sp-1);
    border: 1px solid var(--line-2);
    border-radius: var(--r-1);
    background: var(--bg-2);
    color: var(--fg-1);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .num:hover {
    border-color: var(--line-3);
  }
</style>
