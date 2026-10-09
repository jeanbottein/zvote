const counts = new Intl.NumberFormat('en');

/** "1,234,567": counts can run to billions. */
export function formatCount(count: number): string {
  return counts.format(count);
}
