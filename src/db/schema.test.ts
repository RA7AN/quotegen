import { describe, expect, it } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { clients, documents, events, signoffBlocks, schema } from './schema';

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
    expect(colsOf(clients)).toEqual(['createdAt', 'data', 'id', 'name', 'updatedAt', 'userId']);
    expect(colsOf(signoffBlocks)).toEqual(['createdAt', 'data', 'id', 'label', 'updatedAt', 'userId']);
  });

  it('aggregates the tables for drizzle(client, { schema })', () => {
    expect(schema).toMatchObject({ documents, events, clients, signoffBlocks });
  });
});
