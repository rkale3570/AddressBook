import { Controller, Post, Body, UploadedFile, UseInterceptors, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VoiceService } from './voice.service';
import { VoiceSttService } from './voice-stt.service';

@Controller('voice')
export class VoiceController {
  private readonly logger = new Logger(VoiceController.name);

  constructor(
    private readonly voiceService: VoiceService,
    private readonly sttService: VoiceSttService,
  ) {}

  @Post('transcribe')
  transcribe(@Body('transcript') transcript: string) {
    return this.voiceService.parseTranscript(transcript || '');
  }

  @Post('transcribe-audio')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: 'No audio file provided' };
    }

    this.logger.log(`Audio received: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);

    try {
      const transcript = await this.sttService.transcribeAudio(file.buffer, file.mimetype);
      this.logger.log(`Transcript: ${transcript}`);
      return this.voiceService.parseTranscript(transcript);
    } catch (err: any) {
      this.logger.error(`STT failed: ${err.message}`);
      return { error: 'Transcription failed', detail: err.message };
    }
  }
}
