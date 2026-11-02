<script lang="ts">
  interface Props {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    oninput?: (value: number) => void;
  }

  let { id, label, value, min, max, step = 1, oninput }: Props = $props();

  function handle(event: Event): void {
    oninput?.(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

<input
  {id}
  class="sl"
  type="range"
  {min}
  {max}
  {step}
  {value}
  aria-label={label}
  oninput={handle}
/>

<style>
  .sl {
    width: 100%;
    height: calc(14px * var(--u));
    margin: 0;
    accent-color: var(--accent);
    background: transparent;
    cursor: pointer;
  }
</style>
