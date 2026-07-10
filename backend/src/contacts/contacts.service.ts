import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE, DrizzleDb } from '../database/database.module';
import * as schema from '../database/schema';
import { eq, or, like } from 'drizzle-orm';
import { CreateContactDto, UpdateContactDto } from '../common/create-contact.dto';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ContactsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  async create(dto: CreateContactDto) {
    const contactId = uuid();
    await this.db.insert(schema.contacts).values({
      id: contactId,
      fullName: dto.fullName,
      jobTitle: dto.jobTitle || null,
      company: dto.company || null,
      website: dto.website || null,
      address: dto.address || null,
      businessRelationship: dto.businessRelationship || null,
      notes: dto.notes || null,
    });

    if (dto.emails?.length) {
      await this.db.insert(schema.contactEmails).values(
        dto.emails.map(e => ({ id: uuid(), contactId, email: e.email, type: e.type || 'other' }))
      );
    }

    if (dto.phones?.length) {
      await this.db.insert(schema.contactPhones).values(
        dto.phones.map(p => ({ id: uuid(), contactId, phone: p.phone, type: p.type || 'other' }))
      );
    }

    return this.findOne(contactId);
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;

    let contactsList: (typeof schema.contacts.$inferSelect)[];
    if (search) {
      const pattern = `%${search}%`;
      contactsList = await this.db.select().from(schema.contacts)
        .where(
          or(
            like(schema.contacts.fullName, pattern),
            like(schema.contacts.company, pattern),
            like(schema.contacts.jobTitle, pattern),
          )
        )
        .limit(limit).offset(offset);
    } else {
      contactsList = await this.db.select().from(schema.contacts)
        .limit(limit).offset(offset);
    }

    const enriched = await Promise.all(
      contactsList.map(c => this.enrichContact(c))
    );

    return { data: enriched, page, limit };
  }

  async findOne(id: string) {
    const rows = await this.db.select().from(schema.contacts).where(eq(schema.contacts.id, id));
    if (!rows.length) throw new NotFoundException('Contact not found');
    return this.enrichContact(rows[0]);
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.findOne(id);

    const updates: Record<string, any> = {};
    if (dto.fullName !== undefined) updates.fullName = dto.fullName;
    if (dto.jobTitle !== undefined) updates.jobTitle = dto.jobTitle || null;
    if (dto.company !== undefined) updates.company = dto.company || null;
    if (dto.website !== undefined) updates.website = dto.website || null;
    if (dto.address !== undefined) updates.address = dto.address || null;
    if (dto.businessRelationship !== undefined) updates.businessRelationship = dto.businessRelationship || null;
    if (dto.notes !== undefined) updates.notes = dto.notes || null;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length > 0) {
      await this.db.update(schema.contacts).set(updates).where(eq(schema.contacts.id, id));
    }

    if (dto.emails !== undefined) {
      await this.db.delete(schema.contactEmails).where(eq(schema.contactEmails.contactId, id));
      if (dto.emails.length) {
        await this.db.insert(schema.contactEmails).values(
          dto.emails.map(e => ({ id: uuid(), contactId: id, email: e.email, type: e.type || 'other' }))
        );
      }
    }

    if (dto.phones !== undefined) {
      await this.db.delete(schema.contactPhones).where(eq(schema.contactPhones.contactId, id));
      if (dto.phones.length) {
        await this.db.insert(schema.contactPhones).values(
          dto.phones.map(p => ({ id: uuid(), contactId: id, phone: p.phone, type: p.type || 'other' }))
        );
      }
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.delete(schema.contacts).where(eq(schema.contacts.id, id));
    return { deleted: true };
  }

  async merge(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return this.findOne(targetId);
    }

    const source = await this.findOne(sourceId);
    const target = await this.findOne(targetId);

    // Delete the source's email/phone rows FIRST. Both columns have a
    // table-wide unique index, so if we inserted the merged list into the
    // target before removing the source's own (still-present) rows, any
    // shared email/phone would collide and the insert would fail.
    await this.db.delete(schema.contactEmails).where(eq(schema.contactEmails.contactId, sourceId));
    await this.db.delete(schema.contactPhones).where(eq(schema.contactPhones.contactId, sourceId));

    const dedupeBy = <T extends Record<string, any>>(items: T[], key: string, normalize: (v: string) => string = v => v.toLowerCase()) => {
      const seen = new Set<string>();
      return items.filter(item => {
        const k = normalize(String(item[key]));
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };

    const mergedEmails = dedupeBy(
      [...((target as any).emails || []), ...((source as any).emails || [])],
      'email',
    );
    const mergedPhones = dedupeBy(
      [...((target as any).phones || []), ...((source as any).phones || [])],
      'phone',
      v => v.replace(/[^\d]/g, ''),
    );

    const merged: UpdateContactDto = {
      fullName: (target as any).fullName || (source as any).fullName,
      jobTitle: (target as any).jobTitle || (source as any).jobTitle,
      company: (target as any).company || (source as any).company,
      website: (target as any).website || (source as any).website,
      address: (target as any).address || (source as any).address,
      businessRelationship: (target as any).businessRelationship || (source as any).businessRelationship,
      notes: [(target as any).notes, (source as any).notes].filter(Boolean).join('\n---\n') || undefined,
      emails: mergedEmails,
      phones: mergedPhones,
    };

    const updated = await this.update(targetId, merged);

    await this.db.delete(schema.contacts).where(eq(schema.contacts.id, sourceId));

    return updated;
  }

  private async enrichContact(contact: typeof schema.contacts.$inferSelect) {
    const emails = await this.db.select().from(schema.contactEmails)
      .where(eq(schema.contactEmails.contactId, contact.id));
    const phones = await this.db.select().from(schema.contactPhones)
      .where(eq(schema.contactPhones.contactId, contact.id));

    const groups = await this.db.select({
      groupId: schema.contactGroups.groupId,
      groupName: schema.relationshipGroups.name,
    })
      .from(schema.contactGroups)
      .innerJoin(schema.relationshipGroups, eq(schema.contactGroups.groupId, schema.relationshipGroups.id))
      .where(eq(schema.contactGroups.contactId, contact.id));

    const rels = await this.db.select().from(schema.relationships)
      .where(
        or(
          eq(schema.relationships.contactId1, contact.id),
          eq(schema.relationships.contactId2, contact.id),
        )
      );

    return {
      ...contact,
      emails,
      phones,
      groups,
      relationships: rels,
    };
  }
}
