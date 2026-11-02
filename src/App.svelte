<script lang="ts">
  import { onMount } from 'svelte';
  import Panel from './lib/ui/Panel.svelte';
  import Button from './lib/ui/Button.svelte';
  import IconButton from './lib/ui/IconButton.svelte';
  import Select from './lib/ui/Select.svelte';
  import Checkbox from './lib/ui/Checkbox.svelte';
  import TrimModal from './lib/ui/TrimModal.svelte';
  import Stage from './lib/ui/Stage.svelte';
  import Field from './lib/ui/Field.svelte';
  import NumberInput from './lib/ui/NumberInput.svelte';
  import ParamControl from './lib/ui/ParamControl.svelte';
  import Filmstrip from './lib/ui/Filmstrip.svelte';
  import EffectPicker from './lib/ui/EffectPicker.svelte';
  import EffectList from './lib/ui/EffectList.svelte';
  import ShortcutHelp from './lib/ui/ShortcutHelp.svelte';
  import { PHASE_LABEL, effects, getEffect } from './lib/core/registry';
  import { ORDER_MODES, type OrderMode } from './lib/core/order';
  import { LIMITS } from './lib/core/limits';
  import { presets } from './lib/state/presets';
  import {
    addEffect,
    appendFiles,
    applyOrderMode,
    applyPreset,
    bumpSeed,
    duplicateFrame,
    getOutputDelays,
    exportGif,
    exportAvi,
    exportDatamosh,
    exportPng,
    exportRaw,
    exportVideo,
    previewVideo,
    clearVideoPreview,
    resetOrder,
    recapture,
    getOutputFrames,
    loadFiles,
    loadSample,
    moveEffect,
    moveFrame,
    project,
    removeEffect,
    removeFrame,
    replaceEffect,
    setCaptureRange,
    selectEffect,
    setFps,
    setFrame,
    setFrameDelay,
    setOutput,
    setParam,
    setSeed,
    toggleEffect,
    ui,
    view,
  } from './lib/state/project.svelte';

  let fileInput: HTMLInputElement | null = $state(null);
  let playing = $state(false);
  let appendMode = false;
  let replacing = $state(false);
  let help = $state(false);
  let orderAmount = $state(2);

  const selected = $derived(
    project.stack.find((instance) => instance.uid === project.selectedId) ?? null,
  );
  const definition = $derived(selected ? (getEffect(selected.effectId) ?? null) : null);
  const hasSource = $derived(project.sourceKind !== 'none');
  const isSequence = $derived(project.frameCount > 1);
  const frames = $derived.by(() => {
    project.runId;
    return getOutputFrames();
  });

  const totalMs = $derived(project.sequence.reduce((sum, entry) => sum + entry.delay, 0));

  let trimOpen = $state(false);

  const captureEstimate = $derived.by(() => {
    if (project.videoDuration <= 0) return '';
    const from = project.captureFrom;
    const to = project.captureTo > 0 ? project.captureTo : project.videoDuration;
    const span = Math.max(0.1, to - from);
    const total = Math.min(LIMITS.videoFrames, Math.max(1, Math.round(span * 12)));
    const fps = Math.max(1, Math.round(total / span));
    return `${total} frames a ${fps} fps · del ${from.toFixed(0)} s al ${to.toFixed(0)} s`;
  });
  const exportLabel = $derived(
    project.exporting
      ? 'exportando…'
      : `${project.hasCorrupt ? 'Hornear' : 'Exportar'} ${project.output.toUpperCase()}`,
  );

  const gifOverflow = $derived(
    project.output === 'gif' && project.frameCount > LIMITS.gifFrames,
  );
  const currentDelay = $derived(
    project.sequence[project.current]?.delay ?? Math.round(1000 / Math.max(1, project.fps)),
  );

  const skipped = $derived(
    project.sourceKind === 'frames'
      ? project.stack.filter(
          (instance) => instance.enabled && getEffect(instance.effectId)?.surface === 'bytes',
        ).length
      : 0,
  );

  const fitsOutput = (surface: string): boolean => {
    if (surface === 'gif') return project.output === 'gif';
    if (surface === 'video') return project.output === 'mp4' || project.output === 'avi';
    return true;
  };

  const availableEffects = $derived(
    effects.filter(
      (effect) =>
        (effect.surface !== 'bytes' || project.sourceKind === 'file') &&
        fitsOutput(effect.surface) &&
        (!effect.requires || effect.requires.includes(project.sourceType)),
    ),
  );

  const videoCodecActive = $derived(
    project.stack.some(
      (instance) => instance.enabled && getEffect(instance.effectId)?.surface === 'video',
    ),
  );

  const codecActive = $derived(
    project.stack.some(
      (instance) =>
        instance.enabled &&
        (getEffect(instance.effectId)?.surface === 'gif' ||
          getEffect(instance.effectId)?.surface === 'video' ||
          getEffect(instance.effectId)?.surface === 'frame'),
    ),
  );

  const aviOnly = $derived(
    project.stack.some(
      (instance) => instance.enabled && instance.effectId === 'avi.reorder',
    ),
  );

  const idleEffects = $derived(
    project.stack.filter((instance) => {
      if (!instance.enabled) return false;
      const effect = getEffect(instance.effectId);
      return effect ? !fitsOutput(effect.surface) : false;
    }).length,
  );

  const integrityOptions = [
    { value: '100', label: '100 %' },
    { value: '97', label: '97 %' },
    { value: '92', label: '92 %' },
  ];

  const scaleOptions = [
    { value: '100', label: '100 %' },
    { value: '125', label: '125 %' },
    { value: '150', label: '150 %' },
  ];

  const orderOptions = [
    { value: '', label: 'reordenar…' },
    ...ORDER_MODES.map((mode) => ({ value: mode.value, label: mode.label })),
    { value: 'original', label: 'volver al original' },
  ];

  const outputOptions = [
    { value: 'png', label: 'PNG · frame actual' },
    { value: 'gif', label: 'GIF · secuencia' },
    { value: 'mp4', label: 'MP4 · video', disabled: !project.canVideo },
    { value: 'avi', label: 'AVI · tomate' },
  ];

  function timecode(frame: number, fps: number): string {
    const rate = Math.max(1, Math.round(fps));
    const seconds = Math.floor(frame / rate);
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}:${pad(frame % rate)}`;
  }

  function openPicker(): void {
    appendMode = false;
    fileInput?.click();
  }

  function openAppend(): void {
    appendMode = true;
    fileInput?.click();
  }

  async function onFileChange(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const append = appendMode;
    appendMode = false;
    if (files.length > 0) {
      if (append) await appendFiles(files);
      else await loadFiles(files);
    }
    input.value = '';
  }

  function onFiles(files: File[]): void {
    void loadFiles(files);
  }

  function onExample(): void {
    void loadSample();
  }

  function togglePlay(): void {
    if (project.frameCount < 2) return;
    playing = !playing;
  }

  function isTyping(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return true;
    if (element.tagName === 'SELECT') return true;
    return element.isContentEditable;
  }

  function onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      doExport();
      return;
    }

    if (isTyping(event.target)) return;

    if (event.key === ' ') {
      if (project.frameCount < 2) return;
      event.preventDefault();
      togglePlay();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (project.frameCount < 2) return;
      event.preventDefault();
      setFrame(project.current + (event.key === 'ArrowLeft' ? -1 : 1));
      return;
    }

    if (event.key === '?') {
      event.preventDefault();
      help = !help;
      return;
    }

    if (event.key === 'Escape' && help) help = false;
  }

  function doExport(): void {
    if (project.exporting) return;
    if (project.output === 'mp4') void exportVideo();
    else if (project.output === 'avi') void exportAvi();
    else if (project.output === 'gif') void exportGif();
    else void exportPng();
  }

  // si cambia el efecto seleccionado, el selector de reemplazo se cierra
  $effect(() => {
    project.selectedId;
    replacing = false;
  });

  // reproducción: cada frame dura lo que dice la secuencia
  $effect(() => {
    if (!playing || project.frameCount < 2) return;
    let last = performance.now();
    const ticker = setInterval(() => {
      const delays = getOutputDelays();
      const delay = delays[project.current] ?? Math.round(1000 / Math.max(1, project.fps));
      const now = performance.now();
      if (now - last >= delay) {
        last = now;
        setFrame(project.current + 1);
      }
    }, 16);
    return () => clearInterval(ticker);
  });

  $effect(() => {
    if (project.frameCount < 2 && playing) playing = false;
  });

  // la escala vive en <html>: los tokens se calculan en la raíz
  $effect(() => {
    const root = document.documentElement;
    root.classList.remove('u-100', 'u-125', 'u-150');
    root.classList.add(`u-${ui.scale}`);
  });

  onMount(() => {
    if (!window.location.search.includes('ejemplo')) return;
    void (async () => {
      await loadSample();
      applyPreset('cortes');
    })();
  });
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
  <title>glitch</title>
</svelte:head>

<input
  class="file"
  type="file"
  accept="image/*,video/*"
  multiple
  tabindex="-1"
  aria-hidden="true"
  bind:this={fileInput}
  onchange={onFileChange}
/>

<div class="app" class:has-sequence={isSequence} data-integrity={ui.integrity}>
  <header class="menubar">
    <span class="brand">glit<span class="brand__accent">c</span>h</span>

    <nav class="menu">
      <Button variant="ghost" size="sm" onclick={() => openPicker()}>Abrir</Button>
    </nav>

    <p class="readout">
      {#if hasSource}
        {project.width}×{project.height} · {project.frameCount}
        {project.frameCount === 1 ? 'frame' : 'frames'}
        {#if isSequence} · {project.fps} fps{/if} · {project.ms < 1 ? '<1' : project.ms} ms
      {:else}
        sin fuente
      {/if}
    </p>

    <span class="spacer"></span>

    {#if project.status === 'error'}
      <span class="chip chip--danger" role="status">{project.error}</span>
    {/if}
    {#if project.info}
      <span class="chip" role="status">{project.info}</span>
    {/if}
    {#if project.notice}
      <span class="chip chip--warn" role="status">{project.notice}</span>
    {/if}
    {#if aviOnly}
      <span class="chip chip--warn" role="status">
        {project.output === 'avi'
          ? '«Ordenar el AVI» no se previsualiza: se ve al abrir el archivo en VLC'
          : '«Ordenar el AVI» solo existe en el archivo: exporta en AVI y ábrelo en VLC'}
      </span>
    {/if}
    {#if idleEffects > 0}
      <span class="chip chip--warn" role="status">
        {idleEffects} efecto(s) no aplican a la salida {project.output.toUpperCase()}
      </span>
    {/if}
    {#if gifOverflow}
      <span class="chip chip--warn" role="status">
        el GIF exporta los primeros {LIMITS.gifFrames} frames
      </span>
    {/if}
    {#if project.capture}
      <span class="chip chip--warn" role="status">
        capturando {project.capture.done}/{project.capture.total}
      </span>
    {/if}
    {#if skipped > 0}
      <span class="chip" role="status">{skipped} efecto(s) de datos omitidos</span>
    {/if}

    <span class="mini">integridad</span>
    <Select
      id="integrity"
      label="Integridad de la interfaz"
      small
      value={String(ui.integrity)}
      options={integrityOptions}
      onchange={(value) => (ui.integrity = Number(value))}
    />

    <span class="mini">escala</span>
    <Select
      id="scale"
      label="Escala de la interfaz"
      small
      value={String(ui.scale)}
      options={scaleOptions}
      onchange={(value) => (ui.scale = Number(value))}
    />

    <IconButton label="Atajos de teclado" onclick={() => (help = !help)}>?</IconButton>
  </header>

  <main class="workspace">
    <Panel index="01" title="Medios">
      <section class="block">
        <h2 class="block__title">Fuente</h2>
        {#if hasSource}
          <dl class="meta">
            <dt>archivo</dt>
            <dd>{project.name}</dd>
            <dt>tamaño</dt>
            <dd>{project.width}×{project.height}</dd>
            <dt>frames</dt>
            <dd>{project.frameCount}</dd>
            <dt>cálculo</dt>
            <dd>{project.ms < 1 ? '<1' : project.ms} ms</dd>
          </dl>
        {:else}
          <p class="empty">Sin fuente. Arrastra imágenes, un GIF o un video al visor.</p>
        {/if}
      </section>

      {#if project.videoDuration > 0}
        <section class="block">
          <h2 class="block__title">Video</h2>
          <div class="meta">
            <span>duración</span>
            <span>{project.videoDuration} s</span>
          </div>
          <p class="help">{captureEstimate}</p>
          <Button wide disabled={project.capture !== null} onclick={() => (trimOpen = true)}>
            Elegir tramo del video
          </Button>
          <Button wide disabled={project.capture !== null} onclick={() => void recapture()}>
            Recapturar
          </Button>
          <Field label="romper" forId="dmevery">
            <Select
              id="dmevery"
              label="Cuántos I-frames se rompen"
              value={String(project.datamoshEvery)}
              options={[
                { value: '1', label: 'todos' },
                { value: '2', label: 'uno de cada 2' },
                { value: '3', label: 'uno de cada 3' },
                { value: '4', label: 'uno de cada 4' },
              ]}
              onchange={(value) => (project.datamoshEvery = Number(value))}
            />
          </Field>
          <Button wide disabled={project.exporting} onclick={() => void exportDatamosh()}>
            {project.exporting ? 'reescribiendo…' : 'Datamosh real (MP4)'}
          </Button>
          <p class="help">
            Reescribe los paquetes del archivo original y sustituye cada I-frame por el P-frame
            anterior. Chrome no lo decodifica: ábrelo en VLC.
          </p>
        </section>
      {/if}

      {#if hasSource}
        <section class="block">
          <h2 class="block__title">Secuencia</h2>
          <div class="meta">
            <span>{project.frameCount} frames</span>
            <span>{(totalMs / 1000).toFixed(2)} s</span>
          </div>
          <Field label="orden" forId="order">
            <Select
              id="order"
              label="Reordenar los frames"
              value=""
              options={orderOptions}
              disabled={project.frameCount < 2}
              onchange={(value) => {
                if (value === 'original') resetOrder();
                else if (value) applyOrderMode(value as OrderMode, orderAmount);
              }}
            />
          </Field>
          <Field label="veces" forId="order-amount">
            <NumberInput
              id="order-amount"
              label="Veces"
              value={orderAmount}
              min={1}
              max={24}
              onchange={(value) => (orderAmount = value)}
            />
          </Field>
        </section>
      {/if}

      <section class="block">
        <h2 class="block__title">Presets</h2>
        <div class="presets">
          {#each presets as preset (preset.id)}
            <button class="preset" onclick={() => applyPreset(preset.id)}>
              <span class="preset__name">{preset.name}</span>
              <span class="preset__sum">{preset.summary}</span>
            </button>
          {/each}
        </div>
      </section>
    </Panel>

    <section class="viewer">
      <Stage
        bitmap={view.bitmap}
        videoUrl={view.videoUrl}
        name={project.name}
        hasSource={hasSource}
        onfiles={onFiles}
        onopen={openPicker}
        onexample={onExample}
      />

      {#if view.videoUrl}
        <div class="codec-note">
          <span>Previsualización del MP4 final.</span>
          <Button size="sm" onclick={clearVideoPreview}>Volver a los frames</Button>
        </div>
      {/if}

      {#if videoCodecActive && project.output === 'mp4' && !view.videoUrl}
        <div class="codec-note">
          <span>
            Los efectos de código no se ven en el canvas: se aplican al codificar.
          </span>
          <Button size="sm" disabled={project.exporting} onclick={() => void previewVideo()}>
            {project.exporting ? 'codificando…' : 'Codificar y ver el MP4'}
          </Button>
        </div>
      {/if}

      {#if hasSource}
        <div class="transport">
          <IconButton
            label={playing ? 'Pausar (espacio)' : 'Reproducir (espacio)'}
            disabled={project.frameCount < 2}
            onclick={togglePlay}
          >
            {playing ? '❚❚' : '▶'}
          </IconButton>
          <span class="tc">{timecode(project.current, project.fps)}</span>
          <span class="counter">{project.current + 1} / {project.frameCount}</span>
          <span class="mini">fps</span>
          <span class="fps">
            <NumberInput
              id="fps"
              label="Frames por segundo"
              value={project.fps}
              min={1}
              max={60}
              onchange={setFps}
            />
          </span>

          <span class="mini">ms</span>
          <span class="fps">
            <NumberInput
              id="delay"
              label="Duración del frame en milisegundos"
              value={currentDelay}
              min={20}
              max={10000}
              onchange={setFrameDelay}
            />
          </span>

          <span class="spacer"></span>

          <span class="mini">frame</span>
          <IconButton
            label="Mover el frame a la izquierda"
            disabled={project.current === 0}
            onclick={() => moveFrame(project.current, -1)}
          >
            ←
          </IconButton>
          <IconButton
            label="Mover el frame a la derecha"
            disabled={project.current >= project.frameCount - 1}
            onclick={() => moveFrame(project.current, 1)}
          >
            →
          </IconButton>
          <IconButton label="Duplicar el frame" onclick={() => duplicateFrame(project.current)}>
            ⧉
          </IconButton>
          <IconButton
            label="Quitar el frame"
            disabled={project.frameCount <= 1}
            onclick={() => removeFrame(project.current)}
          >
            ✕
          </IconButton>
          <IconButton label="Añadir frames" onclick={openAppend}>+</IconButton>
        </div>
      {/if}
    </section>

    <Panel index="03" title="Propiedades">
      <section class="block">
        <div class="stack">
          {#each project.stack as instance, index (instance.uid)}
            {@const item = getEffect(instance.effectId)}
            <button
              class="fx"
              class:is-active={instance.uid === project.selectedId}
              class:is-off={!instance.enabled}
              onclick={() => selectEffect(instance.uid)}
            >
              <span class="fx__no">{String(index + 1).padStart(2, '0')}</span>
              <span class="fx__name">{item?.label ?? instance.effectId}</span>
              <span class="fx__kind">{item ? PHASE_LABEL[item.phase] : ''}</span>
              <span class="fx__dot"></span>
            </button>
          {:else}
            <p class="empty">La pila está vacía.</p>
          {/each}
        </div>

        <EffectPicker label="añadir efecto" effects={availableEffects} onpick={addEffect} />
      </section>

      {#if selected && definition}
        {@const current = selected}
        {@const effect = definition}
        <section class="block">
          <div class="phead">
            <button
              class="phead__name"
              aria-expanded={replacing}
              title="Cambiar este efecto"
              onclick={() => (replacing = !replacing)}
            >
              {effect.label}
              <span class="phead__caret" aria-hidden="true"></span>
            </button>
            <div class="phead__actions">
              <IconButton label="Subir" onclick={() => moveEffect(current.uid, -1)}>↑</IconButton>
              <IconButton label="Bajar" onclick={() => moveEffect(current.uid, 1)}>↓</IconButton>
              <IconButton
                label={current.enabled ? 'Desactivar' : 'Activar'}
                onclick={() => toggleEffect(current.uid)}
              >
                {current.enabled ? '●' : '○'}
              </IconButton>
              <IconButton label="Quitar" onclick={() => removeEffect(current.uid)}>✕</IconButton>
            </div>
          </div>

          {#if replacing}
            <EffectList
              effects={availableEffects}
              current={current.effectId}
              onpick={(id) => {
                replaceEffect(current.uid, id);
                replacing = false;
              }}
            />
          {/if}

          <p class="help">{effect.help}</p>

          {#each effect.params as schema (schema.key)}
            <ParamControl
              schema={schema}
              id={`${current.uid}-${schema.key}`}
              value={current.params[schema.key]}
              onchange={(value) => setParam(current.uid, schema.key, value)}
            />
          {/each}
        </section>
      {/if}

      <section class="block">
        <Field label="seed" forId="seed">
          <div class="seed">
            <NumberInput
              id="seed"
              label="Semilla"
              value={project.seed}
              min={0}
              max={99999}
              onchange={setSeed}
            />
            <Button size="sm" title="Nueva semilla" onclick={bumpSeed}>⟳</Button>
          </div>
        </Field>

        <Field label="salida" forId="output">
          <Select
            id="output"
            label="Formato de salida"
            value={project.output}
            options={outputOptions}
            onchange={(value) => setOutput(value as 'png' | 'gif' | 'mp4' | 'avi')}
          />
        </Field>

        {#if project.hasAudioSource && project.output === 'mp4'}
          <Checkbox
            id="audio"
            label="Con el sonido original"
            checked={project.withAudio}
            onchange={(checked) => (project.withAudio = checked)}
          />
        {/if}

        <Button
          variant="primary"
          wide
          disabled={!view.bitmap || project.exporting}
          onclick={doExport}
        >
          {exportLabel}
        </Button>

        {#if project.output === 'avi'}
          <p class="help">
            El navegador no reproduce AVI: el archivo se abre en VLC. El índice queda obsoleto a
            propósito.
          </p>
        {/if}

        {#if project.output === 'mp4'}
          <Button wide disabled={!view.bitmap || project.exporting} onclick={() => void previewVideo()}>
            {project.exporting ? 'codificando…' : 'Ver el MP4 final'}
          </Button>
          <p class="help">
            Codifica los {project.frameCount} frames con la corrupción y reproduce el archivo tal
            como se descarga. No es una muestra: es el video completo.
          </p>
          {#if project.videoGlitch}
            <p class="help">
              Con la corrupción activa, el video puede congelarse al reproducir: el visor muestra lo
              que el decodificador logre sacar.
            </p>
          {/if}
        {/if}

        {#if project.hasCorrupt}
          <Button wide onclick={exportRaw}>Descargar archivo corrupto</Button>
          <p class="help">
            Hornear decodifica el archivo dañado y lo vuelve a comprimir: el resultado lo abre
            cualquier reproductor. El corrupto crudo se descarga abajo.
          </p>
        {/if}
      </section>
    </Panel>
    {#if trimOpen && project.videoThumbs.length > 0}
    <TrimModal
      thumbs={project.videoThumbs}
      duration={project.videoDuration}
      from={project.captureFrom}
      to={project.captureTo > 0 ? project.captureTo : project.videoDuration}
      onapply={(from, to) => setCaptureRange(from, to)}
      onclose={() => (trimOpen = false)}
    />
  {/if}
</main>

  {#if help}
    <ShortcutHelp onclose={() => (help = false)} />
  {/if}

  {#if isSequence}
    <footer class="timeline">
      <div class="timeline__head">
        <span class="panel__no">02</span>
        <span>Línea</span>
        <span class="timeline__meta">
          {#if codecActive}sin comprimir · {/if}{project.frameCount} frames · {project.fps} fps ·
          {(totalMs / 1000).toFixed(2)} s
        </span>
      </div>
      <Filmstrip {frames} current={project.current} onpick={setFrame} />
    </footer>
  {/if}
</div>

<style>
  .file {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .app {
    display: grid;
    grid-template-rows: var(--h-menu) 1fr;
    height: 100vh;
    height: 100dvh;
  }

  .app.has-sequence {
    grid-template-rows: var(--h-menu) 1fr var(--h-timeline);
  }

  /* ── barra superior ─────────────────────────────────────── */

  .menubar {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: 0 var(--sp-2) 0 var(--sp-3);
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
  }

  .brand {
    font-family: var(--font-mono);
    font-size: var(--fs-lg);
    letter-spacing: 0.16em;
    color: var(--fg-1);
  }

  .brand__accent {
    color: var(--accent);
  }

  .menu {
    display: flex;
    gap: var(--sp-1);
  }

  .readout {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--fg-3);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .spacer {
    flex: 1;
  }

  .mini {
    font-size: var(--fs-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg-3);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    height: var(--h-ctl-sm);
    padding: 0 var(--sp-2);
    border: 1px solid var(--line-2);
    border-radius: var(--r-1);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    color: var(--fg-2);
    max-width: calc(260px * var(--u));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip--danger {
    color: var(--danger);
    border-color: var(--danger);
  }

  .chip--warn {
    color: var(--warn);
  }

  /* ── tres zonas ─────────────────────────────────────────── */

  .workspace {
    display: grid;
    grid-template-columns: var(--w-left) minmax(0, 1fr) var(--w-right);
    min-height: 0;
  }

  .workspace > :global(.pnl:first-child) {
    border-right: 1px solid var(--line);
  }

  .workspace > :global(.pnl:last-child) {
    border-left: 1px solid var(--line);
  }

  .viewer {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  /* ── transporte ─────────────────────────────────────────── */

  .codec-note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    flex: none;
    padding: var(--sp-1) var(--sp-2);
    border-top: 1px solid var(--line);
    background: var(--bg-2);
    color: var(--fg-2);
    font-size: var(--fs-xs);
  }

  .transport {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: none;
    height: var(--h-bar);
    padding: 0 var(--sp-2);
    border-top: 1px solid var(--line);
    background: var(--bg-1);
  }

  .tc {
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    color: var(--fg-1);
    font-variant-numeric: tabular-nums;
  }

  .counter {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--fg-3);
    font-variant-numeric: tabular-nums;
  }

  .fps {
    width: calc(64px * var(--u));
  }

  /* ── bloques internos ───────────────────────────────────── */

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }

  .block__title {
    margin: 0;
    font-size: var(--fs-xs);
    font-weight: 400;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--fg-3);
  }

  .meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sp-1) var(--sp-2);
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }

  .meta dt {
    color: var(--fg-3);
  }

  .meta dd {
    margin: 0;
    color: var(--fg-2);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--fg-3);
  }

  .presets {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--line);
  }

  .preset {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: var(--sp-1);
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    text-align: left;
    color: var(--fg-2);
  }

  .preset:hover {
    background: var(--bg-2);
    color: var(--fg-1);
  }

  .preset__name {
    font-size: var(--fs-sm);
  }

  .preset__sum {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--fg-3);
  }

  /* ── pila de efectos ────────────────────────────────────── */

  .stack {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--line);
  }

  .fx {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    height: var(--h-row);
    padding: 0 var(--sp-1);
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: var(--fg-2);
    text-align: left;
  }

  .fx:hover {
    background: var(--bg-2);
    color: var(--fg-1);
  }

  .fx__no {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--fg-3);
    width: calc(14px * var(--u));
  }

  .fx__name {
    flex: 1;
    font-size: var(--fs-md);
  }

  .fx__kind {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.06em;
    color: var(--fg-3);
  }

  .fx__dot {
    width: calc(4px * var(--u));
    height: calc(4px * var(--u));
    border-radius: 50%;
    background: var(--accent);
  }

  .fx.is-active {
    background: var(--bg-2);
    color: var(--fg-1);
    box-shadow:
      inset 2px 0 0 var(--accent),
      inset 3px 0 0 var(--mis-c),
      inset -1px 0 0 var(--mis-m);
  }

  .fx.is-off {
    opacity: 0.4;
  }

  .fx.is-off .fx__dot {
    background: var(--fg-3);
  }

  .phead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
  }

  .phead__name {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--fg-1);
    font-size: var(--fs-md);
    text-align: left;
  }

  .phead__name:hover {
    color: var(--accent);
  }

  .phead__caret {
    flex: none;
    width: 0;
    height: 0;
    border-top: 3px solid currentColor;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    opacity: 0.7;
  }

  .phead__actions {
    display: flex;
    gap: 1px;
  }

  .help {
    margin: 0;
    font-size: var(--fs-xs);
    color: var(--fg-3);
    line-height: 1.35;
  }

  .seed {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    width: 100%;
  }

  /* ── línea de tiempo ────────────────────────────────────── */

  .timeline {
    display: grid;
    grid-template-rows: var(--h-head) 1fr;
    min-height: 0;
    border-top: 1px solid var(--line);
    overflow: hidden;
  }

  .timeline__head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 0 var(--sp-2);
    border-bottom: 1px solid var(--line);
    font-size: var(--fs-xs);
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--fg-2);
  }

  .timeline__meta {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0;
    color: var(--fg-3);
    text-transform: none;
  }

  /* ── integridad: corrupción decorativa, nunca de datos ──── */

  .app[data-integrity='97'] :global(.pnl__title) {
    letter-spacing: 0.128em;
  }

  .app[data-integrity='97'] .fx.is-active .fx__name {
    transform: translateY(1px);
  }

  .app[data-integrity='92'] {
    --mis-c: rgba(34, 224, 255, 0.8);
    --mis-m: rgba(255, 46, 136, 0.75);
  }

  .app[data-integrity='92'] .brand {
    letter-spacing: 0.155em;
  }

  @media (max-width: 1040px) {
    .workspace {
      grid-template-columns: calc(240px * var(--u)) minmax(0, 1fr) calc(276px * var(--u));
    }
  }

  @media (max-width: 900px) {
    .app,
    .app.has-sequence {
      height: auto;
      min-height: 100dvh;
      grid-template-rows: var(--h-menu) auto auto;
    }

    .workspace {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto auto;
    }

    .viewer {
      order: -1;
      min-height: 62vh;
    }

    .workspace > :global(.pnl) {
      border-left: 0;
      border-right: 0;
      border-top: 1px solid var(--line);
    }

    .timeline {
      grid-template-rows: var(--h-head) auto;
    }

    :global(body) {
      overflow: auto;
    }
  }
</style>
