import type { Bitmap, EffectInstance, ParamValue } from '../core/types';
import { defaults } from '../core/params';
import { getEffect } from '../core/registry';
import {
  collectGifSettings,
  countBySurface,
  hasGlitch,
  runIngest,
  runStack,
  collectMoshing,
  collectGhost,
  collectAviSettings,
} from '../core/pipeline';
import { decodeBytes, decodeImageBytes, normalizeFrames, scaleToFrame } from '../ingest/decode';
import { captureVideo, grabThumbnails, videoDuration } from '../ingest/video';
import { permute, type OrderMode } from '../core/order';
import { hash32, mulberry32 } from '../core/prng';
import { extensionFor, fileToBytes, urlToBytes, type SourceBytes } from '../ingest/image';
import { baseName, bitmapToPng, downloadBlob } from '../export/png';
import { decodeGif } from '../codecs/gif/decode';
import { encodeGif, encodeGifFrame, prepareGif, type GifPrepared } from '../codecs/gif/encode';
import { framesToVideo, canEncodeVideo } from '../export/video';
import { framesToAvi } from '../export/avi';
import { datamoshVideo } from '../export/datamosh';
import { reorderAvi } from '../codecs/avi/read';
import { hasAviReorder } from '../core/video-settings';
import { moshSequence } from '../core/moshing';
import { applyGhost } from '../core/ghost';
import { LIMITS } from '../core/limits';
import type { GifGlitch } from '../core/gif-settings';
import { presets } from './presets';

type Status = 'empty' | 'ready' | 'running' | 'error';
type SourceKind = 'none' | 'file' | 'frames';
type Output = 'png' | 'gif' | 'mp4' | 'avi';

/** Un frame de la secuencia: qué frame de la fuente es y cuánto dura. */
type SequenceEntry = { index: number; delay: number };

/** Ajustes de interfaz: no son parte de la obra. */
export const ui = $state({
  integrity: 100,
  scale: 100,
});

export const project = $state({
  name: '',
  width: 0,
  height: 0,
  frameCount: 0,
  current: 0,
  fps: 12,
  seed: 81293,
  sourceKind: 'none' as SourceKind,
  sourceType: '',
  stack: [] as EffectInstance[],
  selectedId: '',
  status: 'empty' as Status,
  error: '',
  ms: 0,
  runId: 0,
  hasCorrupt: false,
  glitchActive: false,
  notice: '',
  capture: null as { done: number; total: number } | null,
  info: '',
  aviReorder: false,
  videoDuration: 0,
  datamoshEvery: 1,
  captureFrom: 0,
  captureTo: 0,
  videoThumbs: [] as string[],
  exporting: false,
  canVideo: canEncodeVideo(),
  videoGlitch: false,
  moshing: false,
  output: 'png' as Output,
  /** La secuencia es del proyecto, no de la pila: orden y duración por frame. */
  sequence: [] as SequenceEntry[],
  sourceLen: 0,
});

export const view = $state({
  bitmap: null as Bitmap | null,
  videoUrl: null as string | null,
});

let sourceBytes: SourceBytes | null = null;
let sourceFrames: Bitmap[] = [];
let cached: { signature: string; frames: Bitmap[]; delays: number[] } | null = null;
let extraFrames: { bitmap: Bitmap; delay: number }[] = [];
let outputFrames: Bitmap[] = [];
let outputDelays: number[] = [];
let corruptBytes: Uint8Array | null = null;
let prepared: GifPrepared | null = null;
let activeGlitch: GifGlitch | null = null;
let runToken = 0;
let scheduled = 0;
let previewUrl: string | null = null;
let videoFile: File | null = null;
/** Frame que se pinta en el visor, con el códec de GIF aplicado si hay glitch de GIF. */
function displayFrame(index: number): Bitmap | null {
  return glitchFrame(index) ?? outputFrames[index] ?? null;
}

function clearPreview(): void {
  if (!previewUrl) return;
  URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  view.videoUrl = null;
}
let counter = 0;

function uid(): string {
  counter += 1;
  return `fx${counter}`;
}

function fail(error: unknown): void {
  project.status = 'error';
  project.error = error instanceof Error ? error.message : String(error);
}

function defaultDelay(): number {
  return Math.max(20, Math.round(1000 / Math.max(1, project.fps)));
}

