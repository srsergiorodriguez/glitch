import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
} from 'mediabunny';

/**
 * Datamosh de verdad: se reescriben los paquetes del video original y cada I-frame se
 * sustituye por el P-frame anterior, así que el decodificador nunca reinicia la imagen y
 * el movimiento nuevo se aplica sobre la escena vieja.
 *
 * Chrome no lo decodifica (pinta negro), pero VLC y los reproductores tolerantes sí.
 */
export async function datamoshVideo(
  file: File,
  options: { every?: number } = {},
): Promise<{ blob: Blob; broken: number; total: number }> {
  const every = Math.max(1, Math.round(options.every ?? 1));
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('el archivo no tiene pista de video');
  const config = await track.getDecoderConfig();
  const sink = new EncodedPacketSink(track);

  const packets = [];
  for await (const packet of sink.packets()) packets.push(packet);
  if (packets.length < 2) throw new Error('el video es demasiado corto');

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new EncodedVideoPacketSource('avc');
  output.addVideoTrack(source, { decoderConfig: config ?? undefined });

  // el audio se copia tal cual: los tiempos de video no cambian, así que sigue sincronizado
  const audioTrack = await input.getPrimaryAudioTrack();
  let audioSource: EncodedAudioPacketSource | null = null;
  const audioCodec = audioTrack ? await audioTrack.getCodec() : null;
  if (audioTrack && audioCodec) {
    const audioConfig = await audioTrack.getDecoderConfig();
    audioSource = new EncodedAudioPacketSource(audioCodec);
    output.addAudioTrack(audioSource, { decoderConfig: audioConfig ?? undefined });
  }

  await output.start();

  if (audioSource && audioTrack) {
    const audioSink = new EncodedPacketSink(audioTrack);
    let firstAudio = true;
    for await (const packet of audioSink.packets()) {
      await audioSource.add(
        packet,
        firstAudio ? { decoderConfig: (await audioTrack.getDecoderConfig()) ?? undefined } : undefined,
      );
      firstAudio = false;
    }
  }

  let broken = 0;
  let keyCount = 0;
  for (let index = 0; index < packets.length; index++) {
    const packet = packets[index];
    const isKey = packet.type === 'key' && index > 0;
    if (isKey) keyCount += 1;
    const shouldBreak = isKey && (keyCount - 1) % every === 0;
    if (shouldBreak) {
      // el hueco del I-frame se rellena con el P-frame anterior: misma cadena, sin reinicio
      const previous = packets[index - 1];
      await source.add(
        new EncodedPacket(previous.data, 'delta', packet.timestamp, packet.duration),
        { decoderConfig: config ?? undefined },
      );
      broken += 1;
      continue;
    }
    await source.add(packet, index === 0 ? { decoderConfig: config ?? undefined } : undefined);
  }

  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('el codificador no devolvió datos');
  return { blob: new Blob([buffer], { type: 'video/mp4' }), broken, total: keyCount };
}
