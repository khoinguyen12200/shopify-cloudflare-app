/**
 * Narrow a value a test has just proven is present, failing loudly with a
 * message when it is not. Replaces the non-null assertion (`!`), which tells the
 * compiler a lie instead of checking it.
 */
export function defined<T>(value: T | null | undefined, what = "value"): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what} to be defined`);
  }
  return value;
}
