export class ScanResultDto {
  fullName?: string;
  jobTitle?: string;
  company?: string;
  emails?: { email: string; type?: string }[];
  phones?: { phone: string; type?: string }[];
  website?: string;
  address?: string;
  businessRelationship?: string;
}

export class VoiceEntryDto {
  transcript!: string;
}
