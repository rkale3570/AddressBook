DROP INDEX IF EXISTS "email_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "phone_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_email_idx" ON "contact_emails" ("contact_id", "email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_lookup_idx" ON "contact_emails" ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_phone_idx" ON "contact_phones" ("contact_id", "phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_lookup_idx" ON "contact_phones" ("phone");
