import { describe, expect, it } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { account, clients, documents, events, schema, session, signoffBlocks, user, verification } from './schema';

function colsOf(table: Parameters<typeof getTableColumns>[0]): string[] {
  return Object.keys(getTableColumns(table)).sort();
}

const allTables = [documents, events, clients, signoffBlocks];

describe('db schema — table identity', () => {
  it('maps each export to its snake_case Postgres table', () => {
    expect(getTableName(documents)).toBe('documents');
    expect(getTableName(events)).toBe('events');
    expect(getTableName(clients)).toBe('clients');
    expect(getTableName(signoffBlocks)).toBe('signoff_blocks');
  });

  it('scopes every table by userId (rows are always owner-filtered)', () => {
    for (const t of allTables) {
      expect(colsOf(t)).toContain('userId');
    }
  });

  it('gives every table an id + createdAt (append/audit friendly)', () => {
    for (const t of allTables) {
      const c = colsOf(t);
      expect(c).toContain('id');
      expect(c).toContain('createdAt');
    }
  });
});

describe('db schema — column shape', () => {
  it('documents carries the deterministic re-render payload + doc metadata', () => {
    expect(colsOf(documents)).toEqual([
      'clientName', 'createdAt', 'id', 'kind', 'number', 'payload', 'updatedAt', 'userId',
    ]);
  });

  it('events is the append-only KPI feed', () => {
    expect(colsOf(events)).toEqual(['createdAt', 'docKind', 'documentId', 'id', 'type', 'userId']);
  });

  it('clients / signoffBlocks store a jsonb blob + name/label', () => {
    // clients gains custId (#11 slice 1) — the (userId, name, custId) dedupe business key.
    expect(colsOf(clients)).toEqual(['createdAt', 'custId', 'data', 'id', 'name', 'updatedAt', 'userId']);
    expect(colsOf(signoffBlocks)).toEqual(['createdAt', 'data', 'id', 'label', 'updatedAt', 'userId']);
  });

  it('aggregates the tables for drizzle(client, { schema })', () => {
    expect(schema).toMatchObject({ documents, events, clients, signoffBlocks });
  });
});

describe('db schema — Better Auth tables (#9)', () => {
  it('maps to the singular model names the Drizzle adapter resolves by', () => {
    expect(getTableName(user)).toBe('user');
    expect(getTableName(session)).toBe('session');
    expect(getTableName(account)).toBe('account');
    expect(getTableName(verification)).toBe('verification');
  });

  it('exposes the exact camelCase fields Better Auth validates by property name', () => {
    expect(colsOf(user)).toEqual(['createdAt', 'email', 'emailVerified', 'id', 'image', 'name', 'updatedAt']);
    expect(colsOf(session)).toEqual([
      'createdAt', 'expiresAt', 'id', 'ipAddress', 'token', 'updatedAt', 'userAgent', 'userId',
    ]);
    expect(colsOf(account)).toEqual([
      'accessToken', 'accessTokenExpiresAt', 'accountId', 'createdAt', 'id', 'idToken', 'password',
      'providerId', 'refreshToken', 'refreshTokenExpiresAt', 'scope', 'updatedAt', 'userId',
    ]);
    expect(colsOf(verification)).toEqual(['createdAt', 'expiresAt', 'id', 'identifier', 'updatedAt', 'value']);
  });

  it('is included in the aggregate schema under the singular keys', () => {
    expect(schema).toMatchObject({ user, session, account, verification });
  });
});
