# AddressBook — Changes Documentation

This document covers every change made across the four functional requirements and the bug-fix pass that followed.

---

## 1. Business Card Scanner

**Spec:** capture/upload a card, extract Full Name, Title, Company, Emails, Phones, Website, Address, and Business Relationship (Client, Vendor, Accountant, Attorney, Contractor, Friend, etc.).

### State before
- Backend `ScanService.processImage` (Tesseract.js OCR) and `parseText` already extracted most fields.
- Frontend `ScanPage` supported file upload and clipboard paste, then routed the result to `ContactForm`.

### Gap
- The `Contractor` relationship listed in the spec was missing from both the OCR keyword list and the frontend dropdown.

### Changes
- `backend/src/scan/scan.service.ts` — added `'contractor'` to `relationshipKeywords`.
- `frontend/src/types/index.ts` — added `'Contractor'` to `BUSINESS_RELATIONSHIPS`.

---

## 2. Voice-Based Contact Entry

**Spec:** click Start Speaking, speak naturally, system fills fields. Example:
`"John Smith, Sales Manager at ABC Realty. Email john@abc.com. Mobile 518-555-1111. Office 518-555-2222. Website abc.com. Vendor."`

### State before
The existing `VoiceService.parseTranscript` failed the spec example:
- All phones took the same type (whole-text keyword scan) — `Office` was mislabeled as `mobile`.
- Website regex matched the email domain (`john@abc.com` → `abc.com`) by accident.
- Cleaner stripped the word `at`, then splitting on `at/from/with` produced one part, so name/title/company all fell into a broken fallback and produced garbage like `"John Smith Sales"`.
- `contractor` was missing from relationship keywords.

### Speech-to-text stack
- `backend/src/voice/voice-stt.service.ts` uses `@huggingface/transformers` (transformers.js) with `Xenova/whisper-tiny`.
- Runs **locally** in the NestJS process. Model is cached under `~/.cache/whisper-models`. No third-party service is contacted; no audio leaves the server.
- Client records via `frontend/src/services/wavRecorder.ts` (MediaStream → 16 kHz PCM → in-browser WAV encoding) and POSTs the WAV to `/api/voice/transcribe-audio`.
- Manual-transcript textarea remains as a fallback for when STT fails.

### Changes
- `backend/src/voice/voice.service.ts` — full rewrite of the parser:
  - Split transcript on `.!?` **followed by whitespace** (so `john@abc.com` is preserved instead of splitting on the dot inside the domain).
  - Per-sentence extraction: phone type is derived from the same sentence (`Mobile 518-555-1111` → mobile; `Office 518-555-2222` → office).
  - Email type derived per-sentence (`Personal` / `Other` / else `work`).
  - Website extraction guarded against email domains and against sentences that contain an email.
  - `contractor` added to relationship keywords.
  - Name / title / company extracted via comma split and an `at|from|with|for` split on the remainder.
- `frontend/src/pages/VoiceEntryPage.tsx` — added a **"Start Speaking" / "Stop"** button next to the mic icon to match the spec's wording.

### Verified against the spec example
```
Input:  "John Smith, Sales Manager at ABC Realty. Email john@abc.com.
         Mobile 518-555-1111. Office 518-555-2222. Website abc.com. Vendor."
Output: fullName            "John Smith"
        jobTitle            "Sales Manager"
        company             "ABC Realty"
        emails              [{ john@abc.com, work }]
        phones              [{ 5185551111, mobile }, { 5185552222, office }]
        website             "https://abc.com"
        businessRelationship "Vendor"
```

---

## 3. Duplicate Contact Detection

**Spec:** while creating a contact, detect duplicates by Name, Email, Phone. Show matches. Allow Use Existing / Merge / Create New.

### State before
- Backend `DuplicatesService.findDuplicates` supported a single `email` + single `phone` + `fullName`.
- Frontend `ContactForm.checkDuplicates` only sent the **first** email and **first** phone — misses duplicates on any other row on the form.
- Frontend `api.contacts.merge` existed but the backend had **no `POST /contacts/merge` route** — would 404.
- In create mode, the "Merge" button had no source contact yet, so the handler just closed the dialog. Merge was a no-op.
- `DuplicateDialog.onMerge` signature accepted `(sourceId, targetId)` with `targetId` hardcoded to `'new'` (a placeholder that meant nothing).