function ingestSignature(): string {
  const ingest = project.stack
    .filter((instance) => instance.enabled)
    .map((instance) => ({ id: instance.effectId, params: instance.params }))
    .filter((entry) => getEffect(entry.id)?.surface === 'bytes');
  return JSON.stringify({
    ingest,
    seed: project.seed,
    name: sourceBytes?.name,
    size: sourceBytes?.data.length,
    extras: extraFrames.length,
  });
}

/** Ordena la fuente según la secuencia. Si la fuente cambia de tamaño, vuelve al orden natural. */
function applySequence(
  frames: Bitmap[],
  delays: number[],
): { frames: Bitmap[]; delays: number[] } {
  if (project.sourceLen !== frames.length) {
    project.sourceLen = frames.length;
    project.sequence = frames.map((_, index) => ({
      index,
      delay: delays[index] ?? defaultDelay(),
    }));
  }

  const orderedFrames: Bitmap[] = [];
  const orderedDelays: number[] = [];
  for (const entry of project.sequence) {
    const frame = frames[entry.index];
    if (!frame) continue;
    orderedFrames.push(frame);
    orderedDelays.push(entry.delay);
  }

  return orderedFrames.length > 0
    ? { frames: orderedFrames, delays: orderedDelays }
    : { frames, delays };
}

export function getOutputFrames(): Bitmap[] {
  return outputFrames;
}

export function getOutputDelays(): number[] {
  return outputDelays;
}

/** El visor muestra el frame ya comprimido y decodificado: lo que el GIF termina siendo. */
function glitchFrame(index: number): Bitmap | null {
  const frame = outputFrames[index];
  if (!frame || !prepared || !activeGlitch) return null;
  try {
    const bytes = encodeGifFrame(frame, prepared, {
      glitch: activeGlitch,
      seed: project.seed,
      delays: [outputDelays[index] ?? defaultDelay()],
      delayMs: defaultDelay(),
    });
    return decodeGif(bytes).frames[0] ?? null;
  } catch {
    return null;
  }
}

export async function run(): Promise<void> {
  const token = ++runToken;
  if (project.sourceKind === 'none') {
    view.bitmap = null;
    return;
  }

  project.status = 'running';
  clearPreview();
  const avi = collectAviSettings(project.stack);
  project.aviReorder = avi !== null && hasAviReorder(avi);
  const started = performance.now();

  try {
    let decodedFrames: Bitmap[];
    let decodedDelays: number[];

    if (project.sourceKind === 'file' && sourceBytes) {
      const signature = ingestSignature();
      if (!cached || cached.signature !== signature) {
        const corrupt = await runIngest(sourceBytes.data, project.stack, project.seed);
        corruptBytes = corrupt;
        project.hasCorrupt = countBySurface(project.stack, 'bytes') > 0;
        let decoded;
        try {
          decoded = await decodeBytes(corrupt, sourceBytes.type);
        } catch (error) {
          if (project.hasCorrupt) {
            // no es un fallo de la app: es el resultado de corromper el archivo
            project.notice = 'el archivo corrupto ya no decodifica · descárgalo igual';
            project.status = 'ready';
            return;
          }
          throw error;
        }
        if (token !== runToken) return;
        project.notice = decoded.partial
          ? `se rescataron ${decoded.frames.length} frames del archivo dañado`
          : '';
        cached = { signature, frames: decoded.frames, delays: decoded.delays };
        if (decoded.delays[0] > 0) project.fps = Math.round(1000 / decoded.delays[0]);
      }
      decodedFrames = cached.frames;
      decodedDelays = cached.delays;
    } else {
      decodedFrames = sourceFrames;
      decodedDelays = sourceFrames.map(() => defaultDelay());
      corruptBytes = null;
      project.hasCorrupt = false;
    }

    const base = [...decodedFrames, ...extraFrames.map((extra) => extra.bitmap)];
    const baseDelays = [...decodedDelays, ...extraFrames.map((extra) => extra.delay)];
    const ordered = applySequence(base, baseDelays);

    const ghost = collectGhost(project.stack);
    let output = runStack(ordered.frames, project.stack, project.seed);
    // el reuso de P-frames es de secuencia: se aplica después de los efectos de píxel
    output = ghost ? applyGhost(output, ghost) : output;

    // el moshing hace su propio viaje por el códec: AVI de un JPEG por frame, índice roto
    const moshing = collectMoshing(project.stack);
    project.moshing = moshing !== null;
    if (moshing) output = await moshSequence(output, moshing, project.seed);

    if (token !== runToken) return;

    outputFrames = output;
    outputDelays = ordered.delays.slice(0, output.length);
    project.frameCount = output.length;
    project.width = output[0]?.width ?? 0;
    project.height = output[0]?.height ?? 0;
    if (project.current >= output.length) project.current = 0;

    const settings = collectGifSettings(project.stack, project.seed);
    project.glitchActive = hasGlitch(settings);
    if (project.glitchActive) {
      prepared = prepareGif(output, settings);
      activeGlitch = settings;
    } else {
      prepared = null;
      activeGlitch = null;
    }
    view.bitmap = displayFrame(project.current);
    project.ms = Math.round(performance.now() - started);
    project.runId += 1;
    project.status = 'ready';
    project.error = '';
  } catch (error) {
    if (token !== runToken) return;
    // el último frame bueno se queda en pantalla: un fallo no vacía el visor
    fail(error);
  }
}

