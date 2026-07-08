import { IsOptional, IsString } from 'class-validator';

export class CheckDuplicateDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class MergeContactsDto {
  @IsString()
  sourceId!: string;

  @IsString()
  targetId!: string;
}

export class ResolveDuplicateDto {
  @IsString()
  action!: 'use_existing' | 'merge' | 'create_new';

  @IsOptional()
  @IsString()
  existingContactId?: string;
}
