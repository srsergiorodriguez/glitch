<script lang="ts">
  import type { ParamSchema, ParamValue } from '../core/types';
  import Field from './Field.svelte';
  import Slider from './Slider.svelte';
  import NumberInput from './NumberInput.svelte';
  import Select from './Select.svelte';
  import Checkbox from './Checkbox.svelte';

  interface Props {
    schema: ParamSchema;
    id: string;
    value: ParamValue;
    onchange?: (value: ParamValue) => void;
  }

  let { schema, id, value, onchange }: Props = $props();

  const numeric = $derived(typeof value === 'number' ? value : Number(schema.default));
  const text = $derived(typeof value === 'string' ? value : String(schema.default));
  const flag = $derived(value === true);

  const display = $derived.by(() => {
    if (schema.kind === 'range' || schema.kind === 'int') {
      const shown = schema.kind === 'range' ? numeric.toFixed(2).replace(/\.?0+$/, '') : String(numeric);
      return schema.unit ? `${shown} ${schema.unit}` : shown;
    }
    if (schema.kind === 'enum') {
      return schema.options.find((option) => option.value === text)?.label ?? text;
    }
    return '';
  });
</script>

{#if schema.kind === 'bool'}
  <div class="pc pc--bool">
    <Checkbox {id} label={schema.label} checked={flag} onchange={(next) => onchange?.(next)} />
  </div>
{:else if schema.kind === 'range'}
  <Field label={schema.label} forId={id} value={display} help={schema.help}>
    <Slider
      {id}
      label={schema.label}
      value={numeric}
      min={schema.min}
      max={schema.max}
      step={schema.step}
      oninput={(next) => onchange?.(next)}
    />
  </Field>
{:else if schema.kind === 'int'}
  <Field label={schema.label} forId={id} value={display} help={schema.help}>
    <NumberInput
      {id}
      label={schema.label}
      value={numeric}
      min={schema.min}
      max={schema.max}
      onchange={(next) => onchange?.(next)}
    />
  </Field>
{:else}
  <Field label={schema.label} forId={id} value="" help={schema.help}>
    <Select
      {id}
      label={schema.label}
      value={text}
      options={schema.options}
      onchange={(next) => onchange?.(next)}
    />
  </Field>
{/if}

<style>
  .pc--bool {
    padding: var(--sp-1) 0 var(--sp-1) calc(var(--w-label) + var(--sp-2));
  }
</style>
