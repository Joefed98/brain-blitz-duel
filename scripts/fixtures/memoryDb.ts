// A tiny in-memory stand-in for the service-role Supabase client: enough of
// from().select()/.update()/.eq()/.lt()/.gt()/.order()/.maybeSingle() for the guarded
// room writes in src/lib/duel/roomPhase.server.ts. Every write records the
// table it touched, so checks can prove what was (and wasn't) written.
// insert() appends rows (the beta recording tables); `unique` lists a table's
// unique key, and a clashing insert returns Postgres's 23505 like the real one.
type Row = Record<string, unknown>;

export function memoryDb(
  tables: Record<string, Row[]>,
  options: { unique?: Record<string, string[]> } = {},
) {
  const writes: { table: string; values: Row; matched: number }[] = [];
  const client = {
    from(table: string) {
      return {
        select() {
          const conditions: ((row: Row) => boolean)[] = [];
          const rows = () =>
            (tables[table] ?? []).filter((row) => conditions.every((test) => test(row)));
          const query = {
            eq: (key: string, value: unknown) => (
              conditions.push((row) => row[key] === value),
              query
            ),
            order: () => query,
            maybeSingle: async () => {
              const found = rows()[0];
              return { data: found ? structuredClone(found) : null, error: null };
            },
            then: (resolve: (result: { data: Row[]; error: null }) => void) =>
              resolve({ data: rows().map((row) => structuredClone(row)), error: null }),
          };
          return query;
        },
        insert(values: Row | Row[]) {
          const list = Array.isArray(values) ? values : [values];
          const key = options.unique?.[table];
          const rows = (tables[table] ??= []);
          for (const value of list) {
            if (key && rows.some((row) => key.every((k) => row[k] === value[k]))) {
              writes.push({ table, values: value, matched: 0 });
              return Promise.resolve({
                data: null,
                error: { code: "23505", message: `duplicate key value violates unique constraint on ${table}` },
              });
            }
            rows.push(structuredClone(value));
            writes.push({ table, values: value, matched: 1 });
          }
          return Promise.resolve({ data: null, error: null });
        },
        update(values: Row) {
          const conditions: ((row: Row) => boolean)[] = [];
          let selecting = false;
          const run = () => {
            const rows = (tables[table] ??= []).filter((row) =>
              conditions.every((test) => test(row)),
            );
            for (const row of rows) Object.assign(row, values);
            writes.push({ table, values, matched: rows.length });
            return rows;
          };
          const query = {
            eq: (key: string, value: unknown) => (
              conditions.push((row) => row[key] === value),
              query
            ),
            lt: (key: string, value: number) => (
              conditions.push((row) => (row[key] as number) < value),
              query
            ),
            gt: (key: string, value: string) => (
              conditions.push((row) => String(row[key]) > value),
              query
            ),
            select: () => ((selecting = true), query),
            maybeSingle: async () => {
              const rows = run();
              return { data: rows[0] ? { ...rows[0] } : null, error: null };
            },
            then: (resolve: (result: { data: Row[] | null; error: null }) => void) => {
              const rows = run();
              resolve({ data: selecting ? rows : null, error: null });
            },
          };
          return query;
        },
      };
    },
  };
  return { client, tables, writes };
}
