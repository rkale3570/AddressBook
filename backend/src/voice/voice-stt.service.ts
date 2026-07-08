import { Injectable, Logger } from '@nestjs/common';
import { pipeline } from '@huggingface/transformers';
import * as os from 'os';
import * as path from 'path';

@Injectable()
export class VoiceSttService {
  private readonly logger = new Logger(VoiceSttService.name);
  private transcriber: any = null;
  private loading = false;

  private async ensureModel() {
    if (this.transcriber) return this.transcriber;
    if (this.loading) {
      while (this.loading) await new Promise(r => setTimeout(r, 500));
      return this.transcriber;
    }

    this.loading = true;
    this.logger.log('Loading Whisper tiny model - this may take a moment on first run (~150MB download)...');

    try {
      const cacheDir = path.join(os.homedir(), '.cache', 'whisper-models');
      this.logger.log(`Using cache directory: ${cacheDir}`);

      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        { cache_dir: cacheDir },
      );

      this.logger.log('Whisper model loaded successfully');
      return this.transcriber;
    } catch (err: any) {
      this.logger.error(`Failed to load Whisper model: ${err.message}`);
      if (err.stack) this.logger.error(err.stack);
      throw new Error(`Failed to load Whisper model: ${err.message}`);
    } finally {
      this.loading = false;
    }
  }

  async transcribeAudio(audioBuffer: Buffer, mimetype?: string): Promise<string> {
    this.logger.log(`Processing audio: ${audioBuffer.length} bytes, mimetype: ${mimetype || 'unknown'}`);

    const transcriber = await this.ensureModel();

    let float32: Float32Array;

    if (mimetype?.includes('wav') || this.looksLikeWav(audioBuffer)) {
      this.logger.log('Detected WAV format, decoding...');
      float32 = this.wavToFloat32(audioBuffer);
    } else {
      this.logger.log('Detected non-WAV format, attempting raw conversion...');
      float32 = this.rawToFloat32(audioBuffer);
    }

    if (float32.length === 0) {
      this.logger.error('No audio samples extracted from audio buffer');
      throw new Error('No audio samples could be extracted from the audio file');
    }

    const duration = float32.length / 16000;
    this.logger.log(`Extracted ${float32.length} samples (${duration.toFixed(1)}s at 16kHz)`);

    this.logger.log('Sending audio to Whisper for transcription...');

    try {
      const result = await transcriber(float32, {
        language: 'english',
        task: 'transcribe',
      });

      const text = result?.text || '';
      this.logger.log(`Transcript: "${text}"`);
      return text;
    } catch (err: any) {
      this.logger.error(`Transcription failed: ${err.message}`);
      if (err.stack) this.logger.error(err.stack);
      throw new Error(`Transcription failed: ${err.message}`);
    }
  }

  private looksLikeWav(buffer: Buffer): boolean {
    const header = buffer.slice(0, 4).toString('ascii');
    return buffer.length > 4 && header === 'RIFF';
  }

  private wavToFloat32(buffer: Buffer): Float32Array {
    this.logger.log(`WAV buffer size: ${buffer.length} bytes`);

    if (buffer.length < 44) {
      this.logger.error('WAV buffer too small (< 44 bytes)');
      return new Float32Array(0);
    }

    try {
      const numChannels = buffer.readUInt16LE(22);
      const bitsPerSample = buffer.readUInt16LE(34);
      const byteRate = buffer.readUInt32LE(28);

      this.logger.log(`WAV: channels=${numChannels}, bitsPerSample=${bitsPerSample}, byteRate=${byteRate}`);

      let dataOffset = 12;
      while (dataOffset < buffer.length - 8) {
        const chunkId = buffer.toString('ascii', dataOffset, dataOffset + 4);
        const chunkSize = buffer.readUInt32LE(dataOffset + 4);
        if (chunkId === 'data') {
          dataOffset += 8;
          break;
        }
        dataOffset += 8 + chunkSize;
      }

      const bytesPerSample = bitsPerSample / 8;
      const bytesAvailable = buffer.length - dataOffset;
      const totalSamples = Math.floor(bytesAvailable / (bytesPerSample * numChannels));
      const float32 = new Float32Array(totalSamples);

      this.logger.log(`WAV: dataOffset=${dataOffset}, bytesPerSample=${bytesPerSample}, totalSamples=${totalSamples}`);

      if (totalSamples === 0) {
        this.logger.error('No audio samples found in WAV data chunk');
        return new Float32Array(0);
      }

      for (let i = 0; i < totalSamples; i++) {
        const offset = dataOffset + i * bytesPerSample * numChannels;
        if (offset + bytesPerSample > buffer.length) break;

        let sum = 0;
        for (let ch = 0; ch < numChannels; ch++) {
          const chOffset = offset + ch * bytesPerSample;
          if (bitsPerSample === 16) {
            sum += buffer.readInt16LE(chOffset) / 32768.0;
          } else if (bitsPerSample === 32) {
            sum += buffer.readFloatLE(chOffset);
          } else {
            this.logger.warn(`Unsupported bitsPerSample: ${bitsPerSample}`);
            sum = 0;
          }
        }
        float32[i] = sum / numChannels;
      }

      this.logger.log(`WAV conversion successful: ${float32.length} float32 samples`);
      return float32;
    } catch (err: any) {
      this.logger.error(`WAV parsing failed: ${err.message}`);
      throw new Error(`Failed to parse WAV file: ${err.message}`);
    }
  }

  private rawToFloat32(buffer: Buffer): Float32Array {
    this.logger.log(`Raw buffer size: ${buffer.length} bytes`);

    const numSamples = Math.floor(buffer.length / 2);
    const float32 = new Float32Array(numSamples);

    this.logger.log(`Raw conversion: ${numSamples} int16 samples`);

    for (let i = 0; i < numSamples; i++) {
      float32[i] = buffer.readInt16LE(i * 2) / 32768.0;
    }

    return float32;
  }
}