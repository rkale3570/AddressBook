import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateRelationshipDto {
  @IsString()
  contactId1!: string;

  @IsString()
  contactId2!: string;

  @IsString()
  relationshipType!: string;
}

export class CreateGroupDto {
  @IsString()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  contactIds!: string[];
}

export class AddContactsToGroupDto {
  @IsArray()
  @IsString({ each: true })
  contactIds!: string;
}
