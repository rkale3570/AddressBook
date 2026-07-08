const TARGET_SAMPLE_RATE = 16000;

export function createWavRecorder() {
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let allSamples: Float32Array[] = [];

  async function start() {
    allSamples = [];
    audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    source = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      allSamples.push(new Float32Array(input));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }

  function stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (processor) processor.disconnect();
      if (source) source.disconnect();
      if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());

      let totalLength = 0;
      for (const chunk of allSamples) totalLength += chunk.length;

      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of allSamples) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      const wav = encodeWav(merged, TARGET_SAMPLE_RATE);
      resolve(wav);

      allSamples = [];
      audioContext?.close();
      audioContext = null;
    });
  }

  return { start, stop };
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
