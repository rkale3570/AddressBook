export interface Email {
  id?: string;
  email: string;
  type?: string;
}

export interface Phone {
  id?: string;
  phone: string;
  type?: string;
}

export interface Contact {
  id: string;
  fullName: string;
  jobTitle?: string | null;
  company?: string | null;
  website?: string | null;
  address?: string | null;
  businessRelationship?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  emails?: Email[];
  phones?: Phone[];
  groups?: { groupId: string; groupName: string }[];
  relationships?: Relationship[];
}

export interface Relationship {
  id: string;
  contactId1: string;
  contactId2: string;
  relationshipType: string;
  createdAt: string;
  relatedContact?: Contact | null;
}

export interface RelationshipGroup {
  id: string;
  name: string;
  createdAt: string;
  contactIds: string[];
}

export interface DuplicateResult {
  contact: Contact;
  matchReason: string;
  score: number;
}

export const BUSINESS_RELATIONSHIPS = [
  'Client',
  'Vendor',
  'Accountant',
  'Attorney',
  'Contractor',
  'Employee',
  'Supplier',
  'Customer',
  'Mortgage Broker',
  'Inspector',
  'Friend',
  'Other',
] as const;

export const PHONE_TYPES = ['mobile', 'office', 'home', 'other'] as const;
export const EMAIL_TYPES = ['personal', 'work', 'other'] as const;
export const RELATIONSHIP_TYPES = [
  'Husband',
  'Wife',
  'Spouse',
  'Father',
  'Mother',
  'Parent',
  'Son',
  'Daughter',
  'Child',
  'Brother',
  'Sister',
  'Sibling',
  'Business Partner',
  'Team Member',
  'Friend',
  'Other',
] as const;
