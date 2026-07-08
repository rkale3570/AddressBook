import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE, DrizzleDb } from '../database/database.module';
import * as schema from '../database/schema';
import { eq, and, or } from 'drizzle-orm';
import { CreateRelationshipDto, CreateGroupDto } from '../common/relationship.dto';
import { v4 as uuid } from 'uuid';

@Injectable()
export class RelationshipsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  async createRelationship(dto: CreateRelationshipDto) {
    const existing = await this.db.select().from(schema.relationships)
      .where(
        or(
          and(eq(schema.relationships.contactId1, dto.contactId1), eq(schema.relationships.contactId2, dto.contactId2)),
          and(eq(schema.relationships.contactId1, dto.contactId2), eq(schema.relationships.contactId2, dto.contactId1)),
        )
      );

    if (existing.length) {
      return existing[0];
    }

    const rel = { id: uuid(), ...dto };
    await this.db.insert(schema.relationships).values(rel as any);
    return rel;
  }

  async getRelationships(contactId: string) {
    const rels = await this.db.select()
      .from(schema.relationships)
      .where(
        or(eq(schema.relationships.contactId1, contactId), eq(schema.relationships.contactId2, contactId))
      );

    const enriched = await Promise.all(
      rels.map(async (rel: typeof schema.relationships.$inferSelect) => {
        const otherId = rel.contactId1 === contactId ? rel.contactId2 : rel.contactId1;
        const otherContact = await this.db.select().from(schema.contacts).where(eq(schema.contacts.id, otherId));
        return {
          ...rel,
          relatedContact: otherContact[0] || null,
        };
      })
    );

    return enriched;
  }

  async deleteRelationship(id: string) {
    await this.db.delete(schema.relationships).where(eq(schema.relationships.id, id));
    return { deleted: true };
  }

  async createGroup(dto: CreateGroupDto) {
    const groupId = uuid();
    await this.db.insert(schema.relationshipGroups).values({ id: groupId, name: dto.name });

    if (dto.contactIds?.length) {
      await this.db.insert(schema.contactGroups).values(
        dto.contactIds.map(contactId => ({ id: uuid(), contactId, groupId }))
      );
    }

    return { id: groupId, name: dto.name, contactIds: dto.contactIds };
  }

  async getGroups() {
    const groups = await this.db.select().from(schema.relationshipGroups);

    const enriched = await Promise.all(
      groups.map(async (g: typeof schema.relationshipGroups.$inferSelect) => {
        const cgs = await this.db.select({
          contactId: schema.contactGroups.contactId,
        })
          .from(schema.contactGroups)
          .where(eq(schema.contactGroups.groupId, g.id));

        return {
          ...g,
          contactIds: cgs.map((c: { contactId: string }) => c.contactId),
        };
      })
    );

    return enriched;
  }

  async addContactsToGroup(groupId: string, contactIds: string[]) {
    const group = await this.db.select().from(schema.relationshipGroups).where(eq(schema.relationshipGroups.id, groupId));
    if (!group.length) throw new NotFoundException('Group not found');

    await this.db.insert(schema.contactGroups).values(
      contactIds.map(contactId => ({ id: uuid(), contactId, groupId }))
    );

    return this.getGroups();
  }

  async deleteGroup(id: string) {
    await this.db.delete(schema.relationshipGroups).where(eq(schema.relationshipGroups.id, id));
    return { deleted: true };
  }
}
