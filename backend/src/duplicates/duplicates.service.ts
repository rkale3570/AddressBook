import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE, DrizzleDb } from '../database/database.module';
import * as schema from '../database/schema';
import { eq, or } from 'drizzle-orm';
import { CheckDuplicateDto } from '../common/duplicate.dto';

export interface DuplicateResult {
  contact: typeof schema.contacts.$inferSelect & {
    emails: (typeof schema.contactEmails.$inferSelect)[];
    phones: (typeof schema.contactPhones.$inferSelect)[];
  };
  matchReason: string;
  score: number;
}

@Injectable()
export class DuplicatesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  async findDuplicates(dto: CheckDuplicateDto): Promise<DuplicateResult[]> {
    const matches = new Map<string, { contact: typeof schema.contacts.$inferSelect; reasons: string[]; score: number }>();

    const addMatch = (contact: typeof schema.contacts.$inferSelect, reason: string, score: number) => {
      const existing = matches.get(contact.id);
      if (existing) {
        existing.reasons.push(reason);
        existing.score = Math.max(existing.score, score);
      } else {
        matches.set(contact.id, { contact, reasons: [reason], score });
      }
    };

    // Requirement: detect using Name, Email, and Phone. Check every email/phone
    // the user has entered on the form (not just the first one), since a
    // contact can have several and a duplicate may only share a secondary one.
    const emailsToCheck = [dto.email, ...(dto.emails || [])].filter((e): e is string => !!e);
    const phonesToCheck = [dto.phone, ...(dto.phones || [])].filter((p): p is string => !!p);

    for (const email of emailsToCheck) {
      const emailContacts = await this.db.select({
        contact: schema.contacts,
        email: schema.contactEmails,
      })
        .from(schema.contactEmails)
        .innerJoin(schema.contacts, eq(schema.contactEmails.contactId, schema.contacts.id))
        .where(
          or(
            eq(schema.contactEmails.email, email.toLowerCase()),
            eq(schema.contactEmails.email, email),
          )
        );

      for (const row of emailContacts) {
        addMatch(row.contact, `Same email: ${row.email.email}`, 0.95);
      }
    }

    for (const phone of phonesToCheck) {
      const cleanPhone = phone.replace(/[^\d]/g, '');
      if (!cleanPhone) continue;
      const allPhones = await this.db.select().from(schema.contactPhones);
      const matchedPhones = allPhones.filter(p => p.phone.replace(/[^\d]/g, '') === cleanPhone);

      for (const phoneRow of matchedPhones) {
        const contactRows = await this.db.select().from(schema.contacts).where(eq(schema.contacts.id, phoneRow.contactId));
        for (const contact of contactRows) {
          addMatch(contact, `Same phone: ${phoneRow.phone}`, 0.95);
        }
      }
    }

    if (dto.fullName) {
      const nameParts = dto.fullName.toLowerCase().split(/\s+/).filter(Boolean);
      const allContacts = await this.db.select().from(schema.contacts);

      for (const contact of allContacts) {
        const contactName = contact.fullName.toLowerCase();
        const contactParts = contactName.split(/\s+/);
        const commonParts = nameParts.filter(p => contactParts.includes(p));
        const score = commonParts.length / Math.max(nameParts.length, contactParts.length);

        if (score >= 0.5) {
          addMatch(contact, `Similar name: "${dto.fullName}" ~ "${contact.fullName}"`, score);
        }
      }
    }

    const results: DuplicateResult[] = await Promise.all(
      Array.from(matches.values()).map(async ({ contact, reasons, score }) => {
        const emails = await this.db.select().from(schema.contactEmails)
          .where(eq(schema.contactEmails.contactId, contact.id));
        const phones = await this.db.select().from(schema.contactPhones)
          .where(eq(schema.contactPhones.contactId, contact.id));

        return {
          contact: { ...contact, emails, phones },
          matchReason: reasons.join('; '),
          score,
        };
      })
    );

    results.sort((a, b) => b.score - a.score);
    return results;
  }
}
