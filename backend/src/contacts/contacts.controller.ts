import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from '../common/create-contact.dto';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Post('merge')
  merge(@Body() body: { sourceId: string; targetId: string }) {
    return this.contactsService.merge(body.sourceId, body.targetId);
  }

  @Post(':id/merge-into')
  mergeInto(@Param('id') id: string, @Body() dto: CreateContactDto) {
    return this.contactsService.mergeInto(id, dto);
  }

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.contactsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }
}
