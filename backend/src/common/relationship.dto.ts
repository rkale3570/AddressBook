import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { RelationshipType } from './enum/relationship-type.enum'; // adjust the path

export class CreateRelationshipDto {
  @IsString()
  contactId1!: string;

  @IsString()
  contactId2!: string;

  @IsEnum(RelationshipType)
  relationshipType!: RelationshipType;
}

export class CreateGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactIds?: string[];
}

export class AddContactsToGroupDto {
  @IsArray()
  @IsString({ each: true })
  contactIds!: string[];
}