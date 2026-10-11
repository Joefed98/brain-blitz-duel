// A tiny in-memory stand-in for the service-role Supabase client: enough of
// from().update()/.eq()/.lt()/.gt()/.select().maybeSingle() for the guarded
// room writes in src/lib/duel/roomPhase.server.ts. Every write records the
// table it touched, so checks can prove what was (and wasn't) written.
type Row = Record<string, unknown>;

export function memoryDb(tables: Record<string, Row[]>) {
  const writes: { table: string; values: Row; matched: number }[] = [];
  const client = {
    from(table: string) {
      return {
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
