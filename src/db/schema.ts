/**
 * src/db/schema.ts — Drizzle Postgres schema (issue #13 data-model RFC).
 *
 * These are the forward-looking tables that #10–#12 build on, defined once here so
 * features extend rather than churn the schema. Every row is scoped by `userId`
 * (plain `text`, indexed) for now; the foreign key to the Better Auth `users` table
 * is added in #9 once that table exists — this deliberately avoids an ordering
 * dependency so the DB plumbing can land before auth.
 *
 * Placement note (AC-28): this file lives under `src/db`, which is OUTSIDE the
 * deterministic-core scan dirs (`src/lib|domain|pdf`). Timestamps/ids use DB-side
 * defaults (`defaultNow()` / `defaultRandom()`), never JS `Date.now()`/`Math.random()`.
 */
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** A generated Quotation or Proforma Invoice (#10 KPI + #12 storage reuse). */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(), // 'quotation' | 'proforma'
    number: text('number'), // human doc number, e.g. ENCM-26-6879
    clientName: text('client_name'),
    // Full document input, so a PDF can be re-rendered deterministically on open
    // instead of being stored as bytes (see #12).
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('documents_user_idx').on(t.userId), index('documents_user_kind_idx').on(t.userId, t.kind)],
);

/** Append-only activity used for the landing KPI strip (#10). */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(), // 'generated' | 'exported' | 'draft_saved' | ...
    docKind: text('doc_kind'),
    documentId: uuid('document_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('events_user_idx').on(t.userId), index('events_user_type_idx').on(t.userId, t.type)],
);

/** Reusable client profiles, auto-saved + suggested on new creates (#11). */
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    data: jsonb('data').notNull(), // full client object (address, attn, contacts…)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('clients_user_idx').on(t.userId)],
);

/** Reusable sign-off blocks (#11). */
export const signoffBlocks = pgTable(
  'signoff_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    label: text('label'), // friendly name for the picker
    data: jsonb('data').notNull(), // closing / name / email / website fields
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('signoff_blocks_user_idx').on(t.userId)],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type ActivityEvent = typeof events.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type SignoffBlock = typeof signoffBlocks.$inferSelect;

/** Exported as a single object for `drizzle(client, { schema })` query builders. */
export const schema = { documents, events, clients, signoffBlocks };