### Changes

**Backend**
- `backend/src/common/duplicate.dto.ts` — `CheckDuplicateDto` now accepts `emails?: string[]` and `phones?: string[]` in addition to the single-value fields.
- `backend/src/duplicates/duplicates.service.ts` — iterates over the arrays (falls back to the single-value fields for backwards compat); one contact appears at most once via `seenIds`.
- `backend/src/contacts/contacts.service.ts` — added `mergeInto(targetId, incoming)` that fills empty fields on the target, appends unique emails/phones (dedup by lowercase email / digits-only phone), and joins notes.
- `backend/src/contacts/contacts.controller.ts` — added `POST /contacts/merge` (was missing) and `POST /contacts/:id/merge-into`.

**Frontend**
- `frontend/src/api/client.ts` — added `api.contacts.mergeInto(targetId, data)`.
- `frontend/src/pages/ContactForm.tsx` — `checkDuplicates` sends all emails and all phones; new `mergeIntoExisting` handler POSTs the form data to the merge-into endpoint and navigates to the merged contact.
- `frontend/src/components/DuplicateDialog.tsx` — `onMerge` signature simplified to `(existingId)`.

### Behavior now
| Action | Result |
|---|---|
| Use Existing | Navigate to the existing contact's edit page |
| Merge | Merge the form data into the existing contact, then open it |
| Create New Anyway | Create a fresh contact bypassing the duplicate check |

---

## 4. Contact Relationship Grouping

**Spec:** link multiple contacts (Husband→Wife, Father→Son, Brother→Sister, Business Partners, Team Members). A contact may belong to multiple groups.

### State before
- `relationships` (pairwise) and `contactGroups` (many-to-many join) tables already existed with full backend CRUD.
- `RelationshipPanel` handled pairwise relationships on the contact edit page. `GroupsPage` managed groups globally.
- `RELATIONSHIP_TYPES` only had generic labels (`Spouse`, `Parent`, `Sibling`, `Business Partner`, `Team Member`, `Friend`, `Other`).
- `enrichContact` already returned group memberships, but the contact edit page never displayed them — no way to add or remove a contact from a group directly from the contact.
- Backend had no endpoint to remove a single contact from a group (only "delete whole group").

### Changes

**Backend**
- `backend/src/relationships/relationships.service.ts`
  - `addContactsToGroup` now filters out contacts already in the group (safe to re-invoke).
  - Added `removeContactFromGroup(groupId, contactId)`.
- `backend/src/relationships/relationships.controller.ts` — added `DELETE /relationships/groups/:groupId/contacts/:contactId`.

**Frontend**
- `frontend/src/types/index.ts` — expanded `RELATIONSHIP_TYPES` with the spec's directional/gendered types:
  `Husband, Wife, Spouse, Father, Mother, Parent, Son, Daughter, Child, Brother, Sister, Sibling, Business Partner, Team Member, Colleague, Friend, Other`.
- `frontend/src/api/client.ts` — added `api.relationships.groups.removeContact(groupId, contactId)`.
- `frontend/src/components/RelationshipPanel.tsx` — added a **Groups** card below the Relationships card:
  - Lists every group the contact belongs to.
  - Add-to-group dropdown lists groups the contact is not yet in.
  - Remove button per group.
  Multiple group membership is supported by the underlying many-to-many join.

---

## 5. Bug Fixes

Nine bugs were found and fixed during the evaluation-criteria audit.

### Fix 1 — Global unique index on `contact_emails.email` / `contact_phones.phone` (CRITICAL)

