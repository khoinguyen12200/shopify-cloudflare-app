import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { money, nullableMoney } from "./columns";

const rewards = sqliteTable("rewards", {
  id: text("id").primaryKey(),
  ...money("rewardFixed", "reward_fixed"),
});

const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  ...money("total"),
  ...nullableMoney("refund", "refund"),
});

describe("money()", () => {
  it("names its columns from the given snake_case prefix, not the field name", () => {
    // The whole schema is snake_case. Interpolating the camelCase TS field name
    // straight into the column name emits `rewardFixed_amount`, which only
    // shows up once you read the generated migration.
    const cols = getTableColumns(rewards);
    expect(cols.rewardFixedAmount.name).toBe("reward_fixed_amount");
    expect(cols.rewardFixedCurrency.name).toBe("reward_fixed_currency");
  });

  it("defaults the prefix to the field name, so single-word calls are unchanged", () => {
    const cols = getTableColumns(orders);
    expect(cols.totalAmount.name).toBe("total_amount");
    expect(cols.totalCurrency.name).toBe("total_currency");
  });

  it("is NOT NULL at runtime", () => {
    const cols = getTableColumns(orders);
    expect(cols.totalAmount.notNull).toBe(true);
    expect(cols.totalCurrency.notNull).toBe(true);
  });

  it("types the amount as number, never number | null", () => {
    // The real assertion here is `npm run typecheck`: the cast inside money()
    // used `ReturnType<typeof integer>` — the builder BEFORE `.notNull()` — so a
    // NOT NULL column typed as `number | null` and every reader had to handle a
    // null the database cannot produce. This function does not compile unless
    // the nullability survives.
    const readAmount = (row: typeof rewards.$inferSelect): number => row.rewardFixedAmount;
    const readCurrency = (row: typeof rewards.$inferSelect): string =>
      row.rewardFixedCurrency;

    const row = { id: "r1", rewardFixedAmount: 500, rewardFixedCurrency: "USD" };
    expect(readAmount(row)).toBe(500);
    expect(readCurrency(row)).toBe("USD");
  });
});

describe("nullableMoney()", () => {
  it("stays nullable — there the absence is real", () => {
    const cols = getTableColumns(orders);
    expect(cols.refundAmount.notNull).toBe(false);

    const readAmount = (row: typeof orders.$inferSelect): number | null => row.refundAmount;
    expect(readAmount({ id: "o1", totalAmount: 1, totalCurrency: "USD", refundAmount: null, refundCurrency: null })).toBeNull();
  });
});
