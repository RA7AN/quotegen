/**
 * src/db/schema.ts — Drizzle Postgres schema (issue #13 data-model RFC).
 *
 * These are the forward-looking tables that #10–#12 build on, defined once here so
 * features extend rather than churn the schema. Every row is scoped by `userId`
 * (indexed). #9 kept the feature tables' `userId` as plain text while they received
 * no rows; #10 slice 3 tightened `documents.userId` to a real FK once document
 * writes went live (migration 0002) — the other feature tables keep plain text
 * until they first receive rows.
 *
 * Auth table shape is dictated by Better Auth's Drizzle adapter: tables are resolved
 * by model name (singular `user`/`session`/`account`/`verification`) and columns are
 * validated by camelCase property name, so those names are load-bearing, not stylistic.
 */
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Better Auth core tables (#9). Ids/timestamps are written by Better Auth, so no
 * DB-side defaults are required; `emailVerified` still gets a safe default.
 * Defined before the feature tables because `documents.userId` references it eagerly.
 */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** A generated Quotation or Proforma Invoice (#10 KPI + #12 storage reuse). */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK enforced since #10 slice 3 — the first feature table to receive rows.
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'quotation' | 'proforma'
    number: text('number'), // human doc number, e.g. ENCM-26-6879
    clientName: text('client_name'),
    // Full document input, so a PDF can be re-rendered deterministically on open
    // instead of being stored as bytes (see #12).
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('documents_user_idx').on(t.userId),
    index('documents_user_kind_idx').on(t.userId, t.kind),
    // Business key for the export-time upsert in src/db/activities.ts (saveDocument).
    uniqueIndex('documents_user_kind_number_uq').on(t.userId, t.kind, t.number),
  ],
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

/**
 * Better Auth session/account/verification tables (#9). `user` is defined above
 * (documents.userId references it). Ids/timestamps are written by Better Auth, so
 * no DB-side defaults are required.
 */
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'), // hashed credential for email+password sign-in
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type ActivityEvent = typeof events.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type SignoffBlock = typeof signoffBlocks.$inferSelect;
export type AuthUser = typeof user.$inferSelect;
export type AuthSession = typeof session.$inferSelect;

/**
 * Aggregated for `drizzle(client, { schema })` and the Better Auth adapter, which
 * resolves models by these exact singular keys.
 */
export const schema = { user, session, account, verification, documents, events, clients, signoffBlocks };
