<script lang="ts">
  import type { Effect } from '../core/types';
  import { PHASE_LABEL } from '../core/registry';

  interface Props {
    effects: Effect[];
    onpick: (id: string) => void;
    current?: string;
  }

  let { effects, onpick, current = '' }: Props = $props();

  const ORDER: Array<'pixel' | 'encode' | 'ingest'> = ['pixel', 'encode', 'ingest'];

  const groups = $derived(
    ORDER.map((phase) => ({
      phase,
      label: PHASE_LABEL[phase],
      items: effects.filter((effect) => effect.phase === phase),
    })).filter((group) => group.items.length > 0),
  );
</script>

<div class="list">
  {#each groups as group (group.phase)}
    <p class="list__group">{group.label}</p>
    {#each group.items as effect (effect.id)}
      <button
        class="list__item"
        class:is-current={effect.id === current}
        onclick={() => onpick(effect.id)}
      >
        <span class="list__name">{effect.label}</span>
        <span class="list__help">{effect.help}</span>
      </button>
    {/each}
  {/each}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    max-height: calc(300px * var(--u));
    overflow-y: auto;
    border: 1px solid var(--line);
    background: var(--bg-0);
  }

  .list__group {
    position: sticky;
    top: 0;
    margin: 0;
    padding: var(--sp-1) var(--sp-2);
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.12em;
    color: var(--fg-3);
  }

  .list__item {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    padding: var(--sp-1) var(--sp-2);
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: var(--fg-2);
    text-align: left;
  }

  .list__item:hover {
    background: var(--bg-2);
    color: var(--fg-1);
  }

  .list__item.is-current {
    color: var(--fg-1);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .list__name {
    font-size: var(--fs-md);
  }

  .list__help {
    font-size: var(--fs-xs);
    color: var(--fg-3);
    line-height: 1.3;
  }
</style>
