import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { VoiceSttService } from './voice-stt.service';

@Module({
  imports: [
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [VoiceController],
  providers: [VoiceService, VoiceSttService],
  exports: [VoiceService],
})
export class VoiceModule {}
