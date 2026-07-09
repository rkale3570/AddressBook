import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE, DrizzleDb } from '../database/database.module';
import * as schema from '../database/schema';
import { eq } from 'drizzle-orm';
import { CheckDuplicateDto } from '../common/duplicate.dto';

export interface DuplicateResult {
  contact: typeof schema.contacts.$inferSelect;
  matchReason: string;
  score: number;
}

@Injectable()
export class DuplicatesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  async findDuplicates(dto: CheckDuplicateDto): Promise<DuplicateResult[]> {
    const results: DuplicateResult[] = [];
    const seenIds = new Set<string>();

    const emailsToCheck = Array.from(new Set(
      [...(dto.emails || []), dto.email]
        .filter((e): e is string => !!e)
        .map(e => e.toLowerCase())
    ));

    if (emailsToCheck.length) {
      const emailContacts = await this.db.select({
        contact: schema.contacts,
        email: schema.contactEmails,
      })
        .from(schema.contactEmails)
        .innerJoin(schema.contacts, eq(schema.contactEmails.contactId, schema.contacts.id));

      for (const row of emailContacts) {
        if (seenIds.has(row.contact.id)) continue;
        if (!emailsToCheck.includes(row.email.email.toLowerCase())) continue;
        seenIds.add(row.contact.id);
        results.push({
          contact: row.contact,
          matchReason: `Same email: ${row.email.email}`,
          score: 0.95,
        });
      }
    }

    const phonesToCheck = Array.from(new Set(
      [...(dto.phones || []), dto.phone]
        .filter((p): p is string => !!p)
        .map(p => p.replace(/[^\d]/g, ''))
        .filter(Boolean)
    ));

    if (phonesToCheck.length) {
      const allPhones = await this.db.select().from(schema.contactPhones);
      for (const phoneRow of allPhones) {
        const digits = phoneRow.phone.replace(/[^\d]/g, '');
        if (!phonesToCheck.includes(digits)) continue;
        if (seenIds.has(phoneRow.contactId)) continue;
        const contactRows = await this.db.select().from(schema.contacts).where(eq(schema.contacts.id, phoneRow.contactId));
        for (const contact of contactRows) {
          if (seenIds.has(contact.id)) continue;
          seenIds.add(contact.id);
          results.push({
            contact,
            matchReason: `Same phone: ${phoneRow.phone}`,
            score: 0.95,
          });
        }
      }
    }

    if (dto.fullName) {
      const nameParts = dto.fullName.toLowerCase().split(/\s+/).filter(Boolean);
      const allContacts = await this.db.select().from(schema.contacts);

      for (const contact of allContacts) {
        if (seenIds.has(contact.id)) continue;

        const contactName = contact.fullName.toLowerCase();
        const contactParts = contactName.split(/\s+/);
        const commonParts = nameParts.filter(p => contactParts.includes(p));
        const score = commonParts.length / Math.max(nameParts.length, contactParts.length);

        if (score >= 0.5) {
          seenIds.add(contact.id);
          results.push({
            contact,
            matchReason: `Similar name: "${dto.fullName}" ~ "${contact.fullName}"`,
            score,
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }
}
