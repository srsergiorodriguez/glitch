<script lang="ts">
  import type { Bitmap } from '../core/types';

  interface Props {
    bitmap: Bitmap;
    width: number;
  }

  let { bitmap, width }: Props = $props();
  let canvas: HTMLCanvasElement | null = $state(null);

  $effect(() => {
    const target = canvas;
    const frame = bitmap;
    if (!target || !frame) return;

    const ratio = frame.height / frame.width;
    target.width = width;
    target.height = Math.max(1, Math.round(width * ratio));

    const context = target.getContext('2d');
    const source = document.createElement('canvas');
    source.width = frame.width;
    source.height = frame.height;
    const sourceContext = source.getContext('2d');
    if (!context || !sourceContext) return;

    sourceContext.putImageData(
      new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height),
      0,
      0,
    );
    context.drawImage(source, 0, 0, target.width, target.height);
  });
</script>

<span class="thumb-frame"><canvas bind:this={canvas} class="thumb" aria-hidden="true"></canvas></span>

<style>
  .thumb-frame {
    display: block;
    line-height: 0;
  }

  .thumb {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
