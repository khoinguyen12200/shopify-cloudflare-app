import { integer, text } from "drizzle-orm/sqlite-core";

/**
 * A money column pair.
 *
 * ALWAYS use this for money. It exists so nobody can reach for `real()` — D1 is
 * SQLite, `REAL` is an IEEE-754 double, and SQLite has no fixed-point decimal
 * type, so `INTEGER` minor units is the only safe representation. See
 * `app/money/types.ts` for the demonstration.
 *
 * It emits TWO columns, because an amount without its currency is meaningless and
 * a single column is how they drift apart:
 *
 *   ...money("total")                        →  total_amount, total_currency
 *   ...money("rewardFixed", "reward_fixed")  →  reward_fixed_amount, …_currency
 *
 * `columnPrefix` defaults to the field name, which is right for a single-word
 * one. **Pass it explicitly for anything camelCase** — the whole schema is
 * snake_case, and `money("rewardFixed")` on its own emits `rewardFixed_amount`,
 * which you only notice by reading the generated migration.
 *
 * Read them back through `fromMinorUnits(row.totalAmount, currency)`, which
 * refuses a non-integer — so a column that somehow holds a float is caught at the
 * boundary rather than silently formatted.
 */
export function money<Name extends string>(name: Name, columnPrefix: string = name) {
  return {
    [`${name}Amount`]: integer(`${columnPrefix}_amount`).notNull(),
    [`${name}Currency`]: text(`${columnPrefix}_currency`).notNull(),
  } as {
    // `ReturnType<typeof integer>` is the builder BEFORE `.notNull()`, so it
    // would type a NOT NULL column as `number | null` and push a null the
    // database cannot produce through every reader. Carry the notNull through.
    [K in `${Name}Amount`]: ReturnType<ReturnType<typeof integer>["notNull"]>;
  } & {
    [K in `${Name}Currency`]: ReturnType<ReturnType<typeof text>["notNull"]>;
  };
}

/**
 * The nullable variant, for an amount that may genuinely be absent. Here the
 * nullability in the type is correct, so it stays.
 */
export function nullableMoney<Name extends string>(
  name: Name,
  columnPrefix: string = name,
) {
  return {
    [`${name}Amount`]: integer(`${columnPrefix}_amount`),
    [`${name}Currency`]: text(`${columnPrefix}_currency`),
  } as {
    [K in `${Name}Amount`]: ReturnType<typeof integer>;
  } & {
    [K in `${Name}Currency`]: ReturnType<typeof text>;
  };
}
