/** Split `items` into consecutive slices of at most `size`, preserving order. */
export function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  const slices: (readonly T[])[] = [];
  for (let index = 0; index < items.length; index += size) slices.push(items.slice(index, index + size));
  return slices;
}
