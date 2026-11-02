import {
  ALL_FORMATS,
  BlobSource,
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedPacketSink,
  Input,
  type Output,
} from 'mediabunny';

/** Un hueco de audio: de qué frame del original sale y dónde cae en la salida. */
export type AudioSlot = {
  sourceIndex: number;
  outStart: number;
};

export type AudioPlan = {
  file: File;
  /** segundo del original donde empieza la captura */
  from: number;
  /** duración de un frame del original, en segundos */
  srcSpan: number;
  slots: AudioSlot[];
};

/**
 * Copia el audio del archivo original y lo recoloca según la secuencia: cada frame se lleva su
 * trozo de sonido, y los frames duplicados lo repiten. Sin reordenar, es un recorte normal.
 */
export async function addAudioTrack(output: Output, plan: AudioPlan) {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(plan.file) });
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;
  const codec = await track.getCodec();
  if (!codec) return null;

  const config = await track.getDecoderConfig();
  const source = new EncodedAudioPacketSource(codec);
  output.addAudioTrack(source, { decoderConfig: config ?? undefined });

  const byFrame = new Map<number, AudioSlot[]>();
  for (const slot of plan.slots) {
    const list = byFrame.get(slot.sourceIndex) ?? [];
    list.push(slot);
    byFrame.set(slot.sourceIndex, list);
  }

  void byFrame;

  const feed = async (): Promise<number> => {
    const sink = new EncodedPacketSink(track);

    // el muxer exige orden de tiempo: se agrupan los paquetes por frame de origen y se
    // escriben en el orden de la secuencia, no en el del archivo
    const packetsByFrame = new Map<number, { data: Uint8Array; type: 'key' | 'delta'; timestamp: number; duration: number }[]>();
    for await (const packet of sink.packets()) {
      const frame = Math.floor((packet.timestamp - plan.from) / plan.srcSpan);
      if (frame < 0) continue;
      const list = packetsByFrame.get(frame) ?? [];
      list.push({
        data: packet.data,
        type: packet.type,
        timestamp: packet.timestamp,
        duration: packet.duration,
      });
      packetsByFrame.set(frame, list);
    }

    let written = 0;
    let first = true;
    for (const slot of plan.slots) {
      const list = packetsByFrame.get(slot.sourceIndex);
      if (!list) continue;
      const srcStart = plan.from + slot.sourceIndex * plan.srcSpan;
      for (const packet of list) {
        const offset = packet.timestamp - srcStart;
        if (offset < 0 || offset >= plan.srcSpan) continue;
        await source.add(
          new EncodedPacket(packet.data, packet.type, slot.outStart + offset, packet.duration),
          first ? { decoderConfig: config ?? undefined } : undefined,
        );
        first = false;
        written += 1;
      }
    }
    return written;
  };

  return { source, feed };
}
