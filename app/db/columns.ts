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
 *   ...money("total")   →   total_amount INTEGER, total_currency TEXT
 *
 * Read them back through `fromMinorUnits(row.totalAmount, currency)`, which
 * refuses a non-integer — so a column that somehow holds a float is caught at the
 * boundary rather than silently formatted.
 */
export function money<Name extends string>(name: Name) {
  return {
    [`${name}Amount`]: integer(`${name}_amount`).notNull(),
    [`${name}Currency`]: text(`${name}_currency`).notNull(),
  } as {
    [K in `${Name}Amount`]: ReturnType<typeof integer>;
  } & {
    [K in `${Name}Currency`]: ReturnType<typeof text>;
  };
}

/** The nullable variant, for an amount that may genuinely be absent. */
export function nullableMoney<Name extends string>(name: Name) {
  return {
    [`${name}Amount`]: integer(`${name}_amount`),
    [`${name}Currency`]: text(`${name}_currency`),
  } as {
    [K in `${Name}Amount`]: ReturnType<typeof integer>;
  } & {
    [K in `${Name}Currency`]: ReturnType<typeof text>;
  };
}
