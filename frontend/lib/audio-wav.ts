/** Convert browser MediaRecorder blobs to 16 kHz mono WAV for NeuralDEEP Whisper. */

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function downsampleToMono(buffer: AudioBuffer, targetRate: number): Float32Array {
  const channelCount = buffer.numberOfChannels;
  const sourceRate = buffer.sampleRate;
  const length = Math.max(1, Math.round((buffer.length * targetRate) / sourceRate));
  const result = new Float32Array(length);
  const ratio = sourceRate / targetRate;

  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(buffer.length, Math.floor((i + 1) * ratio) || start + 1);
    let sum = 0;
    let count = 0;
    for (let sample = start; sample < end; sample += 1) {
      let mixed = 0;
      for (let channel = 0; channel < channelCount; channel += 1) {
        mixed += buffer.getChannelData(channel)[sample] ?? 0;
      }
      sum += mixed / channelCount;
      count += 1;
    }
    result[i] = count > 0 ? sum / count : 0;
  }
  return result;
}

function encodeWavMono16(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function blobToWav16kMono(blob: Blob): Promise<Blob> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("Браузер не умеет декодировать аудио");
  }

  const context = new AudioCtx();
  try {
    if (context.state === "suspended") {
      await context.resume();
    }
    const source = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(source.slice(0));
    if (!decoded.length) {
      throw new Error("Пустая аудиодорожка");
    }
    const mono = downsampleToMono(decoded, 16000);
    return encodeWavMono16(mono, 16000);
  } finally {
    await context.close().catch(() => undefined);
  }
}
