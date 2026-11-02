<script lang="ts">
  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  const shortcuts = [
    { keys: 'espacio', what: 'reproducir / pausar' },
    { keys: '← →', what: 'frame anterior / siguiente' },
    { keys: 'ctrl ⌘ + s', what: 'exportar' },
    { keys: '?', what: 'esta ayuda' },
    { keys: 'esc', what: 'cerrar' },
  ];
</script>

<section class="help" aria-label="Atajos de teclado">
  <header class="help__head">
    <span>Atajos</span>
    <button class="help__close" aria-label="Cerrar la ayuda" onclick={onclose}>✕</button>
  </header>

  <dl class="help__list">
    {#each shortcuts as shortcut (shortcut.keys)}
      <dt class="help__keys">{shortcut.keys}</dt>
      <dd class="help__what">{shortcut.what}</dd>
    {/each}
  </dl>

  <p class="help__note">Arrastra archivos al visor para cargarlos.</p>
</section>

<style>
  .help {
    position: fixed;
    left: var(--sp-3);
    bottom: var(--sp-3);
    z-index: var(--z-pop);
    width: calc(260px * var(--u));
    padding: var(--sp-2);
    border: 1px solid var(--line-2);
    background: var(--bg-1);
    box-shadow: var(--shadow-pop);
  }

  .help__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--sp-2);
    font-size: var(--fs-xs);
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--fg-2);
  }

  .help__close {
    width: calc(20px * var(--u));
    height: calc(20px * var(--u));
    border: 0;
    background: transparent;
    color: var(--fg-3);
    font-size: var(--fs-sm);
    line-height: 1;
  }

  .help__close:hover {
    color: var(--fg-1);
  }

  .help__list {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sp-1) var(--sp-3);
    margin: 0;
    padding: var(--sp-2) 0;
    border-top: 1px solid var(--line);
  }

  .help__keys {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--fg-1);
  }

  .help__what {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--fg-2);
  }

  .help__note {
    margin: 0;
    padding-top: var(--sp-2);
    border-top: 1px solid var(--line);
    font-size: var(--fs-xs);
    color: var(--fg-3);
  }
</style>