/** Agrupa los cambios de un arrastre en una sola corrida por frame. */
export function requestRun(): void {
  if (scheduled) return;
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    void run();
  });
}

function resetSource(): void {
  project.info = '';
  project.videoThumbs = [];
  extraFrames = [];
  prepared = null;
  activeGlitch = null;
  cached = null;
  corruptBytes = null;
  outputFrames = [];
  outputDelays = [];
  project.sequence = [];
  project.sourceLen = 0;
  project.current = 0;
}

export async function loadFiles(files: File[]): Promise<void> {
  if (files.length === 0) return;
  try {
    if (files.length === 1 && files[0].type.startsWith('video/')) {
      const file = files[0];
      resetSource();
      videoFile = file;
      project.sourceType = file.type;
      project.name = file.name;
      await captureFromVideo(file);
      return;
    }

    if (files.length === 1) {
      const source = await fileToBytes(files[0]);
      resetSource();
      sourceBytes = source;
      sourceFrames = [];
      project.sourceKind = 'file';
      project.sourceType = source.type;
      project.name = source.name;
      await run();
      if (project.frameCount > 1) project.output = 'gif';
      return;
    }

    const frames: Bitmap[] = [];
    for (const file of files.slice(0, 300)) {
      const source = await fileToBytes(file);
      if (source.type === 'image/gif') {
        const decoded = await decodeBytes(source.data, source.type);
        frames.push(...decoded.frames);
      } else {
        frames.push(await decodeImageBytes(source.data, source.type));
      }
    }

    resetSource();
    sourceBytes = null;
    sourceFrames = normalizeFrames(frames);
    project.sourceKind = 'frames';
    project.sourceType = '';
    project.name = `${files.length} imágenes`;
    project.output = sourceFrames.length > 1 ? 'gif' : 'png';
    await run();
  } catch (error) {
    fail(error);
  }
}

/** Largo de la fuente antes de los frames añadidos. */
function baseLength(): number {
  const decoded = project.sourceKind === 'file' ? (cached?.frames.length ?? 0) : sourceFrames.length;
  return decoded + extraFrames.length;
}

/** Suma imágenes (o un GIF entero) al final de la secuencia actual. */
export async function appendFiles(files: File[]): Promise<void> {
  if (files.length === 0 || project.sourceKind === 'none') return;
  try {
    const added: { bitmap: Bitmap; delay: number }[] = [];
    const width = project.width;
    const height = project.height;

    for (const file of files.slice(0, 100)) {
      const source = await fileToBytes(file);
      if (source.type === 'image/gif') {
        const decoded = await decodeBytes(source.data, source.type);
        decoded.frames.forEach((bitmap, index) => {
          added.push({
            bitmap: width > 0 ? scaleToFrame(bitmap, width, height) : bitmap,
            delay: decoded.delays[index] || defaultDelay(),
          });
        });
      } else {
        const bitmap = await decodeImageBytes(source.data, source.type);
        added.push({
          bitmap: width > 0 ? scaleToFrame(bitmap, width, height) : bitmap,
          delay: defaultDelay(),
        });
      }
    }

    if (added.length === 0) return;

    const firstIndex = baseLength();
    extraFrames.push(...added);
    added.forEach((extra, offset) => {
      project.sequence.push({ index: firstIndex + offset, delay: extra.delay });
    });
    project.sourceLen = firstIndex + added.length;
    project.current = firstIndex;
    if (project.sequence.length > 1) project.output = 'gif';
    requestRun();
  } catch (error) {
    fail(error);
  }
}

