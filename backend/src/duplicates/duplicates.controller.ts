import { Controller, Post, Body } from '@nestjs/common';
import { DuplicatesService } from './duplicates.service';
import { CheckDuplicateDto, ResolveDuplicateDto } from '../common/duplicate.dto';

@Controller('duplicates')
export class DuplicatesController {
  constructor(
    private readonly duplicatesService: DuplicatesService,
  ) {}

  @Post('check')
  check(@Body() dto: CheckDuplicateDto) {
    return this.duplicatesService.findDuplicates(dto);
  }

  @Post('resolve')
  async resolve(@Body() dto: ResolveDuplicateDto) {
    return { action: dto.action };
  }
}
