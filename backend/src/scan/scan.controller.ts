import { Controller, Post, UploadedFile, UseInterceptors, Body, BadRequestException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ScanService } from './scan.service';

@Controller('scan')
export class ScanController {
  private readonly logger = new Logger(ScanController.name);

  constructor(private readonly scanService: ScanService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('image'))
  async scanImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file uploaded');
    }
    this.logger.log(`Received image: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
    return this.scanService.processImage(file.buffer);
  }

  @Post('text')
  async scanText(@Body('text') text: string) {
    return this.scanService.parseText(text || '');
  }
}