async function captureFromVideo(file: File): Promise<void> {
  project.capture = { done: 0, total: 0 };
  try {
    // el tramo por defecto es el primero que cabe a 12 fps, no el video entero
    if (project.captureTo <= 0) {
      const duration = await videoDuration(file);
      project.videoDuration = Math.round(duration);
      project.captureFrom = 0;
      project.captureTo = Math.min(duration, LIMITS.videoFrames / 12);
    }
    const captured = await captureVideo(file, {
      fps: 12,
      maxFrames: LIMITS.videoFrames,
      maxEdge: LIMITS.videoEdge,
      from: project.captureFrom,
      to: project.captureTo > 0 ? project.captureTo : undefined,
      onProgress: (done, total) => {
        project.capture = { done, total };
      },
    });
    extraFrames = [];
    cached = null;
    sourceBytes = null;
    sourceFrames = captured.frames;
    project.sourceKind = 'frames';
    project.sourceLen = 0;
    project.sequence = [];
    project.current = 0;
    project.videoDuration = Math.round(captured.duration);
    project.captureFrom = Math.round(captured.start * 10) / 10;
    project.captureTo = Math.round((captured.start + captured.frames.length / captured.fps) * 10) / 10;
    project.fps = Math.max(1, Math.min(60, captured.fps));
    // un video se exporta como video: es donde sirven los efectos de códec
    project.output = canEncodeVideo() ? 'mp4' : 'gif';
    if (project.videoThumbs.length === 0) {
      // las miniaturas van aparte: no deben retrasar la captura
      grabThumbnails(file, 48, 320)
        .then((thumbs) => {
          if (videoFile === file) project.videoThumbs = thumbs;
        })
        .catch(() => undefined);
    }
    project.info = `${captured.frames.length} frames a ${captured.fps} fps · del ${captured.start.toFixed(0)} s al ${(
      captured.start + captured.frames.length / captured.fps
    ).toFixed(0)} s`;
    await run();
  } catch (error) {
    fail(error);
  } finally {
    project.capture = null;
  }
}

/** Vuelve a capturar el video cargado con el reparto elegido. */
export async function recapture(): Promise<void> {
  if (!videoFile) return;
  await captureFromVideo(videoFile);
}

/** Fija el tramo del video que se captura y lo aplica. */
export function setCaptureRange(from: number, to: number): void {
  project.captureFrom = Math.max(0, Math.round(from * 10) / 10);
  project.captureTo = Math.max(project.captureFrom + 0.1, Math.round(to * 10) / 10);
  if (videoFile) void recapture();
}

export async function loadSample(): Promise<void> {
  try {
    sourceBytes = await urlToBytes(`${import.meta.env.BASE_URL}sample.jpg`);
    resetSource();
    sourceFrames = [];
    project.sourceKind = 'file';
    project.sourceType = sourceBytes.type;
    project.name = sourceBytes.name;
    await run();
    if (project.frameCount > 1) project.output = 'gif';
  } catch (error) {
    fail(error);
  }
}

/** Aplica un modo de orden de tomato a la secuencia, con la semilla del proyecto. */
export function applyOrderMode(mode: OrderMode, amount: number): void {
  if (project.sequence.length < 2) return;
  const rng = mulberry32(hash32(`order|${project.seed}`));
  project.sequence = permute(project.sequence, mode, amount, rng);
  if (project.current >= project.sequence.length) project.current = 0;
  requestRun();
}

/** Devuelve la secuencia al orden natural, conservando la duración de cada frame. */
export function resetOrder(): void {
  if (project.sequence.length < 2) return;
  const delays = new Map(project.sequence.map((entry) => [entry.index, entry.delay]));
  const length = Math.max(project.sourceLen, ...project.sequence.map((entry) => entry.index + 1));
  project.sequence = Array.from({ length }, (_, index) => ({
    index,
    delay: delays.get(index) ?? defaultDelay(),
  }));
  project.current = 0;
  requestRun();
}