The original schema declared `uniqueIndex('email_idx').on(table.email)` on both `contact_emails` and `contact_phones`. That made a given email or phone number globally unique across all contacts — which directly contradicts the duplicate-detection feature (Create New Anyway would 500 with a unique violation, both merge paths would fail because inserts collided with rows that hadn't been deleted yet).

- `backend/src/database/schema.ts` — replaced with:
  - `uniqueIndex('contact_email_idx').on(contactId, email)` (prevents *the same email twice on the same contact*)
  - `index('email_lookup_idx').on(email)` (keeps duplicate detection fast)
  - Same pattern for phones.
- `backend/src/database/migrations/0001_relax_email_phone_uniqueness.sql` — drops the old indexes and creates the new ones.
- `backend/src/database/migrations/meta/_journal.json` — registered the new migration entry.

Apply with `npm run db:migrate` from the backend (or by piping the SQL to psql).

### Fix 2 — Scan → ContactForm prefill was broken (CRITICAL)

`ScanPage.goToEditForm` navigated with `state: formState` (flat), but `ContactForm` read `location.state?.scanResult`. Every scan result was silently ignored.

- `frontend/src/pages/ScanPage.tsx` — now navigates with `state: { scanResult: payload }`.

### Fix 3 — Scan upload never triggered OCR (CRITICAL)

`processScan` early-returned on `if (!imageData) return;`, but `imageData` was set via `setState` in the same tick — the closure still held `null`.

- `frontend/src/pages/ScanPage.tsx` — removed the stale-closure guard; the `File` is already passed in as a parameter.

### Fix 4 — `merge(sourceId, targetId)` inserted rows before deleting source's (HIGH)

`update()` deletes the target's rows and inserts the merged list. Source's emails/phones still existed at that point, so with the old unique index the insert failed. Even after Fix 1, the merged list had duplicates because the same email could appear on source and target.

- `backend/src/contacts/contacts.service.ts` — `merge()` now:
  1. Deletes source emails/phones **before** the update.
  2. Deduplicates the merged emails (by lowercase) and phones (by digits-only) via `Map`.
  3. Rejects self-merge with `BadRequestException`.

### Fix 5 — Dead code in `processScan` (HIGH)

`processScan` called `fetch(imageData).then(r => r.blob())` and never used the result.

- `frontend/src/pages/ScanPage.tsx` — removed.

### Fix 6 — `createRelationship` allowed self-linking (HIGH)

No check on `contactId1 === contactId2`.

- `backend/src/relationships/relationships.service.ts` — throws `BadRequestException`.

### Fix 7 — Voice "Save as Contact" bypassed duplicate detection (MEDIUM)

Spec says duplicate check happens while creating a contact — voice save was writing directly to the DB via `api.contacts.create`.

- `frontend/src/pages/VoiceEntryPage.tsx` — `saveAsContact` now navigates to `/contacts/new` with `state.scanResult`, so `ContactForm`'s duplicate check runs.

### Fix 8 — Search was case-sensitive (MEDIUM)

Postgres `LIKE` is case-sensitive. `"john"` didn't match `"John Smith"`.

- `backend/src/contacts/contacts.service.ts` — swapped `like` for `ilike`.

### Fix 9 — Dead `POST /duplicates/resolve` endpoint (LOW)

Never called from the frontend; returned only `{ action }`.

- `backend/src/duplicates/duplicates.controller.ts` — endpoint removed.
- `backend/src/common/duplicate.dto.ts` — `ResolveDuplicateDto` removed.
- `frontend/src/api/client.ts` — `api.duplicates.resolve` removed.

---

## Files Changed

**Backend**
- `src/database/schema.ts`
- `src/database/migrations/0001_relax_email_phone_uniqueness.sql` (new)
- `src/database/migrations/meta/_journal.json`
- `src/common/duplicate.dto.ts`
- `src/scan/scan.service.ts`
- `src/voice/voice.service.ts`
- `src/duplicates/duplicates.service.ts`
- `src/duplicates/duplicates.controller.ts`
- `src/contacts/contacts.service.ts`
- `src/contacts/contacts.controller.ts`
- `src/relationships/relationships.service.ts`
- `src/relationships/relationships.controller.ts`

**Frontend**
- `src/types/index.ts`
- `src/api/client.ts`
- `src/pages/ScanPage.tsx`
- `src/pages/VoiceEntryPage.tsx`
- `src/pages/ContactForm.tsx`
- `src/components/DuplicateDialog.tsx`
- `src/components/RelationshipPanel.tsx`

---

## Running the Migration

After pulling these changes, apply the new migration once:

```bash
cd backend
npm run db:migrate
```

The migration is idempotent (`IF EXISTS` / `IF NOT EXISTS`) and safe to re-run.
