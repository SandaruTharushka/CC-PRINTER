export function formatCurrency(value: number | null | undefined): string {
  const n = value == null || isNaN(value as number) ? 0 : (value as number);
  return `LKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCurrencyShort(value: number | null | undefined): string {
  const n = value == null || isNaN(value as number) ? 0 : (value as number);
  return `LKR ${Math.round(n).toLocaleString('en-US')}`;
}