export function setFrame(index: number): void {
  if (project.frameCount === 0) return;
  const next = ((index % project.frameCount) + project.frameCount) % project.frameCount;
  project.current = next;
  view.bitmap = displayFrame(next);
}

/** Mueve el frame visible dentro de la secuencia. */
export function moveFrame(index: number, direction: -1 | 1): void {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= project.sequence.length) return;
  const sequence = project.sequence.slice();
  [sequence[index], sequence[target]] = [sequence[target], sequence[index]];
  project.sequence = sequence;
  project.current = target;
  requestRun();
}

export function duplicateFrame(index: number): void {
  if (index < 0 || index >= project.sequence.length) return;
  const sequence = project.sequence.slice();
  const entry = sequence[index];
  sequence.splice(index + 1, 0, { index: entry.index, delay: entry.delay });
  project.sequence = sequence;
  project.current = index + 1;
  requestRun();
}

export function removeFrame(index: number): void {
  if (project.sequence.length <= 1 || index < 0 || index >= project.sequence.length) return;
  const sequence = project.sequence.slice();
  sequence.splice(index, 1);
  project.sequence = sequence;
  project.current = Math.min(index, sequence.length - 1);
  requestRun();
}

export function setFrameDelay(ms: number): void {
  const entry = project.sequence[project.current];
  if (!entry) return;
  entry.delay = Math.max(20, Math.min(10000, Math.round(ms)));
  requestRun();
}

export function addEffect(effectId: string): void {
  const effect = getEffect(effectId);
  if (!effect) return;
  const instance: EffectInstance = {
    uid: uid(),
    effectId,
    enabled: true,
    params: defaults(effect.params),
  };
  project.stack.push(instance);
  project.selectedId = instance.uid;
  requestRun();
}

/** Cambia el efecto de un hueco de la pila sin moverlo ni cambiar su uid. */
export function replaceEffect(uidValue: string, effectId: string): void {
  const instance = project.stack.find((entry) => entry.uid === uidValue);
  const effect = getEffect(effectId);
  if (!instance || !effect) return;
  instance.effectId = effectId;
  instance.params = defaults(effect.params);
  project.selectedId = instance.uid;
  requestRun();
}

export function removeEffect(target: string): void {
  const index = project.stack.findIndex((instance) => instance.uid === target);
  if (index < 0) return;
  project.stack.splice(index, 1);
  if (project.selectedId === target) {
    project.selectedId = project.stack[Math.max(0, index - 1)]?.uid ?? '';
  }
  requestRun();
}

export function toggleEffect(target: string): void {
  const instance = project.stack.find((entry) => entry.uid === target);
  if (!instance) return;
  instance.enabled = !instance.enabled;
  requestRun();
}

export function moveEffect(target: string, direction: -1 | 1): void {
  const index = project.stack.findIndex((instance) => instance.uid === target);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= project.stack.length) return;
  const [instance] = project.stack.splice(index, 1);
  project.stack.splice(next, 0, instance);
  requestRun();
}

export function selectEffect(target: string): void {
  project.selectedId = target;
}

export function setParam(uidValue: string, key: string, value: ParamValue): void {
  const instance = project.stack.find((entry) => entry.uid === uidValue);
  if (!instance) return;
  instance.params[key] = value;
  requestRun();
}

export function applyPreset(presetId: string): void {
  const preset = presets.find((entry) => entry.id === presetId);
  if (!preset) return;
  project.stack = preset.stack.map((entry) => {
    const effect = getEffect(entry.effectId);
    return {
      uid: uid(),
      effectId: entry.effectId,
      enabled: true,
      params: { ...defaults(effect?.params ?? []), ...entry.params },
    };
  });
  project.selectedId = project.stack[0]?.uid ?? '';
  requestRun();
}

export function setSeed(seed: number): void {
  project.seed = Math.round(seed) % 100000;
  requestRun();
}

export function bumpSeed(): void {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  setSeed(value[0] % 100000);
}

