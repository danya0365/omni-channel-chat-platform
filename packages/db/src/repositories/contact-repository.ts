import { and, eq } from 'drizzle-orm';
import { contactIdentitySchema, contactSchema } from '@omni/domain';
import type { ContactRepository } from '@omni/domain';
import type { Executor } from '../client';
import { contactIdentities, contacts } from '../schema';

/**
 * ContactRepository (Postgres) — resolve/สร้าง contact ตาม key ช่องทาง
 * DB→domain map ผ่าน zod parse (validate + brand id ที่ boundary) · scope workspaceId ทุก query
 */
export function createContactRepository(db: Executor): ContactRepository {
  return {
    findByChannelIdentity: async (workspaceId, channelId, externalId) => {
      const rows = await db
        .select()
        .from(contactIdentities)
        .innerJoin(contacts, eq(contactIdentities.contactId, contacts.id))
        .where(
          and(
            eq(contactIdentities.workspaceId, workspaceId),
            eq(contactIdentities.channelId, channelId),
            eq(contactIdentities.externalId, externalId),
          ),
        )
        .limit(1);

      const row = rows[0];
      if (!row) return null;
      return {
        contact: contactSchema.parse(row.contacts),
        identity: contactIdentitySchema.parse(row.contact_identities),
      };
    },

    insertContactWithIdentity: async (_workspaceId, contact, identity) => {
      // atomic: contact + identity แรก ต้องเกิดพร้อมกัน (กัน orphan identity)
      await db.transaction(async (tx) => {
        await tx.insert(contacts).values(contact);
        await tx.insert(contactIdentities).values(identity);
      });
    },

    updateDisplayName: async (workspaceId, contactId, displayName) => {
      await db
        .update(contacts)
        .set({ displayName })
        .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.id, contactId)));
    },
  };
}
