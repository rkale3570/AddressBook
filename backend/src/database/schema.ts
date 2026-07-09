import { pgTable, uuid, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  jobTitle: text('job_title'),
  company: text('company'),
  website: text('website'),
  address: text('address'),
  businessRelationship: text('business_relationship'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contactEmails = pgTable('contact_emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  type: text('type').default('other'),
}, (table) => ({
  contactEmailIdx: uniqueIndex('contact_email_idx').on(table.contactId, table.email),
  emailLookupIdx: index('email_lookup_idx').on(table.email),
}));

export const contactPhones = pgTable('contact_phones', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull(),
  type: text('type').default('other'),
}, (table) => ({
  contactPhoneIdx: uniqueIndex('contact_phone_idx').on(table.contactId, table.phone),
  phoneLookupIdx: index('phone_lookup_idx').on(table.phone),
}));

export const relationshipGroups = pgTable('relationship_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contactGroups = pgTable('contact_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').notNull().references(() => relationshipGroups.id, { onDelete: 'cascade' }),
});

export const relationships = pgTable('relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId1: uuid('contact_id_1').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  contactId2: uuid('contact_id_2').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
