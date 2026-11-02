<script lang="ts">
  interface Props {
    id: string;
    label: string;
    checked: boolean;
    onchange?: (checked: boolean) => void;
  }

  let { id, label, checked, onchange }: Props = $props();

  function change(event: Event): void {
    onchange?.((event.currentTarget as HTMLInputElement).checked);
  }
</script>

<label class="chk" for={id}>
  <input {id} class="chk__box" type="checkbox" {checked} onchange={change} />
  <span class="chk__label">{label}</span>
</label>

<style>
  .chk {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--fs-sm);
    color: var(--fg-2);
    cursor: pointer;
  }

  .chk__box {
    width: calc(11px * var(--u));
    height: calc(11px * var(--u));
    margin: 0;
    accent-color: var(--accent);
    background: var(--bg-2);
    cursor: pointer;
  }

  .chk:hover .chk__label {
    color: var(--fg-1);
  }
</style>