/** fija la duración de todos los frames a partir de los fps */
export function setFps(fps: number): void {
  project.fps = Math.max(1, Math.min(60, Math.round(fps)));
  const delay = defaultDelay();
  for (const entry of project.sequence) entry.delay = delay;
  requestRun();
}

export function setOutput(output: Output): void {
  project.output = output;
}

export async function exportPng(): Promise<void> {
  if (!view.bitmap) return;
  try {
    const blob = await bitmapToPng(view.bitmap);
    downloadBlob(blob, `${baseName(project.name)}-glitch.png`);
  } catch (error) {
    fail(error);
  }
}

export async function exportGif(): Promise<void> {
  if (outputFrames.length === 0) return;
  try {
    // un GIF con cientos de frames pesa demasiado: se recorta al principio
    const frames = outputFrames.slice(0, LIMITS.gifFrames);
    const delays = outputDelays.slice(0, LIMITS.gifFrames);
    const gif = encodeGif(frames, {
      delayMs: defaultDelay(),
      delays,
      glitch: activeGlitch ?? undefined,
      seed: project.seed,
    });
    downloadBlob(
      new Blob([gif as BlobPart], { type: 'image/gif' }),
      `${baseName(project.name)}-glitch.gif`,
    );
  } catch (error) {
    fail(error);
  }
}

async function buildVideo(): Promise<{ blob: Blob; extension: 'mp4' | 'webm' }> {
  const frames = outputFrames.map((bitmap, index) => ({
    bitmap,
    delay: outputDelays[index] ?? defaultDelay(),
  }));
  return await framesToVideo(frames);
}

/** Datamosh real sobre el archivo original: reescribe los paquetes y quema los I-frames. */
export async function exportDatamosh(): Promise<void> {
  if (!videoFile) return;
  project.exporting = true;
  try {
    const { blob, broken, total } = await datamoshVideo(videoFile, { every: project.datamoshEvery });
    downloadBlob(blob, `${baseName(project.name)}-datamosh.mp4`);
    project.notice = `${broken} de ${total} I-frames quemados · ábrelo en VLC, Chrome lo muestra en negro`;
  } catch (error) {
    fail(error);
  } finally {
    project.exporting = false;
  }
}

export async function exportAvi(): Promise<void> {
  if (outputFrames.length === 0) return;
  project.exporting = true;
  try {
    const bytes = await framesToAvi(outputFrames, Math.max(1, project.fps));
    const settings = collectAviSettings(project.stack);
    let file = bytes;
    if (settings && hasAviReorder(settings)) {
      const rng = mulberry32(hash32(`avi|${project.seed}`));
      const order = permute(
        Array.from({ length: project.frameCount }, (_, index) => index),
        settings.mode as OrderMode,
        settings.amount,
        rng,
      );
      file = reorderAvi(bytes, order);
    }
    downloadBlob(new Blob([file as BlobPart], { type: 'video/x-msvideo' }), `${baseName(project.name)}-glitch.avi`);
  } catch (error) {
    fail(error);
  } finally {
    project.exporting = false;
  }
}

export async function exportVideo(): Promise<void> {
  if (outputFrames.length === 0) return;
  project.exporting = true;
  try {
    const { blob, extension } = await buildVideo();
    downloadBlob(blob, `${baseName(project.name)}-glitch.${extension}`);
    project.notice =
      extension === 'webm' ? 'este navegador no pudo codificar MP4: se exportó WebM' : '';
  } catch (error) {
    fail(error);
  } finally {
    project.exporting = false;
  }
}

/** Vuelve del video previsualizado a la secuencia de frames. */
export function clearVideoPreview(): void {
  clearPreview();
}

export async function previewVideo(): Promise<void> {
  if (outputFrames.length === 0) return;
  project.exporting = true;
  try {
    const { blob } = await buildVideo();
    clearPreview();
    previewUrl = URL.createObjectURL(blob);
    view.videoUrl = previewUrl;
  } catch (error) {
    fail(error);
  } finally {
    project.exporting = false;
  }
}

export function exportRaw(): void {
  if (!corruptBytes || !sourceBytes) return;
  downloadBlob(
    new Blob([corruptBytes as BlobPart], { type: sourceBytes.type }),
    `${baseName(project.name)}-corrupto.${extensionFor(sourceBytes.type)}`,
  );
}
