---
description: Money is integer minor units plus a currency, always together, never a float. Everything enters through app/money and nothing else parses, stores, or formats an amount. Apply whenever an amount, price, total, tax, discount, or refund is read, written, computed, or displayed.
globs:
  - "app/money/**"
  - "app/models/**"
  - "app/services/**"
  - "app/db/**"
  - "app/routes/**"
alwaysApply: true
---

# Money

```
NEVER A FLOAT. INTEGER MINOR UNITS AND A CURRENCY, ALWAYS TOGETHER.
```

## Why, demonstrated in this project's own D1

```
0.1 + 0.2          →  0.30000000000000004
0.1 + 0.2 = 0.3    →  0  (false)
ROUND(0.615, 2)    →  0.61   ← not 0.62; 0.615 is really 0.6149999… in binary
```

D1 is SQLite, so `REAL` exists and it is an IEEE-754 double. **SQLite has no
fixed-point decimal type at all** — its `NUMERIC` is a type *affinity*, not
`DECIMAL(10,2)`. So there is nothing in D1 to store money in safely except
`INTEGER`.

That last line is the one that bites: because `0.615` is really `0.6149999…`,
SQLite rounds it *down*. A tax or discount computed that way is off by a cent
sometimes, which surfaces as "the totals disagree occasionally" — the worst kind
of bug to chase.

**Shopify already protects you and you can throw it away in one call.** In the
Admin schema, `Decimal` is *"a signed decimal number, which supports arbitrary
precision and is **serialized as a string**"* and `Money` is *"a monetary value
**string**"*. They send `"29.99"` deliberately. `parseFloat` on that discards the
protection.

## The rules

**1. Every amount enters through `~/money`.** `fromMoneyV2`, `fromDecimalString`,
or `fromMinorUnits` — nothing else. A GraphQL response whose `amount` is still a
string when it reaches a model or a template is how a `parseFloat` gets added
later by someone who needed a number.

**2. Never `parseFloat` / `Number()` / `+` on a decimal amount.** `Number("0.615")`
is already `0.6149999…` *before* any arithmetic, so rounding afterwards cannot
recover it. The parser works on the digit string.

**3. Never `real()` in a schema.** Use `money("total")` from `~/db/columns`, which
emits `total_amount INTEGER` + `total_currency TEXT`. Two columns because an
amount without its currency is meaningless, and one column is how they drift.

**4. Never `* 100` or `/ 100`.** About twenty currencies are not 2-decimal: JPY,
KRW, VND and CLP have **0**; KWD, BHD, JOD and TND have **3**. A Shopify app sells
in whatever currency the merchant's market uses. `currencyDecimals()` reads it
from `Intl`.

**5. Never `.toFixed()` on money for display.** `formatMoney(locale, money)`.
`toFixed` ignores the locale, so a German merchant sees `19.99` instead of
`19,99`, and it ignores the currency's real decimal count.

**6. Currencies are validated by MEMBERSHIP, not shape.**
`Intl.NumberFormat` accepts any well-formed three-letter code and uses it as the
symbol, so `"ZZZ"` passes and a typo reaches the database looking valid.
`toCurrency()` checks `Intl.supportedValuesOf("currency")` — the real list.

**7. Arithmetic goes through `~/money`, and refuses mismatched currencies.**
`add`, `subtract`, `sum`, `multiply`, `applyRate`, `allocate`, `compare`. Adding
500 JPY to 500 USD is a bug, and this is the only place it can be caught.

**8. `applyRate` requires a rounding mode, with no default.** There is no
universally correct choice — tax authorities differ — and a silent default means
the difference shows up as unexplained variance in someone's books. Prefer
`half_away_from_zero` so a refund and a charge of the same magnitude round
symmetrically; `half_up` sends -0.5 to 0 and +0.5 to 1.

**9. Splitting a total uses `allocate`, never division.** Dividing $10.00 three
ways and rounding gives $9.99, and the missing cent turns up later as an
unbalanced order. `allocate` uses largest-remainder and **always** sums back to
the input — asserted by a property test over a thousand inputs.

**10. Extra precision is REFUSED, not truncated.** `fromDecimalString` fails with
`precision_loss` when the input has more decimals than the currency holds.
Shopify's own docs use `"29.999"` as an example, and quietly dropping the third
decimal loses a tenth of a cent per line, which reconciles to a real discrepancy
at volume. Pass `allowRounding` only where you have *decided* rounding is
correct.

## Reading and writing the database

```ts
// WRITE — store the integer and the currency together.
await db.insert(orders).values({
  totalAmount: money.amount,
  totalCurrency: money.currency,
});

// READ — back through fromMinorUnits, which refuses a non-integer, so a column
// that somehow holds a float is caught at the boundary rather than formatted.
const total = fromMinorUnits(row.totalAmount, currency);
if (!total.ok) return total;
```

## Sending money back to Shopify

`toMoneyV2(money)` → `{ amount: "29.99", currencyCode: "USD" }`. Built from the
digits, so the round trip is exact — `(1999 / 100).toFixed(2)` happens to work at
small values and stops being reliable as they grow.

## Red flags — stop

- `parseFloat`, `Number(...)`, or unary `+` on anything that came from a money field
- `real()` or `numeric()` in a Drizzle schema
- `* 100`, `/ 100`, `Math.round(x * 100) / 100`
- `.toFixed(2)` anywhere near a price
- A `price: number` field with no currency beside it
- An amount added, compared, or summed without going through `~/money`
- `allowRounding: true` with no comment saying why the loss is acceptable
- A currency stored as a plain `string` that never passed `toCurrency`
