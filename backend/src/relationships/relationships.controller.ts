import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { RelationshipsService } from './relationships.service';
import { CreateRelationshipDto, CreateGroupDto, AddContactsToGroupDto } from '../common/relationship.dto';

@Controller('relationships')
export class RelationshipsController {
  constructor(private readonly relationshipsService: RelationshipsService) {}

  @Post()
  createRelationship(@Body() dto: CreateRelationshipDto) {
    return this.relationshipsService.createRelationship(dto);
  }

  @Get('contact/:contactId')
  getRelationships(@Param('contactId') contactId: string) {
    return this.relationshipsService.getRelationships(contactId);
  }

  @Delete(':id')
  deleteRelationship(@Param('id') id: string) {
    return this.relationshipsService.deleteRelationship(id);
  }

  @Post('groups')
  createGroup(@Body() dto: CreateGroupDto) {
    return this.relationshipsService.createGroup(dto);
  }

  @Get('groups')
  getGroups() {
    return this.relationshipsService.getGroups();
  }

  @Post('groups/:groupId/contacts')
  addContactsToGroup(@Param('groupId') groupId: string, @Body('contactIds') contactIds: string[]) {
    return this.relationshipsService.addContactsToGroup(groupId, contactIds);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.relationshipsService.deleteGroup(id);
  }
}
