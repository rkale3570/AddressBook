import { Controller, Post, UploadedFile, UseInterceptors, UseFilters, Body, BadRequestException, UnprocessableEntityException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ScanService } from './scan.service';
import { MulterExceptionFilter } from './multer-exception.filter';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

@Controller('scan')
@UseFilters(MulterExceptionFilter)
export class ScanController {
  private readonly logger = new Logger(ScanController.name);

  constructor(private readonly scanService: ScanService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException(`Unsupported image type "${file.mimetype}". Please upload a JPEG, PNG, WEBP, or HEIC image.`), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async scanImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file was uploaded, or the file was rejected. Please provide a JPEG, PNG, WEBP, or HEIC image under 10MB.');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('The uploaded image is empty or corrupted. Please try again.');
    }

    this.logger.log(`Received image: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);

    try {
      return await this.scanService.processImage(file.buffer);
    } catch (err: any) {
      this.logger.error(`Scan failed for ${file.originalname}: ${err.message}`);
      throw new UnprocessableEntityException({
        error: 'extraction_failed',
        detail: 'We could not read this business card. Try a clearer, well-lit photo with the card filling the frame.',
      });
    }
  }

  @Post('text')
  async scanText(@Body('text') text: string) {
    if (!text || !text.trim()) {
      throw new BadRequestException('No text provided to parse.');
    }
    return this.scanService.parseText(text);
  }
}
